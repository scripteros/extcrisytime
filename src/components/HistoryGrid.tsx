import { useState, useEffect } from "react";
import { ParsedSpin } from "../types";
import { SECTOR_DEFINITIONS } from "../data";
import { Calendar, HelpCircle, Trophy, User, Zap, CircleAlert, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface HistoryGridProps {
  spins: ParsedSpin[];
  selectedFilter: string; // "all" | "bonus" | sectorKey
  onChangeFilter: (filter: string) => void;
}

export default function HistoryGrid({ spins, selectedFilter, onChangeFilter }: HistoryGridProps) {
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilter, spins.length]);

  // Filter spins
  const filteredSpins = spins.filter((spin) => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "bonus") return spin.isBonus;
    return spin.sectorKey === selectedFilter;
  });

  // Helper to extract HH:MM
  const formatHour = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  // Helper to extract HH:MM:SS
  const formatTimeFull = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const formatDateFull = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  // Get display details for any sector key
  const getSectorDetail = (key: string) => {
    return SECTOR_DEFINITIONS.find((s) => s.key === key);
  };

  const getAbbreviation = (key: string) => {
    if (key === "CoinFlip") return "CF";
    if (key === "Pachinko") return "PK";
    if (key === "CashHunt") return "CH";
    if (key === "CrazyTime") return "CT";
    return key;
  };

  // Pagination parameters
  const ITEMS_PER_PAGE = 14;
  const totalPages = Math.ceil(filteredSpins.length / ITEMS_PER_PAGE);
  
  // Auto-adjust page if out of bounds
  const activePage = Math.min(currentPage, Math.max(1, totalPages));
  const displayedSpins = filteredSpins.slice(
    (activePage - 1) * ITEMS_PER_PAGE,
    activePage * ITEMS_PER_PAGE
  );

  return (
    <div className="glass-panel p-6 rounded-2xl w-full overflow-visible" id="history-grid-section">
      {/* Header and Filter bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Trophy size={18} className="text-[#ec4899]" />
            Grade do Histórico de Resultados
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Visualização de chips coloridos dos últimos 100 sorteios (mais recente no início)
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-1.5" id="history-filter-controls">
          <button
            onClick={() => onChangeFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all font-medium cursor-pointer ${
              selectedFilter === "all"
                ? "bg-white/15 text-white border border-white/20"
                : "text-gray-400 hover:text-white bg-white/[0.02] border border-transparent hover:bg-white/[0.04]"
            }`}
          >
            Tudo
          </button>
          
          <button
            onClick={() => onChangeFilter("bonus")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all font-medium flex items-center gap-1 cursor-pointer ${
              selectedFilter === "bonus"
                ? "bg-pink-500/20 text-pink-300 border border-pink-500/30"
                : "text-gray-400 hover:text-white bg-white/[0.02] border border-transparent hover:bg-white/[0.04]"
            }`}
          >
            Bônus
          </button>

          <div className="h-4 w-[1px] bg-white/10 mx-1 hidden sm:block" />

          {/* Individual Sector Quick Selectors */}
          <div className="flex flex-wrap gap-1">
            {SECTOR_DEFINITIONS.map((def) => (
              <button
                key={def.key}
                onClick={() => onChangeFilter(def.key)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all font-semibold cursor-pointer ${
                  selectedFilter === def.key
                    ? "bg-white/15 text-white border border-white/35"
                    : "text-gray-400 hover:text-white bg-white/[0.01] border border-transparent"
                }`}
                style={{
                  color: selectedFilter === def.key ? undefined : def.color,
                  backgroundColor: selectedFilter === def.key ? undefined : `${def.color}08`,
                  borderColor: selectedFilter === def.key ? def.color : "transparent"
                }}
              >
                {getAbbreviation(def.key)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid container with overflow-visible to support tooltips */}
      <div className="relative overflow-visible" id="spins-chips-stage">
        {filteredSpins.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white/[0.01] rounded-2xl border border-white/5 text-center">
            <CircleAlert className="text-gray-500 mb-2" size={28} />
            <span className="text-sm text-gray-300 font-semibold">Nenhum resultado corresponde ao filtro</span>
            <span className="text-xs text-gray-500 mt-1">Tente alternar para outra categoria ou limpar a seleção</span>
          </div>
        ) : (
          <motion.div 
            layout
            className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-7 lg:grid-cols-14 gap-3 relative overflow-visible"
          >
            <AnimatePresence mode="popLayout">
              {displayedSpins.map((spin) => {
                const spec = getSectorDetail(spin.sectorKey);
                const colorHex = spec?.color || "#d4a84c";
                const isHovered = activeTooltipId === spin.id;
                
                // Content of the indicator check:
                // For a bonus -> show multiplier (e.g. 25x).
                // For a number -> show hour (e.g. 13:24)
                const indicatorText = spin.isBonus ? `${spin.maxMultiplier}x` : formatHour(spin.settledAt);

                return (
                  <motion.div
                    layout
                    id={`chip-${spin.id}`}
                    key={spin.id}
                    className="relative group cursor-help overflow-visible"
                    onMouseEnter={() => setActiveTooltipId(spin.id)}
                    onMouseLeave={() => setActiveTooltipId(null)}
                    onClick={() => setActiveTooltipId(isHovered ? null : spin.id)}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Corner Multiplier Badge for Numbers with Top Slot matched */}
                    {!spin.isBonus && spin.isTopSlotMatched && spin.topSlot?.multiplier && (
                      <div className="absolute -top-1.5 -right-1.5 bg-gradient-to-br from-[#d4a84c] to-[#ec4899] text-black font-extrabold text-[8px] leading-none px-1.5 py-0.5 rounded-md shadow-lg shadow-black/80 border border-white/20 z-10 select-none animate-pulse pointer-events-none flex items-center justify-center">
                        {spin.topSlot.multiplier}x
                      </div>
                    )}

                    {/* Chip layout */}
                    <div
                      className={`w-full aspect-[4/3] rounded-xl flex flex-col justify-center items-center transition-all duration-300 select-none border-2 p-1 text-center ${
                        isHovered 
                          ? "scale-105 shadow-xl bg-opacity-30 border-opacity-100" 
                          : "bg-opacity-15 border-opacity-35 hover:bg-opacity-25 hover:border-opacity-60"
                      }`}
                      style={{
                        backgroundColor: `${colorHex}15`,
                        borderColor: isHovered ? colorHex : `${colorHex}45`,
                        boxShadow: isHovered ? `0 0 15px ${colorHex}50` : "none"
                      }}
                    >
                      {/* Name tag */}
                      <span 
                        className="font-display font-black text-xs leading-none tracking-tight flex items-center gap-1"
                        style={{ color: colorHex }}
                      >
                        {getAbbreviation(spin.sectorKey)}
                        {spin.sectorKey === "CrazyTime" && spin.activeFlapperColor && (
                          <span className={`w-1.5 h-1.5 rounded-full inline-block ${
                            spin.activeFlapperColor === "Green" ? "bg-emerald-400 shadow-[0_0_4px_#34d399]" :
                            spin.activeFlapperColor === "Blue" ? "bg-blue-400 shadow-[0_0_4px_#60a5fa]" :
                            "bg-amber-400 shadow-[0_0_4px_#fbbf24]"
                          }`} />
                        )}
                      </span>
                      
                      {/* Indicator text (Time or multiplier) */}
                      <span className="font-mono text-[9px] font-medium text-gray-300 mt-1 block truncate w-full">
                        {indicatorText}
                      </span>
                    </div>

                    {/* Highly stylized Tooltip */}
                    {isHovered && (
                      <div
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3.5 z-40 w-56 glass-panel rounded-2xl p-3 shadow-2xl border pointer-events-none text-left flex flex-col gap-2 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
                        style={{
                          borderColor: `${colorHex}50`,
                          boxShadow: `0 10px 30px -5px rgba(0,0,0,0.8), 0 0 15px ${colorHex}15`
                        }}
                      >
                        {/* Title of sector */}
                        <div className="flex items-center gap-1.5 border-b border-white/10 pb-2">
                          <div
                            className="w-5 h-5 rounded font-display text-[9px] font-black flex items-center justify-center text-white border"
                            style={{
                              backgroundColor: `${colorHex}15`,
                              borderColor: colorHex,
                            }}
                          >
                            <span style={{ color: colorHex }}>{getAbbreviation(spin.sectorKey)}</span>
                          </div>
                          
                          <span className="font-display font-extrabold text-xs text-white">
                            {spin.displayName}
                          </span>

                          <span className="ml-auto font-mono text-[9px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">
                            {spin.isBonus ? "BÔNUS" : "NÚMERO"}
                          </span>
                        </div>

                        {/* Stats Body */}
                        <div className="flex flex-col gap-1.5 text-[10px] font-mono text-gray-300">
                          {/* Multiplier result */}
                          <div className="flex justify-between items-center bg-white/[0.02] p-1.5 rounded-lg border border-white/[0.04]">
                            <span className="text-gray-400">Multiplicador Final:</span>
                            <span className="font-bold text-[#d4a84c] text-xs">
                              {spin.maxMultiplier}x
                            </span>
                          </div>

                          {/* Crazy Time Flapper Comparison */}
                          {spin.sectorKey === "CrazyTime" && (
                            <div className="p-2 border border-white/5 bg-black/35 rounded-xl flex flex-col gap-1.5">
                              <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wider block">Multiplicador por Flapper:</span>
                              <div className="flex flex-col gap-1 text-[9.5px]">
                                <div className={`flex justify-between items-center p-1 px-1.5 rounded-md ${spin.activeFlapperColor === "Green" ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-extrabold" : "text-slate-400"}`}>
                                  <span className="flex items-center gap-1">🟢 <span className="font-sans">Verde</span></span>
                                  <span>{spin.crazyTimeFlappers?.Green || spin.maxMultiplier}x {spin.activeFlapperColor === "Green" && "🎯"}</span>
                                </div>
                                <div className={`flex justify-between items-center p-1 px-1.5 rounded-md ${spin.activeFlapperColor === "Blue" ? "bg-blue-500/10 border border-blue-500/25 text-blue-300 font-extrabold" : "text-slate-400"}`}>
                                  <span className="flex items-center gap-1">🔵 <span className="font-sans">Azul</span></span>
                                  <span>{spin.crazyTimeFlappers?.Blue || spin.maxMultiplier}x {spin.activeFlapperColor === "Blue" && "🎯"}</span>
                                </div>
                                <div className={`flex justify-between items-center p-1 px-1.5 rounded-md ${spin.activeFlapperColor === "Yellow" ? "bg-amber-500/10 border border-amber-500/25 text-amber-300 font-extrabold" : "text-slate-400"}`}>
                                  <span className="flex items-center gap-1">🟡 <span className="font-sans">Amarelo</span></span>
                                  <span>{spin.crazyTimeFlappers?.Yellow || spin.maxMultiplier}x {spin.activeFlapperColor === "Yellow" && "🎯"}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Top slot information */}
                          {spin.topSlot ? (
                            <div className="p-1.5 rounded-lg bg-[#d4a84c]/5 border border-[#d4a84c]/10 flex flex-col gap-0.5">
                              <div className="flex justify-between">
                                <span className="text-gray-400">Top Slot:</span>
                                <span className="text-white font-bold">{spin.topSlot.displayName}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Multiplicador Slot:</span>
                                <span className="text-[#d4a84c] font-bold">{spin.topSlot.multiplier}x</span>
                              </div>
                              <div className="flex justify-between border-t border-white/5 mt-1 pt-1">
                                <span className="text-gray-400">Sincronizado:</span>
                                <span className={`font-semibold ${spin.isTopSlotMatched ? "text-emerald-400" : "text-gray-500"}`}>
                                  {spin.isTopSlotMatched ? "SIM (Sincronizado!)" : "NÃO"}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between p-1.5 rounded-lg bg-white/[0.02]">
                              <span className="text-gray-500">Top Slot:</span>
                              <span className="text-gray-500">Nenhum</span>
                            </div>
                          )}

                          {/* Detail of winners / amount */}
                          <div className="flex flex-col gap-0.5 border-t border-white/5 pt-1.5 mt-0.5">
                            <div className="flex justify-between text-[9px] text-gray-400">
                              <span className="flex items-center gap-1">
                                <User size={8} /> Ganhadores:
                              </span>
                              <span className="text-white font-medium">{spin.totalWinners.toLocaleString("pt-BR")}</span>
                            </div>
                            <div className="flex justify-between text-[9px] text-gray-400">
                              <span className="flex items-center gap-1">
                                <Trophy size={8} /> Payout:
                              </span>
                              <span className="text-emerald-400 font-medium">
                                €{spin.totalAmount.toLocaleString("pt-BR")}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Full datetime footer */}
                        <div className="border-t border-white/5 pt-2 mt-1 flex flex-col gap-0.5 text-[8px] font-mono text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar size={8} /> {formatDateFull(spin.settledAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Zap size={8} /> {formatTimeFull(spin.settledAt)} UTC
                          </span>
                          <span>Dealer: {spin.dealerName}</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-5 border-t border-white/[0.04] select-none" id="history-pagination-footer">
          <span className="text-[10px] font-mono text-slate-400">
            Exibindo <strong className="text-white">{Math.min(filteredSpins.length, (activePage - 1) * ITEMS_PER_PAGE + 1)}-{Math.min(filteredSpins.length, activePage * ITEMS_PER_PAGE)}</strong> de <strong className="text-white">{filteredSpins.length}</strong> giros filtrados
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={activePage === 1}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all font-bold cursor-pointer border flex items-center gap-1 ${
                activePage === 1
                  ? "opacity-30 border-transparent text-slate-600 pointer-events-none"
                  : "border-white/5 bg-white/[0.02] text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <ChevronLeft size={14} /> Voltar
            </button>

            <span className="text-[10px] font-mono font-bold text-slate-400 px-3 py-1.5 rounded-lg border border-white/5 bg-white/[0.01]">
              Pág. {activePage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={activePage === totalPages}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all font-bold cursor-pointer border flex items-center gap-1 ${
                activePage === totalPages
                  ? "opacity-30 border-transparent text-slate-600 pointer-events-none"
                  : "border-white/5 bg-white/[0.02] text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              Avançar <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Stats explanation/note */}
      <p className="text-[10px] text-gray-500 mt-5 font-mono leading-relaxed" id="history-section-footnote">
        * Para fins analíticos de cassino, as rodadas bônus exibem o multiplicador total atingido na partida (ex: 25x, 500x). Os números regulares (1, 2, 5, 10) mostram o horário exato da extração para fins de sincronismo temporal dos ciclos da mesa.
      </p>
    </div>
  );
}
