import { useState, useEffect, useRef } from "react";
import { ParsedSpin } from "../types";
import { Play, Pause, RotateCcw, AlertTriangle, TrendingUp, TrendingDown, DollarSign, ListOrdered, CheckSquare, Square, Zap, HelpCircle, Send, Wifi } from "lucide-react";
import { SECTOR_DEFINITIONS } from "../data";
import { useSignalRelay, mapSectorsToSpots } from "../hooks/useSignalRelay";

interface BetSimulatorProps {
  spins: ParsedSpin[]; // Raw spins array, index 0 is most recent
  crazyTimeFlapper: "alternate" | "Green" | "Blue" | "Yellow";
  setCrazyTimeFlapper: (v: "alternate" | "Green" | "Blue" | "Yellow") => void;
}

interface BetLog {
  id: string;
  spinIndex: number;
  sectorDisplayName: string;
  multiplier: number;
  betAmountPerSector: number;
  totalBetAmount: number;
  selectedSectors: string[];
  galeStep: number;
  netResult: number;
  bankrollAfter: number;
  isSystemLog?: boolean;
  activeFlapperColor?: "Green" | "Blue" | "Yellow";
}

const formatBRL = (val: number) => {
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function BetSimulator({ spins, crazyTimeFlapper, setCrazyTimeFlapper }: BetSimulatorProps) {
  // Simulator configuration
  const [initialBankroll, setInitialBankroll] = useState<number>(() => {
    const saved = localStorage.getItem("bs_initial_bankroll");
    return saved ? parseFloat(saved) : 50;
  });
  const [baseBet, setBaseBet] = useState<number>(() => {
    const saved = localStorage.getItem("bs_base_bet");
    return saved ? parseFloat(saved) : 0.50;
  });
  const [progressionType, setProgressionType] = useState<"martingale" | "soros">("martingale");
  const [maxGales, setMaxGales] = useState<number>(2);
  const [maxSorosLevels, setMaxSorosLevels] = useState<number>(3);
  const [sorosReinvestPercent, setSorosReinvestPercent] = useState<number>(100);
  const [selectedSectors, setSelectedSectors] = useState<string[]>(["1", "2"]); // Default safe strategy
  const [isLiveEnabled, setIsLiveEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem("bs_live_enabled") === "true"; }
    catch { return false; }
  });

  // States
  const [currentBankroll, setCurrentBankroll] = useState<number>(1000);
  const [galeStep, setGaleStep] = useState<number>(0);
  const [sorosStep, setSorosStep] = useState<number>(0);
  const [sorosAccumulatedProfit, setSorosAccumulatedProfit] = useState<number>(0);
  const [logs, setLogs] = useState<BetLog[]>([]);
  const [totalPlacedBetsCount, setTotalPlacedBetsCount] = useState<number>(0);
  const [winsCount, setWinsCount] = useState<number>(0);
  const [lossesCount, setLossesCount] = useState<number>(0);
  const [maxDrawdown, setMaxDrawdown] = useState<number>(0);
  const [peakBankroll, setPeakBankroll] = useState<number>(1000);
  const [isBankrollBroken, setIsBankrollBroken] = useState<boolean>(false);

  // Signal relay for extension
  const { extensionId, sendSignal, isConfigured } = useSignalRelay();
  const [signalToast, setSignalToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [autoSendSimulator, setAutoSendSimulator] = useState<boolean>(() => {
    try { return localStorage.getItem("bs_auto_send") === "true"; } catch { return false; }
  });
  useEffect(() => {
    try {
      if (autoSendSimulator) localStorage.setItem("bs_auto_send", "true");
      else localStorage.removeItem("bs_auto_send");
    } catch {}
  }, [autoSendSimulator]);

  useEffect(() => {
    try { localStorage.setItem("bs_initial_bankroll", initialBankroll.toString()); } catch {}
  }, [initialBankroll]);

  useEffect(() => {
    try { localStorage.setItem("bs_base_bet", baseBet.toString()); } catch {}
  }, [baseBet]);

  // Backtest specific states
  const [backtestChartHistory, setBacktestChartHistory] = useState<number[]>([]);
  const [hasPerformedBacktest, setHasPerformedBacktest] = useState<boolean>(false);

  // Keep track of evaluated spins to prevent duplication in live updates
  const lastProcessedSpinId = useRef<string | null>(null);

  // Reset simulation stats
  const handleReset = () => {
    setCurrentBankroll(initialBankroll);
    setGaleStep(0);
    setSorosStep(0);
    setSorosAccumulatedProfit(0);
    setLogs([]);
    setTotalPlacedBetsCount(0);
    setWinsCount(0);
    setLossesCount(0);
    setMaxDrawdown(0);
    setPeakBankroll(initialBankroll);
    setBacktestChartHistory([]);
    setHasPerformedBacktest(false);
    setIsBankrollBroken(false);
    if (spins[0]) {
      lastProcessedSpinId.current = spins[0].id;
    }
  };

  // Toggle selection
  const toggleSector = (key: string) => {
    setSelectedSectors((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Run simulation on a list of spins ordered chronologically (oldest first)
  const runSimulationOnBatch = (batchSpins: ParsedSpin[], isBacktest: boolean = false) => {
    if (selectedSectors.length === 0) return;

    // Reject processing if is already broken to block simulation if balance is exhausted
    if (!isBacktest && isBankrollBroken) {
      return;
    }

    let bankroll = isBacktest ? initialBankroll : currentBankroll;
    let step = isBacktest ? 0 : (progressionType === "martingale" ? galeStep : sorosStep);
    let accumulatedProfit = isBacktest ? 0 : sorosAccumulatedProfit;
    let peak = isBacktest ? initialBankroll : peakBankroll;
    let maxDd = isBacktest ? 0 : maxDrawdown;
    let wins = isBacktest ? 0 : winsCount;
    let losses = isBacktest ? 0 : lossesCount;
    let totalBets = isBacktest ? 0 : totalPlacedBetsCount;
    const newLogs: BetLog[] = isBacktest ? [] : [...logs];
    const localHistoryPoints: number[] = [bankroll];
    let localIsBroken = false;

    batchSpins.forEach((spin, index) => {
      if (localIsBroken) return;

      // Calculate current bet amount per sector based on Progression type
      let betPerSector = baseBet;

      if (progressionType === "martingale") {
        const currentMultiplier = Math.pow(2, step);
        betPerSector = baseBet * currentMultiplier;
      } else if (progressionType === "soros" && step > 0) {
        // Reinvest is based on the profit of previous step
        const reinvestmentAmount = (accumulatedProfit * (sorosReinvestPercent / 100)) / selectedSectors.length;
        betPerSector = baseBet + reinvestmentAmount;
      }

      const totalBetAmount = betPerSector * selectedSectors.length;

      // STRICT LIMIT: If balance is less than required bet, the bank is officially broken for this simulation progress
      if (bankroll < totalBetAmount) {
        localIsBroken = true;
        newLogs.unshift({
          id: `broken-${spin.id}-${index}-${Date.now()}`,
          spinIndex: totalBets + 1,
          sectorDisplayName: "ALERTA",
          multiplier: 0,
          betAmountPerSector: betPerSector,
          totalBetAmount,
          selectedSectors: [...selectedSectors],
          galeStep: step,
          netResult: 0,
          bankrollAfter: bankroll,
          isSystemLog: true
        });
        return;
      }

      // Deduct bet from bankroll
      bankroll -= totalBetAmount;
      totalBets += 1;

      // Check result
      const isWinner = selectedSectors.includes(spin.sectorKey);
      let netResult = -totalBetAmount;

      if (isWinner) {
        // Winning calculation: In Crazy Time (as in most casino games), the winning payout returns the initial bet amount
        // alongside the net win (profit). Thus, the total payout multiplier is spin.maxMultiplier + 1 for ALL sectors
        // (both numeric sectors and bonus stages, as confirmed by the official rules).
        const winPayoutMultiplier = spin.maxMultiplier + 1;
        const winPayout = betPerSector * winPayoutMultiplier;
        netResult = winPayout - totalBetAmount;
        bankroll += winPayout; // Bankroll gets the payout return
      }

      // Update Peak / Max Drawdown
      if (bankroll > peak) {
        peak = bankroll;
      }
      const dd = peak - bankroll;
      if (dd > maxDd) {
        maxDd = dd;
      }

      localHistoryPoints.push(bankroll);

      // Track win/loss & progression state transition
      if (netResult > 0) {
        wins += 1;
        
        if (progressionType === "martingale") {
          step = 0; // Reset Gale on win
        } else if (progressionType === "soros") {
          // Soros: accumulate net result to reinvest in next step
          accumulatedProfit = netResult;
          if (step < maxSorosLevels) {
            step += 1; // move up soros level
          } else {
            step = 0; // reached max, secure profit and reset to dry
            accumulatedProfit = 0;
          }
        }
      } else if (netResult < 0) {
        losses += 1;
        
        if (progressionType === "martingale") {
          // Increase Martingale step
          if (step < maxGales) {
            step += 1;
          } else {
            step = 0; // Limit reached, reset to dry
          }
        } else if (progressionType === "soros") {
          // Soros resets completely on loss
          step = 0;
          accumulatedProfit = 0;
        }
      }

      // Push custom log
      newLogs.unshift({
        id: `${spin.id}-${totalBets}-${index}`,
        spinIndex: totalBets,
        sectorDisplayName: spin.displayName,
        multiplier: spin.maxMultiplier,
        betAmountPerSector: betPerSector,
        totalBetAmount,
        selectedSectors: [...selectedSectors],
        galeStep: step,
        netResult,
        bankrollAfter: bankroll,
        activeFlapperColor: spin.activeFlapperColor
      });
    });

    // Update React states
    setCurrentBankroll(bankroll);
    if (progressionType === "martingale") {
      setGaleStep(step);
    } else {
      setSorosStep(step);
      setSorosAccumulatedProfit(accumulatedProfit);
    }
    setPeakBankroll(peak);
    setMaxDrawdown(maxDd);
    setWinsCount(wins);
    setLossesCount(losses);
    setTotalPlacedBetsCount(totalBets);
    setLogs(newLogs.slice(0, 100)); // Keep last 100 logs
    if (localIsBroken) {
      setIsBankrollBroken(true);
    }

    if (isBacktest) {
      setBacktestChartHistory(localHistoryPoints);
      setHasPerformedBacktest(true);
    }
  };

  // Run backtest over the 100 historical spins loaded (oldest to newest)
  const handleRunBacktest = () => {
    if (spins.length === 0) return;
    // Chronological order: oldest spins have higher indices
    const chronologicalSpins = [...spins].reverse();
    runSimulationOnBatch(chronologicalSpins, true);
  };

  // Live monitor effect
  useEffect(() => {
    if (!isLiveEnabled || spins.length === 0) return;

    const latestSpin = spins[0];
    // Evaluate if there is an unhandled new spin
    if (latestSpin.id !== lastProcessedSpinId.current) {
      lastProcessedSpinId.current = latestSpin.id;
      // Process single live event
      runSimulationOnBatch([latestSpin], false);
      // Auto-send signal if enabled
      if (autoSendSimulator && selectedSectors.length > 0) {
        const spots = mapSectorsToSpots(selectedSectors);
        sendSignal({ spots, betAmount: baseBet });
      }
    }
  }, [spins, isLiveEnabled, autoSendSimulator]);

  // Handle manual activation
  const handleToggleLive = () => {
    if (!isLiveEnabled && spins[0]) {
      // Sync last processed to avoid double evaluating the latest spin immediately
      lastProcessedSpinId.current = spins[0].id;
    }
    setIsLiveEnabled(!isLiveEnabled);
  };

  const handleSendSignal = async () => {
    if (selectedSectors.length === 0) {
      setSignalToast({ type: "error", message: "Selecione pelo menos 1 setor!" });
      return;
    }
    const spots = mapSectorsToSpots(selectedSectors);
    try {
      await sendSignal({ spots, betAmount: baseBet });
      setSignalToast({ type: "success", message: `📡 Sinal: ${selectedSectors.join(", ")}` });
    } catch {
      setSignalToast({ type: "error", message: "Erro ao enviar sinal" });
    }
  };

  // Persist live toggle
  useEffect(() => {
    try { localStorage.setItem("bs_live_enabled", isLiveEnabled.toString()); } catch {}
  }, [isLiveEnabled]);
  const profitLoss = currentBankroll - initialBankroll;
  const roi = totalPlacedBetsCount > 0 ? (profitLoss / (baseBet * totalPlacedBetsCount)) * 100 : 0;
  const winRate = totalPlacedBetsCount > 0 ? (winsCount / totalPlacedBetsCount) * 100 : 0;

  return (
    <div className="glass-panel p-6 rounded-2xl w-full max-w-7xl mx-auto mb-8 relative z-10" id="bet-simulator-panel">
      {/* Visual top border glow */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-amber-500/0 via-amber-500/50 to-pink-500/0" />

      {/* Header section with status badges */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-white/5 pb-5 mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <Zap className="text-[#d4a84c] animate-pulse" size={22} />
            Estratégias de Opções: Martingale & Soros
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Simule virtualmente o desempenho do seu saldo usando táticas de <span className="text-amber-300 font-bold">Martingale (Gale)</span> ou <span className="text-[#ec4899] font-bold">Soros</span> sobre os giros consolidados da roleta.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleRunBacktest}
            className="px-4 py-2 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-500/40 text-blue-300 font-extrabold text-xs rounded-xl hover:from-blue-500/30 hover:to-indigo-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg"
          >
            <ListOrdered size={14} />
            Simular Histórico ({spins.length} Giros)
          </button>

          {/* Signal sending buttons */}
          {isConfigured && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSendSignal}
                disabled={selectedSectors.length === 0}
                className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={11} />
                📡 Enviar
              </button>
              <button
                onClick={() => setAutoSendSimulator(!autoSendSimulator)}
                className={`px-2.5 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                  autoSendSimulator
                    ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.25)]"
                    : "bg-white/[0.03] border-white/10 text-slate-500 hover:text-slate-300"
                }`}
              >
                <Wifi size={11} className={autoSendSimulator ? "animate-pulse" : ""} />
                Auto
              </button>
            </div>
          )}

          <button
            onClick={handleToggleLive}
            className={`px-4 py-2 rounded-xl border font-extrabold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              isLiveEnabled
                ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
            }`}
          >
            {isLiveEnabled ? <Pause size={14} /> : <Play size={14} />}
            {isLiveEnabled ? "Simulação Ativa (Ao Vivo)" : "Ativar Simulação Ao Vivo"}
          </button>

          <button
            onClick={handleReset}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl transition-all cursor-pointer"
            title="Resetar Banca e Estatísticas"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* Flapper Simulation Card */}
      <div className="glass-panel p-4 md:p-5 rounded-2xl border border-white/5 bg-gradient-to-r from-slate-900/40 to-slate-900/20 shadow-lg relative overflow-hidden mb-6">
        <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-[#d4a84c]/5 to-[#ec4899]/0 rounded-full filter blur-xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="max-w-xl">
            <h3 className="font-display font-black text-xs md:text-sm text-white uppercase tracking-wider flex items-center gap-2">
              <span className="p-1 px-1.5 bg-[#d4a84c]/10 text-[#d4a84c] rounded border border-[#d4a84c]/20 text-[10px]">🎯 NOVO</span>
              SIMULAÇÃO DE FLAPPER • CRAZY TIME BONUS
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Escolha qual cor de flapper simular. O catalogador, gráficos, histórico e o simulador de apostas recalcularão instantaneamente todos os resultados utilizando os multiplicadores da cor selecionada.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setCrazyTimeFlapper("alternate")}
              className={`px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer border transition-all ${
                crazyTimeFlapper === "alternate"
                  ? "bg-white/10 text-white border-white/25 shadow-md"
                  : "text-slate-400 border-transparent hover:text-white hover:bg-white/5"
              }`}
            >
              🔄 Alternar/Misto
            </button>

            <div className="h-4 w-[1px] bg-white/10 mx-1 hidden sm:block" />

            <button
              onClick={() => setCrazyTimeFlapper("Green")}
              className={`px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer border transition-all ${
                crazyTimeFlapper === "Green"
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                  : "text-slate-400 border-transparent hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Verde
            </button>

            <button
              onClick={() => setCrazyTimeFlapper("Blue")}
              className={`px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer border transition-all ${
                crazyTimeFlapper === "Blue"
                  ? "bg-blue-500/15 text-blue-300 border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                  : "text-slate-400 border-transparent hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              Azul
            </button>

            <button
              onClick={() => setCrazyTimeFlapper("Yellow")}
              className={`px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer border transition-all ${
                crazyTimeFlapper === "Yellow"
                  ? "bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                  : "text-slate-400 border-transparent hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Amarelo
            </button>
          </div>
        </div>
      </div>

      {isBankrollBroken && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/25 rounded-2xl flex items-start gap-3 text-sm text-rose-300 leading-relaxed font-sans shadow-lg animate-pulse" id="broken-bankroll-banner">
          <AlertTriangle className="shrink-0 text-rose-400 mt-0.5 animate-bounce" size={18} />
          <div>
            <p className="font-bold text-rose-400 uppercase tracking-wide text-xs">🚫 BANCA CRITICAMENTE QUEBRADA!</p>
            <p className="text-[11.5px] text-rose-300/90 mt-1">
              O simulador esgotou o saldo fictício disponível para apostas (Saldo Atual aproximado: <strong className="text-white font-mono">R$ {formatBRL(currentBankroll)}</strong>). As progressões foram travadas para proteger o seu balanceamento face à oscilação extrema da mesa. Por favor, mude o tipo de progressão, diminua o valor da aposta básica ou pressione <strong className="text-white">"⚙️ Resetar"</strong> no painel de controle acima.
            </p>
          </div>
        </div>
      )}

      {/* Signal Toast */}
      {signalToast && (
        <div className={`mb-4 px-4 py-2 rounded-xl text-xs font-mono font-bold border ${
          signalToast.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
            : "bg-rose-500/10 border-rose-500/20 text-rose-400"
        }`}>
          {signalToast.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Parameters Form */}
        <div className="lg:col-span-5 space-y-5 bg-black/20 p-5 rounded-2xl border border-white/5">
          <h4 className="text-xs font-mono uppercase text-[#d4a84c] tracking-widest font-bold">
            Configurar Método de Progressão
          </h4>

          {/* Type of Progression Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
            <button
              onClick={() => {
                setProgressionType("martingale");
                handleReset();
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                progressionType === "martingale"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-md"
                  : "text-slate-450 hover:text-white border border-transparent"
              }`}
            >
              🚀 Martingale
            </button>
            <button
              onClick={() => {
                setProgressionType("soros");
                handleReset();
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                progressionType === "soros"
                  ? "bg-[#ec4899]/20 text-pink-300 border border-pink-500/30 shadow-md"
                  : "text-slate-450 hover:text-white border border-transparent"
              }`}
            >
              🌊 Soros (Ganho Composto)
            </button>
          </div>

          {/* Bankroll & Base Bet Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Banca Inicial (R$)
              </label>
              <input
                type="number"
                value={initialBankroll}
                step="0.01"
                min="0.01"
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    const cleanVal = Math.max(0.01, val);
                    setInitialBankroll(cleanVal);
                    setCurrentBankroll(cleanVal);
                  }
                }}
                disabled={totalPlacedBetsCount > 0}
                className="w-full bg-[#12121a]/80 outline-none border border-white/10 text-white rounded-xl p-2.5 px-3 font-mono text-sm focus:border-amber-500/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Aposta por Setor (R$)
              </label>
              <input
                type="number"
                value={baseBet}
                step="0.01"
                min="0.01"
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    setBaseBet(Math.max(0.01, val));
                  }
                }}
                className="w-full bg-[#12121a]/80 outline-none border border-white/10 text-white rounded-xl p-2.5 px-3 font-mono text-sm focus:border-amber-500/40"
              />
            </div>
          </div>

          {/* Toggle params based on method */}
          {progressionType === "martingale" ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Níveis de Recuperação (Gale)
                </label>
                <span className="text-[10px] font-mono text-[#ec4899] font-bold">
                  Dobra Máxima: R$ {formatBRL(baseBet * Math.pow(2, maxGales))} por setor
                </span>
              </div>
              <select
                value={maxGales}
                onChange={(e) => setMaxGales(parseInt(e.target.value))}
                className="w-full bg-[#12121a]/80 outline-none border border-white/10 text-slate-200 rounded-xl p-2.5 text-xs focus:border-amber-500/40"
              >
                <option value={0}>Entrada Seca (Nenhum Gale - Sem dobrar)</option>
                <option value={1}>Até Gale 1 (Dobra 1 vez - Multiplica por 2)</option>
                <option value={2}>Até Gale 2 (Dobra 2 vezes - Multiplica por 4)</option>
                <option value={3}>Até Gale 3 (Dobra 3 vezes - Multiplica por 8)</option>
                <option value={4}>Até Gale 4 (Dobra 4 vezes - Multiplica por 16)</option>
                <option value={5}>Até Gale 5 (Dobra 5 vezes - Multiplica por 32)</option>
              </select>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Níveis de Soros
                  </label>
                  <span className="text-[10px] font-mono text-pink-450 font-bold">
                    Acumular até nível {maxSorosLevels}
                  </span>
                </div>
                <select
                  value={maxSorosLevels}
                  onChange={(e) => setMaxSorosLevels(parseInt(e.target.value))}
                  className="w-full bg-[#12121a]/80 outline-none border border-white/10 text-slate-200 rounded-xl p-2.5 text-xs focus:border-amber-500/40"
                >
                  <option value={1}>Soros Nível 1 (1 Lucro Reinvestido)</option>
                  <option value={2}>Soros Nível 2 (2 Lucros Consecutivos Reinvestidos)</option>
                  <option value={3}>Soros Nível 3 (3 Lucros Consecutivos Reinvestidos)</option>
                  <option value={4}>Soros Nível 4 (4 Lucros Consecutivos Reinvestidos)</option>
                  <option value={5}>Soros Nível 5 (5 Lucros Consecutivos Reinvestidos)</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                  <span className="uppercase tracking-wider">Porcentagem do Lucro Reinvestido</span>
                  <span className="text-white font-mono">{sorosReinvestPercent}%</span>
                </div>
                <div className="flex gap-2">
                  {[50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setSorosReinvestPercent(pct)}
                      className={`flex-1 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all ${
                        sorosReinvestPercent === pct
                          ? "bg-pink-500/20 border-pink-500 text-pink-300"
                          : "bg-white/5 border-white/5 text-slate-450 hover:bg-white/10"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Select Sectors Grid */}
          <div className="space-y-2.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Setores para Apostar ({selectedSectors.length} selecionados)
            </label>
            
            <div className="grid grid-cols-4 gap-2">
              {SECTOR_DEFINITIONS.map((sector) => {
                const isSelected = selectedSectors.includes(sector.key);
                return (
                  <button
                    key={sector.key}
                    onClick={() => toggleSector(sector.key)}
                    className={`p-2 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1.5 cursor-pointer relative overflow-hidden group ${
                      isSelected
                        ? "bg-white/10 text-white border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                        : "bg-[#12121a]/40 border-white/5 text-slate-500 hover:border-white/10"
                    }`}
                  >
                    {/* Tiny visual badge */}
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sector.color }} />
                    <span className="truncate max-w-full text-[10px]">{sector.displayName}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic summary of active stake */}
          <div className="p-3.5 bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/5 rounded-xl flex items-center justify-between" id="active-stake-summary">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Custo de Entrada por Rodada
              </span>
              <span className="text-[11px] text-slate-400 mt-1">
                {selectedSectors.length} {selectedSectors.length === 1 ? "setor selecionado" : "setores selecionados"} × R$ {formatBRL(baseBet)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Aposta Total Estimada:</span>
              <span className="text-sm font-black text-amber-400 font-mono">
                R$ {formatBRL(baseBet * selectedSectors.length)}
              </span>
            </div>
          </div>

          {/* Risk Alert Info */}
          <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/10 flex items-start gap-2 text-[10.5px] text-amber-400/90 leading-relaxed font-sans">
            <AlertTriangle className="shrink-0 mt-0.5" size={14} />
            <div>
              {progressionType === "martingale" ? (
                <span>
                  <span className="font-bold">Princípio do Martingale:</span> Ao perder uma entrada, o simulador dobra o valor apostado na rodada seguinte para reaver o saldo e lucrar com o Payout. Tenha ciência de que Gales elevados podem consumir sua banca em sequências frias.
                </span>
              ) : (
                <span>
                  <span className="font-bold">Princípio de Soros:</span> Ao vencer, os seus lucros líquidos daquela rodada são reinvestidos na próxima aposta. O objetivo é criar lucros em bola de neve limitando suas perdas à aposta inicial de cada ciclo de níveis!
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Performance Dashboard & Bets Log */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Dashboard statistics panel */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <div className="bg-[#12121a]/60 backdrop-blur-xl border border-white/10 p-3.5 rounded-2xl shadow-lg">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 font-sans">Banca Atual</p>
              <p className="text-xl font-mono font-bold text-white">
                R$ {formatBRL(currentBankroll)}
              </p>
              <div className="flex items-center gap-1 mt-1 font-mono text-[9px]">
                {profitLoss >= 0 ? (
                  <span className="text-emerald-400 flex items-center gap-0.5">
                    <TrendingUp size={10} /> +{roi.toFixed(1)}% ROI
                  </span>
                ) : (
                  <span className="text-red-400 flex items-center gap-0.5">
                    <TrendingDown size={10} /> {roi.toFixed(1)}% ROI
                  </span>
                )}
              </div>
            </div>

            <div className="bg-[#12121a]/60 backdrop-blur-xl border border-white/10 p-3.5 rounded-2xl shadow-lg">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 font-sans">Lucro / Prejuízo</p>
              <p className={`text-xl font-mono font-bold ${profitLoss >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {profitLoss >= 0 ? "+" : ""}R$ {formatBRL(profitLoss)}
              </p>
              <span className="text-[9px] text-slate-400">Desde o início</span>
            </div>

            <div className="bg-[#12121a]/60 backdrop-blur-xl border border-white/10 p-3.5 rounded-2xl shadow-lg">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 font-sans">Taxa de Win</p>
              <p className="text-xl font-mono font-bold text-white">
                {winRate.toFixed(1)}<span className="text-xs text-slate-400">%</span>
              </p>
              <p className="text-[9px] text-slate-400 mt-1 font-mono">
                {winsCount}W - {lossesCount}L
              </p>
            </div>

            <div className="bg-[#12121a]/60 backdrop-blur-xl border border-white/10 p-3.5 rounded-2xl shadow-lg">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 font-sans">
                {progressionType === "martingale" ? "Gale Atual / Ddown" : "Nível Soros / Ddown"}
              </p>
              <p className="text-xl font-mono font-bold text-[#ec4899]">
                {progressionType === "martingale"
                  ? (galeStep > 0 ? `Level ${galeStep}` : "Dry")
                  : (sorosStep > 0 ? `Nível ${sorosStep}/${maxSorosLevels}` : "Base")}
              </p>
              <p className="text-[9px] text-slate-400 mt-1">
                Max DD: <span className="font-mono text-red-400 font-bold">R$ {formatBRL(maxDrawdown)}</span>
              </p>
            </div>

          </div>

          {/* Historical Bankroll Simulation Graph if performed */}
          {hasPerformedBacktest && backtestChartHistory.length > 0 && (
            <div className="bg-[#12121a]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4.5 shadow-lg flex flex-col">
              <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                <div>
                  <h4 className="text-xs font-mono uppercase text-blue-400 font-bold">
                    📈 Gráfico de Evolução de Saldo Fictício (Histórico {spins.length} Giros)
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Veja as oscilações da sua banca após simular as últimas {spins.length} rodadas reais que já saíram.
                  </p>
                </div>
                <div className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${
                  currentBankroll >= initialBankroll
                    ? "bg-green-500/15 border-green-500/30 text-green-400"
                    : "bg-red-500/15 border-red-500/30 text-red-500"
                }`}>
                  {currentBankroll >= initialBankroll ? "👍 TERMINOU NO LUCRO" : "📉 TERMINOU EM PREJUÍZO"}
                </div>
              </div>

              {/* Sparkline Custom SVG Chart */}
              <div className="h-[120px] w-full mt-2 relative overflow-visible">
                {(() => {
                  const data = backtestChartHistory;
                  const minVal = Math.min(...data);
                  const maxVal = Math.max(...data);
                  const valRange = maxVal - minVal || 1;
                  const pointsCount = data.length;
                  const isProfitable = currentBankroll >= initialBankroll;

                  // Build smooth path points
                  const points = data
                    .map((val, idx) => {
                      const x = (idx / (pointsCount - 1)) * 500;
                      // invert height
                      const y = 100 - ((val - minVal) / valRange) * 85;
                      return `${x},${y}`;
                    })
                    .join(" ");

                  // Full area points closing with the baseline
                  const baselineY = 110;
                  const areaPoints = `0,${baselineY} ${points} 500,${baselineY}`;

                  return (
                    <svg
                      viewBox="0 0 500 120"
                      className="w-full h-full overflow-visible"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={isProfitable ? "#10b981" : "#ef4444"} stopOpacity="0.25" />
                          <stop offset="100%" stopColor={isProfitable ? "#10b981" : "#ef4444"} stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Gridline guidelines */}
                      <line x1="0" y1="15" x2="500" y2="15" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1="0" y1="57.5" x2="500" y2="57.5" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1="0" y1="100" x2="500" y2="100" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="3 3" />

                      {/* Initial Bankroll reference line */}
                      {(() => {
                        const referenceY = 100 - ((initialBankroll - minVal) / valRange) * 85;
                        return (
                          <line
                            x1="0"
                            y1={referenceY}
                            x2="500"
                            y2={referenceY}
                            stroke="rgba(212, 168, 76, 0.25)"
                            strokeWidth="1"
                            strokeDasharray="4 2"
                            title="Banca Inicial"
                          />
                        );
                      })()}

                      {/* Filled area */}
                      <polygon points={areaPoints} fill="url(#chart-area-grad)" />

                      {/* Beautiful signal path line */}
                      <polyline
                        fill="none"
                        stroke={isProfitable ? "#10b981" : "#f43f5e"}
                        strokeWidth="2"
                        points={points}
                        className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                      />

                      {/* Accent highlight points on extremities */}
                      <circle cx="0" cy={100 - ((initialBankroll - minVal) / valRange) * 85} r="3" fill="#d4a84c" />
                      <circle cx="500" cy={100 - ((currentBankroll - minVal) / valRange) * 85} r="4" fill={isProfitable ? "#34d399" : "#fb7185"} />
                    </svg>
                  );
                })()}
                
                {/* Visual axis overlay indicators */}
                <div className="absolute top-1 left-2 text-[8px] font-mono text-slate-500">
                  Máximo: R$ {Math.round(Math.max(...backtestChartHistory))}
                </div>
                <div className="absolute bottom-1.5 left-2 text-[8px] font-mono text-amber-500/70">
                  Inicial: R$ {initialBankroll}
                </div>
                <div className="absolute bottom-1.5 right-2 text-[8px] font-mono text-slate-500 text-right">
                  Mínimo: R$ {Math.round(Math.min(...backtestChartHistory))}
                </div>
              </div>
            </div>
          )}

          {/* Simulation activity log list */}
          <div className="bg-[#12121a]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col h-[280px]">
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
              <h5 className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Rodadas Simuladas ({totalPlacedBetsCount})
              </h5>
              <span className="text-[9px] text-slate-500 font-mono">
                EXIBINDO ÚLTIMOS RESULTADOS
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-4">
                  <DollarSign size={28} className="text-slate-600 mb-2" />
                  <p className="text-xs font-sans">Nenhuma aposta realizada ainda.</p>
                  <p className="text-[10px] text-slate-600 mt-1 max-w-sm">
                    Simule os resultados que já saíram para saber se estaria no lucro! Clique no botão <span className="text-blue-300 font-bold">"Simular Histórico ({spins.length} Giros)"</span> no topo.
                  </p>
                </div>
              ) : (
                logs.map((log) => {
                  if (log.isSystemLog) {
                    return (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 font-mono text-[11px]"
                        id={`system-log-broke-${log.id}`}
                      >
                        <div className="flex items-center gap-2 text-rose-400">
                          <AlertTriangle size={15} className="animate-pulse" />
                          <span className="font-bold uppercase tracking-wider text-[10px]">Banca Quebrada!</span>
                          <span className="text-slate-400 text-[10.5px]">Aposta de R$ {formatBRL(log.totalBetAmount)} ({log.selectedSectors.length}x R$ {formatBRL(log.betAmountPerSector)}) recusada por saldo insuficiente de R$ {formatBRL(log.bankrollAfter)}.</span>
                        </div>
                        <span className="text-rose-500 font-mono font-bold text-[9px] uppercase tracking-wider">Bloqueado</span>
                      </div>
                    );
                  }
                  const isWon = log.netResult >= 0;
                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-black/10 hover:bg-black/20 transition-all font-mono text-[11px]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 font-mono text-[10px]">#{log.spinIndex}</span>
                        
                        {/* Chip of winning sector */}
                        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 font-bold text-white text-[10px] flex items-center gap-1.5">
                          {log.sectorDisplayName} {log.multiplier > 1 && `(${log.multiplier}x)`}
                        </span>

                        {log.activeFlapperColor && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono leading-none inline-block border ${
                            log.activeFlapperColor === "Green" ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 font-bold" :
                            log.activeFlapperColor === "Blue" ? "bg-blue-500/10 border-blue-500/25 text-blue-400 font-bold" :
                            "bg-amber-500/10 border-amber-500/25 text-amber-400 font-bold"
                          }`}>
                            Flapper: {log.activeFlapperColor === "Green" ? "Verde" : log.activeFlapperColor === "Blue" ? "Azul" : "Amarelo"}
                          </span>
                        )}

                        <div className="hidden sm:flex flex-col text-[10px] text-slate-400">
                          <span>Aposta: R$ {formatBRL(log.totalBetAmount)} ({log.selectedSectors.length}x R$ {formatBRL(log.betAmountPerSector)})</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className={`font-bold ${isWon ? "text-emerald-400" : "text-rose-400"}`}>
                            {isWon ? "+" : ""}R$ {formatBRL(log.netResult)}
                          </p>
                          <p className="text-[9px] text-slate-500">Banca: R$ {formatBRL(log.bankrollAfter)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {logs.length > 0 && totalPlacedBetsCount > logs.length && (
                <div className="text-center p-3 mt-1.5 rounded-xl border border-white/5 bg-white/[0.01]" id="sliced-logs-note">
                  <p className="text-[10px] text-slate-500 font-sans">
                    ... +{totalPlacedBetsCount - logs.length} rodadas anteriores ocultas para melhor desempenho.
                  </p>
                  <p className="text-[9px] text-amber-500/80 font-mono mt-0.5">
                    A primeira rodada (#1) começou com a banca inicial de R$ {formatBRL(initialBankroll)}
                  </p>
                </div>
              )}
              {logs.length > 0 && totalPlacedBetsCount <= logs.length && (
                <div className="flex items-center justify-between p-2.5 mt-1.5 rounded-xl border border-white/5 bg-emerald-500/5 text-emerald-400/90 font-mono text-[10.5px]" id="simulation-start-log">
                  <span className="font-bold flex items-center gap-1.5 uppercase text-[9px] tracking-wider text-emerald-500">
                    🚀 Início da Simulação
                  </span>
                  <p className="text-[9px] text-slate-400">
                    Banca Inicial: <strong className="text-white">R$ {formatBRL(initialBankroll)}</strong>
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
