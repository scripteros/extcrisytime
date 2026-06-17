import { useState, useMemo } from "react";
import { SECTOR_DEFINITIONS } from "../data";
import type { ParsedSpin } from "../types";
import { motion } from "motion/react";
import { Clock, TrendingUp, Zap, AlertTriangle, Target, BarChart3, Calendar, Activity, Flame, Hash, Search, Hourglass, Eye, Crosshair } from "lucide-react";

interface SectorAnalysisProps {
  allSpins: ParsedSpin[];
}

interface DelayStats {
  currentDelay: number;
  historicalAvg: number;
  maxDelay: number;
  p50: number;
  p80: number;
  p90: number;
  pressurePercentage: number;
  severity: "normal" | "warning" | "danger" | "critical";
  theoryAvg: number;
  intervals: number[];
  intervalFrequency: Record<string, number>;
}

interface HourlyStats {
  hour: number;
  appearances: number;
  totalSpins: number;
  hitRate: number;
  avgMultiplier: number;
  maxMultiplier: number;
}

export default function SectorAnalysis({ allSpins }: SectorAnalysisProps) {
  const [selectedSector, setSelectedSector] = useState<string>("1");
  const [filterBonus, setFilterBonus] = useState<boolean>(false);

  const chronologicalSpins = useMemo(() => [...allSpins].reverse(), [allSpins]);

  // Helper to check if a spin matches the selected sector
  const isSectorHit = (spin: ParsedSpin) => {
    if (filterBonus) return spin.isBonus;
    if (selectedSector === "bonus") return spin.isBonus;
    return spin.sectorKey === selectedSector;
  };

  const selectedDef = useMemo(() => {
    if (filterBonus || selectedSector === "bonus") {
      return { key: "bonus", displayName: "Todos os Bônus", color: "#ec4899", theoreticalProbability: 1 / 4.5 };
    }
    return SECTOR_DEFINITIONS.find(s => s.key === selectedSector) || SECTOR_DEFINITIONS[0];
  }, [selectedSector, filterBonus]);

  // ====== DELAY STATS ======
  const delayStats: DelayStats = useMemo(() => {
    const indices: number[] = [];
    for (let i = 0; i < chronologicalSpins.length; i++) {
      if (isSectorHit(chronologicalSpins[i])) indices.push(i);
    }
    const currentDelay = indices.length > 0 ? indices[0] : chronologicalSpins.length;
    const intervals: number[] = [];
    for (let j = 0; j < indices.length - 1; j++) {
      intervals.push(indices[j + 1] - indices[j]);
    }
    const theoryAvg = 1 / selectedDef.theoreticalProbability;
    const historicalAvg = intervals.length > 0
      ? parseFloat((intervals.reduce((a, b) => a + b, 0) / intervals.length).toFixed(1))
      : parseFloat(theoryAvg.toFixed(1));
    const maxDelay = intervals.length > 0 ? Math.max(...intervals) : Math.round(theoryAvg * 3.5);
    const sorted = [...intervals].sort((a, b) => a - b);
    const getPercentile = (p: number) => {
      if (sorted.length === 0) return Math.round(theoryAvg * (p / 0.5));
      const idx = Math.floor(sorted.length * p);
      return sorted[idx] !== undefined ? sorted[idx] : sorted[sorted.length - 1];
    };
    const p50 = getPercentile(0.5);
    const p80 = getPercentile(0.8);
    const p90 = getPercentile(0.9);
    const returnsBefore = intervals.filter(v => v <= currentDelay).length;
    const pressurePercentage = intervals.length > 0
      ? Math.round((returnsBefore / intervals.length) * 100)
      : Math.round(Math.min(100, (currentDelay / theoryAvg) * 50));
    let severity: "normal" | "warning" | "danger" | "critical" = "normal";
    if (currentDelay >= p90) severity = "critical";
    else if (currentDelay >= p80) severity = "danger";
    else if (currentDelay >= historicalAvg) severity = "warning";

    // Build frequency distribution of intervals
    const intervalFreq: Record<string, number> = {};
    intervals.forEach(iv => {
      const bucket = iv <= 5 ? String(iv) : iv <= 10 ? "6-10" : iv <= 20 ? "11-20" : "21+";
      intervalFreq[bucket] = (intervalFreq[bucket] || 0) + 1;
    });

    return { currentDelay, historicalAvg, maxDelay, p50, p80, p90, pressurePercentage, severity, theoryAvg, intervals, intervalFrequency: intervalFreq };
  }, [chronologicalSpins, selectedSector, filterBonus]);

  // ====== HOURLY PATTERNS ======
  const hourlyStats: HourlyStats[] = useMemo(() => {
    const hourMap: Record<number, { appearances: number; total: number; multipliers: number[] }> = {};
    for (let h = 0; h < 24; h++) hourMap[h] = { appearances: 0, total: 0, multipliers: [] };

    chronologicalSpins.forEach((spin, idx) => {
      const hour = new Date(spin.timestamp).getHours();
      if (hourMap[hour]) {
        hourMap[hour].total++;
        if (isSectorHit(spin)) {
          hourMap[hour].appearances++;
          if (spin.maxMultiplier > 0) hourMap[hour].multipliers.push(spin.maxMultiplier);
        }
      }
    });

    return Object.entries(hourMap).map(([hourStr, data]) => ({
      hour: parseInt(hourStr),
      appearances: data.appearances,
      totalSpins: data.total,
      hitRate: data.total > 0 ? Math.round((data.appearances / data.total) * 100) : 0,
      avgMultiplier: data.multipliers.length > 0
        ? Math.round(data.multipliers.reduce((a, b) => a + b, 0) / data.multipliers.length)
        : 0,
      maxMultiplier: data.multipliers.length > 0 ? Math.max(...data.multipliers) : 0,
    }));
  }, [chronologicalSpins, selectedSector, filterBonus]);

  const bestHours = useMemo(() => {
    return [...hourlyStats]
      .filter(h => h.totalSpins >= 10)
      .sort((a, b) => b.hitRate - a.hitRate)
      .slice(0, 5);
  }, [hourlyStats]);

  const worstHours = useMemo(() => {
    return [...hourlyStats]
      .filter(h => h.totalSpins >= 10)
      .sort((a, b) => a.hitRate - b.hitRate)
      .slice(0, 5);
  }, [hourlyStats]);

  // ====== CORRELATION: what pulls this sector ======
  const correlationAnalysis = useMemo(() => {
    const results: { sectorKey: string; displayName: string; color: string; followedBy: number; totalFollows: number; rate: number }[] = [];
    SECTOR_DEFINITIONS.forEach(sector => {
      let followedBy = 0;
      for (let i = 0; i < chronologicalSpins.length - 1; i++) {
        if (isSectorHit(chronologicalSpins[i]) && chronologicalSpins[i + 1].sectorKey === sector.key) {
          followedBy++;
        }
      }
      const totalFollows = chronologicalSpins.filter(s => isSectorHit(s)).length;
      results.push({
        sectorKey: sector.key,
        displayName: sector.displayName,
        color: sector.color,
        followedBy,
        totalFollows,
        rate: totalFollows > 0 ? Math.round((followedBy / totalFollows) * 100) : 0,
      });
    });
    return results.sort((a, b) => b.rate - a.rate);
  }, [chronologicalSpins, selectedSector, filterBonus]);

  // ====== MULTIPLIER ANALYSIS ======
  const multiplierAnalysis = useMemo(() => {
    const hits = chronologicalSpins.filter(s => isSectorHit(s));
    const withMult = hits.filter(s => s.maxMultiplier > 1);
    const bigMults = hits.filter(s => s.maxMultiplier >= 20);
    return {
      totalHits: hits.length,
      avgMultiplier: hits.length > 0
        ? Math.round(hits.reduce((a, s) => a + s.maxMultiplier, 0) / hits.length)
        : 0,
      maxMultiplier: hits.length > 0 ? Math.max(...hits.map(s => s.maxMultiplier)) : 0,
      withMultiplier: withMult.length,
      bigMultiplier: bigMults.length,
      multiplierDistribution: [
        { label: "1x", count: hits.filter(s => s.maxMultiplier <= 1).length, color: "#6b7280" },
        { label: "2x-5x", count: hits.filter(s => s.maxMultiplier > 1 && s.maxMultiplier <= 5).length, color: "#22c55e" },
        { label: "6x-20x", count: hits.filter(s => s.maxMultiplier > 5 && s.maxMultiplier <= 20).length, color: "#eab308" },
        { label: "21x-50x", count: hits.filter(s => s.maxMultiplier > 20 && s.maxMultiplier <= 50).length, color: "#f97316" },
        { label: "50x+", count: hits.filter(s => s.maxMultiplier > 50).length, color: "#ef4444" },
      ],
    };
  }, [chronologicalSpins, selectedSector, filterBonus]);

  // ====== STRENGTH ASSESSMENT ======
  const strength = useMemo(() => {
    const last20 = chronologicalSpins.slice(0, 20);
    const hitsIn20 = last20.filter(s => isSectorHit(s)).length;
    const expected = 20 * selectedDef.theoreticalProbability;
    const isHot = hitsIn20 >= expected * 1.5;
    const isCold = hitsIn20 <= expected * 0.5;
    const isDue = delayStats.currentDelay >= delayStats.p80;

    let assessment: string;
    let color: string;
    if (isHot) { assessment = "🔥 Forte Tendência de Aparecimento"; color = "#22c55e"; }
    else if (isDue) { assessment = "⚡ Alta Probabilidade de Retorno (Atrasado)"; color = "#eab308"; }
    else if (isCold) { assessment = "📉 Frio — Evitar no Momento"; color = "#ef4444"; }
    else { assessment = "➡️ Comportamento Normal"; color = "#6b7280"; }

    return { hitsIn20, expected20: Math.round(expected * 10) / 10, assessment, color, isHot, isCold, isDue };
  }, [chronologicalSpins, selectedSector, filterBonus, delayStats]);

  // ====== HIT RATES WITH GALES ======
  const hitRates = useMemo(() => {
    const totalEntries = Math.min(50, chronologicalSpins.length - 3);
    if (totalEntries < 5) return { direct: 0, g1: 0, g2: 0, attempts: 0 };
    let directHits = 0, g1Hits = 0, g2Hits = 0;
    for (let i = 0; i < totalEntries; i++) {
      if (isSectorHit(chronologicalSpins[i])) directHits++;
      if (isSectorHit(chronologicalSpins[i]) || (chronologicalSpins[i + 1] && isSectorHit(chronologicalSpins[i + 1]))) g1Hits++;
      if (isSectorHit(chronologicalSpins[i]) ||
          (chronologicalSpins[i + 1] && isSectorHit(chronologicalSpins[i + 1])) ||
          (chronologicalSpins[i + 2] && isSectorHit(chronologicalSpins[i + 2]))) g2Hits++;
    }
    return {
      direct: Math.round((directHits / totalEntries) * 100),
      g1: Math.round((g1Hits / totalEntries) * 100),
      g2: Math.round((g2Hits / totalEntries) * 100),
      attempts: totalEntries,
    };
  }, [chronologicalSpins, selectedSector, filterBonus]);

  const latestSpins6 = useMemo(() => chronologicalSpins.filter(s => isSectorHit(s)).slice(0, 6), [chronologicalSpins]);

  const severityColor = { normal: "#6b7280", warning: "#eab308", danger: "#f97316", critical: "#ef4444" };
  const severityLabel = { normal: "Normal", warning: "⚠️ Atenção", danger: "🔴 Perigo", critical: "🚨 Crítico" };

  const getTimeframeLabel = (h: number) => {
    const ranges = [
      [0, 5, "Madrugada (0-5h)"], [6, 11, "Manhã (6-11h)"],
      [12, 17, "Tarde (12-17h)"], [18, 23, "Noite (18-23h)"]
    ];
    for (const [start, end, label] of ranges) {
      if (h >= start && h <= end) return label;
    }
    return "";
  };

  // Group hours into timeframes for quick insights
  const timeframeInsights = useMemo(() => {
    const tf = ["Madrugada (0-5h)", "Manhã (6-11h)", "Tarde (12-17h)", "Noite (18-23h)"];
    return tf.map(label => {
      const hours = hourlyStats.filter(h => getTimeframeLabel(h.hour) === label);
      const total = hours.reduce((a, h) => a + h.totalSpins, 0);
      const hits = hours.reduce((a, h) => a + h.appearances, 0);
      const avgMult = hours.reduce((a, h) => a + h.avgMultiplier, 0);
      return {
        label,
        hitRate: total > 0 ? Math.round((hits / total) * 100) : 0,
        appearances: hits,
        avgMultiplier: hours.length > 0 ? Math.round(avgMult / hours.length) : 0,
        totalSpins: total,
      };
    });
  }, [hourlyStats]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel p-6 rounded-2xl w-full max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Crosshair size={22} className="text-[#d4a84c]" />
          <h2 className="text-lg font-black uppercase tracking-wider" style={{ color: selectedDef.color }}>
            Análise do Setor
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedSector}
            onChange={e => { setSelectedSector(e.target.value); setFilterBonus(false); }}
            className="bg-[#0b0b10] border border-white/10 rounded-xl px-3.5 py-2 text-xs font-bold text-white outline-none cursor-pointer focus:border-[#d4a84c]"
          >
            <optgroup label="Números">
              {SECTOR_DEFINITIONS.filter(s => ["1", "2", "5", "10"].includes(s.key)).map(s => (
                <option key={s.key} value={s.key}>Número {s.displayName}</option>
              ))}
            </optgroup>
            <optgroup label="Bônus">
              {SECTOR_DEFINITIONS.filter(s => !["1", "2", "5", "10"].includes(s.key)).map(s => (
                <option key={s.key} value={s.key}>{s.displayName}</option>
              ))}
            </optgroup>
          </select>
          <span className="text-xs text-slate-500">ou</span>
          <button
            onClick={() => { setFilterBonus(!filterBonus); setSelectedSector("1"); }}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${filterBonus ? "bg-pink-500/20 text-pink-400 border-pink-500/30" : "bg-white/5 text-slate-400 border-white/10"}`}
          >
            {filterBonus ? "🎰 Todos Bônus" : "Todos Bônus"}
          </button>
        </div>
      </div>

      {/* ====== STRENGTH CARD ====== */}
      <div className="rounded-xl border mb-6 p-5" style={{ borderColor: strength.color + "30", background: strength.color + "08" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity size={28} style={{ color: strength.color }} />
            <div>
              <div className="text-lg font-black uppercase tracking-wider" style={{ color: strength.color }}>
                {strength.assessment}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {strength.hitsIn20}/{plural(20, "últimas rodadas")} • Esperado: {strength.expected20} • 
                Atraso atual: {delayStats.currentDelay} giros
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase">Hit Rate</span>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-black text-sm">{hitRates.direct}%</span>
              <span className="text-slate-600">|</span>
              <span className="text-amber-400 font-bold text-xs">G1 {hitRates.g1}%</span>
              <span className="text-slate-600">|</span>
              <span className="text-rose-400 font-bold text-xs">G2 {hitRates.g2}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ====== GRID: 2 cols ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* LEFT COL: Delay + Multiplier + Recent */}
        <div className="space-y-4">

          {/* Delay Analysis */}
          <div className="rounded-xl border border-white/10 p-4 bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-3">
              <Hourglass size={14} className="text-[#d4a84c]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Análise de Atraso</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="text-center">
                <div className="text-lg font-black" style={{ color: severityColor[delayStats.severity] }}>{delayStats.currentDelay}</div>
                <div className="text-[8px] text-slate-500 uppercase">Atraso</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-black text-slate-300">{delayStats.historicalAvg}</div>
                <div className="text-[8px] text-slate-500 uppercase">Média</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-black text-slate-300">{delayStats.p80}</div>
                <div className="text-[8px] text-slate-500 uppercase">Limite 80%</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-black text-slate-300">{delayStats.p90}</div>
                <div className="text-[8px] text-slate-500 uppercase">Limite 90%</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: Math.min(delayStats.pressurePercentage, 100) + "%", background: delayStats.severity === "critical" ? "#ef4444" : delayStats.severity === "danger" ? "#f97316" : delayStats.severity === "warning" ? "#eab308" : "#22c55e" }} />
              </div>
              <span className="text-[9px] font-bold text-slate-400">{delayStats.pressurePercentage}%</span>
            </div>
            <div className="mt-2">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full`} style={{ background: severityColor[delayStats.severity] + "20", color: severityColor[delayStats.severity] }}>
                {severityLabel[delayStats.severity]}
              </span>
            </div>

            {/* Interval distribution */}
            {Object.keys(delayStats.intervalFrequency).length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <span className="text-[8px] text-slate-500 uppercase tracking-wider">Distribuição dos Intervalos</span>
                <div className="flex gap-1 mt-1.5">
                  {Object.entries(delayStats.intervalFrequency).map(([k, v]) => {
                    const max = Math.max(...Object.values(delayStats.intervalFrequency));
                    return (
                      <div key={k} className="flex-1 text-center">
                        <div className="text-[9px] font-bold text-white">{v}</div>
                        <div className="bg-white/5 rounded-full h-8 mt-0.5 overflow-hidden relative">
                          <div className="absolute bottom-0 w-full rounded-full transition-all" style={{ height: (v / max) * 100 + "%", background: "#d4a84c" }} />
                        </div>
                        <div className="text-[7px] text-slate-500 mt-0.5">{k}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Multiplier Analysis */}
          <div className="rounded-xl border border-white/10 p-4 bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} className="text-[#d4a84c]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Multiplicadores</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="text-center">
                <div className="text-lg font-black text-amber-400">{multiplierAnalysis.avgMultiplier}x</div>
                <div className="text-[8px] text-slate-500 uppercase">Média</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-black text-rose-400">{multiplierAnalysis.maxMultiplier}x</div>
                <div className="text-[8px] text-slate-500 uppercase">Máximo</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-black text-slate-300">{multiplierAnalysis.withMultiplier}</div>
                <div className="text-[8px] text-slate-500 uppercase">C/ Mult</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-black text-purple-400">{multiplierAnalysis.bigMultiplier}</div>
                <div className="text-[8px] text-slate-500 uppercase">20x+</div>
              </div>
            </div>
            <div className="space-y-1">
              {multiplierAnalysis.multiplierDistribution.filter(d => d.count > 0).map(d => {
                const maxCount = Math.max(...multiplierAnalysis.multiplierDistribution.map(x => x.count));
                return (
                  <div key={d.label} className="flex items-center gap-2">
                    <span className="text-[8px] text-slate-500 w-12">{d.label}</span>
                    <div className="flex-1 bg-white/5 rounded-full h-2.5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: (d.count / maxCount) * 100 + "%", background: d.color }} />
                    </div>
                    <span className="text-[9px] font-bold text-slate-400">{d.count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent 6 hits */}
          <div className="rounded-xl border border-white/10 p-4 bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-3">
              <Eye size={14} className="text-[#d4a84c]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Últimas Ocorrências</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {latestSpins6.length === 0 && <span className="text-[10px] text-slate-500">Nenhuma ocorrência encontrada</span>}
              {latestSpins6.map((s, i) => (
                <div key={i} className="px-2 py-1 rounded-md bg-white/5 border border-white/10 flex items-center gap-1.5">
                  {s.maxMultiplier > 1 && <Zap size={9} className="text-amber-400" />}
                  <span className="text-[9px] font-mono font-bold">{s.displayName}</span>
                  {s.maxMultiplier > 1 && <span className="text-[8px] font-mono text-amber-400">{s.maxMultiplier}x</span>}
                  <span className="text-[7px] text-slate-500">{new Date(s.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COL: Hourly + Correlation */}
        <div className="space-y-4">

          {/* Timeframe Insights */}
          <div className="rounded-xl border border-white/10 p-4 bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={14} className="text-[#d4a84c]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Melhores Faixas de Horário</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {timeframeInsights.map(tf => (
                <div key={tf.label} className={`rounded-lg p-3 border ${tf.hitRate > 0 ? (tf.hitRate >= 20 ? "border-emerald-500/20 bg-emerald-500/05" : "border-white/5 bg-white/[0.02]") : "border-white/5 bg-white/[0.02]"}`}>
                  <div className="text-[9px] font-bold" style={{ color: tf.hitRate >= 20 ? "#22c55e" : "#94a3b8" }}>{tf.label}</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-sm font-black ${tf.hitRate >= 20 ? "text-emerald-400" : "text-slate-400"}`}>{tf.hitRate}%</span>
                    <span className="text-[8px] text-slate-500">{tf.appearances} ocorrências</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Zap size={8} className="text-amber-500" />
                    <span className="text-[7px] text-slate-500">Mult médio: {tf.avgMultiplier}x</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Best & Worst Hours */}
          <div className="rounded-xl border border-white/10 p-4 bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={14} className="text-[#d4a84c]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Melhores & Piores Horários</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[8px] text-emerald-400 uppercase font-bold tracking-wider">🔥 Melhores</span>
                <div className="space-y-1 mt-2">
                  {bestHours.map(h => (
                    <div key={h.hour} className="flex items-center justify-between">
                      <span className="text-[9px] text-slate-300">{String(h.hour).padStart(2, "0")}h</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-emerald-400">{h.hitRate}%</span>
                        <span className="text-[7px] text-slate-500">{h.appearances}x</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[8px] text-rose-400 uppercase font-bold tracking-wider">📉 Piores</span>
                <div className="space-y-1 mt-2">
                  {worstHours.map(h => (
                    <div key={h.hour} className="flex items-center justify-between">
                      <span className="text-[9px] text-slate-300">{String(h.hour).padStart(2, "0")}h</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-rose-400">{h.hitRate}%</span>
                        <span className="text-[7px] text-slate-500">{h.appearances}x</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Correlation */}
          <div className="rounded-xl border border-white/10 p-4 bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-3">
              <Hash size={14} className="text-[#d4a84c]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">O que costuma puxar {selectedDef.displayName}</span>
            </div>
            <div className="space-y-1.5">
              {correlationAnalysis.filter(c => c.totalFollows > 0).map(c => {
                const maxRate = Math.max(...correlationAnalysis.filter(x => x.totalFollows > 0).map(x => x.rate));
                return (
                  <div key={c.sectorKey} className="flex items-center gap-2">
                    <span className="text-[9px] font-mono font-bold" style={{ color: c.color }}>{c.displayName}</span>
                    <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: maxRate > 0 ? (c.rate / maxRate) * 100 + "%" : "0%", background: c.color }} />
                    </div>
                    <span className="text-[9px] font-mono text-slate-400 w-10 text-right">{c.rate}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function plural(n: number, word: string) { return `${n} ${word}`; }
