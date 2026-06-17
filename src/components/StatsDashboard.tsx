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
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4 w-full max-w-7xl mx-auto"
      id="bento-stats-grid"
    >
      {/* CARD 1: Total de Giros */}
      <motion.div
        variants={itemVariants}
        className="glass-panel p-3 rounded-xl flex flex-col relative overflow-hidden"
        id="card-total-spins"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] uppercase tracking-wider text-gray-400 font-medium truncate">Giros</span>
          <Hash size={11} className="text-[#d4a84c] shrink-0" />
        </div>
        <div className="font-mono text-lg font-extrabold text-white leading-none tracking-tight">
          {stats.totalSpins}
        </div>
      </motion.div>

      {/* CARD 2: Bônus % */}
      <motion.div
        variants={itemVariants}
        className="glass-panel p-3 rounded-xl flex flex-col relative overflow-hidden"
        id="card-bonus-freq"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] uppercase tracking-wider text-gray-400 font-medium truncate">Bônus</span>
          <Sparkles size={11} className="text-[#ec4899] shrink-0" />
        </div>
        <div className="font-mono text-lg font-extrabold text-white leading-none tracking-tight">
          {stats.bonusPercentage.toFixed(1)}%
        </div>
      </motion.div>

      {/* CARD 3: Último Resultado */}
      <motion.div
        variants={itemVariants}
        className="glass-panel p-3 rounded-xl flex flex-col relative overflow-hidden"
        id="card-last-result"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] uppercase tracking-wider text-gray-400 font-medium truncate">Último</span>
          <Zap size={11} className="text-[#22c55e] shrink-0" />
        </div>
        <div className="font-mono text-lg font-extrabold text-white leading-none tracking-tight truncate" style={{ color: colorHex }}>
          {displayName}
        </div>
      </motion.div>

      {/* CARD 4: Multiplicador Máximo */}
      <motion.div
        variants={itemVariants}
        className="glass-panel p-3 rounded-xl flex flex-col relative overflow-hidden"
        id="card-max-mult"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] uppercase tracking-wider text-gray-400 font-medium truncate">Max Mult</span>
          <TrendingUp size={11} className="text-amber-400 shrink-0" />
        </div>
        <div className="font-mono text-lg font-extrabold text-white leading-none tracking-tight">
          {stats.maxMultiplier}x
        </div>
      </motion.div>

      {/* CARD 5: Média Mult */}
      <motion.div
        variants={itemVariants}
        className="glass-panel p-3 rounded-xl flex flex-col relative overflow-hidden"
        id="card-avg-mult"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] uppercase tracking-wider text-gray-400 font-medium truncate">Média Mult</span>
          <Award size={11} className="text-blue-400 shrink-0" />
        </div>
        <div className="font-mono text-lg font-extrabold text-white leading-none tracking-tight">
          {stats.averageMultiplier.toFixed(1)}x
        </div>
      </motion.div>

      {/* CARD 6: Última Atualização */}
      <motion.div
        variants={itemVariants}
        className="glass-panel p-3 rounded-xl flex flex-col relative overflow-hidden"
        id="card-last-update"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] uppercase tracking-wider text-gray-400 font-medium truncate">Atualizado</span>
          <Clock size={11} className="text-slate-400 shrink-0" />
        </div>
        <div className="font-mono text-xs font-bold text-white leading-none tracking-tight truncate">
          {formatTime(lastSpin?.timestamp)}
        </div>
      </motion.div>
    </motion.div>
  );
}