import { GameStats, ParsedSpin, SectorDefinition } from "../types";
import { SECTOR_DEFINITIONS } from "../data";
import { Award, Zap, Hash, TrendingUp, Sparkles, Clock, User } from "lucide-react";
import { motion } from "motion/react";

interface StatsDashboardProps {
  stats: GameStats;
  lastSpin: ParsedSpin | null;
}

export default function StatsDashboard({ stats, lastSpin }: StatsDashboardProps) {
  // Find color parameters of the last sector
  const lastSectorDef = SECTOR_DEFINITIONS.find((s) => s.key === lastSpin?.sectorKey);
  const colorHex = lastSectorDef?.color || "#d4a84c";
  const displayName = lastSpin?.displayName || "N/A";

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } },
  };

  // Helper to format timestamps
  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 w-full max-w-7xl mx-auto"
      id="bento-stats-grid"
    >
      {/* CARD 1: Total de Giros Analisados */}
      <motion.div
        variants={itemVariants}
        className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden"
        id="card-total-spins"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-radial-gradient-animated rounded-full filter blur-2xl -mr-10 -mt-10" />
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-wider text-gray-400 font-medium">Giros Analisados</span>
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[#d4a84c]">
            <Hash size={18} />
          </div>
        </div>
        <div>
          <h2 className="font-mono text-5xl font-extrabold text-white leading-none mb-1 tracking-tight">
            {stats.totalSpins}
          </h2>
          <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Amostra em tempo real (últimos {stats.totalSpins})
          </p>
        </div>
      </motion.div>

      {/* CARD 2: Frequência de Bônus */}
      <motion.div
        variants={itemVariants}
        className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden"
        id="card-bonus-freq"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-radial-magenta-animated rounded-full filter blur-2xl -mr-10 -mt-10" />
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-wider text-gray-400 font-medium">Frequência de Bônus</span>
          <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-[#ec4899]">
            <Award size={18} />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2 mb-1">
            <h2 className="font-mono text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-[#ec4899] leading-none tracking-tight">
              {stats.bonusPercentage.toFixed(1)}%
            </h2>
            <span className="text-sm font-mono text-pink-400 font-semibold bg-pink-500/10 px-2 py-0.5 rounded-md border border-pink-500/20">
              {stats.bonusCount} Giros
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Expectativa teórica: <span className="font-mono text-pink-300">16.67%</span> (9 de 54 setores)
          </p>
        </div>
      </motion.div>

      {/* CARD 3: Multiplicador Médio */}
      <motion.div
        variants={itemVariants}
        className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden"
        id="card-avg-multiplier"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-wider text-gray-400 font-medium">Multiplicador Médio</span>
          <div className="p-2 rounded-xl bg-[#d4a84c]/10 border border-[#d4a84c]/20 text-[#d4a84c]">
            <TrendingUp size={18} />
          </div>
        </div>
        <div>
          <h2 className="font-mono text-5xl font-extrabold text-[#f3f4f6] gold-glow leading-none mb-1 tracking-tight">
            {stats.averageMultiplier.toFixed(1)}x
          </h2>
          <p className="text-xs text-gray-400 mt-2">
            Inclui multiplicadores do <span className="text-[#d4a84c] font-medium font-display">Top Slot</span> e jogos bônus
          </p>
        </div>
      </motion.div>

      {/* CARD 4: Maior Multiplicador Registrado */}
      <motion.div
        variants={itemVariants}
        className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden md:col-span-2 lg:col-span-1"
        id="card-max-multiplier"
      >
        <div className="absolute -bottom-10 -right-10 w-28 h-28 bg-[#d4a84c]/10 rounded-full filter blur-2xl" />
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-wider text-gray-400 font-medium">Maior Multiplicador</span>
          <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
            <Sparkles size={18} />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2 mb-1">
            <h2 className="font-mono text-5xl font-extrabold text-[#d4a84c] gold-glow leading-none tracking-tight">
              {stats.maxMultiplier}x
            </h2>
            {stats.maxMultiplier > 100 && (
              <span className="text-[10px] uppercase font-mono font-bold bg-[#d4a84c]/20 text-white px-2 py-0.5 rounded-full border border-[#d4a84c]/40 animate-pulse">
                MEGA WIN!
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-2 flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <Clock size={12} className="text-[#d4a84c]/70" />
              <span>Ocorrido na base de dados de rastreamento</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* CARD 5: Último Setor Sorteado */}
      <motion.div
        variants={itemVariants}
        className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden md:col-span-1 lg:col-span-2"
        id="card-last-outcome"
      >
        {/* Border indicator matching the actual sector color */}
        <div
          className="absolute top-0 left-0 w-full h-1"
          style={{ backgroundColor: colorHex }}
        />
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-wider text-gray-400 font-medium">Último Resultado</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-gray-400 flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md">
              <User size={10} className="text-gray-400" />
              Dealer: <span className="text-white font-medium">{lastSpin?.dealerName || "N/A"}</span>
            </span>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-1">
          <div className="flex items-center gap-4">
            {/* Massive formatted chip in sector color */}
            <div
              className={`font-display text-4xl sm:text-5xl font-black px-6 py-2 rounded-xl text-white shadow-lg flex items-center justify-center transition-all duration-300`}
              style={{
                backgroundColor: `${colorHex}15`,
                border: `2px solid ${colorHex}`,
                textShadow: `0 0 15px ${colorHex}50`
              }}
            >
              <span style={{ color: colorHex }}>{displayName}</span>
            </div>
            
            <div className="flex flex-col">
              <span className="font-mono text-3xl font-extrabold text-white">
                {lastSpin?.maxMultiplier || 1}x
              </span>
              <span className="text-xs text-gray-400">Multiplicador Final</span>
              {lastSpin?.sectorKey === "CrazyTime" && lastSpin.activeFlapperColor && (
                <span className={`text-[10px] font-mono mt-1 px-2 py-0.5 rounded-lg border-2 leading-none inline-block w-fit ${
                  lastSpin.activeFlapperColor === "Green" ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-extrabold" :
                  lastSpin.activeFlapperColor === "Blue" ? "bg-blue-500/10 border-blue-500/40 text-blue-400 font-extrabold" :
                  "bg-amber-500/10 border-amber-500/40 text-amber-400 font-extrabold"
                }`}>
                  {lastSpin.activeFlapperColor === "Green" ? "🟢 Verde" :
                   lastSpin.activeFlapperColor === "Blue" ? "🔵 Azul" :
                   "🟡 Amarelo"} Ativo
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:items-end font-mono text-right text-xs text-gray-400 gap-1 border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
            <span className="text-white font-bold flex items-center gap-1 sm:justify-end text-sm">
              <Clock size={14} className="text-gray-500" />
              {formatTime(lastSpin?.settledAt)}
            </span>
            <span>{lastSpin?.settledAt ? new Date(lastSpin.settledAt).toLocaleDateString("pt-BR") : "N/A"}</span>
          </div>
        </div>
      </motion.div>

      {/* CARD 6: Sincronia de Top Slot */}
      <motion.div
        variants={itemVariants}
        className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden"
        id="card-topslot-match"
      >
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-[#d4a84c]/5 rounded-full filter blur-xl" />
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-wider text-gray-400 font-medium">Sincronia Top Slot</span>
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Zap size={18} />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2 mb-1">
            <h2 className="font-mono text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-[#d4a84c] leading-none tracking-tight">
              {stats.topSlotMatches}
            </h2>
            <span className="text-xs font-mono text-gray-400">giros</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Top Slot combinou seu multiplicador com o setor final selecionado na roda
          </p>
        </div>
      </motion.div>

      {/* CARD 7: AI Bonus Prediction & Saturation */}
      <motion.div
        variants={itemVariants}
        className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden md:col-span-1 lg:col-span-2 border-l-2 border-l-pink-500"
        id="card-ai-bonus-forecast"
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-pink-500/5 rounded-full filter blur-3xl pointer-events-none" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <span className="p-1 rounded bg-pink-500/10 border border-pink-500/20 text-pink-400">
              <Sparkles size={14} className="animate-pulse" />
            </span>
            <span className="text-xs uppercase tracking-wider text-pink-400 font-bold">Previsor de Bônus IA</span>
          </div>
          
          <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${
            stats.predictionConfidence === "Crítica" ? "bg-rose-500/20 border-rose-500/30 text-rose-300 animate-pulse font-black" :
            stats.predictionConfidence === "Alta" ? "bg-pink-500/20 border-pink-500/30 text-pink-300 font-bold" :
            stats.predictionConfidence === "Moderada" ? "bg-amber-500/20 border-amber-500/30 text-amber-300" :
            "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
          }`}>
            Sinal: {stats.predictionConfidence}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div className="space-y-1">
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] text-gray-400 uppercase font-mono font-bold block">Saturação de Entrada</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <h2 className="font-mono text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-400 to-pink-300 tracking-tight leading-none">
                {stats.predictedBonusChance.toFixed(1)}%
              </h2>
            </div>
            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5 mt-2">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  stats.roundsSinceLastBonus >= 10 ? "bg-gradient-to-r from-rose-500 to-pink-500" :
                  stats.roundsSinceLastBonus >= 6 ? "bg-gradient-to-r from-amber-500 to-pink-400" :
                  "bg-gradient-to-r from-emerald-500 to-teal-400"
                }`}
                style={{ width: `${stats.predictedBonusChance}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 bg-black/30 p-3 rounded-xl border border-white/5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-gray-400">Atraso Atual:</span>
              <span className="text-pink-300 font-bold">{stats.roundsSinceLastBonus} rodadas</span>
            </div>
            <div className="text-[11px] leading-relaxed text-slate-300 font-sans italic border-t border-white/5 pt-2 mt-1">
              {stats.roundsSinceLastBonus >= 10 ? (
                <span>⚠️ <strong className="text-rose-300">Aviso Máximo:</strong> Mesa super-saturada! Excelente momento para posicionar moedas de cobertura em todos os bônus.</span>
              ) : stats.roundsSinceLastBonus >= 6 ? (
                <span>⚡ <strong className="text-amber-300">Tendência Alta:</strong> Sequência sem bônus ultrapassou a média técnica de 6 giros. Alerta ativado.</span>
              ) : (
                <span>⚖️ <strong className="text-emerald-300">Ciclo Regular:</strong> Distribuição de rodadas saudável. Continue preservando saldo na cobertura secundária.</span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
