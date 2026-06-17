import { useState, useEffect } from "react";
import { ParsedSpin } from "../types";
import { SECTOR_DEFINITIONS } from "../data";
import { Calendar, HelpCircle, Trophy, User, Zap, CircleAlert, ChevronLeft, ChevronRight, Sparkles, Clock, Star, BarChart4 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface HistoryGridProps {
  spins: ParsedSpin[];
  selectedFilter: string;
  onChangeFilter: (filter: string) => void;
}

export default function HistoryGrid({ spins, selectedFilter, onChangeFilter }: HistoryGridProps) {
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilter, spins.length]);

  const filteredSpins = spins.filter((spin) => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "bonus") return spin.isBonus;
    return spin.sectorKey === selectedFilter;
  });

  const formatHour = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatTimeFull = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const formatDateFull = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

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

  const getSectorIcon = (key: string) => {
    if (key === "1") return "1";
    if (key === "2") return "2";
    if (key === "5") return "5";
    if (key === "10") return "10";
    if (key === "CoinFlip") return "🪙";
    if (key === "Pachinko") return "🔴";
    if (key === "CashHunt") return "🎯";
    if (key === "CrazyTime") return "🎡";
    return key;
  };

  // Statistics summary
  const recentSpins = filteredSpins.slice(0, 32);
  const statBonuses = recentSpins.filter(s => s.isBonus).length;
  const statTopSlots = recentSpins.filter(s => s.isTopSlotMatched).length;
  const statAvgMult = recentSpins.reduce((a, s) => a + s.maxMultiplier, 0) / Math.max(1, recentSpins.length);

  // Pagination parameters
  const ITEMS_PER_PAGE = 32;
  const totalPages = Math.ceil(filteredSpins.length / ITEMS_PER_PAGE);
  const activePage = Math.min(currentPage, Math.max(1, totalPages));
  const displayedSpins = filteredSpins.slice(
    (activePage - 1) * ITEMS_PER_PAGE,
    activePage * ITEMS_PER_PAGE
  );

  return (
    <div className="glass-panel p-6 rounded-2xl w-full overflow-visible" id="history-grid-section">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-5">
        <div>
          <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Trophy size={18} className="text-[#ec4899]" />
            Grade do Histórico de Resultados
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            {filteredSpins.length} resultados • Página {activePage} de {totalPages}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => onChangeFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all font-medium cursor-pointer ${
              selectedFilter === "all"
                ? "bg-white/15 text-white border border-white/20"
                : "text-gray-400 hover:text-white bg-white/[0.02] border border-transparent hover:bg-white/[0.04]"
            }`}
          >Tudo</button>
          <button
            onClick={() => onChangeFilter("bonus")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all font-medium flex items-center gap-1 cursor-pointer ${
              selectedFilter === "bonus"
                ? "bg-pink-500/20 text-pink-300 border border-pink-500/30"
                : "text-gray-400 hover:text-white bg-white/[0.02] border border-transparent hover:bg-white/[0.04]"
            }`}
          >Bônus</button>
          <div className="h-4 w-[1px] bg-white/10 mx-1 hidden sm:block" />
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
            >{getAbbreviation(def.key)}</button>
          ))}
        </div>
      </div>

      {/* Mini Stats Bar */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
        {[
          { label: "Bônus (32g)", value: statBonuses, color: "text-pink-400", icon: Star },
          { label: "Top Slot", value: statTopSlots, color: "text-amber-400", icon: Zap },
          { label: "Média Mult", value: statAvgMult.toFixed(1) + "x", color: "text-cyan-400", icon: BarChart4 },
          { label: "Total Filtro", value: filteredSpins.length, color: "text-emerald-400", icon: Trophy },
          { label: "Pág. Atual", value: `${activePage}/${totalPages}`, color: "text-indigo-400", icon: ChevronRight },
          { label: "Por Pág.", value: `${ITEMS_PER_PAGE} chips`, color: "text-slate-400", icon: Clock },
        ].map(stat => (
          <div key={stat.label} className="bg-white/[0.02] border border-white/5 rounded-xl p-2 flex items-center gap-2">
            <stat.icon size={14} className={stat.color} />
            <div className="min-w-0">
              <div className="text-[9px] text-slate-500 uppercase tracking-wider truncate">{stat.label}</div>
              <div className={`text-xs font-bold font-mono ${stat.color}`}>{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="relative overflow-visible" id="spins-chips-stage">
        {filteredSpins.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white/[0.01] rounded-2xl border border-white/5 text-center">
            <CircleAlert className="text-gray-500 mb-2" size={28} />
            <span className="text-sm text-gray-300 font-semibold">Nenhum resultado corresponde ao filtro</span>
            <span className="text-xs text-gray-500 mt-1">Tente alternar para outra categoria ou limpar a seleção</span>
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-8 gap-2 relative overflow-visible">
            <AnimatePresence mode="popLayout">
              {displayedSpins.map((spin, idx) => {
                const spec = getSectorDetail(spin.sectorKey);
                const colorHex = spec?.color || "#d4a84c";
                const isHovered = activeTooltipId === spin.id;
                const isLatest = idx === 0 && activePage === 1;
                const indicatorText = spin.isBonus ? `${spin.maxMultiplier}x` : formatHour(spin.settledAt);

                // Opacity gradient: newer = brighter, older = dimmer
                const opacityFactor = Math.max(0.5, 1 - (idx / displayedSpins.length) * 0.5);

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
                    animate={{
                      scale: 1,
                      opacity: opacityFactor,
                      boxShadow: isLatest
                        ? ['0 0 0px rgba(255,255,255,0)', '0 0 12px rgba(255,255,255,0.3)', '0 0 0px rgba(255,255,255,0)']
                        : undefined
                    }}
                    transition={isLatest ? {
                      duration: 0.2,
                      boxShadow: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
                    } : { duration: 0.2 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                  >
                    {/* Top Slot Badge */}
                    {!spin.isBonus && spin.isTopSlotMatched && spin.topSlot?.multiplier && (
                      <div className="absolute -top-2 -right-2 bg-gradient-to-br from-amber-400 to-rose-500 text-white font-extrabold text-[7px] leading-none px-1.5 py-0.5 rounded-md shadow-lg z-10 animate-pulse pointer-events-none border border-white/30">
                        {spin.topSlot.multiplier}x
                      </div>
                    )}

                    {/* Bonus Badge */}
                    {spin.isBonus && (
                      <div className="absolute -top-2 -right-2 bg-gradient-to-br from-pink-500 to-purple-600 text-white font-extrabold text-[7px] leading-none px-1.5 py-0.5 rounded-md shadow-lg z-10 animate-pulse pointer-events-none border border-white/30 flex items-center gap-0.5">
                        <Sparkles size={7} /> {spin.maxMultiplier}x
                      </div>
                    )}

                    {/* Mini Sector Icon + Indicator */}
                    <div
                      className={`w-full aspect-square rounded-xl flex flex-col justify-center items-center transition-all duration-300 select-none border-2 relative overflow-hidden ${
                        isHovered ? "scale-105 shadow-xl z-20" : "hover:scale-[1.03]"
                      }`}
                      style={{
                        backgroundColor: isLatest ? `${colorHex}25` : `${colorHex}12`,
                        borderColor: isHovered ? colorHex : isLatest ? `${colorHex}70` : `${colorHex}30`,
                        boxShadow: isHovered ? `0 0 20px ${colorHex}40` : isLatest ? `0 0 8px ${colorHex}30` : "none",
                        opacity: opacityFactor
                      }}
                    >
                      {/* Background glow */}
                      <div
                        className="absolute inset-0 opacity-20"
                        style={{
                          background: `radial-gradient(circle at 50% 50%, ${colorHex}40 0%, transparent 70%)`
                        }}
                      />

                      {/* Newest indicator */}
                      {isLatest && (
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white to-transparent" />
                      )}

                      {/* Sector Icon */}
                      <span
                        className="font-display font-black text-sm leading-none relative z-10"
                        style={{ color: isHovered ? colorHex : (isLatest ? '#fff' : `${colorHex}cc`) }}
                      >
                        {getSectorIcon(spin.sectorKey)}
                      </span>

                      {/* Indicator text */}
                      <span
                        className="font-mono text-[8px] font-medium mt-0.5 relative z-10"
                        style={{ color: isHovered ? '#fff' : `${colorHex}99` }}
                      >
                        {indicatorText}
                      </span>
                    </div>

                    {/* Tooltip */}
                    {isHovered && (
                      <div
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-40 w-56 pointer-events-none"
                      >
                        <div
                          className="glass-panel rounded-2xl p-3 shadow-2xl border transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
                          style={{
                            borderColor: `${colorHex}50`,
                            boxShadow: `0 10px 30px -5px rgba(0,0,0,0.8), 0 0 15px ${colorHex}15`
                          }}
                        >
                          {/* Title */}
                          <div className="flex items-center gap-1.5 border-b border-white/10 pb-2">
                            <div
                              className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-black border"
                              style={{
                                backgroundColor: `${colorHex}15`,
                                borderColor: colorHex,
                                color: colorHex
                              }}
                            >{getAbbreviation(spin.sectorKey)}</div>
                            <span className="font-display font-extrabold text-xs text-white">{spin.displayName}</span>
                            <span className="ml-auto font-mono text-[9px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">
                              #{filteredSpins.length - (idx + ((activePage - 1) * ITEMS_PER_PAGE))}
                            </span>
                          </div>

                          {/* Stats */}
                          <div className="flex flex-col gap-1 text-[10px] font-mono text-gray-300 mt-2">
                            <div className="flex justify-between items-center bg-white/[0.02] p-1.5 rounded-lg border border-white/[0.04]">
                              <span className="text-gray-400">Multiplicador:</span>
                              <span className="font-bold" style={{ color: colorHex }}>{spin.maxMultiplier}x</span>
                            </div>

                            {/* Crazy Time Flapper */}
                            {spin.sectorKey === "CrazyTime" && (
                              <div className="p-2 border border-white/5 bg-black/35 rounded-xl flex flex-col gap-1">
                                <span className="text-slate-400 text-[9px] font-bold uppercase">Por Flapper:</span>
                                {["Green", "Blue", "Yellow"].map(c => {
                                  const colorName = c === "Green" ? "Verde" : c === "Blue" ? "Azul" : "Amarelo";
                                  const isActive = spin.activeFlapperColor === c;
                                  return (
                                    <div key={c} className={`flex justify-between items-center p-1 px-1.5 rounded-md text-[9px] ${isActive ? "bg-white/10 font-extrabold" : "text-slate-400"}`}>
                                      <span>{c === "Green" ? "🟢" : c === "Blue" ? "🔵" : "🟡"} {colorName}</span>
                                      <span>{(spin.crazyTimeFlappers as any)?.[c] || spin.maxMultiplier}x {isActive && "✓"}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Top Slot */}
                            {spin.topSlot ? (
                              <div className="p-1.5 rounded-lg bg-[#d4a84c]/5 border border-[#d4a84c]/10">
                                <div className="flex justify-between text-[9px]">
                                  <span className="text-gray-400">Top:</span>
                                  <span className="text-white font-bold">{spin.topSlot.displayName}</span>
                                </div>
                                <div className="flex justify-between text-[9px]">
                                  <span className="text-gray-400">Mult:</span>
                                  <span className="text-[#d4a84c] font-bold">{spin.topSlot.multiplier}x</span>
                                </div>
                                <div className="flex justify-between text-[9px] border-t border-white/5 mt-0.5 pt-0.5">
                                  <span className="text-gray-400">Match:</span>
                                  <span className={spin.isTopSlotMatched ? "text-emerald-400 font-bold" : "text-gray-500"}>{spin.isTopSlotMatched ? "SIM ✓" : "NÃO"}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-between p-1.5 rounded-lg bg-white/[0.02] text-[9px]">
                                <span className="text-gray-500">Top Slot:</span>
                                <span className="text-gray-500">Nenhum</span>
                              </div>
                            )}

                            {/* Winners & Payout */}
                            <div className="flex gap-1.5 text-[8px] text-gray-400 border-t border-white/5 pt-1.5 mt-0.5">
                              <div className="flex items-center gap-1">
                                <User size={8} />
                                <span>{spin.totalWinners.toLocaleString("pt-BR")}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Trophy size={8} />
                                <span className="text-emerald-400">€{spin.totalAmount.toLocaleString("pt-BR")}</span>
                              </div>
                            </div>
                          </div>

                          {/* Footer */}
                          <div className="border-t border-white/5 pt-1.5 mt-1.5 text-[8px] font-mono text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar size={7} /> {formatDateFull(spin.settledAt)} • {formatTimeFull(spin.settledAt)}
                            </div>
                            <div>{spin.dealerName}</div>
                          </div>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-5 border-t border-white/[0.04] select-none">
          <span className="text-[10px] font-mono text-slate-400">
            Exibindo <strong className="text-white">{Math.min(filteredSpins.length, (activePage - 1) * ITEMS_PER_PAGE + 1)}-{Math.min(filteredSpins.length, activePage * ITEMS_PER_PAGE)}</strong> de <strong className="text-white">{filteredSpins.length}</strong> giros
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

      {/* Footer note */}
      <p className="text-[10px] text-gray-500 mt-5 font-mono leading-relaxed">
        * Bônus mostram o multiplicador final da partida. Números (1, 2, 5, 10) mostram o horário do giro para sincronismo temporal. 🟢🟡🔵 indicam o flapper ativo no Crazy Time.
      </p>
    </div>
  );
}
