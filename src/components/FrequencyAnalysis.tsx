import { SectorDefinition, ParsedSpin } from "../types";
import { SECTOR_DEFINITIONS } from "../data";
import { Check, TrendingUp } from "lucide-react";
import { motion } from "motion/react";

interface FrequencyAnalysisProps {
  allSpins: ParsedSpin[];
  selectedSector: string | null;
  onSelectSector: (key: string | null) => void;
}

export default function FrequencyAnalysis({ allSpins, selectedSector, onSelectSector }: FrequencyAnalysisProps) {
  const totalSpins = allSpins.length || 100;

  // Calculate observations
  const analysisData = SECTOR_DEFINITIONS.map((sector) => {
    const observedCount = allSpins.filter((s) => s.sectorKey === sector.key).length;
    const expectedPercent = sector.theoreticalProbability * 100;
    const expectedCount = totalSpins * sector.theoreticalProbability;
    
    const ratio = expectedCount > 0 ? observedCount / expectedCount : 0;
    
    // Determine Hot / Cold
    let status: "hot" | "cold" | "normal" = "normal";
    if (ratio >= 1.2) status = "hot";
    else if (ratio <= 0.8) status = "cold";

    // Find minutes or spins since last seen
    // (since our array sorted descends, i.e., index 0 is most recent)
    const index = allSpins.findIndex((spin) => spin.sectorKey === sector.key);
    const spinsSince = index === -1 ? totalSpins : index;

    return {
      ...sector,
      observedCount,
      expectedCount,
      expectedPercent,
      ratio,
      status,
      spinsSince,
    };
  });

  // Decide on maximum count for setting progress bar widths (bounds setting)
  const maxVal = Math.max(
    ...analysisData.map((d) => Math.max(d.observedCount, d.expectedCount))
  ) || 40;
  
  // Outer scale factor (add 10% space)
  const renderLimit = maxVal * 1.1;

  return (
    <div className="glass-panel p-6 rounded-2xl w-full" id="frequency-analysis-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp size={18} className="text-[#d4a84c]" />
            Análise de Frequência por Setor
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Contagem real (últimos {totalSpins} giros) vs. Probabilidade teórica da roleta
          </p>
        </div>
        
        {selectedSector && (
          <button
            onClick={() => onSelectSector(null)}
            className="self-start sm:self-center text-[10px] uppercase font-mono px-2.5 py-1 rounded-md border border-[#d4a84c]/20 bg-[#d4a84c]/10 text-[#d4a84c] hover:bg-[#d4a84c]/20 transition-all cursor-pointer"
          >
            Limpar Filtro
          </button>
        )}
      </div>

      {/* Grid Headers */}
      <div className="grid grid-cols-12 text-[10px] uppercase font-mono tracking-wider font-semibold text-gray-500 mb-3 px-2 border-b border-white/5 pb-2">
        <div className="col-span-3 sm:col-span-2">Setor</div>
        <div className="col-span-6 sm:col-span-8 px-1 text-center sm:text-left">Frequência (Real vs. Teórica)</div>
        <div className="col-span-3 sm:col-span-2 text-right">Desde Último</div>
      </div>

      <div className="flex flex-col gap-3.5" id="frequency-rows-container">
        {analysisData.map((item, idx) => {
          const isSelected = selectedSector === item.key;
          const ratioPercent = item.ratio * 100;
          
          // Width percentage calculation for progress bars
          const obsPercentWidth = (item.observedCount / renderLimit) * 100;
          const expPercentWidth = (item.expectedCount / renderLimit) * 100;

          return (
            <motion.div
              type="button"
              id={`freq-row-${item.key}`}
              key={item.key}
              onClick={() => onSelectSector(isSelected ? null : item.key)}
              className={`grid grid-cols-12 items-center px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                isSelected
                  ? "bg-[#d4a84c]/10 border border-[#d4a84c]/40 shadow-md"
                  : "bg-white/[0.01] border border-transparent hover:bg-white/[0.03] hover:border-white/5"
              }`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04 }}
              whileHover={{ scale: 1.005 }}
              whileTap={{ scale: 0.995 }}
            >
              {/* Sector Name / Chip column */}
              <div className="col-span-3 sm:col-span-2 flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg font-display text-xs font-extrabold flex items-center justify-center text-white border transition-shadow duration-300 shadow-sm"
                  style={{
                    backgroundColor: `${item.color}15`,
                    borderColor: `${item.color}80`,
                    textShadow: `0 0 8px ${item.color}30`
                  }}
                >
                  <span style={{ color: item.color }}>{item.displayName}</span>
                </div>
                {isSelected && (
                  <Check size={14} className="text-[#d4a84c] shrink-0" />
                )}
              </div>

              {/* Progress bar container column */}
              <div className="col-span-6 sm:col-span-8 px-2 flex flex-col justify-center select-none relative">
                {/* Text metrics */}
                <div className="flex items-center justify-between text-xs font-mono mb-1.5 px-0.5">
                  <span className="text-white font-medium">
                    {item.observedCount}{" "}
                    <span className="text-gray-500 font-normal">
                      ({((item.observedCount / totalSpins) * 100).toFixed(1)}%)
                    </span>
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-[10px]">
                      Esp: {item.expectedCount.toFixed(1)} ({item.expectedPercent.toFixed(1)}%)
                    </span>

                    {/* Hot / Cold badge */}
                    {item.status === "hot" ? (
                      <span className="text-[9px] font-bold text-[#d4a84c] bg-[#d4a84c]/10 border border-[#d4a84c]/30 px-1.5 py-0.5 rounded flex items-center gap-0.5 leading-none uppercase">
                        🔥 HOT
                      </span>
                    ) : item.status === "cold" ? (
                      <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 rounded flex items-center gap-0.5 leading-none uppercase">
                        ❄️ COLD
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Bars Stage */}
                <div className="w-full h-3.5 bg-black/40 rounded-full relative overflow-visible border border-white/[0.03]">
                  {/* Theoretical Expected value Line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 z-10 filter drop-shadow-[0_0_1px_rgba(255,255,255,0.8)]"
                    style={{
                      left: `${expPercentWidth}%`,
                      backgroundColor: "rgba(255, 255, 255, 0.45)",
                      borderStyle: "dashed"
                    }}
                    title={`Theoretical expected value: ${item.expectedPercent.toFixed(2)}%`}
                  />

                  {/* Observed Progress bar */}
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out relative opacity-85"
                    style={{
                      width: `${obsPercentWidth}%`,
                      background: `linear-gradient(to right, ${item.color}50, ${item.color})`,
                      boxShadow: `0 0 10px ${item.color}30`
                    }}
                  />
                </div>
              </div>

              {/* Spins since column */}
              <div className="col-span-3 sm:col-span-2 text-right flex flex-col justify-center font-mono">
                <span className="text-xs text-white font-medium">
                  {item.spinsSince === 0 ? (
                    <span className="text-emerald-400 font-bold tracking-tight animate-pulse bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                      AGORA
                    </span>
                  ) : item.spinsSince === totalSpins ? (
                    <span className="text-gray-600 font-light text-[10px]">100+ giros</span>
                  ) : (
                    <span>{item.spinsSince} {item.spinsSince === 1 ? "giro" : "giros"}</span>
                  )}
                </span>
                <span className="text-[10px] text-gray-500 mt-0.5">
                  frequência de {item.segments}/54
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer guideline legend */}
      <div className="mt-5 flex items-center gap-4 text-[10px] font-mono text-gray-500 bg-white/[0.01] px-3 py-2 rounded-xl border border-white/5">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-0.5 bg-white/50 border border-white"></span>
          Teórico Esperado
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2 rounded-sm bg-[#d4a84c]"></span>
          Observado
        </span>
        <span className="hidden sm:inline">|</span>
        <span className="hidden sm:inline text-gray-400">
          * Barra amarela/verde/rosa/magenta para Bônus, ouro/azul/vermelha/violeta para números.
        </span>
      </div>
    </div>
  );
}
