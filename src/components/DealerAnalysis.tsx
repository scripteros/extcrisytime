import { useState, useMemo } from "react";
import { ParsedSpin } from "../types";
import { SECTOR_DEFINITIONS, getSafeLabel } from "../data";
import { Users, Hash, BarChart3, TrendingUp, Clock, Sparkles, Search, X, Zap, Target, Eye, Activity, Award, Trophy } from "lucide-react";

interface DealerAnalysisProps {
  allSpins: ParsedSpin[];
}

const formatBRL = (val: number) =>
  val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DealerAnalysis({ allSpins }: DealerAnalysisProps) {
  const [selectedDealer, setSelectedDealer] = useState<string | null>(null);

  const dealerStats = useMemo(() => {
    const map = new Map<string, {
      spins: ParsedSpin[];
      sectorCount: Map<string, number>;
      bonusCount: number;
      multiplierSum: number;
      topSlotCount: number;
      firstSeen: number;
      lastSeen: number;
      sectorMultiplierSum: Map<string, number>;
    }>();

    for (const spin of allSpins) {
      const name = spin.dealerName || "Desconhecido";
      if (!map.has(name)) {
        map.set(name, {
          spins: [],
          sectorCount: new Map(),
          bonusCount: 0,
          multiplierSum: 0,
          topSlotCount: 0,
          firstSeen: spin.timestamp,
          lastSeen: spin.timestamp,
          sectorMultiplierSum: new Map(),
        });
      }
      const entry = map.get(name)!;
      entry.spins.push(spin);
      entry.sectorCount.set(spin.sectorKey, (entry.sectorCount.get(spin.sectorKey) || 0) + 1);
      entry.multiplierSum += spin.maxMultiplier;
      if (spin.isBonus) entry.bonusCount++;
      if (spin.isTopSlotMatched) entry.topSlotCount++;
      if (spin.timestamp < entry.firstSeen) entry.firstSeen = spin.timestamp;
      if (spin.timestamp > entry.lastSeen) entry.lastSeen = spin.timestamp;
      entry.sectorMultiplierSum.set(
        spin.sectorKey,
        (entry.sectorMultiplierSum.get(spin.sectorKey) || 0) + spin.maxMultiplier
      );
    }

    return Array.from(map.entries())
      .map(([name, data]) => {
        const total = data.spins.length;
        const avgMult = total > 0 ? data.multiplierSum / total : 0;
        const bonusPct = total > 0 ? (data.bonusCount / total) * 100 : 0;

        const sectorStats = Array.from(data.sectorCount.entries())
          .map(([key, count]) => {
            const def = SECTOR_DEFINITIONS.find(d => d.key === key);
            const multSum = data.sectorMultiplierSum.get(key) || 0;
            return {
              key,
              displayName: def?.displayName || key,
              count,
              pct: (count / total) * 100,
              avgMultiplier: count > 0 ? multSum / count : 0,
              maxMultiplier: Math.max(...data.spins.filter(s => s.sectorKey === key).map(s => s.maxMultiplier), 0),
            };
          })
          .sort((a, b) => b.count - a.count);

        const sessionMinutes = total > 0 ? Math.round((data.lastSeen - data.firstSeen) / 60000) : 0;
        const avgSpinTime = total > 0 && sessionMinutes > 0 ? Math.round(sessionMinutes / total) : 0;

        return {
          name,
          total,
          bonusCount: data.bonusCount,
          bonusPct,
          avgMultiplier: avgMult,
          topSlotCount: data.topSlotCount,
          firstSeen: data.firstSeen,
          lastSeen: data.lastSeen,
          sessionMinutes,
          avgSpinTime,
          sectorStats,
          recentSpins: data.spins.slice(0, 10),
          lastResult: data.spins[0] || null,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [allSpins]);

  const selectedData = selectedDealer
    ? dealerStats.find(d => d.name === selectedDealer)
    : null;

  // Find hot sectors for a dealer (most frequent)
  const getHotSectors = (data: typeof dealerStats[0]) => {
    const total = data.total;
    return data.sectorStats
      .filter(s => s.count > 0)
      .sort((a, b) => b.count - a.count);
  };

  const safeLabel = (key: string) => {
    if (key === "CoinFlip") return "🪙";
    if (key === "CashHunt") return "🎯";
    if (key === "Pachinko") return "🔴";
    if (key === "CrazyTime") return "🎡";
    return key;
  };

  return (
    <div className="glass-panel p-6 rounded-2xl w-full max-w-7xl mx-auto mb-8 relative z-10" id="dealer-analysis-panel">
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-amber-500/0 via-amber-500/50 to-rose-500/0" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <Users className="text-rose-400" size={22} />
            Análise por Dealer
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Estatísticas detalhadas de cada dealer — giros, setores favoritos, bônus e multiplicadores
          </p>
        </div>

        <div className="text-xs text-slate-500 font-mono bg-white/[0.03] px-3 py-1.5 rounded-xl border border-white/5">
          {allSpins.length} giros • {dealerStats.length} dealers
        </div>
      </div>

      {selectedData ? (
        /* Detail View */
        <div>
          <button
            onClick={() => setSelectedDealer(null)}
            className="mb-4 flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-all cursor-pointer bg-white/[0.03] hover:bg-white/[0.06] px-3 py-1.5 rounded-xl border border-white/5"
          >
            <X size={12} /> Voltar para lista
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Dealer Header Card */}
            <div className="lg:col-span-3 glass-panel p-5 rounded-2xl border border-white/5 bg-gradient-to-r from-rose-500/10 to-purple-500/5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-lg">
                  {selectedData.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-display font-bold text-white">{selectedData.name}</h3>
                  <p className="text-xs text-slate-400">
                    {selectedData.sessionMinutes > 60
                      ? `~${Math.round(selectedData.sessionMinutes / 60)}h${selectedData.sessionMinutes % 60}m de atividade`
                      : `~${selectedData.sessionMinutes} minutos de atividade`}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-white">{selectedData.total}</div>
                  <div className="text-[10px] text-slate-500 uppercase">Giros totais</div>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <StatCard icon={Sparkles} label="Bônus" value={`${selectedData.bonusCount} (${selectedData.bonusPct.toFixed(1)}%)`} color="text-pink-400" />
            <StatCard icon={BarChart3} label="Média Mult" value={`${selectedData.avgMultiplier.toFixed(1)}x`} color="text-amber-400" />
            <StatCard icon={Zap} label="Top Slot" value={`${selectedData.topSlotCount}x`} color="text-emerald-400" />
          </div>

          {/* Hot Sectors */}
          <div className="glass-panel p-5 rounded-2xl border border-white/5 mb-6">
            <h4 className="text-xs font-display font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp size={13} className="text-emerald-400" />
              Setores Preferidos
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {getHotSectors(selectedData).slice(0, 8).map((s) => (
                <div key={s.key} className="bg-white/[0.03] rounded-xl p-3 border border-white/5 hover:bg-white/[0.06] transition-all">
                  <div className="text-lg font-black text-white flex items-center justify-between">
                    <span>{safeLabel(s.key)}</span>
                    <span className="text-[10px] text-slate-500 font-mono font-normal">{(s.pct).toFixed(1)}%</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                    <span>{s.count}x aparições</span>
                    <span className="text-amber-400">ø {s.avgMultiplier.toFixed(1)}x</span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                      style={{ width: `${Math.min(100, s.pct * 2)}%` }}
                    />
                  </div>
                  {s.maxMultiplier > 10 && (
                    <div className="mt-1 text-[9px] text-rose-400 font-bold">🔥 Max: {s.maxMultiplier}x</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recent Results */}
          <div className="glass-panel p-5 rounded-2xl border border-white/5 mb-6">
            <h4 className="text-xs font-display font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <Activity size={13} className="text-amber-400" />
              Últimos 10 Resultados
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {selectedData.recentSpins.map((s, i) => {
                const def = SECTOR_DEFINITIONS.find(d => d.key === s.sectorKey);
                const isBonus = s.isBonus;
                return (
                  <div
                    key={i}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border flex items-center gap-1 ${
                      isBonus
                        ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
                        : "bg-white/[0.04] border-white/10 text-slate-300"
                    }`}
                    title={`${def?.displayName || s.sectorKey} — ${s.maxMultiplier}x`}
                  >
                    {safeLabel(s.sectorKey)}
                    {s.maxMultiplier > 1 && <span className="text-[9px] opacity-70">×{s.maxMultiplier}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* List View */
        <div className="space-y-3">
          {dealerStats.map((dealer) => {
            const hotSectors = getHotSectors(dealer).slice(0, 3);
            const isCold = dealer.total < 10;

            return (
              <button
                key={dealer.name}
                onClick={() => setSelectedDealer(dealer.name)}
                className="w-full glass-panel p-4 rounded-2xl border border-white/5 hover:bg-white/[0.04] transition-all cursor-pointer text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm shadow-lg ${
                    isCold
                      ? "bg-slate-700"
                      : dealer.bonusPct > 10
                      ? "bg-gradient-to-br from-rose-500 to-purple-600"
                      : "bg-gradient-to-br from-amber-500 to-orange-600"
                  }`}>
                    {dealer.name.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-white text-sm">{dealer.name}</span>
                      {dealer.total > 50 && <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/20">Experiente</span>}
                      {dealer.bonusPct > 15 && <span className="text-[9px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded-full border border-rose-500/20">🔥 Bônus</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      <span className="text-[10px] text-slate-400">{dealer.total} giros</span>
                      <span className="text-[10px] text-slate-500">•</span>
                      <span className="text-[10px] text-amber-400">ø {dealer.avgMultiplier.toFixed(1)}x</span>
                      <span className="text-[10px] text-slate-500">•</span>
                      <span className={`text-[10px] ${dealer.bonusPct > 12 ? 'text-pink-400' : 'text-slate-400'}`}>
                        {dealer.bonusCount} bônus ({dealer.bonusPct.toFixed(1)}%)
                      </span>
                      <span className="text-[10px] text-slate-500">•</span>
                      <span className="text-[10px] text-slate-400">{dealer.sessionMinutes}min ativo</span>
                    </div>
                    {hotSectors.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[9px] text-slate-500 uppercase">Top:</span>
                        {hotSectors.map((s) => (
                          <span key={s.key} className="text-[10px] bg-white/[0.05] px-1.5 py-0.5 rounded-md text-slate-300 font-mono">
                            {safeLabel(s.key)} ({s.count})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs text-emerald-400 font-bold group-hover:underline">
                      Ver Detalhes →
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5">
                      {dealer.avgSpinTime > 0 ? `~${dealer.avgSpinTime}s/giro` : ""}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {dealerStats.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Users size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">Nenhum dealer encontrado nos dados atuais.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className={`glass-panel p-4 rounded-2xl border border-white/5 bg-white/[0.02]`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={13} className={color} />
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <div className={`text-lg font-black ${color}`}>{value}</div>
    </div>
  );
}
