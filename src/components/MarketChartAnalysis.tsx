import { ParsedSpin } from "../types";
import { SECTOR_DEFINITIONS } from "../data";
import { useSignalRelay, mapSectorsToSpots } from "../hooks/useSignalRelay";
import { 
  TrendingUp, TrendingDown, Layers, Percent, BarChart3, 
  HelpCircle, Info, Sliders, Play, Settings, AlertCircle, Sparkles,
  Flame, Zap, Eye, Activity, ChevronUp, ChevronDown, Target,
  Clock, ArrowUp, ArrowDown, Minus, Send
} from "lucide-react";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

interface MarketChartAnalysisProps {
  allSpins: ParsedSpin[];
  candlePeriodMinutes: number; // Time period per candle in minutes (1m, 5m, 15m, 30m, 1h, 2h, 6h)
}

function formatPeriodLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = minutes / 60;
  return `${h}h`;
}

// ====== KNOWN CANDLESTICK PATTERNS adapted for Crazy Time context ======

interface CandlePattern {
  name: string;
  type: "bullish" | "bearish" | "neutral";
  strength: "forte" | "moderada" | "fraca";
  probabilityText: string;
  description: string;
  condition: (data: any[]) => boolean;
  targetSectors: string[];
}

function generateCandlePatterns(
  chronologicalSpins: ParsedSpin[], 
  selectedSector: string,
  candlePeriodMinutes: number,
  delayStatsMap: Record<string, { currentDelay: number; p80: number; p90: number; severity: string; pressurePercentage: number }>
): CandlePattern[] {
  if (chronologicalSpins.length < 10) return [];

  const patterns: CandlePattern[] = [];
  const isHit = (spin: ParsedSpin) => {
    return selectedSector === "bonus" 
      ? spin.isBonus 
      : spin.sectorKey === selectedSector;
  };

  // Build array of "price" movements: +payout on hit, -1 on miss
  const payout = selectedSector === "bonus" ? 8 :
    selectedSector === "1" ? 1 :
    selectedSector === "2" ? 2 :
    selectedSector === "5" ? 5 :
    selectedSector === "10" ? 10 :
    selectedSector === "coin_flip" ? 11 :
    selectedSector === "pachinko" ? 19 :
    selectedSector === "cash_hunt" ? 22 : 45;

  const recentSpins = chronologicalSpins.slice(0, Math.min(40, chronologicalSpins.length));
  const sectorDelay = delayStatsMap[selectedSector];

  // Calculate consecutive stats
  let consecutiveHits = 0;
  let consecutiveMisses = 0;
  for (let i = 0; i < recentSpins.length; i++) {
    if (isHit(recentSpins[i])) {
      if (consecutiveMisses > 0) break;
      consecutiveHits++;
    } else {
      if (consecutiveHits > 0) break;
      consecutiveMisses++;
    }
  }

  // Hit/miss ratio in last N spins
  const last10 = recentSpins.slice(0, 10);
  const hitsIn10 = last10.filter(s => isHit(s)).length;
  const hitsIn20 = recentSpins.slice(0, 20).filter(s => isHit(s)).length;

  // Build candles for time-based pattern detection (group by minute intervals)
  const intervalMs = candlePeriodMinutes * 60 * 1000;
  const candles: any[] = [];
  if (recentSpins.length >= 2) {
    const oldestTime = recentSpins[recentSpins.length - 1].timestamp;
    const newestTime = recentSpins[0].timestamp;
    // Generate time intervals from newest to oldest
    let intervalStart = newestTime;
    while (intervalStart > oldestTime) {
      const intervalEnd = intervalStart;
      intervalStart = intervalStart - intervalMs;
      const chunk = recentSpins.filter(
        s => s.timestamp >= intervalStart && s.timestamp < intervalEnd
      );
      if (chunk.length < 2) continue;
      let hits = 0;
      chunk.forEach(s => { if (isHit(s)) hits++; });
      candles.push({
        open: hits,
        high: hits + 1,
        low: hits,
        close: hits,
        volume: hits,
        ratio: hits / chunk.length,
        timeLabel: new Date(intervalStart).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      });
    }
  }

  // ==========================================
  // PATTERN 1: BULLISH ENGULFING (Reversão para Alta - setor vai aparecer)
  // ==========================================
  if (candles.length >= 2) {
    const prev = candles[candles.length - 2];
    const curr = candles[candles.length - 1];
    if (prev.ratio < 0.3 && curr.ratio > 0.6) {
      patterns.push({
        name: "Engolfo de Alta (Bullish Engulfing)",
        type: "bullish",
        strength: "forte",
        probabilityText: "Probabilidade Forte de Aparecer",
        description: `Após um período fraco (${(prev.ratio * 100).toFixed(0)}% de acertos), o setor teve uma recuperação forte (${(curr.ratio * 100).toFixed(0)}% de acertos), indicando possível virada para cima.`,
        condition: () => true,
        targetSectors: [selectedSector],
      });
    }
  }

  // ==========================================
  // PATTERN 2: HAMMER (Martelo - fundo formado)
  // ==========================================
  if (consecutiveMisses >= 5 && hitsIn10 >= 1) {
    const firstHitIdx = recentSpins.findIndex(s => isHit(s));
    if (firstHitIdx >= 3 && firstHitIdx <= consecutiveMisses) {
      patterns.push({
        name: "Martelo (Hammer)",
        type: "bullish",
        strength: consecutiveMisses >= 8 ? "forte" : "moderada",
        probabilityText: consecutiveMisses >= 8 ? "🔥 Probabilidade Muito Forte" : "Probabilidade Moderada",
        description: `Longa sequência de ausências (${consecutiveMisses} giros sem aparecer) seguida de reaparição. Indica que o setor formou um fundo e pode estar retornando ao ciclo normal.`,
        condition: () => true,
        targetSectors: [selectedSector],
      });
    }
  }

  // ==========================================
  // PATTERN 3: THREE WHITE SOLDIERS (Três Soldados - alta consecutiva)
  // ==========================================
  if (hitsIn10 >= 3 && hitsIn20 >= 4) {
    patterns.push({
      name: "Três Soldados (Three White Soldiers)",
      type: "bullish",
      strength: hitsIn10 >= 5 ? "forte" : "moderada",
      probabilityText: hitsIn10 >= 5 ? "🔥 Tendência de Alta Confirmada" : "Tendência de Alta",
      description: `O setor apareceu ${hitsIn10}x nos últimos 10 giros e ${hitsIn20}x em 20 giros. Sequência consistente de aparições indica momentum positivo.`,
      condition: () => true,
      targetSectors: [selectedSector],
    });
  }

  // ==========================================
  // PATTERN 4: PIERCING LINE (Linha Perfurante)
  // ==========================================
  if (consecutiveMisses >= 3 && consecutiveHits >= 1 && hitsIn10 >= 1) {
    patterns.push({
      name: "Linha Perfurante (Piercing Line)",
      type: "bullish",
      strength: "moderada",
      probabilityText: "Possível Reversão",
      description: `${consecutiveMisses} giros sem o setor, interrompidos por uma aparição. Pode indicar o início de uma reversão do ciclo negativo.`,
      condition: () => true,
      targetSectors: [selectedSector],
    });
  }

  // ==========================================
  // PATTERN 5: MORNING STAR (Estrela da Manhã)
  // ==========================================
  // Pattern: miss, mixed, hit in consecutive groups
  if (candles.length >= 3) {
    const c1 = candles[candles.length - 3];
    const c2 = candles[candles.length - 2];
    const c3 = candles[candles.length - 1];
    if (c1.ratio < 0.3 && c2.ratio >= 0.3 && c2.ratio <= 0.6 && c3.ratio > 0.5) {
      patterns.push({
        name: "Estrela da Manhã (Morning Star)",
        type: "bullish",
        strength: "moderada",
        probabilityText: "Sinal de Reversão Positiva",
        description: `Padrão de 3 velas: baixa → indecisão → alta. Indicador clássico de reversão de tendência baixista para altista.`,
        condition: () => true,
        targetSectors: [selectedSector],
      });
    }
  }

  // ==========================================
  // PATTERN 6: DOJI (Indecisão seguida de movimento)
  // ==========================================
  if (candles.length >= 2) {
    const prev = candles[candles.length - 2];
    const curr = candles[candles.length - 1];
    const isDoji = Math.abs(prev.ratio - 0.5) < 0.15; // ~50% hits
    if (isDoji && curr.ratio > 0.6) {
      patterns.push({
        name: "Doji de Alta",
        type: "bullish",
        strength: "moderada",
        probabilityText: "Indecisão Rompida para Cima",
        description: `Um período de equilíbrio (acertos ~${(prev.ratio * 100).toFixed(0)}%) seguido por rompimento positivo (${(curr.ratio * 100).toFixed(0)}% de acertos).`,
        condition: () => true,
        targetSectors: [selectedSector],
      });
    }
  }

  // ==========================================
  // PATTERN 7: DELAY-BASED — STRONG PROBABILITY FROM DELAY ANALYSIS
  // ==========================================
  if (sectorDelay && sectorDelay.currentDelay > 0) {
    if (sectorDelay.severity === "critical" || sectorDelay.severity === "danger") {
      patterns.push({
        name: sectorDelay.severity === "critical" ? "⚠️ CRÍTICO — Limiar Máximo Excedido" : "⚡ Alerta de Retorno por Atraso",
        type: "bullish",
        strength: "forte",
        probabilityText: sectorDelay.severity === "critical" 
          ? "🔥🔥 Pressão Máxima de Retorno!" 
          : "🔥 Alta Probabilidade de Retorno",
        description: sectorDelay.severity === "critical"
          ? `O setor está há ${sectorDelay.currentDelay} rodadas sem aparecer — EXCEDEU O LIMIAR DE 90% (${sectorDelay.p90} rodadas). Historicamente, em apenas 10% dos casos ele demorou mais que isso. Pressão de ${sectorDelay.pressurePercentage}% para retorno iminente!`
          : `O setor está atrasado há ${sectorDelay.currentDelay} rodadas (limiar de 80%~90%: ${sectorDelay.p80} a ${sectorDelay.p90} rodadas). Pressão de ${sectorDelay.pressurePercentage}% nos ciclos.`,
        condition: () => true,
        targetSectors: [selectedSector],
      });
    }

    if (sectorDelay.severity === "warning") {
      patterns.push({
        name: "📊 Atraso Moderado — Janela de Retorno",
        type: "bullish",
        strength: "fraca",
        probabilityText: "Probabilidade Moderada",
        description: `O setor está ${sectorDelay.currentDelay} rodadas sem aparecer (acima da média histórica). Entrando na janela de reaparecimento.`,
        condition: () => true,
        targetSectors: [selectedSector],
      });
    }
  }

  return patterns;
}

export default function MarketChartAnalysis({ allSpins, candlePeriodMinutes }: MarketChartAnalysisProps) {
  const [selectedSector, setSelectedSector] = useState<string>(() => {
    try { return localStorage.getItem("mc_selected_sector") || "1"; } catch { return "1"; }
  });
  const [autoUpdate, setAutoUpdate] = useState<boolean>(() => {
    try { return localStorage.getItem("mc_auto_update") !== "false"; } catch { return true; }
  });
  const [showProbabilityTip, setShowProbabilityTip] = useState<string | null>(null);

  // Signal relay
  const { extensionId, sendSignal, isConfigured } = useSignalRelay();
  const [signalToast, setSignalToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [autoSendEnabled, setAutoSendEnabled] = useState(() => {
    try { return localStorage.getItem("mc_auto_send") === "true"; } catch { return false; }
  });
  const lastAutoSentKey = useRef<string | null>(null);

  useEffect(() => {
    try {
      if (autoSendEnabled) localStorage.setItem("mc_auto_send", "true");
      else localStorage.removeItem("mc_auto_send");
    } catch {}
  }, [autoSendEnabled]);

  useEffect(() => {
    try { localStorage.setItem("mc_selected_sector", selectedSector); } catch {}
  }, [selectedSector]);

  useEffect(() => {
    try { localStorage.setItem("mc_auto_update", autoUpdate.toString()); } catch {}
  }, [autoUpdate]);

  useEffect(() => {
    if (signalToast) {
      const t = setTimeout(() => setSignalToast(null), 2000);
      return () => clearTimeout(t);
    }
  }, [signalToast]);

  const sectorOptions = useMemo(() => {
    return [
      { key: "bonus", displayName: "Todos os Bônus", color: "#ec4899", payout: 8 },
      ...SECTOR_DEFINITIONS.map(s => ({
        key: s.key,
        displayName: s.displayName,
        color: s.color,
        payout: s.key === "1" ? 1 : 
                s.key === "2" ? 2 : 
                s.key === "5" ? 5 : 
                s.key === "10" ? 10 : 
                s.key === "coin_flip" ? 11 : 
                s.key === "pachinko" ? 19 : 
                s.key === "cash_hunt" ? 22 : 45
      }))
    ];
  }, []);

  const activeSectorConfig = useMemo(() => {
    return sectorOptions.find(s => s.key === selectedSector) || sectorOptions[0];
  }, [selectedSector, sectorOptions]);

  const chronologicalSpins = useMemo(() => [...allSpins].reverse(), [allSpins]);

  // Hit rate simulation (direct, G1, G2) for each sector
  const calcHitRates = useCallback((targetSector: string): { direct: number; g1: number; g2: number } => {
    const totalEntries = Math.min(50, chronologicalSpins.length - 3);
    if (totalEntries < 5) return { direct: 0, g1: 0, g2: 0 };
    let directHits = 0, g1Hits = 0, g2Hits = 0, attempts = 0;
    for (let i = 0; i < totalEntries; i++) {
      const isTargetHit = (spin: ParsedSpin) => {
        if (targetSector === "bonus") return spin.isBonus;
        return spin.sectorKey === targetSector;
      };
      if (isTargetHit(chronologicalSpins[i])) directHits++;
      if (isTargetHit(chronologicalSpins[i]) || (chronologicalSpins[i + 1] && isTargetHit(chronologicalSpins[i + 1]))) g1Hits++;
      if (isTargetHit(chronologicalSpins[i]) || 
          (chronologicalSpins[i + 1] && isTargetHit(chronologicalSpins[i + 1])) ||
          (chronologicalSpins[i + 2] && isTargetHit(chronologicalSpins[i + 2]))) g2Hits++;
      attempts++;
    }
    return {
      direct: Math.round((directHits / attempts) * 100),
      g1: Math.round((g1Hits / attempts) * 100),
      g2: Math.round((g2Hits / attempts) * 100),
    };
  }, [chronologicalSpins]);
  const hitRatesCache = useRef<Record<string, { direct: number; g1: number; g2: number }>>({});
  const getHitRates = useCallback((sector: string) => {
    if (!hitRatesCache.current[sector]) hitRatesCache.current[sector] = calcHitRates(sector);
    return hitRatesCache.current[sector];
  }, [calcHitRates]);

  // Delay stats map for pattern generation
  const delayStatsMap = useMemo(() => {
    const map: Record<string, { currentDelay: number; p80: number; p90: number; severity: string; pressurePercentage: number }> = {};
    
    SECTOR_DEFINITIONS.forEach(sector => {
      const indices: number[] = [];
      for (let i = 0; i < chronologicalSpins.length; i++) {
        if (chronologicalSpins[i].sectorKey === sector.key) {
          indices.push(i);
        }
      }
      const currentDelay = indices.length > 0 ? indices[0] : chronologicalSpins.length;
      const intervals: number[] = [];
      for (let j = 0; j < indices.length - 1; j++) {
        intervals.push(indices[j+1] - indices[j]);
      }
      const sorted = [...intervals].sort((a, b) => a - b);
      const getP = (p: number) => {
        if (sorted.length === 0) return Math.round(1 / sector.theoreticalProbability);
        const idx = Math.floor(sorted.length * p);
        return sorted[idx] !== undefined ? sorted[idx] : sorted[sorted.length - 1];
      };
      const p80 = getP(0.8);
      const p90 = getP(0.9);
      const returnsBefore = intervals.filter(v => v <= currentDelay).length;
      const pressure = intervals.length > 0 
        ? Math.round((returnsBefore / intervals.length) * 100)
        : Math.round(Math.min(100, (currentDelay / (1 / sector.theoreticalProbability)) * 50));

      let severity = "normal";
      if (currentDelay >= p90) severity = "critical";
      else if (currentDelay >= p80) severity = "danger";
      else if (currentDelay >= (intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 1/sector.theoreticalProbability)) severity = "warning";

      map[sector.key] = { currentDelay, p80, p90, severity, pressurePercentage: pressure };
    });

    // Also for combined "bonus"
    const bonusDelay = Math.max(
      ...SECTOR_DEFINITIONS.filter(s => s.isBonus).map(s => map[s.key]?.currentDelay || 0)
    );
    map["bonus"] = { currentDelay: bonusDelay, p80: 0, p90: 0, severity: "normal", pressurePercentage: 0 };

    return map;
  }, [chronologicalSpins]);

  // Generate candle patterns
  const patterns = useMemo(() => {
    return generateCandlePatterns(chronologicalSpins, selectedSector, candlePeriodMinutes, delayStatsMap);
  }, [chronologicalSpins, selectedSector, candlePeriodMinutes, delayStatsMap]);

  // Build OHLC chart candles from time intervals
  const chartCandles = useMemo(() => {
    const intervalMs = candlePeriodMinutes * 60 * 1000;
    if (chronologicalSpins.length < 2) return [];
    const payout = activeSectorConfig.payout;
    const key = activeSectorConfig.key;
    const isHitSector = (spin: ParsedSpin) => key === "bonus" ? spin.isBonus : spin.sectorKey === key;

    let balance = 1000;
    const candles: any[] = [];
    const oldestTime = chronologicalSpins[chronologicalSpins.length - 1].timestamp;
    const newestTime = chronologicalSpins[0].timestamp;
    let intervalStart = newestTime;

    while (intervalStart > oldestTime) {
      const intervalEnd = intervalStart;
      intervalStart = intervalStart - intervalMs;
      const chunk = chronologicalSpins.filter(
        s => s.timestamp >= intervalStart && s.timestamp < intervalEnd
      );
      if (chunk.length < 1) continue;

      const openBalance = balance;
      let highBalance = balance;
      let lowBalance = balance;
      let hits = 0;

      // Process chronologically oldest-first within the chunk
      [...chunk].reverse().forEach(spin => {
        const hit = isHitSector(spin);
        if (hit) {
          balance += payout;
          hits++;
        } else {
          balance -= 1;
        }
        if (balance > highBalance) highBalance = balance;
        if (balance < lowBalance) lowBalance = balance;
      });

      candles.push({
        open: openBalance,
        high: highBalance,
        low: lowBalance,
        close: balance,
        isGreen: balance >= openBalance,
        volume: hits,
        volumePct: Math.round((hits / chunk.length) * 100),
        spinsCount: chunk.length,
        timeLabel: new Date(intervalStart).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      });
    }
    return candles.reverse(); // oldest → newest
  }, [chronologicalSpins, activeSectorConfig, candlePeriodMinutes]);

  // Auto-send logic
  useEffect(() => {
    if (!autoSendEnabled || !isConfigured) return;
    if (patterns.length === 0) return;

    const strongestPattern = patterns[0];
    // Include latest spin timestamp so each new spin triggers a fresh signal
    const key = `${strongestPattern.name}|${strongestPattern.targetSectors.join(",")}|${chronologicalSpins[0]?.timestamp || ""}`;
    if (key === lastAutoSentKey.current) return;

    if (strongestPattern.strength === "forte" || strongestPattern.strength === "moderada") {
      lastAutoSentKey.current = key;
      const spots = mapSectorsToSpots(strongestPattern.targetSectors);
      if (spots.length > 0) {
        sendSignal({ spots, betAmount: 0.5 });
        setSignalToast({ type: "success", message: `📡 Sinal enviado: ${strongestPattern.name}` });
      }
    }
  }, [patterns, autoSendEnabled, isConfigured, sendSignal, chronologicalSpins]);

  const handleSendPattern = async (pattern: CandlePattern, betAmount: number = 0.5) => {
    if (!extensionId) {
      setSignalToast({ type: "error", message: "Configure o ID da extensão primeiro!" });
      return;
    }
    const spots = mapSectorsToSpots(pattern.targetSectors);
    if (spots.length === 0) {
      setSignalToast({ type: "error", message: "Não foi possível mapear os setores para spots" });
      return;
    }
    try {
      await sendSignal({ spots, betAmount });
      setSignalToast({ type: "success", message: `📡 Sinal enviado para ${pattern.targetSectors.join(", ")}` });
    } catch {
      setSignalToast({ type: "error", message: "Erro ao enviar sinal" });
    }
  };

  const getProbColor = (text: string) => {
    if (text.includes("🔥🔥")) return "text-rose-400 bg-rose-500/15 border-rose-500/30";
    if (text.includes("🔥")) return "text-amber-400 bg-amber-500/15 border-amber-500/30";
    if (text.includes("Forte") || text.includes("Alta") || text.includes("Confirmada")) return "text-emerald-400 bg-emerald-500/15 border-emerald-500/30";
    return "text-yellow-300 bg-yellow-500/10 border-yellow-500/20";
  };

  const getStrengthIcon = (strength: string) => {
    if (strength === "forte") return <Flame size={14} className="text-rose-400" />;
    if (strength === "moderada") return <Zap size={14} className="text-amber-400" />;
    return <Activity size={14} className="text-yellow-300" />;
  };

  const getTypeIcon = (type: string) => {
    if (type === "bullish") return <ArrowUp size={14} className="text-emerald-400" />;
    if (type === "bearish") return <ArrowDown size={14} className="text-rose-400" />;
    return <Minus size={14} className="text-slate-400" />;
  };

  return (
    <div className="glass-panel p-6 rounded-2xl w-full text-left" id="candle-cataloger-panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/5 border border-emerald-400/10 px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 mb-2">
            <Layers size={11} className="animate-pulse" /> Catalogador de Padrões & Velas
          </span>
          <h3 className="font-display text-lg font-black text-white flex items-center gap-2">
            Análise de Probabilidade por Padrões de Vela
          </h3>
          <p className="text-xs text-slate-400">
            Detecta formações clássicas de candlestick adaptadas ao Crazy Time para indicar momentos de alta probabilidade de aparição de números/bônus.
          </p>
        </div>

        {/* Auto-send toggle */}
        {isConfigured && (
          <button
            onClick={() => setAutoSendEnabled(!autoSendEnabled)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              autoSendEnabled
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10"
                : "bg-white/5 text-slate-400 border border-white/10 hover:text-white"
            }`}
          >
            <Send size={11} />
            {autoSendEnabled ? "🌀 Auto Ativo" : "Auto Desligado"}
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white/[0.015] border border-white/5 p-4 rounded-xl mb-6">
        {/* Sector Picker */}
        <div className="col-span-1 md:col-span-4 flex flex-col gap-1.5 text-left">
          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide">Analisar Setor</label>
          <div className="relative">
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="w-full bg-[#0b0b10] border border-white/10 rounded-xl px-3.5 py-2 text-xs font-sans font-bold text-white outline-none cursor-pointer focus:border-[#d4a84c] transition-all"
              style={{ WebkitAppearance: 'menulist' }}
            >
              {sectorOptions.map((opt) => (
                <option key={opt.key} value={opt.key} style={{ color: opt.color }}>
                  {opt.displayName} (Pagamento: {opt.payout}x)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Candle Period - read-only indicator */}
        <div className="col-span-1 md:col-span-3 flex flex-col gap-1.5 text-left">
          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide">Período por Vela</label>
          <div className="bg-[#0b0b10] border border-white/5 rounded-xl h-[38px] flex items-center px-4">
            <span className="text-xs font-mono font-bold text-indigo-400">
              {formatPeriodLabel(candlePeriodMinutes)} por vela <span className="text-slate-500">(global)</span>
            </span>
          </div>
        </div>

        {/* Signal Config */}
        <div className="col-span-1 md:col-span-5 flex flex-col gap-1.5 text-left">
          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide">Envio para Extensão</label>
          <div className="flex items-center gap-2">
            <div className={`flex-1 text-[10px] font-mono px-3 py-2 rounded-xl border ${
              isConfigured 
                ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
                : "bg-rose-500/5 border-rose-500/20 text-rose-400"
            }`}>
              {isConfigured ? "🟢 Extensão Configurada" : "🔴 Configure o ID da Extensão"}
            </div>
          </div>
        </div>
      </div>

      {/* Signal Toast */}
      <AnimatePresence>
        {signalToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mb-4 px-4 py-2 rounded-xl text-xs font-mono font-bold border ${
              signalToast.type === "success" 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            }`}
          >
            {signalToast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 📊 CANDLESTICK CHART */} 
      {chartCandles.length > 0 && (() => {
        const svgW = 800;
        const svgH = 200;
        const pad = 40;
        const maxVal = Math.max(...chartCandles.map(c => c.high));
        const minVal = Math.min(...chartCandles.map(c => c.low));
        const range = maxVal - minVal || 100;
        const getX = (i: number) => pad + (i / Math.max(1, chartCandles.length - 1)) * (svgW - pad * 2);
        const getY = (v: number) => svgH - 20 - ((v - minVal) / range) * (svgH - 40);
        const w = Math.min(16, Math.max(4, (svgW - pad * 2) / (chartCandles.length * 2)));

        return (
          <div className="border border-white/5 rounded-2xl bg-black/40 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 size={13} className="text-indigo-400" />
                Gráfico de Velas — {activeSectorConfig.displayName} ({formatPeriodLabel(candlePeriodMinutes)})
              </h4>
              <span className="text-[9px] font-mono text-slate-500">{chartCandles.length} velas</span>
            </div>
            <div className="w-full overflow-x-auto select-none">
              <svg viewBox={`0 0 ${svgW} ${svgH}`} className="min-w-[600px] h-[180px] md:h-[200px]">
                {[0.25, 0.5, 0.75].map(r => {
                  const v = minVal + range * r;
                  return (
                    <g key={r}>
                      <line x1={pad} y1={getY(v)} x2={svgW} y2={getY(v)} stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                      <text x={2} y={getY(v) - 2} fill="rgba(255,255,255,0.15)" fontSize="7" fontFamily="monospace">{Math.round(v)}</text>
                    </g>
                  );
                })}
                {chartCandles.map((c, i) => {
                  const cx = getX(i);
                  const color = c.isGreen ? "#10b981" : "#ef4444";
                  const candleH = Math.max(1.5, Math.abs(getY(c.close) - getY(c.open)));
                  const candleY = Math.min(getY(c.open), getY(c.close));
                  return (
                    <g key={i}>
                      <line x1={cx} y1={getY(c.high)} x2={cx} y2={getY(c.low)} stroke={color} strokeWidth="1.2" />
                      <rect x={cx - w / 2} y={candleY} width={w} height={candleH} fill={color} opacity="0.8" rx="0.5" />
                    </g>
                  );
                })}
                {/* Time labels */}
                {chartCandles.filter((_, i) => i % Math.max(1, Math.floor(chartCandles.length / 6)) === 0).map((c, i, arr) => {
                  const idx = chartCandles.indexOf(c);
                  return (
                    <text key={i} x={getX(idx)} y={svgH - 4} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7" fontFamily="monospace">
                      {c.timeLabel}
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>
        );
      })()}

      {/* PATTERNS DISPLAY */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-display font-bold text-white text-sm flex items-center gap-2">
            <Target size={16} className="text-[#d4a84c]" />
            Padrões Detectados para <span style={{ color: activeSectorConfig.color }}>{activeSectorConfig.displayName}</span>
          </h4>
          <span className="text-[10px] font-mono text-slate-500">
            {patterns.length} padrão(ns) encontrado(s)
          </span>
        </div>

        {patterns.length === 0 ? (
          <div className="bg-white/[0.015] border border-white/5 rounded-2xl p-10 text-center">
            <div className="flex flex-col items-center gap-3">
              <Eye size={32} className="text-slate-600" />
              <p className="text-sm font-mono text-slate-500">
                Nenhum padrão de vela identificado para <strong className="text-slate-300">{activeSectorConfig.displayName}</strong> no momento.
              </p>
              <p className="text-xs text-slate-600">
                Continue monitorando — padrões aparecem quando há sequências relevantes de acertos/erros.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {patterns.map((pattern, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white/[0.012] border border-white/5 rounded-2xl p-4 hover:bg-white/[0.02] hover:border-white/10 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-1">
                    {getTypeIcon(pattern.type)}
                    <div>
                      <h5 className="text-sm font-black text-white leading-tight">
                        {pattern.name}
                      </h5>
                      <span className={`text-[9px] font-mono font-black uppercase mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${getProbColor(pattern.probabilityText)}`}>
                        {getStrengthIcon(pattern.strength)}
                        {pattern.probabilityText}
                      </span>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-[9px] font-mono font-bold uppercase border ${
                    pattern.type === "bullish" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                    pattern.type === "bearish" ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                    "bg-slate-500/10 border-slate-500/20 text-slate-400"
                  }`}>
                    {pattern.type === "bullish" ? "📈 PROBABILIDADE ALTA" : pattern.type === "bearish" ? "📉 QUEDA" : "NEUTRO"}
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  {pattern.description}
                </p>

                {/* Hit rates with gales */}
                <div className="flex items-center gap-2 mb-3">
                  {(() => {
                    const hr = getHitRates(pattern.targetSectors[0]);
                    return (
                      <>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/15">
                          <span className="text-[8px] font-mono font-bold text-emerald-400">Direto</span>
                          <span className="text-[9px] font-mono font-black text-emerald-300">{hr.direct}%</span>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/15">
                          <span className="text-[8px] font-mono font-bold text-amber-400">G1</span>
                          <span className="text-[9px] font-mono font-black text-amber-300">{hr.g1}%</span>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/15">
                          <span className="text-[8px] font-mono font-bold text-rose-400">G2</span>
                          <span className="text-[9px] font-mono font-black text-rose-300">{hr.g2}%</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Target size={11} className="text-[#d4a84c]" />
                    <span className="text-[10px] font-mono text-slate-400">
                      Alvo: <strong className="text-white">{pattern.targetSectors.join(", ")}</strong>
                    </span>
                  </div>

                  {isConfigured && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSendPattern(pattern, 0.5)}
                        className="px-2.5 py-1.5 rounded-lg text-[9px] font-mono font-bold bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Send size={10} />
                        📡 Enviar
                      </button>
                      <button
                        onClick={() => setAutoSendEnabled(!autoSendEnabled)}
                        className={`px-2.5 py-1.5 rounded-lg text-[9px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          autoSendEnabled
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-white/5 text-slate-400 border border-white/10 hover:text-white"
                        }`}
                      >
                        🌀 {autoSendEnabled ? "Auto ON" : "Auto OFF"}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Legend / Explanation */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[10px] font-mono text-slate-500 bg-white/[0.01] px-4 py-3 rounded-xl border border-white/5">
        <span className="flex items-center gap-1.5">
          <ArrowUp size={11} className="text-emerald-400" />
          <strong className="text-emerald-400 mr-1">Alta</strong> — Probabilidade de aparição aumentando
        </span>
        <span className="flex items-center gap-1.5">
          <ArrowDown size={11} className="text-rose-400" />
          <strong className="text-rose-400 mr-1">Baixa</strong> — Probabilidade diminuindo
        </span>
        <span className="flex items-center gap-1.5">
          <Flame size={11} className="text-rose-400" />
          <strong className="text-rose-400 mr-1">Forte</strong> — Sinal consistente
        </span>
        <span className="flex items-center gap-1.5">
          <Zap size={11} className="text-amber-400" />
          <strong className="text-amber-400 mr-1">Moderada</strong> — Sinal em formação
        </span>
        <span className="flex items-center gap-1.5">
          <Activity size={11} className="text-yellow-300" />
          <strong className="text-yellow-300 mr-1">Fraca</strong> — Sinal preliminar
        </span>
      </div>

      {/* Explanation of adapted patterns */}
      <div className="mt-6 bg-white/[0.01] border border-white/5 rounded-2xl p-5">
        <h4 className="font-display font-bold text-white text-sm flex items-center gap-2 mb-4">
          <HelpCircle size={16} className="text-[#d4a84c]" />
          Como os Padrões de Vela se Aplicam ao Crazy Time
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400 leading-relaxed">
          <div className="bg-[#0b0b10] border border-white/5 rounded-xl p-4">
            <h5 className="text-white font-bold mb-2 flex items-center gap-1.5">
              <ArrowUp size={13} className="text-emerald-400" /> Padrões de Alta (Probabilidade Forte)
            </h5>
            <ul className="space-y-1.5">
              <li><strong className="text-emerald-400">Engolfo de Alta:</strong> Período fraco seguido de recuperação forte → setor pode estar voltando</li>
              <li><strong className="text-emerald-400">Martelo:</strong> Longa sequência sem o setor seguida de aparição → fundo formado</li>
              <li><strong className="text-emerald-400">Três Soldados:</strong> Aparições consecutivas → momentum positivo confirmado</li>
              <li><strong className="text-emerald-400">Estrela da Manhã:</strong> Queda → indecisão → alta → reversão completa</li>
              <li><strong className="text-rose-400">⚠️ Crítico por Atraso:</strong> Setor excedeu o limiar máximo histórico de retorno</li>
            </ul>
          </div>
          <div className="bg-[#0b0b10] border border-white/5 rounded-xl p-4">
            <h5 className="text-white font-bold mb-2 flex items-center gap-1.5">
              <Clock size={13} className="text-amber-400" /> Gatilhos para Envio de Sinais
            </h5>
            <ul className="space-y-1.5">
              <li><strong className="text-amber-400">Automático:</strong> Ative 🌀 Auto para enviar sinais automaticamente quando padrões fortes forem detectados</li>
              <li><strong className="text-amber-400">Manual:</strong> Clique 📡 Enviar em qualquer padrão para enviar o sinal para a extensão</li>
              <li><strong className="text-amber-400">Delay integrado:</strong> Padrões de atraso (Martelo, Crítico) já consideram a análise de ciclos</li>
              <li><strong className="text-amber-400">Extensão:</strong> A extensão Chrome executa os cliques automaticamente na página de apostas</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
