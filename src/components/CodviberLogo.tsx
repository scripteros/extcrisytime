import { motion } from "motion/react";

interface CodviberLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
}

export default function CodviberLogo({ size = "md", showText = true }: CodviberLogoProps) {
  const sizeMap = {
    sm: { box: "w-8 h-8", logoSize: 32, textClass: "text-base" },
    md: { box: "w-12 h-12", logoSize: 48, textClass: "text-xl" },
    lg: { box: "w-20 h-20", logoSize: 80, textClass: "text-2xl" },
    xl: { box: "w-32 h-32", logoSize: 128, textClass: "text-4xl" },
  };

  const config = sizeMap[size];

  return (
    <div className="flex items-center gap-3.5 select-none" id="codviber-brand-container">
      {/* Circle Glowing Logo Container */}
      <div 
        className={`relative ${config.box} rounded-full flex items-center justify-center bg-[#070b13] border border-[#22d3ee]/20 shadow-[0_0_20px_rgba(34,211,238,0.05),0_0_40px_rgba(168,85,247,0.03)] overflow-hidden`}
        id="codviber-avatar-ring"
      >
        {/* Animated Background circuit lines */}
        <div className="absolute inset-0 bg-[#06141d]/10 opacity-30 select-none pointer-events-none">
          <svg width="100%" height="100%" className="w-full h-full stroke-cyan-500/10" strokeWidth="0.5">
            <line x1="0" y1="20" x2="100%" y2="20" />
            <line x1="20" y1="0" x2="20" y2="100%" />
            <line x1="0" y1="80" x2="100%" y2="80" />
            <line x1="80" y1="0" x2="80" y2="100%" />
          </svg>
        </div>

        {/* Ambient spinning ring */}
        <motion.div 
          className="absolute inset-0.5 rounded-full border border-dashed border-[#a855f7]/20"
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        />

        {/* The Exact Logo SVG Graphic (Brain core, brackets, and code-node lines) */}
        <svg 
          viewBox="0 0 120 120" 
          width="100%" 
          height="100%" 
          className="w-full h-full p-1 drop-shadow-[0_0_8px_rgba(34,211,238,0.3)] z-10"
        >
          <defs>
            <linearGradient id="cyanPurple" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
            <linearGradient id="purplePink" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Glowing outer circle border edge */}
          <circle cx="60" cy="60" r="54" fill="transparent" stroke="url(#cyanPurple)" strokeWidth="1.2" opacity="0.65" />

          {/* Left Bracket (<) in glowing Cyan */}
          <motion.path 
            d="M 28 42 L 14 60 L 28 78" 
            fill="transparent" 
            stroke="#22d3ee" 
            strokeWidth="3.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            animate={{ x: [0, -3, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Right Bracket (>) in glowing Purple/Magenta */}
          <motion.path 
            d="M 92 42 L 106 60 L 92 78" 
            fill="transparent" 
            stroke="#d946ef" 
            strokeWidth="3.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            animate={{ x: [0, 3, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Central Brain constellation / network nodes graph */}
          <g transform="translate(36, 32)">
            {/* Brain Outline/Shape Backdrop (Invisible but groups everything) */}
            
            {/* Network Connections (Edges) */}
            <line x1="24" y1="12" x2="12" y2="24" stroke="#a855f7" strokeWidth="1" opacity="0.5" />
            <line x1="24" y1="12" x2="36" y2="20" stroke="#a855f7" strokeWidth="1" opacity="0.5" />
            <line x1="12" y1="24" x2="8" y2="38" stroke="#3b82f6" strokeWidth="1" opacity="0.5" />
            <line x1="36" y1="20" x2="40" y2="34" stroke="#d946ef" strokeWidth="1" opacity="0.5" />
            <line x1="8" y1="38" x2="24" y2="48" stroke="#3b82f6" strokeWidth="1" opacity="0.5" />
            <line x1="40" y1="34" x2="24" y2="48" stroke="#ec4899" strokeWidth="1" opacity="0.5" />
            <line x1="24" y1="12" x2="24" y2="28" stroke="#22d3ee" strokeWidth="1" opacity="0.6" />
            <line x1="12" y1="24" x2="24" y2="28" stroke="#22d3ee" strokeWidth="1" opacity="0.6" />
            <line x1="36" y1="20" x2="24" y2="28" stroke="#2a8af6" strokeWidth="1" opacity="0.6" />
            <line x1="8" y1="38" x2="24" y2="28" stroke="#a855f7" strokeWidth="1" opacity="0.6" />
            <line x1="40" y1="34" x2="24" y2="28" stroke="#d946ef" strokeWidth="1" opacity="0.6" />
            <line x1="24" y1="48" x2="24" y2="28" stroke="#3b82f6" strokeWidth="1" opacity="0.6" />

            {/* Additional biological-AI synapses lines with circle endpoints */}
            <circle cx="2" cy="20" r="1.5" fill="#22d3ee" />
            <line x1="2" y1="20" x2="12" y2="24" stroke="#22d3ee" strokeWidth="0.8" opacity="0.7" />

            <circle cx="46" cy="18" r="1.5" fill="#d946ef" />
            <line x1="46" y1="18" x2="36" y2="20" stroke="#d946ef" strokeWidth="0.8" opacity="0.7" />

            <circle cx="-5" cy="30" r="1.5" fill="#3b82f6" />
            <line x1="-5" y1="30" x2="8" y2="38" stroke="#3b82f6" strokeWidth="0.8" opacity="0.7" />

            <circle cx="24" cy="56" r="1.5" fill="#ec4899" />
            <line x1="24" y1="56" x2="24" y2="48" stroke="#ec4899" strokeWidth="0.8" opacity="0.7" />

            {/* Network Nodes (Soma / Synapses) with pulsing keys */}
            <motion.circle 
              cx="24" cy="12" r="3.5" fill="#c084fc" 
              animate={{ r: [3.5, 4.5, 3.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <circle cx="12" cy="24" r="3" fill="#22d3ee" />
            <circle cx="36" cy="20" r="3" fill="#df5bf7" />
            
            {/* Core Neural Pulse (Glowing central brain nucleus) */}
            <motion.circle 
              cx="24" cy="28" r="5" fill="#ffffff" 
              filter="url(#glow)"
              animate={{ opacity: [0.7, 1, 0.7], scale: [0.9, 1.1, 0.9] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <circle cx="24" cy="28" r="3" fill="#22d3ee" />

            <circle cx="8" cy="38" r="3" fill="#3b82f6" />
            <circle cx="40" cy="34" r="3" fill="#ec4899" />
            <circle cx="24" cy="48" r="3.5" fill="#a855f7" />

            {/* Micro binary digits '0101' inside brain clusters */}
            <text x="18" y="21" fill="#ffffff" fontSize="4.5" fontFamily="monospace" fontWeight="bold" opacity="0.4">
              0101
            </text>
            <text x="5" y="32" fill="#22d3ee" fontSize="3.5" fontFamily="monospace" fontWeight="bold" opacity="0.3">
              01
            </text>
            <text x="28" y="38" fill="#d946ef" fontSize="3.5" fontFamily="monospace" fontWeight="bold" opacity="0.3">
              01
            </text>
          </g>
        </svg>

        {/* Glow halo */}
        <div className="absolute inset-0 bg-radial-gradient-animated bg-opacity-10 pointer-events-none rounded-full" />
      </div>

      {/* Brand Text */}
      {showText && (
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className={`font-display font-black tracking-wider ${config.textClass} flex items-center leading-none`}>
              <span className="text-[#22d3ee] drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]">COD</span>
              <span className="text-[#d946ef] drop-shadow-[0_0_12px_rgba(217,70,239,0.5)] text-transparent bg-clip-text bg-gradient-to-r from-[#d946ef] to-[#f43f5e]">VIBER</span>
            </span>
            {size !== "sm" && (
              <span className="text-[9px] uppercase font-mono bg-white/5 text-gray-400 px-1.5 py-0.5 rounded border border-white/10 shrink-0 select-none">
                CRAZY LIVE
              </span>
            )}
          </div>
          {size !== "sm" && (
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#d4a84c] mt-0.5 leading-none">
              Intelligence Engine
            </span>
          )}
        </div>
      )}
    </div>
  );
}
