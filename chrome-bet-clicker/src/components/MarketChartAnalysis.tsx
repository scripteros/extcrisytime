import { ParsedSpin } from "../types";
import { SECTOR_DEFINITIONS } from "../data";
import { 
  TrendingUp, TrendingDown, Layers, Percent, BarChart3, 
  HelpCircle, Info, Sliders, Play, Settings, AlertCircle, Sparkles
} from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";

interface MarketChartAnalysisProps {
  allSpins: ParsedSpin[];
}

export default function MarketChartAnalysis({ allSpins }: MarketChartAnalysisProps) {
  const [selectedSector, setSelectedSector] = useState<string>("bonus"); // default to all bonuses combined
  const [candleSize, setCandleSize] = useState<number>(10); // spins per candle
  const [selectedCataloger, setSelectedCataloger] = useState<string>("mhi"); // "mhi", "twin_towers", "best_of_three"
  const [useGale, setUseGale] = useState<number>(2); // 0 = sem gale, 1 = gale 1, 2 = gale 2
  const [hoveredCandle, setHoveredCandle] = useState<any | null>(null);

  // Sector list including combined "bonus"
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

  // Translate spins array to chronologically ascending sequence for market chart (from past to present)
  const chronologicalSpins = useMemo(() => {
    return [...allSpins].reverse();
  }, [allSpins]);

  // 1. Generate Candle Data (OHLC) from balance simulation
  const candleData = useMemo(() => {
    if (chronologicalSpins.length === 0) return [];

    const payout = activeSectorConfig.payout;
    const key = activeSectorConfig.key;

    let balance = 1000; // Starting virtual asset balance
    const candles: any[] = [];
    const totalSpinsCount = chronologicalSpins.length;

    // Split chronological spins into chunks of size `candleSize`
    for (let i = 0; i < totalSpinsCount; i += candleSize) {
      const chunk = chronologicalSpins.slice(i, i + candleSize);
      if (chunk.length < 2) continue; // skip trailing odd spin to keep candles proportional

      const openBalance = balance;
      let highBalance = balance;
      let lowBalance = balance;
      let hits = 0;

      // Simulate sequential bets inside this candle
      chunk.forEach((spin) => {
        const isHit = key === "bonus" 
          ? spin.isBonus 
          : spin.sectorKey === key;

        if (isHit) {
          balance += payout; // bet size is 1, so balance increases by payout (effectively payout-1 net, but let's align typical coin index)
          hits++;
        } else {
          balance -= 1; // loss of bet size 1
        }

        if (balance > highBalance) highBalance = balance;
        if (balance < lowBalance) lowBalance = balance;
      });

      const closeBalance = balance;

      candles.push({
        id: `candle-${i}`,
        open: openBalance,
        high: highBalance,
        low: lowBalance,
        close: closeBalance,
        isGreen: closeBalance >= openBalance,
        volume: hits,
        volumePercentage: Math.round((hits / chunk.length) * 100),
        spinsCount: chunk.length,
        startIndex: i,
        endIndex: i + chunk.length - 1,
      });
    }

    // Include simple MA indicators
    return candles.map((c, idx, arr) => {
      // SMA 5
      const slice5 = arr.slice(Math.max(0, idx - 4), idx + 1);
      const sma5 = slice5.reduce((sum, item) => sum + item.close, 0) / slice5.length;

      // SMA 10
      const slice10 = arr.slice(Math.max(0, idx - 9), idx + 1);
      const sma10 = slice10.reduce((sum, item) => sum + item.close, 0) / slice10.length;

      return {
        ...c,
        sma5: parseFloat(sma5.toFixed(1)),
        sma10: parseFloat(sma10.toFixed(1)),
      };
    });
  }, [chronologicalSpins, activeSectorConfig, candleSize]);

  // 2. Pattern Cataloger Engine (MHI, Torres Gêmeas, Melhor de Três)
  const catalogerStats = useMemo(() => {
    if (chronologicalSpins.length === 0) return null;

    const spinsCount = chronologicalSpins.length;
    const isHit = (spin: ParsedSpin) => {
      return selectedSector === "bonus" 
        ? spin.isBonus 
        : spin.sectorKey === selectedSector;
    };

    let totalPatterns = 0;
    let winDirect = 0; // Win with no Gale
    let winG1 = 0; // Win on first Gale
    let winG2 = 0; // Win on second Gale
    let losses = 0;

    const sequenceDetails: any[] = [];

    if (selectedCataloger === "mhi") {
      // MHI: Groups of 5 spins. Analyze first 3. Predict same minority for 4th, 5th, 6th.
      for (let i = 0; i <= spinsCount - 6; i += 5) {
        const s1 = isHit(chronologicalSpins[i]);
        const s2 = isHit(chronologicalSpins[i+1]);
        const s3 = isHit(chronologicalSpins[i+2]);

        // Find minority: true (Hit), false (Miss)
        const hitCount = (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s3 ? 1 : 0);
        const minority = hitCount < 2; // true if Miss/false is minority, false if Hit/true is minority

        const nextSpins = [
          isHit(chronologicalSpins[i+3]), // Slot 4
          isHit(chronologicalSpins[i+4]), // Slot 5
          isHit(chronologicalSpins[i+5]), // Slot 6
        ];

        totalPatterns++;

        let status = "loss";
        if (nextSpins[0] === minority) {
          status = "win_direct";
          winDirect++;
        } else if (useGale >= 1 && nextSpins[1] === minority) {
          status = "win_g1";
          winG1++;
        } else if (useGale >= 2 && nextSpins[2] === minority) {
          status = "win_g2";
          winG2++;
        } else {
          losses++;
        }

        sequenceDetails.push({
          index: totalPatterns,
          input: [s1, s2, s3], // false = Miss, true = Hit
          predicted: minority,
          results: nextSpins,
          status,
          spinsSlice: chronologicalSpins.slice(i, i + 6),
        });
      }
    } else if (selectedCataloger === "twin_towers") {
      // Torres Gêmeas (Twin Towers): Groups of 8 spins. First 2 must match the last 2.
      // E.g., we predict spin 7 and 8 will match spin 1 and 2.
      for (let i = 0; i <= spinsCount - 8; i += 8) {
        const s1 = isHit(chronologicalSpins[i]);
        const s2 = isHit(chronologicalSpins[i+1]);

        const target1 = s1;
        const target2 = s2;

        const current7 = isHit(chronologicalSpins[i+6]);
        const current8 = isHit(chronologicalSpins[i+7]);

        totalPatterns++;

        // Twin towers win definition: spin 7 == spin 1 AND spin 8 == spin 2
        let status = "loss";
        if (current7 === target1 && current8 === target2) {
          status = "win_direct";
          winDirect++;
        } else if (useGale >= 1) {
          // If Gale is enabled: we check adjacent pairs or allow 1 retry on spin 8-9 (simple sim)
          const backup7 = i + 8 < spinsCount ? isHit(chronologicalSpins[i+7]) : false;
          const backup8 = i + 9 < spinsCount ? isHit(chronologicalSpins[i+8]) : false;
          
          if (backup7 === target1 && backup8 === target2) {
            status = "win_g1";
            winG1++;
          } else {
            losses++;
          }
        } else {
          losses++;
        }

        sequenceDetails.push({
          index: totalPatterns,
          input: [s1, s2],
          predicted: [target1, target2],
          results: [current7, current8],
          status,
          spinsSlice: chronologicalSpins.slice(i, i + 8),
        });
      }
    } else {
      // Melhor de Três (Best of Three): Analyse groups of 3 spins. 
      // Rule: In any group of 3 consecutive spins, the majority determines the trigger.
      // Often, we predict that the next spin will be the OPPOSITE (reversal strategy) or the SAME.
      // Standard Best of Three Reversal: If we have 3 of the same, back opposite.
      for (let i = 0; i <= spinsCount - 4; i += 3) {
        const s1 = isHit(chronologicalSpins[i]);
        const s2 = isHit(chronologicalSpins[i+1]);
        const s3 = isHit(chronologicalSpins[i+2]);

        const hitCount = (s1 ? 1 : 0) + (s2 ? 1 : 0) + (s3 ? 1 : 0);
        const majority = hitCount >= 2; // true if Hit is majority, false if Miss is majority
        
        // Predict that next spin (spin 4) will match the majority (Trend follow)
        const nextSpin = isHit(chronologicalSpins[i+3]);
        const nextSpinG1 = i + 4 < spinsCount ? isHit(chronologicalSpins[i+4]) : null;
        const nextSpinG2 = i + 5 < spinsCount ? isHit(chronologicalSpins[i+5]) : null;

        totalPatterns++;

        let status = "loss";
        if (nextSpin === majority) {
          status = "win_direct";
          winDirect++;
        } else if (useGale >= 1 && nextSpinG1 === majority) {
          status = "win_g1";
          winG1++;
        } else if (useGale >= 2 && nextSpinG2 === majority) {
          status = "win_g2";
          winG2++;
        } else {
          losses++;
        }

        sequenceDetails.push({
          index: totalPatterns,
          input: [s1, s2, s3],
          predicted: majority,
          results: [nextSpin, nextSpinG1, nextSpinG2],
          status,
          spinsSlice: chronologicalSpins.slice(i, i + 4),
        });
      }
    }

    // Totals aggregation
    const winsTotal = winDirect + (useGale >= 1 ? winG1 : 0) + (useGale >= 2 ? winG2 : 0);
    const accuracy = totalPatterns > 0 ? parseFloat(((winsTotal / totalPatterns) * 100).toFixed(1)) : 0;

    return {
      totalPatterns,
      winDirect,
      winG1,
      winG2,
      losses,
      accuracy,
      sequenceDetails: sequenceDetails.reverse().slice(0, 40), // oldest to newest, limit display to latest 40 patterns cataloged
    };
  }, [chronologicalSpins, selectedSector, selectedCataloger, useGale]);

  // Dimension helpers for the SVG Candlestick layout
  const svgWidth = 800;
  const svgHeight = 220;
  const paddingY = 20;
  const paddingX = 40;

  // Compute scale boundaries for drawing candlesticks
  const scales = useMemo(() => {
    if (candleData.length === 0) return { min: 400, max: 1600 };
    
    // Find absolute high and low across all candles to fit SVG
    let max = Math.max(...candleData.map(c => Math.max(c.high, c.sma5, c.sma10)));
    let min = Math.min(...candleData.map(c => Math.min(c.low, c.sma5, c.sma10)));

    // Add 5% buffer zone
    const diff = max - min || 100;
    max += diff * 0.08;
    min -= diff * 0.08;

    return { min, max };
  }, [candleData]);

  // Transform coordinates to pixel positions
  const getX = (index: number) => {
    if (candleData.length <= 1) return paddingX;
    return paddingX + (index / (candleData.length - 1)) * (svgWidth - paddingX * 2);
  };

  const getY = (val: number) => {
    const range = scales.max - scales.min;
    if (range === 0) return svgHeight / 2;
    return svgHeight - paddingY - ((val - scales.min) / range) * (svgHeight - paddingY * 2);
  };

  // SVG lines coordinates for moving averages
  const ma5Path = useMemo(() => {
    return candleData
      .map((c, idx) => `${getX(idx).toFixed(1)},${getY(c.sma5).toFixed(1)}`)
      .join(" ");
  }, [candleData, scales]);

  const ma10Path = useMemo(() => {
    return candleData
      .map((c, idx) => `${getX(idx).toFixed(1)},${getY(c.sma10).toFixed(1)}`)
      .join(" ");
  }, [candleData, scales]);

  return (
    <div className="glass-panel p-6 rounded-2xl w-full text-left" id="financial-analysis-panel">
      
      {/* Header and Telemetry */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6" id="market-header">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-yellow-400 bg-yellow-400/5 border border-yellow-400/10 px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 mb-2">
            <Sparkles size={11} className="animate-pulse" /> Simulador de Mercado & Velas
          </span>
          <h3 className="font-display text-lg font-black text-white flex items-center gap-2">
            Simulador Gráfico de Velas (Candlesticks) e Catalogador de Padrões
          </h3>
          <p className="text-xs text-slate-400">
            Simulação financeira de compra/venda onde os acertos elevam o preço do ativo e erros depreciam sua paridade.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 border border-white/5 rounded-xl bg-white/[0.01] p-1 self-start sm:self-center">
          {["mhi", "twin_towers", "best_of_three"].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedCataloger(type)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-black uppercase tracking-wider transition-all cursor-pointer ${
                selectedCataloger === type
                  ? "bg-[#d4a84c] text-black shadow-md font-bold"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {type === "mhi" ? "MHI" : type === "twin_towers" ? "Torres Gêmeas" : "Melhor de 3"}
            </button>
          ))}
        </div>
      </div>

      {/* Control Board */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white/[0.015] border border-white/5 p-4 rounded-xl mb-6">
        
        {/* Sector Picker */}
        <div className="col-span-1 md:col-span-4 flex flex-col gap-1.5 text-left">
          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide">Selecionar Paridade de Setor</label>
          <div className="relative">
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="w-full bg-[#0b0b10] border border-white/10 rounded-xl px-3.5 py-2 text-xs font-sans font-bold text-white outline-none cursor-pointer focus:border-[#d4a84c] transition-all"
              style={{ WebkitAppearance: 'menulist' }}
            >
              {sectorOptions.map((opt) => (
                <option key={opt.key} value={opt.key} style={{ color: opt.color }}>
                  {opt.displayName} (Simulação: {opt.payout}x)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Candle Period Modifier */}
        <div className="col-span-1 md:col-span-3 flex flex-col gap-1.5 text-left">
          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide">Período por Vela (Rodadas)</label>
          <div className="grid grid-cols-4 gap-1 bg-[#0b0b10] p-1 border border-white/5 rounded-xl h-[38px] items-center">
            {[5, 10, 15, 20].map((size) => (
              <button
                key={size}
                onClick={() => setCandleSize(size)}
                className={`h-full rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  candleSize === size
                    ? "bg-white/15 text-white"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                {size}r
              </button>
            ))}
          </div>
        </div>

        {/* Gale Retries */}
        <div className="col-span-1 md:col-span-3 flex flex-col gap-1.5 text-left">
          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide">Martingale (Recuperação)</label>
          <div className="grid grid-cols-3 gap-1 bg-[#0b0b10] p-1 border border-white/5 rounded-xl h-[38px] items-center">
            {[0, 1, 2].map((gale) => (
              <button
                key={gale}
                onClick={() => setUseGale(gale)}
                className={`h-full rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  useGale === gale
                    ? "bg-pink-500/20 text-pink-300 border border-pink-500/20"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                {gale === 0 ? "Sem Gale" : `Gale ${gale}`}
              </button>
            ))}
          </div>
        </div>

        {/* Analytics Display Mini-widget */}
        <div className="col-span-1 md:col-span-2 bg-[#0e0e15] border border-white/5 rounded-xl p-2.5 flex flex-col justify-center items-center text-center font-mono">
          <span className="text-[9px] text-slate-500 uppercase font-black">Assertividade</span>
          <span className="text-xl font-black text-emerald-400 mt-0.5">
            {catalogerStats?.accuracy}%
          </span>
          <span className="text-[8px] text-slate-400 uppercase tracking-wide leading-none mt-0.5">
            {catalogerStats?.winDirect}/{catalogerStats?.totalPatterns} Padrões
          </span>
        </div>
      </div>

      {/* CANDLESTICK CHART AREA */}
      <div className="border border-white/5 rounded-2xl bg-black/40 overflow-hidden relative" id="market-candlestick-area">
        
        {/* Floating details banner */}
        <div className="absolute top-3 left-4 text-[10px] font-mono text-slate-400 z-10 flex gap-4 bg-black/60 p-2 rounded-lg border border-white/5 select-none md:flex-row flex-col">
          <span>Paridade: <strong className="text-white uppercase font-black">{activeSectorConfig.displayName}</strong></span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Indicador 9r (Verde)</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Indicador 21r (Rosa)</span>
        </div>

        {/* Candlestick SVG Container */}
        <div className="w-full overflow-x-auto select-none mt-5 md:mt-2 scrollbar-none">
          <div className="min-w-[800px] h-[240px] px-2 relative pt-4">
            <svg 
              className="w-full h-[220px]" 
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              preserveAspectRatio="none"
            >
              {/* Grids and price lines */}
              {[0.25, 0.5, 0.75].map((ratio, i) => {
                const stepVal = scales.min + (scales.max - scales.min) * ratio;
                return (
                  <g key={i}>
                    <line 
                      x1={0} 
                      y1={getY(stepVal)} 
                      x2={svgWidth} 
                      y2={getY(stepVal)} 
                      stroke="rgba(255,255,255,0.02)" 
                      strokeDasharray="4 4"
                    />
                    <text 
                      x={6} 
                      y={getY(stepVal) - 4} 
                      fill="rgba(255,255,255,0.2)" 
                      fontSize="8" 
                      fontFamily="monospace"
                    >
                      {Math.round(stepVal)} pts
                    </text>
                  </g>
                );
              })}

              {/* Candles group */}
              {candleData.map((candle, idx) => {
                const cx = getX(idx);
                const cyOpen = getY(candle.open);
                const cyClose = getY(candle.close);
                const cyHigh = getY(candle.high);
                const cyLow = getY(candle.low);

                const color = candle.isGreen ? "#10b981" : "#f43f5e";
                const w = Math.min(22, Math.max(8, (svgWidth - paddingX * 2) / (candleData.length * 1.5)));

                const candleHeight = Math.max(2, Math.abs(cyClose - cyOpen));
                const candleY = Math.min(cyOpen, cyClose);

                return (
                  <g 
                    key={candle.id}
                    className="cursor-pointer group"
                    onMouseEnter={() => setHoveredCandle(candle)}
                    onMouseLeave={() => setHoveredCandle(null)}
                  >
                    {/* Shadow / Wick */}
                    <line 
                      x1={cx} 
                      y1={cyHigh} 
                      x2={cx} 
                      y2={cyLow} 
                      stroke={color} 
                      strokeWidth="1.5"
                    />

                    {/* Real body */}
                    <rect 
                      x={cx - w / 2} 
                      y={candleY} 
                      width={w} 
                      height={candleHeight} 
                      fill={color}
                      opacity="0.85"
                      className="transition-all group-hover:opacity-100 group-hover:stroke-white group-hover:stroke-1"
                      rx="1"
                    />

                    {/* Interactive hover glow circle */}
                    <circle 
                      cx={cx} 
                      cy={cyClose} 
                      r="4" 
                      fill="transparent" 
                      className="group-hover:fill-white group-hover:ring-2 group-hover:ring-white/20 transition-all"
                    />
                  </g>
                );
              })}

              {/* Indicator Lines Overlay (MA5 & MA10) */}
              <polyline 
                fill="none" 
                stroke="#10b981" 
                strokeWidth="1.2" 
                points={ma5Path} 
                opacity="0.55"
              />
              <polyline 
                fill="none" 
                stroke="#d946ef" 
                strokeWidth="1.2" 
                points={ma10Path} 
                opacity="0.55"
              />

            </svg>
          </div>
        </div>

        {/* Bottom Drawer showing hovered candle coordinates */}
        <div className="h-14 border-t border-white/5 bg-black/60 px-4 flex items-center justify-between text-xs font-mono uppercase select-none">
          {hoveredCandle ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-slate-300 w-full justify-between">
              <span className="text-[10px] text-slate-500 font-bold">DETALHES DA VELA:</span>
              <span>Abertura: <strong className="text-white">{Math.round(hoveredCandle.open)} pts</strong></span>
              <span>Fechamento: <strong className="text-white">{Math.round(hoveredCandle.close)} pts</strong></span>
              <span>Alta: <strong className="text-emerald-400">{Math.round(hoveredCandle.high)}</strong></span>
              <span>Baixa: <strong className="text-rose-400">{Math.round(hoveredCandle.low)}</strong></span>
              <span className="text-[10px] font-bold text-[#d4a84c]">Hits no período: {hoveredCandle.volume} / {hoveredCandle.spinsCount} ({hoveredCandle.volumePercentage}%)</span>
            </div>
          ) : (
            <span className="text-slate-500 text-[10px]">Passe o cursor do mouse sobre uma vela para visualizar os dados de balanço estatístico</span>
          )}
        </div>
      </div>

      {/* SECTION 2: PATTERN CATALOGER DASHBOARD */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6" id="cataloger-dashboard">
        
        {/* Left column: Pattern Strategy rules & stats */}
        <div className="col-span-1 lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white/[0.015] border border-white/5 rounded-2xl p-5 text-left">
            <h4 className="font-display font-bold text-white text-base mb-3 flex items-center gap-2">
              <Layers size={18} className="text-[#d4a84c]" />
              Catálogo de Padrão: {selectedCataloger === "mhi" ? "Estratégia MHI" : selectedCataloger === "twin_towers" ? "Torres Gêmeas" : "Melhor de Três"}
            </h4>

            {/* Pattern Explanatory paragraph based on selected */}
            <div className="text-xs text-slate-400 leading-relaxed space-y-2 mb-4">
              {selectedCataloger === "mhi" && (
                <>
                  <p>
                    <strong>Estratégia MHI:</strong> Analisa ciclos fixos de 5 rodadas. Identifica o comportamento das 3 primeiras e prevê que a 4ª rodada será a <strong>minorataria</strong> (o resultado que saiu menos vezes: seja Hit ou Miss).
                  </p>
                  <p className="text-[10px] font-mono text-pink-400 bg-pink-400/5 px-2 py-1 rounded inline-block">
                    Se falhar na 4ª, aplica Gale 1 na 5ª e Gale 2 na 6ª rodada respectivamente.
                  </p>
                </>
              )}

              {selectedCataloger === "twin_towers" && (
                <>
                  <p>
                    <strong>Cores Gêmeas (Twin Towers):</strong> Identifica blocos simétricos de 8 giros. Analisa o resultado dos primeiros 2 giros e presume estabilidade: prevê que os giros 7 e 8 serão idênticos aos giros 1 e 2.
                  </p>
                  <p className="text-[10px] font-mono text-pink-400 bg-pink-400/5 px-2 py-1 rounded inline-block">
                    Se houver desvio, projeta a paridade para o bloco seguinte.
                  </p>
                </>
              )}

              {selectedCataloger === "best_of_three" && (
                <>
                  <p>
                    <strong>Melhor de Três:</strong> Analisa grupos de 3 rodadas consecutivas. A predição é que a 4ª rodada seguirá a tendência da <strong>maioria</strong> das 3 anteriores para capturar fluxos de repetição rápida da roleta.
                  </p>
                  <p className="text-[10px] font-mono text-pink-400 bg-pink-400/5 px-2 py-1 rounded inline-block">
                    Ideal para setores frequentes de alta dispersão (como o número 1 ou número 2).
                  </p>
                </>
              )}
            </div>

            {/* Micro details metrics panel */}
            <div className="grid grid-cols-2 gap-3" id="pattern-payout-numbers">
              <div className="bg-[#0b0b10] border border-white/5 rounded-xl p-3 text-left">
                <span className="text-[9px] font-mono text-slate-500 uppercase block">Vitórias Diretas</span>
                <span className="font-mono text-base font-extrabold text-emerald-400">
                  {catalogerStats?.winDirect} <span className="text-xs text-slate-400 font-normal">({catalogerStats && catalogerStats.totalPatterns > 0 ? ((catalogerStats.winDirect / catalogerStats.totalPatterns) * 100).toFixed(0) : 0}%)</span>
                </span>
              </div>

              <div className="bg-[#0b0b10] border border-white/5 rounded-xl p-3 text-left">
                <span className="text-[9px] font-mono text-slate-500 uppercase block">Gale Recuperado</span>
                <span className="font-mono text-base font-extrabold text-amber-300">
                  {catalogerStats && (catalogerStats.winG1 + catalogerStats.winG2)} <span className="text-xs text-slate-400 font-normal">({catalogerStats && catalogerStats.totalPatterns > 0 ? (((catalogerStats.winG1 + catalogerStats.winG2) / catalogerStats.totalPatterns) * 100).toFixed(0) : 0}%)</span>
                </span>
              </div>

              <div className="bg-[#0b0b10] border border-white/5 rounded-xl p-3 text-left">
                <span className="text-[9px] font-mono text-slate-500 uppercase block">Perdas Reais (Loss)</span>
                <span className="font-mono text-base font-extrabold text-rose-500">
                  {catalogerStats?.losses} <span className="text-xs text-slate-400 font-normal">({catalogerStats && catalogerStats.totalPatterns > 0 ? ((catalogerStats.losses / catalogerStats.totalPatterns) * 100).toFixed(0) : 0}%)</span>
                </span>
              </div>

              <div className="bg-[#0b0b10] border border-white/5 rounded-xl p-3 text-left">
                <span className="text-[9px] font-mono text-slate-500 uppercase block">Total Padrões</span>
                <span className="font-mono text-base font-extrabold text-white">
                  {catalogerStats?.totalPatterns}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Interactive list of evaluated sequences under standard Double rules */}
        <div className="col-span-1 lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white/[0.012] border border-white/5 rounded-2xl p-5 flex-1 flex flex-col justify-between">
            <div className="text-left">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-display font-bold text-white text-sm flex items-center gap-1.5 uppercase">
                  <BarChart3 size={15} className="text-[#ec4899]" />
                  Sequências do Catalogador Real-Time (Histórico Crescente)
                </h4>
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                  <span>Limite de Exibição: 40 Ciclos</span>
                </div>
              </div>

              {/* Grid of micro-bubble charts representing success and failures sequentially */}
              <div className="flex flex-wrap gap-2.5 max-h-[220px] overflow-y-auto pr-1 select-none" id="pattern-bubble-details">
                {catalogerStats?.sequenceDetails.map((seq, idx) => {
                  let badgeBg = "bg-rose-500/10 border-rose-500/20 text-rose-400";
                  let label = "Loss";
                  if (seq.status === "win_direct") {
                    badgeBg = "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
                    label = "Vitória";
                  } else if (seq.status === "win_g1") {
                    badgeBg = "bg-amber-500/10 border-amber-500/30 text-amber-400";
                    label = "Gale 1";
                  } else if (seq.status === "win_g2") {
                    badgeBg = "bg-yellow-500/10 border-yellow-500/30 text-yellow-300";
                    label = "Gale 2";
                  }

                  return (
                    <div 
                      key={idx}
                      className={`px-3 py-2 border rounded-xl flex items-center gap-2 text-xs font-mono transition-all hover:bg-white/[0.03] hover:border-white/15 ${badgeBg}`}
                    >
                      <span className="font-black text-[10px]">CÍCLO #{seq.index}</span>
                      <span className="text-[10px] uppercase font-bold shrink-0">{label}</span>
                      
                      {/* Displays sub-indicators */}
                      <div className="flex items-center gap-1">
                        {seq.input.map((val: boolean, valIdx: number) => (
                          <span 
                            key={valIdx}
                            className={`w-1.5 h-1.5 rounded-full ${val ? "bg-[#d4a84c]" : "bg-slate-700"}`}
                            title={val ? "Hit" : "Miss"}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {catalogerStats?.sequenceDetails.length === 0 && (
                  <div className="w-full text-center py-10 font-mono text-slate-500 text-xs">
                    Dados insuficientes de giros para a montagem dos padrões. Modifique as opções para recarregar o catalogador adaptativo.
                  </div>
                )}
              </div>
            </div>

            {/* Mini suggestion label */}
            <div className="mt-4 pt-4 border-t border-white/[0.04] text-[10px] font-mono text-slate-500 text-left flex items-start gap-1.5 leading-relaxed">
              <AlertCircle size={12} className="text-yellow-400 shrink-0 mt-0.5" />
              <span>
                <strong>Aviso de probabilidade:</strong> A taxa de acerto direta ou em Gale 1-2 é condicionada pelo RTP nativo do setor. No Crazy Time, buscar padrões MHI em setores bônus como 'Crazy Time' (1.85%) pode ter sequências longas de erro, enquanto em setores numéricos comuns (como '1' ou '2') a estabilidade dinâmica do MHI costuma ficar em torno de 85% a 92% com Gale 2.
              </span>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
