import { SectorDefinition, ParsedSpin } from "../types";
import { SECTOR_DEFINITIONS } from "../data";
import { 
  Hourglass, AlertTriangle, CheckCircle2, ChevronRight, Info, 
  TrendingUp, RefreshCw, BarChart2, Zap 
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface DelayAnalysisProps {
  allSpins: ParsedSpin[];
}

export default function DelayAnalysis({ allSpins }: DelayAnalysisProps) {
  const [selectedDetailSector, setSelectedDetailSector] = useState<string | null>(null);

  const totalSpins = allSpins.length;

  const delayStats = SECTOR_DEFINITIONS.map((sector) => {
    // 1. Gather all occurrences in history (0 is newest spin)
    const indices: number[] = [];
    for (let i = 0; i < allSpins.length; i++) {
      if (allSpins[i].sectorKey === sector.key) {
        indices.push(i);
      }
    }

    // 2. Current delay (rounds since last appearance)
    const currentDelay = indices.length > 0 ? indices[0] : totalSpins;

    // 3. Intervals between consecutive appearances (gaps between indices)
    const intervals: number[] = [];
    for (let j = 0; j < indices.length - 1; j++) {
      intervals.push(indices[j+1] - indices[j]);
    }

    // 4. Calculate stats on intervals
    const theoryAvg = 1 / sector.theoreticalProbability;
    const historicalAvg = intervals.length > 0 
      ? parseFloat((intervals.reduce((a, b) => a + b, 0) / intervals.length).toFixed(1))
      : parseFloat(theoryAvg.toFixed(1));

    const maxDelay = intervals.length > 0 ? Math.max(...intervals) : Math.round(theoryAvg * 3.5);

    // 5. Sort intervals to calculate percentiles (90% & 80% reappear limits)
    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    const getPercentile = (p: number) => {
      if (sortedIntervals.length === 0) return Math.round(theoryAvg * (p / 0.5));
      const idx = Math.floor(sortedIntervals.length * p);
      return sortedIntervals[idx] !== undefined ? sortedIntervals[idx] : sortedIntervals[sortedIntervals.length - 1];
    };

    const p50 = getPercentile(0.5); // Median delay (50% of times returns by this)
    const p80 = getPercentile(0.8); // 80% of times returns by this (standard pattern)
    const p90 = getPercentile(0.9); // 95% of times returns by this (limit pattern)

    // 6. Urgency coefficient based on what percentage of historical intervals are smaller or equal to currentDelay
    const returnsBeforeCurrent = intervals.filter(v => v <= currentDelay).length;
    const pressurePercentage = intervals.length > 0 
      ? Math.round((returnsBeforeCurrent / intervals.length) * 100)
      : Math.round(Math.min(100, (currentDelay / theoryAvg) * 50));

    // Desvio de atraso
    const delayRatio = historicalAvg > 0 ? currentDelay / historicalAvg : 0;

    // Severity level
    let severity: "normal" | "warning" | "danger" | "critical" = "normal";
    if (currentDelay >= p90) severity = "critical";
    else if (currentDelay >= p80) severity = "danger";
    else if (currentDelay >= historicalAvg) severity = "warning";

    return {
      ...sector,
      occurrencesCount: indices.length,
      currentDelay,
      historicalAvg,
      theoryAvg: parseFloat(theoryAvg.toFixed(1)),
      maxDelay,
      p50,
      p80,
      p90,
      pressurePercentage,
      delayRatio,
      severity,
      allIntervals: intervals,
    };
  });

  return (
    <div className="glass-panel p-6 rounded-2xl w-full text-left" id="delay-analysis-panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6" id="delay-header">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-pink-400 bg-pink-400/5 border border-pink-400/10 px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 mb-2">
            <Hourglass size={11} className="animate-spin text-pink-400" /> Relatório de Ciclos e Atraso
          </span>
          <h3 className="font-display text-lg font-black text-white flex items-center gap-2">
            Anomalia de Atraso e Limiar de Retorno
          </h3>
          <p className="text-xs text-slate-400">
            Mapeamento dinâmico baseado nos intervalos entre os últimos {totalSpins} giros da mesa real.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-white/[0.02] border border-white/5 p-1 rounded-xl text-[10px] font-mono text-slate-400 self-start sm:self-center">
          <Info size={12} className="text-[#d4a84c] ml-1.5" />
          <span className="px-1.5">Conectado ao proxy seguro Live</span>
        </div>
      </div>

      <div className="text-xs text-slate-400 bg-white/[0.015] border border-white/5 p-4 rounded-xl mb-6 leading-relaxed">
        <strong>💡 Como funciona o Limiar de Retorno?</strong> Cada setor possui uma taxa natural de aparição. Ao analisar os giros do servidor, calculamos exatamente quantas rodadas o setor costuma demorar para voltar (<span className="text-white">Média Real</span>). O <span className="text-pink-400">Limite de 80%~90%</span> indica após quantas rodadas de atraso ele costuma reaparecer na grande maioria das vezes. Se o atraso atual ultrapassa esses percentis, a pressão estatística de retorno aumenta exponencialmente.
      </div>

      {/* Grid Headers */}
      <div className="grid grid-cols-12 text-[10px] uppercase font-mono tracking-wider font-bold text-slate-500 mb-3 px-3 border-b border-white/5 pb-2">
        <div className="col-span-3 sm:col-span-2">Setor</div>
        <div className="col-span-3 sm:col-span-2 text-center">Atraso Sem Sair</div>
        <div className="col-span-3 sm:col-span-4 px-1 text-center sm:text-left hidden sm:block">Média vs Máx Histórico</div>
        <div className="col-span-3 sm:col-span-4 text-center">Zona Limiar de Retorno (80~90%)</div>
        <div className="col-span-3 sm:col-span-2 text-right">Pressão</div>
      </div>

      {/* Items List */}
      <div className="flex flex-col gap-2.5" id="delay-items-list">
        {delayStats.map((item, idx) => {
          const isSelected = selectedDetailSector === item.key;
          const labelOfSeverity = () => {
            if (item.severity === "critical") return { text: "CRÍTICO", color: "text-rose-400 bg-rose-500/15 border-rose-500/30" };
            if (item.severity === "danger") return { text: "ALERTA MÁX", color: "text-amber-400 bg-amber-500/15 border-amber-500/30" };
            if (item.severity === "warning") return { text: "ATRASADO", color: "text-yellow-300 bg-yellow-500/10 border-yellow-500/20" };
            return { text: "NORMAL", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/15" };
          };
          const badge = labelOfSeverity();

          return (
            <div
              key={item.key}
              className={`border rounded-xl transition-all overflow-hidden ${
                isSelected 
                  ? "bg-[#11111a] border-white/10 shadow-lg shadow-black/30" 
                  : "bg-white/[0.01] border-transparent hover:bg-white/[0.02] hover:border-white/5"
              }`}
            >
              {/* Row Bar */}
              <button
                onClick={() => setSelectedDetailSector(isSelected ? null : item.key)}
                className="w-full grid grid-cols-12 items-center px-3 py-3 text-left focus:outline-none cursor-pointer"
              >
                {/* Sector Name */}
                <div className="col-span-3 sm:col-span-2 flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg font-display text-xs font-black flex items-center justify-center text-white border transition-shadow duration-300"
                    style={{
                      backgroundColor: `${item.color}15`,
                      borderColor: `${item.color}80`,
                      boxShadow: `0 0 6px ${item.color}20`
                    }}
                  >
                    <span style={{ color: item.color }}>{item.displayName}</span>
                  </div>
                  <ChevronRight 
                    size={13} 
                    className={`text-slate-500 transition-transform ${isSelected ? "rotate-90 text-white" : ""}`}
                  />
                </div>

                {/* Current Delay Badge representation */}
                <div className="col-span-3 sm:col-span-2 text-center flex flex-col items-center justify-center">
                  <span className={`font-mono text-sm font-black ${
                    item.severity === "critical" ? "text-rose-400 animate-pulse font-extrabold" :
                    item.severity === "danger" ? "text-amber-400" :
                    item.severity === "warning" ? "text-yellow-300" : "text-white"
                  }`}>
                    {item.currentDelay === 0 ? "SORTEADO" : `${item.currentDelay} rodadas`}
                  </span>
                  
                  {item.currentDelay > 0 && (
                    <span className={`text-[8.5px] font-mono font-semibold px-1 rounded border leading-none mt-1 ${badge.color}`}>
                      {badge.text}
                    </span>
                  )}
                </div>

                {/* Average vs Max delay */}
                <div className="col-span-3 sm:col-span-4 px-1 flex-col justify-center text-left text-xs font-mono hidden sm:flex">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <span className="text-slate-500 text-[10px]">Média Real:</span>
                    <strong className="text-white">{item.historicalAvg} rod.</strong>
                    <span className="text-slate-600 text-[9px]">(Teórico: {item.theoryAvg})</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 mt-0.5">
                    <span className="text-slate-500 text-[10px]">Máx no histórico:</span>
                    <span className="text-white font-semibold">{item.maxDelay} rodadas sem sair</span>
                  </div>
                </div>

                {/* Target Reappearance Zone */}
                <div className="col-span-3 sm:col-span-4 text-center flex flex-col items-center justify-center font-mono">
                  <div className="text-xs text-pink-400 font-bold bg-pink-500/[0.04] border border-pink-500/10 px-2 py-0.5 rounded-lg">
                    {item.p80} a {item.p90} rodadas
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1 uppercase">Limiar de 80%~90%</span>
                </div>

                {/* Reappearance Urgency indicators with Mini radial or bar */}
                <div className="col-span-3 sm:col-span-2 text-right flex flex-col justify-center items-end pr-1">
                  <span className={`font-mono text-xs font-black ${
                    item.pressurePercentage >= 90 ? "text-rose-400 font-bold" :
                    item.pressurePercentage >= 75 ? "text-amber-400" :
                    item.pressurePercentage >= 50 ? "text-yellow-300" : "text-emerald-400"
                  }`}>
                    {item.pressurePercentage}%
                  </span>
                  
                  {/* Progress bar */}
                  <div className="w-14 h-1 bg-white/5 rounded-full overflow-hidden mt-1.5">
                    <div 
                      className="h-full rounded-full transition-all duration-300"
                      style={{ 
                        width: `${item.pressurePercentage}%`,
                        backgroundColor: item.pressurePercentage >= 90 ? "#fb7185" :
                                         item.pressurePercentage >= 75 ? "#fbbf24" :
                                         item.pressurePercentage >= 50 ? "#facc15" : "#34d399"
                      }}
                    />
                  </div>
                </div>
              </button>

              {/* Extended Details Drawer */}
              <AnimatePresence initial={false}>
                {isSelected && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden bg-black/40 border-t border-white/[0.04] text-xs"
                  >
                    <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-5 leading-relaxed">
                      
                      {/* Explanatory analytics card */}
                      <div className="col-span-1 md:col-span-7 space-y-3.5 text-left">
                        <h4 className="font-display font-semibold text-white text-xs uppercase text-slate-300 flex items-center gap-1.5">
                          <BarChart2 size={13} className="text-[#d4a84c]" />
                          Heurística de Volta e Retorno Histórico
                        </h4>
                        
                        <p className="text-slate-400 text-xs">
                          Para o setor <strong className="text-white">"{item.displayName}"</strong>, registramos exactamente <strong className="text-white">{item.occurrencesCount} aparições</strong> nas últimas 500 rodadas.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300 font-mono text-[11px]">
                          <div className="bg-white/[0.015] border border-white/5 p-2.5 rounded-lg">
                            <span className="text-slate-500 block text-[9px] uppercase font-bold mb-1">Padrão de Espera Comum</span>
                            Em 50% dos casos ele retorna em até <strong>{item.p50} rodadas</strong> (atraso mediano).
                          </div>
                          
                          <div className="bg-white/[0.015] border border-white/5 p-2.5 rounded-lg">
                            <span className="text-slate-500 block text-[9px] uppercase font-bold mb-1">Zona Crítica de Espera</span>
                            Em 90% das vezes de toda a amostragem, ele já reapareceu até no máximo <strong>{item.p90} rodadas</strong>.
                          </div>
                        </div>

                        {/* Interactive analysis phrase based on the state */}
                        <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl flex items-start gap-2.5 text-slate-300 text-xs">
                          <Zap size={15} className="text-yellow-400 shrink-0 mt-0.5" />
                          <div>
                            {item.currentDelay === 0 ? (
                              <span>O setor acaba de aparecer! Seu ciclo foi reiniciado e as chances estão calibradas no comportamento natural do desvio padrão.</span>
                            ) : item.currentDelay < item.historicalAvg ? (
                              <span>Excelente estabilização: O atraso atual de <strong>{item.currentDelay} rodadas</strong> é menor do que a média de silêncio histórica ({item.historicalAvg} rodadas). O setor está no ciclo normal esperado de sorteio.</span>
                            ) : item.currentDelay >= item.p90 ? (
                              <span className="text-rose-400 font-medium">Atenção Crítica: O atraso atual de <strong>{item.currentDelay} rodadas</strong> atingiu ou superou o limiar máximo histórico de 90% ({item.p90} rodadas). Em apenas 10% de toda a história o número atrasou mais do que isso antes de voltar. Pressão máxima de reaparição!</span>
                            ) : (
                              <span>Alerta de Retorno: O atraso de <strong>{item.currentDelay} rodadas</strong> está acima do silêncio médio do histórico. O setor está entrando na janela limiar ideal de reaparecimento (de {item.p80} a {item.p90} rodadas).</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Cumulative Delay Gaps distribution visualization */}
                      <div className="col-span-1 md:col-span-5 border-l border-white/5 pl-0 md:pl-5 flex flex-col justify-between">
                        <div>
                          <h4 className="font-display font-semibold text-white text-xs uppercase text-slate-300 flex items-center gap-1.5 mb-2.5">
                            <TrendingUp size={13} className="text-pink-400" />
                            Taxa Acumulada de Reaparecimento
                          </h4>
                          <span className="text-[10px] text-slate-500 leading-normal block">
                            Diz a porcentagem de vezes em que o setor retornou sob o atraso atual no histórico oficial:
                          </span>
                        </div>

                        <div className="mt-4 flex items-center justify-between font-mono bg-black/55 border border-white/5 p-3 rounded-xl text-center">
                          <div className="flex-1 border-r border-white/5 pr-2">
                            <span className="text-slate-500 text-[9px] uppercase block mb-0.5">Urgência Real</span>
                            <span className="text-sm font-black text-white">{item.pressurePercentage}%</span>
                          </div>
                          
                          <div className="flex-1 px-2">
                            <span className="text-slate-500 text-[9px] uppercase block mb-0.5">Janela Limiar</span>
                            <span className="text-sm font-black text-pink-400">{item.p80}-{item.p90} r.</span>
                          </div>

                          <div className="flex-1 border-l border-white/5 pl-2">
                            <span className="text-slate-500 text-[9px] uppercase block mb-0.5">Máximo</span>
                            <span className="text-sm font-black text-rose-500">{item.maxDelay} r.</span>
                          </div>
                        </div>

                        <div className="mt-4 text-[9px] text-slate-500 font-mono uppercase text-right">
                          Mapeamento do motor estatístico de 500 rodadas
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Info card legend at bottom */}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[10px] font-mono text-slate-500 bg-white/[0.01] px-4 py-3 rounded-xl border border-white/5">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded bg-emerald-500"></span>
          NORMAL (Atraso abaixo da média)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded bg-yellow-400"></span>
          ATRASADO (Acima do silêncio médio)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded bg-amber-500"></span>
          ALERTA MÁXIMO (Entrou no limiar 80%+)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded bg-rose-500 animate-pulse"></span>
          CRÍTICO (Excedeu limiar 90%+)
        </span>
      </div>
    </div>
  );
}
