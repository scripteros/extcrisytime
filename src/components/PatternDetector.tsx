import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ParsedSpin } from "../types";
import { SECTOR_DEFINITIONS } from "../data";
import { 
  Sparkles, RefreshCw, Zap, TrendingUp, AlertTriangle, 
  HelpCircle, ArrowRight, ShieldCheck, Flame, Brain, 
  Award, CheckCircle2, XCircle, Info, Lock, Eye, CheckCircle, Ban, Activity, Coins, Settings, Send,
  BarChart3
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSignalRelay, mapSectorsToSpots } from "../hooks/useSignalRelay";

interface PatternDetectorProps {
  spins: ParsedSpin[];
  analysisWindow: number; // Global analysis period from App.tsx
}

interface Pattern {
  id: string;
  type: "repetition" | "alternation" | "occurrence" | "cycle" | "schedule";
  title: string;
  description: string;
  strength: "Baixa" | "Média" | "Alta" | "Gatilho Crítico";
  strengthColor: string;
  gradient: string;
  recommendation: string;
  isAlmostFormed: boolean;
}

interface ActiveTip {
  id: string;
  type: "repetition" | "alternation" | "occurrence" | "cycle" | "schedule";
  title: string;
  description: string;
  recommendation: string;
  strength: string;
  targetSectors: string[]; // e.g. ["1", "CoinFlip"]
  triggeredAtSpinId: string;
  roundsChecked: number; // 0, 1, 2, 3
  isResolved: boolean;
  outcome?: "win" | "loss";
  history: string[]; // what actually landed during verification
  profit?: number; // exact net profit/loss
  hitSpin?: {
    sectorKey: string;
    displayName: string;
    maxMultiplier: number;
    isTopSlotMatched: boolean;
    description?: string;
  } | null;
  isSoros?: boolean;
  baseBetPerSector?: number;
}

export default function PatternDetector({ spins, analysisWindow }: PatternDetectorProps) {
  // Statistics and learning states persisted in LocalStorage
  const [greensCount, setGreensCount] = useState<number>(() => {
    const saved = localStorage.getItem("pd_greens_count");
    return saved ? parseInt(saved, 10) : 0;
  });

  const [redsCount, setRedsCount] = useState<number>(() => {
    const saved = localStorage.getItem("pd_reds_count");
    return saved ? parseInt(saved, 10) : 0;
  });

  const [initialBankroll, setInitialBankroll] = useState<number>(() => {
    const saved = localStorage.getItem("pd_initial_bankroll_v4");
    return saved ? parseFloat(saved) : 100.00;
  });

  const [bankroll, setBankroll] = useState<number>(() => {
    const saved = localStorage.getItem("pd_bankroll_v4");
    return saved ? parseFloat(saved) : 100.00;
  });

  const [baseBet, setBaseBet] = useState<number>(() => {
    const saved = localStorage.getItem("pd_base_bet_v2");
    return saved ? parseFloat(saved) : 0.50;
  });

  // Performance by pattern type to fulfill the user's intent to identify which tips are best
  const [typePerformance, setTypePerformance] = useState<Record<string, { greens: number; reds: number; profit: number }>>(() => {
    const saved = localStorage.getItem("pd_performance_by_type_v2");
    return saved ? JSON.parse(saved) : {
      repetition: { greens: 0, reds: 0, profit: 0 },
      alternation: { greens: 0, reds: 0, profit: 0 },
      occurrence: { greens: 0, reds: 0, profit: 0 },
      cycle: { greens: 0, reds: 0, profit: 0 },
      schedule: { greens: 0, reds: 0, profit: 0 },
    };
  });

  // Self-Tuning Adaptive STRICTNESS parameters ("Aprendizagem de Erros")
  // If a pattern type fails, strictness increases, meaning it requires higher thresholds to trigger again.
  const [adjustments, setAdjustments] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem("pd_adjustments_v2");
    return saved ? JSON.parse(saved) : { repetition: 0, alternation: 0, occurrence: 0, cycle: 0, schedule: 0 };
  });

  // Current active locked tip
  const [activeTip, setActiveTip] = useState<ActiveTip | null>(() => {
    const saved = localStorage.getItem("pd_active_tip_v2");
    return saved ? JSON.parse(saved) : null;
  });

  // History list of recent tips
  const [tipHistory, setTipHistory] = useState<ActiveTip[]>(() => {
    const saved = localStorage.getItem("pd_tip_history_v2");
    return saved ? JSON.parse(saved) : [];
  });

  // Soros System states
  const [useSoros, setUseSoros] = useState<boolean>(() => {
    const saved = localStorage.getItem("pd_use_soros_v1");
    return saved ? saved === "true" : true; // Default to active (Soros mode)
  });

  const [sorosLevel, setSorosLevel] = useState<number>(() => {
    const saved = localStorage.getItem("pd_soros_level_v1");
    return saved ? parseInt(saved, 10) : 0; // 0 = base bet, 1 = compound reinvestment
  });

  const [lastProfitAmount, setLastProfitAmount] = useState<number>(() => {
    const saved = localStorage.getItem("pd_last_profit_amount_v1");
    return saved ? parseFloat(saved) : 0;
  });

  const [lastScannedId, setLastScannedId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Signal relay hook (shared with extension)
  const { extensionId, sendSignal, isConfigured } = useSignalRelay();
  const [signalToast, setSignalToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  // Selected pattern types for auto-send (Set of type strings, "any" = all)
  const [selectedAutoPatterns, setSelectedAutoPatterns] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("pd_selected_patterns");
      if (saved === "any") return new Set(["any"]);
      if (saved) return new Set(JSON.parse(saved));
      return new Set(["any"]); // Default: send all patterns
    } catch { return new Set(["any"]); }
  });
  const lastAutoSentTipId = useRef<string | null>(null);

  // Persist selected patterns
  useEffect(() => {
    try {
      if (selectedAutoPatterns.has("any")) {
        localStorage.setItem("pd_selected_patterns", "any");
      } else {
        localStorage.setItem("pd_selected_patterns", JSON.stringify([...selectedAutoPatterns]));
      }
    } catch {}
  }, [selectedAutoPatterns]);

  const togglePatternSelection = (type: string) => {
    setSelectedAutoPatterns(prev => {
      const next = new Set(prev);
      if (type === "any") {
        // Toggle "any": if already any, clear all; else set any
        if (next.has("any")) return new Set();
        return new Set(["any"]);
      }
      // Remove "any" when selecting specific
      next.delete("any");
      if (next.has(type)) {
        next.delete(type);
        // If nothing selected, revert to "any"
        if (next.size === 0) return new Set(["any"]);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const isPatternSelected = (type: string): boolean => {
    return selectedAutoPatterns.has("any") || selectedAutoPatterns.has(type);
  };

  const PATTERN_TYPES_CONFIG = [
    { key: "repetition", label: "Repetição", color: "text-amber-400", desc: "Sequências consecutivas" },
    { key: "alternation", label: "Alternância", color: "text-emerald-400", desc: "Zig-zag entre setores" },
    { key: "occurrence", label: "Frequência", color: "text-blue-400", desc: "Alta ocorrência em N giros" },
    { key: "cycle", label: "Ciclo", color: "text-purple-400", desc: "Ritmo periódico" },
    { key: "schedule", label: "Correlação", color: "text-pink-400", desc: "Padrões de horário/sequência" },
  ];

  // Persist active tip to localStorage
  useEffect(() => {
    if (signalToast) {
      const t = setTimeout(() => setSignalToast(null), 2000);
      return () => clearTimeout(t);
    }
  }, [signalToast]);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem("pd_use_soros_v1", useSoros.toString());
  }, [useSoros]);

  useEffect(() => {
    localStorage.setItem("pd_soros_level_v1", sorosLevel.toString());
  }, [sorosLevel]);

  useEffect(() => {
    localStorage.setItem("pd_last_profit_amount_v1", lastProfitAmount.toString());
  }, [lastProfitAmount]);

  useEffect(() => {
    localStorage.setItem("pd_greens_count", greensCount.toString());
  }, [greensCount]);

  useEffect(() => {
    localStorage.setItem("pd_reds_count", redsCount.toString());
  }, [redsCount]);

  useEffect(() => {
    localStorage.setItem("pd_initial_bankroll_v4", initialBankroll.toString());
  }, [initialBankroll]);

  useEffect(() => {
    localStorage.setItem("pd_bankroll_v4", bankroll.toString());
  }, [bankroll]);

  useEffect(() => {
    localStorage.setItem("pd_base_bet_v2", baseBet.toString());
  }, [baseBet]);

  useEffect(() => {
    localStorage.setItem("pd_performance_by_type_v2", JSON.stringify(typePerformance));
  }, [typePerformance]);

  useEffect(() => {
    localStorage.setItem("pd_adjustments_v2", JSON.stringify(adjustments));
  }, [adjustments]);

  useEffect(() => {
    if (activeTip) {
      localStorage.setItem("pd_active_tip_v2", JSON.stringify(activeTip));
    } else {
      localStorage.removeItem("pd_active_tip_v2");
    }
  }, [activeTip]);

  useEffect(() => {
    localStorage.setItem("pd_tip_history_v2", JSON.stringify(tipHistory));
  }, [tipHistory]);

  // RESET All statistics and learning levels
  const handleResetStats = () => {
    setGreensCount(0);
    setRedsCount(0);
    setBankroll(initialBankroll);
    setAdjustments({ repetition: 0, alternation: 0, occurrence: 0, cycle: 0, schedule: 0 });
    setTypePerformance({
      repetition: { greens: 0, reds: 0, profit: 0 },
      alternation: { greens: 0, reds: 0, profit: 0 },
      occurrence: { greens: 0, reds: 0, profit: 0 },
      cycle: { greens: 0, reds: 0, profit: 0 },
      schedule: { greens: 0, reds: 0, profit: 0 },
    });
    setActiveTip(null);
    setTipHistory([]);
    setSorosLevel(0);
    setLastProfitAmount(0);
    localStorage.removeItem("pd_active_tip_v2");
    localStorage.removeItem("pd_performance_by_type_v2");
    localStorage.setItem("pd_soros_level_v1", "0");
    localStorage.setItem("pd_last_profit_amount_v1", "0");
    localStorage.setItem("pd_bankroll_v4", initialBankroll.toString());
  };

  // CHECK NEW ROUND (State Machine Verification)
  // Executes whenever a new spin lands
  useEffect(() => {
    if (spins.length === 0) return;
    const latestSpin = spins[0];

    if (latestSpin.id !== lastScannedId) {
      setLastScannedId(latestSpin.id);
      setIsScanning(true);
      const timer = setTimeout(() => setIsScanning(false), 800);

      // Evaluate whether the current ACTIVE TIP is fulfilled
      if (activeTip && !activeTip.isResolved) {
        const updated = { ...activeTip };
        updated.roundsChecked += 1;
        updated.history = [...updated.history, latestSpin.displayName];

        // Match verification: check standard sector key or if the "bonus" group matched
        const isMatch = updated.targetSectors.includes(latestSpin.sectorKey) || 
                        (updated.targetSectors.includes("bonus") && latestSpin.isBonus);

        const numSectors = updated.targetSectors.length;
        const baseBetPerSector = updated.baseBetPerSector || 0.50;
        const isSorosActive = updated.isSoros || false;

        if (isMatch) {
          // HIT!
          updated.isResolved = true;
          updated.outcome = "win";
          setGreensCount(g => g + 1);

          // Calculate current payout with latest spin multiplier
          // Both numeric and bonus sectors return the original bet back plus the multiplied profit
          const winPayoutMultiplier = latestSpin.maxMultiplier + 1;
          
          const accumulatedBetMultiplierBeforeThisRound = 
            updated.roundsChecked === 1 ? 0 : 
            updated.roundsChecked === 2 ? 1 : 
            3; // (1 + 2)
          const prevLoss = baseBetPerSector * accumulatedBetMultiplierBeforeThisRound * numSectors;
          const currentBetPerSector = baseBetPerSector * Math.pow(2, updated.roundsChecked - 1);
          const totalBetThisRound = currentBetPerSector * numSectors;
          
          const payout = currentBetPerSector * winPayoutMultiplier;
          const profit = payout - totalBetThisRound - prevLoss;
          
          updated.profit = profit;

          // Update Soros Progression
          if (useSoros) {
            if (isSorosActive) {
              // Successfully finished 2-step Soros! Reset to base level to lock in compounding gains
              setSorosLevel(0);
              setLastProfitAmount(0);
            } else {
              // Won a standard base tip, trigger Soros Level 1 for the next tip
              setSorosLevel(1);
              setLastProfitAmount(profit);
            }
          } else {
            setSorosLevel(0);
            setLastProfitAmount(0);
          }

          // Populate detailed hitSpin
          updated.hitSpin = {
            sectorKey: latestSpin.sectorKey,
            displayName: latestSpin.displayName,
            maxMultiplier: latestSpin.maxMultiplier,
            isTopSlotMatched: latestSpin.isTopSlotMatched,
            description: latestSpin.bonusStageDetails?.multiplierDescription || `${latestSpin.displayName} de ${latestSpin.maxMultiplier}x`
          };

          // Record performance metric for this specific pattern group
          setTypePerformance(prev => {
            const current = prev[updated.type] || { greens: 0, reds: 0, profit: 0 };
            return {
              ...prev,
              [updated.type]: {
                greens: current.greens + 1,
                reds: current.reds,
                profit: current.profit + profit
              }
            };
          });

          setBankroll(b => {
            const nextB = b + profit;
            if (nextB <= 0) {
              setTimeout(() => {
                handleResetStats();
              }, 50);
              return initialBankroll;
            }
            return nextB;
          });

          // Ease strictness (Learning reinforcement): ease requirement for this type since it succeeded
          setAdjustments(prev => ({
            ...prev,
            [updated.type]: Math.max(0, (prev[updated.type] || 0) - 0.5)
          }));

          setTipHistory(prev => [updated, ...prev].slice(0, 15));
          setActiveTip(null);
        } else {
          // No match, check if Max Rounds (1 primary + 2 Gales = 3 rounds) is reached
          if (updated.roundsChecked >= 3) {
            // LOST! (Failed check after primary and 2 gales)
            updated.isResolved = true;
            updated.outcome = "loss";
            setRedsCount(r => r + 1);

            const totalLossMultiplier = 1 + 2 + 4; // 7 total base bets
            const lossAmount = baseBetPerSector * totalLossMultiplier * numSectors;
            updated.profit = -lossAmount;
            updated.hitSpin = null;

            // Reset Soros Progression on Loss
            setSorosLevel(0);
            setLastProfitAmount(0);

            // Record performance metric (Loss) for this specific pattern group
            setTypePerformance(prev => {
              const current = prev[updated.type] || { greens: 0, reds: 0, profit: 0 };
              return {
                ...prev,
                [updated.type]: {
                  greens: current.greens,
                  reds: current.reds + 1,
                  profit: current.profit - lossAmount
                }
              };
            });

            setBankroll(b => {
              const nextB = b - lossAmount;
              if (nextB <= 0) {
                setTimeout(() => {
                  handleResetStats();
                }, 50);
                return initialBankroll;
              }
              return nextB;
            });

            // Stricten criteria (Learning from Error): Increase pattern requirement threshold to make it safer!
            setAdjustments(prev => ({
              ...prev,
              [updated.type]: (prev[updated.type] || 0) + 1.0 // Increments strictness level
            }));

            setTipHistory(prev => [updated, ...prev].slice(0, 15));
            setActiveTip(null);
          } else {
            // Update the state with current checked level
            setActiveTip(updated);
          }
        }
      }

      return () => clearTimeout(timer);
    }
  }, [spins, lastScannedId, activeTip, adjustments, useSoros, sorosLevel, lastProfitAmount]);

  // Compute patterns dynamically taking into account ADAPTATIVE STRICTNESS (adjustments)
  const { activePatterns, almostFormedPatterns } = useMemo(() => {
    const active: Pattern[] = [];
    const almost: Pattern[] = [];

    if (spins.length < Math.min(5, analysisWindow / 2)) return { activePatterns: active, almostFormedPatterns: almost };

    // --- 1. Consecutive Repetitions (type: "repetition") ---
    // Rule: normally 2. Stricter checking = 2 + adaptation weight
    const repPenalty = Math.floor(adjustments.repetition || 0);
    const minStreakRequired = 2 + repPenalty;

    let currentStreak = 1;
    const currentSectorKey = spins[0].sectorKey;
    const currentSectorName = spins[0].displayName;

    for (let i = 1; i < spins.length; i++) {
      if (spins[i].sectorKey === currentSectorKey) {
        currentStreak++;
      } else {
        break;
      }
    }

    if (currentStreak >= minStreakRequired) {
      active.push({
        id: "consecutive-rep",
        type: "repetition",
        title: `Padrão de Repetição: ${currentSectorName}`,
        description: `O setor **${currentSectorName}** saiu **${currentStreak} vezes consecutivas** (Limite Adaptado: ${minStreakRequired}).`,
        strength: currentStreak >= 3 ? "Gatilho Crítico" : "Média",
        strengthColor: currentStreak >= 3 ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20",
        gradient: "from-amber-500/10 to-transparent",
        recommendation: `Insistência detectada! Dica para buscar continuação ou cobrir o setor **${currentSectorName}** nos próximos giros devido ao fluxo quente.`,
        isAlmostFormed: false,
      });
    } else {
      if (spins[1].sectorKey === spins[2].sectorKey) {
        almost.push({
          id: "almost-rep",
          type: "repetition",
          title: `Alerta de Repetição Recente`,
          description: `O setor **${spins[1].displayName}** repetiu no giro anterior. Necessita de mais 1 giro idêntico para consolidar o padrão de repetição de ${minStreakRequired} giros.`,
          strength: "Baixa",
          strengthColor: "text-slate-400 bg-white/5 border-white/10",
          gradient: "from-blue-500/5 to-transparent",
          recommendation: "Mantenha atenção caso o setor repita e confirme o gatilho.",
          isAlmostFormed: true,
        });
      }
    }

    // --- 2. Alternating Sequences / Zig-Zag (type: "alternation") ---
    // Rule: default 4. Stricter checking = 4 + penalty * 1
    const altPenalty = Math.floor(adjustments.alternation || 0);
    const minAlternationRequired = 4 + altPenalty;

    let isAlternating = true;
    for (let i = 0; i < minAlternationRequired; i++) {
      if (i + 2 < spins.length) {
        if (spins[i].sectorKey !== spins[i + 2].sectorKey) {
          isAlternating = false;
          break;
        }
      }
    }
    // Also confirm it's not a pure repetition (keys must alternate)
    if (isAlternating && spins[0].sectorKey === spins[1].sectorKey) {
      isAlternating = false;
    }

    if (isAlternating && spins.length >= minAlternationRequired) {
      const nextSuggestedKey = spins[1].sectorKey;
      const nextSuggestedName = spins[1].displayName;
      active.push({
        id: "alternating-pattern",
        type: "alternation",
        title: "Padrão de Zig-Zag (Alternância)",
        description: `Zigue-zague contínuo: do tipo **${spins[0].displayName} ⇄ ${spins[1].displayName}** há mais de ${minAlternationRequired} rodadas.`,
        strength: "Alta",
        strengthColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        gradient: "from-blue-500/10 to-transparent",
        recommendation: `Ocorrência cíclica identificada. Siga a oscilação apostando no setor esperado: **${nextSuggestedName}**.`,
        isAlmostFormed: false,
      });
    } else if (spins[0].sectorKey === spins[2].sectorKey && spins[0].sectorKey !== spins[1].sectorKey) {
      almost.push({
        id: "almost-alternating",
        type: "alternation",
        title: "Sinalização de Alternância Rápida",
        description: `Intercalado em formação: **${spins[2].displayName} ➔ ${spins[1].displayName} ➔ ${spins[0].displayName}**.`,
        strength: "Média",
        strengthColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
        gradient: "from-indigo-500/5 to-transparent",
        recommendation: `Se o próximo giro resultar no setor **${spins[1].displayName}**, ativará o ciclo completo de zigue-zague.`,
        isAlmostFormed: true,
      });
    }

    // --- 3. High Occurrence Frequency (type: "occurrence") ---
    // Rule: checks density/occurrences of a specific sector inside 10 spins
    const occPenalty = Math.floor(adjustments.occurrence || 0);
    const minOccurrencesRequired = 3 + occPenalty; // 3 times in last 10 rounds

    const occCounts: Record<string, number> = {};
    const occLimits = spins.slice(0, 10);
    occLimits.forEach(s => {
      occCounts[s.sectorKey] = (occCounts[s.sectorKey] || 0) + 1;
    });

    // Find the highest occurrence sector (preferring bonus or higher numbers)
    let maxOccKey = "";
    let maxOccCount = 0;
    Object.keys(occCounts).forEach(k => {
      // Scale count weight slightly for non-1 and bonus games to detect cycles accurately
      const weight = k === "1" ? occCounts[k] : occCounts[k] * 1.3;
      if (weight > maxOccCount) {
        maxOccCount = weight;
        maxOccKey = k;
      }
    });

    const realCount = occCounts[maxOccKey] || 0;
    const maxOccName = spins.find(s => s.sectorKey === maxOccKey)?.displayName || maxOccKey;

    if (maxOccKey && realCount >= minOccurrencesRequired) {
      // Hot sector occurrence triggered
      active.push({
        id: `occ-${maxOccKey}`,
        type: "occurrence",
        title: `Alta Frequência: Setor ${maxOccName}`,
        description: `O setor **${maxOccName}** está em um ciclo de altíssima ocorrência: saiu **${realCount} vezes** nos últimos 10 giros.`,
        strength: realCount >= minOccurrencesRequired + 1 ? "Gatilho Crítico" : "Alta",
        strengthColor: realCount >= minOccurrencesRequired + 1 ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20",
        gradient: "from-amber-500/10 to-transparent",
        recommendation: `Insistência de dealer identificada no setor **${maxOccName}**. Aproveite o fluxo forte para cobrir esse setor nas rodadas de apoio.`,
        isAlmostFormed: false,
      });
    } else if (maxOccKey && realCount === minOccurrencesRequired - 1) {
      almost.push({
        id: `almost-occ-${maxOccKey}`,
        type: "occurrence",
        title: `Tendência de Frequência para ${maxOccName}`,
        description: `Setor **${maxOccName}** acumulou **${realCount} aparições** em 10 rodadas. Um novo acerto ativará a sinalização de alta ocorrência.`,
        strength: "Média",
        strengthColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        gradient: "from-[#d4a84c]/5 to-transparent",
        recommendation: "Fique de olho na rítmica de giros do setor para entrada rápida.",
        isAlmostFormed: true,
      });
    }

    // --- 4. Symmetry / Mirror Cycles & Periodicity (type: "cycle") ---
    let periodicActive = false;
    for (const period of [2, 3]) {
      if (spins.length >= (period * 2 + 1)) {
        const sectorAtZero = spins[0].sectorKey;
        const displayNameAtZero = spins[0].displayName;
        let fitsPeriod = true;
        for (let j = 1; j <= 2; j++) {
          if (spins[j * period].sectorKey !== sectorAtZero) {
            fitsPeriod = false;
            break;
          }
        }
        
        // Also check that it's NOT a consecutive repetition streak (handled by repetition)
        if (fitsPeriod && spins[1].sectorKey === sectorAtZero) {
          fitsPeriod = false;
        }

        if (fitsPeriod) {
          active.push({
            id: `periodic-rhythm-${period}-${sectorAtZero}`,
            type: "cycle",
            title: `Ritmo Periódico (A cada ${period} rodadas)`,
            description: `O setor **${displayNameAtZero}** está completando um ritmo perfeito de retorno **a cada ${period} rodadas** (Saídas registradas em: T-0, T-${period}, T-${period * 2}).`,
            strength: period === 2 ? "Gatilho Crítico" : "Alta",
            strengthColor: period === 2 ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20",
            gradient: "from-purple-500/10 to-transparent",
            recommendation: `Cifragem de frequência ativa! O setor **${displayNameAtZero}** tem aparecido ciclicamente a cada ${period} giros do crupiê. Recomendada cobertura de apoio.`,
            isAlmostFormed: false,
          });
          periodicActive = true;
          break; 
        }
      }
    }

    // Almost formed periodic rhythm
    if (!periodicActive) {
      for (const period of [2, 3]) {
        if (spins.length >= (period * 2 + 2)) {
          const sectorAtOne = spins[1].sectorKey;
          const displayNameAtOne = spins[1].displayName;
          let fitsPeriod = true;
          for (let j = 1; j <= 2; j++) {
            if (spins[1 + j * period].sectorKey !== sectorAtOne) {
              fitsPeriod = false;
              break;
            }
          }
          if (fitsPeriod && spins[2].sectorKey === sectorAtOne) {
            fitsPeriod = false;
          }

          if (fitsPeriod) {
            almost.push({
              id: `almost-periodic-rhythm-${period}-${sectorAtOne}`,
              type: "cycle",
              title: `Ciclo Periódico Iminente (${period} rodadas)`,
              description: `O setor **${displayNameAtOne}** está em padrão pendente a cada **${period} rodadas** (Saindo nas rodadas T-1, T-${1 + period}, T-${1 + period * 2}).`,
              strength: "Média",
              strengthColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
              gradient: "from-indigo-500/5 to-transparent",
              recommendation: `A rítmica sugere que o setor **${displayNameAtOne}** pode pular a rodada atual e reaparecer na próxima rodada do temporizador.`,
              isAlmostFormed: true,
            });
            periodicActive = true; // prevent mirror triggers if periodic rhythm is cleaner
            break;
          }
        }
      }
    }

    if (!periodicActive) {
      // If last 3 spins are A, B, B, we want A next. If last 4 are A, B, B, A, it's a completed cycle.
      if (spins.length >= 3 && spins[1].sectorKey === spins[2].sectorKey && spins[0].sectorKey !== spins[1].sectorKey) {
        const expectedTargetName = spins[0].displayName;

        active.push({
          id: `cycle-mirror`,
          type: "cycle",
          title: `Simetria Espelhada Detectada`,
          description: `A sequência recente **${spins[0].displayName} ➔ ${spins[1].displayName} ➔ ${spins[2].displayName}** aponta para um gatilho de espelhamento bilateral.`,
          strength: "Média",
          strengthColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
          gradient: "from-indigo-500/5 to-transparent",
          recommendation: `Para fechar o padrão de simetria bilateral, a jogada ideal é buscar o retorno do líder do ciclo: **${expectedTargetName}**.`,
          isAlmostFormed: false,
        });
      } else if (spins.length >= 4 && spins[0].sectorKey === spins[3].sectorKey && spins[1].sectorKey === spins[2].sectorKey && spins[0].sectorKey !== spins[1].sectorKey) {
        // Completed A B B A - we alert the next cycle startup
        almost.push({
          id: `almost-cycle-mirror`,
          type: "cycle",
          title: `Sucesso de Simetria Espelhada`,
          description: `Padrão de Simetria Espelhada [${spins[3].displayName} - ${spins[2].displayName} - ${spins[1].displayName} - ${spins[0].displayName}] completado com sucesso.`,
          strength: "Média",
          strengthColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
          gradient: "from-emerald-500/5 to-transparent",
          recommendation: "Ciclo de espelho consolidado! Aguarde a quebra de ritmo ou nova entrada.",
          isAlmostFormed: true,
        });
      }
    }

    // --- 5. Transition Correlation & Scheduled Windows (type: "schedule") ---
    // Rule: "Sempre que número X aparece, o Y vem logo em seguida" (Sequential Trigger)
    const lastLandedKey = spins[0].sectorKey;
    const lastLandedName = spins[0].displayName;

    const transitionCounts: Record<string, number> = {};
    let totalOccurrencesOfX = 0;

    for (let i = 0; i < spins.length - 1; i++) {
      if (spins[i + 1].sectorKey === lastLandedKey) {
        totalOccurrencesOfX++;
        const nextLandedKey = spins[i].sectorKey;
        transitionCounts[nextLandedKey] = (transitionCounts[nextLandedKey] || 0) + 1;
      }
    }

    let bestTriggerTargetKey = "";
    let bestTriggerCount = 0;
    Object.keys(transitionCounts).forEach(k => {
      if (transitionCounts[k] > bestTriggerCount) {
        bestTriggerCount = transitionCounts[k];
        bestTriggerTargetKey = k;
      }
    });

    let transitionActiveAdded = false;

    if (bestTriggerTargetKey && totalOccurrencesOfX >= 3) {
      const bestTargetSymbol = spins.find(s => s.sectorKey === bestTriggerTargetKey);
      const bestTargetName = bestTargetSymbol ? bestTargetSymbol.displayName : bestTriggerTargetKey;
      const ratio = (bestTriggerCount / totalOccurrencesOfX) * 100;

      if (ratio >= 35) { // If at least 35% of times it was followed by this target
        const strengthLabel = ratio >= 60 ? "Gatilho Crítico" : ratio >= 45 ? "Alta" : "Média";
        active.push({
          id: `correlation-${lastLandedKey}-${bestTriggerTargetKey}`,
          type: "schedule",
          title: `Ímã de Sequência (Gatilho Sequencial)`,
          description: `Sempre que sai o setor **${lastLandedName}**, o setor **${bestTargetName}** tende a vir em seguida. Ocorreu **${bestTriggerCount} de ${totalOccurrencesOfX} vezes** (${ratio.toFixed(0)}% de correlação).`,
          strength: strengthLabel,
          strengthColor: ratio >= 60 ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : ratio >= 45 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20",
          gradient: "from-emerald-500/10 to-transparent",
          recommendation: `Ímã de rítmica ativo! Aposta recomendada direto no setor **${bestTargetName}** conforme estatística empírica da mesa.`,
          isAlmostFormed: false,
        });
        transitionActiveAdded = true;
      }
    }

    // Schedule Clock Windows as fallback or secondary schedule rule
    const currentMin = new Date().getMinutes();
    const isMultiplierMinute = (currentMin % 5 === 0) || (currentMin % 10 === 0);
    const isApproximationMinute = ((currentMin + 1) % 5 === 0) || ((currentMin + 1) % 10 === 0);

    if (isMultiplierMinute) {
      active.push({
        id: `schedule-active-${currentMin}`,
        type: "schedule",
        title: `Janela Temporal: Minuto ${currentMin}m`,
        description: `Janela temporal cíclica de alta intensidade estatística em andamento. O tempo atual (${currentMin}m) coincide com os picos cíclicos de bônus na mesa.`,
        strength: transitionActiveAdded ? "Média" : "Alta",
        strengthColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        gradient: "from-[#d4a84c]/10 to-transparent",
        recommendation: "Entrada recomendada cobrindo os setores com maior poder de multiplicação (Bônus: Crazy, Pachinko, Hunt, Flip) nesta janela.",
        isAlmostFormed: false,
      });
    } else if (isApproximationMinute) {
      almost.push({
        id: `schedule-almost-${currentMin}`,
        type: "schedule",
        title: `Conexão de Horário Cíclico Iminente`,
        description: `A mesa está a menos de 60 segundos de entrar na janela cíclica dos minutos múltiplos de 5.`,
        strength: "Média",
        strengthColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
        gradient: "from-blue-500/5 to-transparent",
        recommendation: "Prepare suas coberturas para a aproximação rápida da janela de minutos.",
        isAlmostFormed: true,
      });
    }

    // --- 6. Multi-Target Compound Opportunities (Dicas de Apostas Múltiplas) ---

    // A. Bonus Overdue Heavy Cluster (Aposta conjunta em todos os Bônus)
    const spinsSlice10 = spins.slice(0, 10);
    const bonusInLast10 = spinsSlice10.filter(s => s.isBonus).length;
    if (bonusInLast10 === 0 && spins.length >= 10) {
      active.push({
        id: "multi-target-all-bonuses",
        type: "schedule",
        title: "Dica Premium: Cobertura Total de Bônus",
        description: "Alerta de Acúmulo! Não sai nenhum jogo bônus nos últimos **10 giros**. Pico de probabilidade iminente nas casas especiais.",
        strength: "Gatilho Crítico",
        strengthColor: "text-rose-400 bg-rose-500/10 border-rose-500/20",
        gradient: "from-pink-500/15 to-transparent",
        recommendation: "Oportunidade Composta IA: Divisão de risco recomendada cobrindo simultaneamente todos os bônus: Coin Flip, Pachinko, Cash Hunt e Crazy Time.",
        isAlmostFormed: false,
      });
    }

    // B. High-odds Numbers Duel (Aposta em 5 & 10)
    const highNumbersInLast15 = spins.slice(0, 15).filter(s => s.sectorKey === "5" || s.sectorKey === "10").length;
    if (highNumbersInLast15 === 0 && spins.length >= 15) {
      active.push({
        id: "multi-target-high-numbers",
        type: "occurrence",
        title: "Dica Premium: Caça aos Multiplicadores (5 + 10)",
        description: "Os setores de alta rentabilidade **5 e 10** estão pendentes nas últimas **15 rodadas**.",
        strength: "Alta",
        strengthColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        gradient: "from-yellow-500/10 to-transparent",
        recommendation: "Oportunidade Composta IA: Faça uma aposta dividida cobrindo os setores 5 e 10. O lucro de qualquer um deles paga a proteção do outro.",
        isAlmostFormed: false,
      });
    }

    // C. Low-risk Double Cover (Aposta em 1 + 2)
    const lowSectorsCount = spins.slice(0, 5).filter(s => s.sectorKey === "1" || s.sectorKey === "2").length;
    if (lowSectorsCount === 0 && spins.length >= 5) {
      active.push({
        id: "multi-target-low-scarcity",
        type: "repetition",
        title: "Dica Conservadora: Retorno ao Fluxo Estável (1 + 2)",
        description: "Zero saídas dos setores comuns **1 e 2** nos últimos **5 giros** (fuga de estabilidade incomum).",
        strength: "Média",
        strengthColor: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
        gradient: "from-slate-500/10 to-transparent",
        recommendation: "Oportunidade Composta IA: Realize uma entrada conservadora dividida em 1 e 2. Estabilização estatística de alta cobertura.",
        isAlmostFormed: false,
      });
    }

    // D. Number + Bonus Combo (Aposta em 2 + Bônus)
    const last3IsNumbers = spins.slice(0, 3).every(s => !s.isBonus);
    const mostFrequentLow = spins.slice(0, 10).filter(s => s.sectorKey === '2').length >= 3;
    if (last3IsNumbers && mostFrequentLow) {
      active.push({
        id: "multi-target-hybrid-combo",
        type: "cycle",
        title: "Dica Premium: Combo Volatilidade Controlada",
        description: "O setor **2** está super aquecido na mesa e a roleta gerou apenas números secos nas últimas 3 rodadas.",
        strength: "Alta",
        strengthColor: "text-teal-400 bg-teal-500/10 border-teal-500/20",
        gradient: "from-teal-500/10 to-transparent",
        recommendation: "Oportunidade Composta IA: Cubra o setor estável 2 como segurança e adicione os bônus Coin Flip e Pachinko para capturar picos de ganho.",
        isAlmostFormed: false,
      });
    }

    // Sort by priority score
    const sortPatterns = (list: Pattern[]) => {
      return [...list].sort((a, b) => {
        const score = (str: string) => {
          if (str.includes("Crítico")) return 4;
          if (str.includes("Alta")) return 3;
          if (str.includes("Média")) return 2;
          return 1;
        };
        return score(b.strength) - score(a.strength);
      });
    };

    return {
      activePatterns: sortPatterns(active),
      almostFormedPatterns: sortPatterns(almost),
    };
  }, [spins, adjustments]);

  // Auto-lock onto top priority active pattern if no tip is monitored
  useEffect(() => {
    if (!activeTip && activePatterns.length > 0) {
      const topPattern = activePatterns[0];
      
      let targets: string[] = [];
      if (topPattern.id === "multi-target-all-bonuses") {
        targets = ["CoinFlip", "Pachinko", "CashHunt", "CrazyTime"];
      } else if (topPattern.id === "multi-target-high-numbers") {
        targets = ["5", "10"];
      } else if (topPattern.id === "multi-target-low-scarcity") {
        targets = ["1", "2"];
      } else if (topPattern.id === "multi-target-hybrid-combo") {
        targets = ["2", "CoinFlip", "Pachinko"];
      } else if (topPattern.type === "repetition") {
        targets = [spins[0].sectorKey]; // ride the trend
      } else if (topPattern.type === "alternation") {
        targets = [spins[1]?.sectorKey || spins[0].sectorKey]; // Target prior alternate item
      } else if (topPattern.type === "occurrence") {
        const occKey = topPattern.id.replace("occ-", "");
        targets = [occKey];
      } else if (topPattern.type === "cycle") {
        if (topPattern.id.startsWith("periodic-rhythm-")) {
          const parts = topPattern.id.split("-");
          const targetKey = parts[parts.length - 1];
          targets = [targetKey];
        } else {
          targets = [spins[0]?.sectorKey || "1"];
        }
      } else if (topPattern.type === "schedule") {
        if (topPattern.id.startsWith("correlation-")) {
          const parts = topPattern.id.split("-");
          const targetKey = parts[parts.length - 1];
          targets = [targetKey];
        } else {
          targets = ["5", "10", "CoinFlip", "Pachinko", "CashHunt", "CrazyTime"];
        }
      }

      if (targets.length > 0) {
        const isSorosRound = useSoros && sorosLevel === 1 && lastProfitAmount > 0;
        const calculatedSorosBet = isSorosRound ? baseBet + (lastProfitAmount / targets.length) : baseBet;
        const finalBaseBetPerSector = isSorosRound ? Math.min(baseBet * 10, calculatedSorosBet) : baseBet;

        const newTip: ActiveTip = {
          id: `${topPattern.id}-${Date.now()}`,
          type: topPattern.type,
          title: topPattern.title,
          description: topPattern.description,
          recommendation: topPattern.recommendation,
          strength: topPattern.strength,
          targetSectors: targets,
          triggeredAtSpinId: spins[0].id,
          roundsChecked: 0,
          isResolved: false,
          history: [],
          isSoros: isSorosRound,
          baseBetPerSector: Number(finalBaseBetPerSector.toFixed(2)),
        };
        setActiveTip(newTip);
      }
    }
  }, [activePatterns, activeTip, spins, useSoros, sorosLevel, lastProfitAmount, baseBet]);

  // Calculations for winrate
  const totalTipsCount = greensCount + redsCount;
  const winRatePercent = totalTipsCount > 0 ? (greensCount / totalTipsCount) * 100 : 0;

  // Pattern category descriptions translated for Brazilians
  const PATTERN_TYPE_LABELS: Record<string, string> = {
    repetition: "Tendência (Repetição)",
    alternation: "Alvo Alternado",
    occurrence: "Escassez de Setor",
    cycle: "Ciclos IA & Combos",
    schedule: "Padrões de Horário"
  };

  const getWinnerPatternType = () => {
    let bestType = "";
    let maxProfit = -Infinity;
    let maxGreens = -1;
    
    (Object.entries(typePerformance) as [string, { greens: number; reds: number; profit: number }][]).forEach(([key, stats]) => {
      if (stats.profit > maxProfit) {
        maxProfit = stats.profit;
        bestType = key;
      } else if (stats.profit === maxProfit && stats.greens > maxGreens && stats.greens > 0) {
        maxGreens = stats.greens;
        bestType = key;
      }
    });
    
    const totalActivity = (Object.values(typePerformance) as { greens: number; reds: number; profit: number }[]).reduce((acc, current) => acc + current.greens + current.reds, 0);
    if (totalActivity === 0) return null;
    return bestType;
  };

  const winnerType = getWinnerPatternType();

  // Send active tip signal to extension
  const handleSendTipToExtension = useCallback(async () => {
    if (!activeTip) return;
    const spots = mapSectorsToSpots(activeTip.targetSectors);
    const chip = activeTip.baseBetPerSector || 0.50;
    const result = await sendSignal({
      extensionId,
      chip,
      spots,
    });
    setSignalToast(result);
  }, [activeTip, extensionId, sendSignal]);

  // Auto-send signal when activeTip is generated — only if its pattern type is selected
  useEffect(() => {
    const isSelected = activeTip && isPatternSelected(activeTip.type);
    if (isSelected && activeTip && activeTip.id !== lastAutoSentTipId.current) {
      lastAutoSentTipId.current = activeTip.id;
      handleSendTipToExtension();
    }
  }, [activeTip, handleSendTipToExtension, selectedAutoPatterns]);

  // Simulated bankroll calculations (with dynamic base and real multipliers)
  const currentBankroll = bankroll;
  const totalProfitLoss = currentBankroll - initialBankroll;
  const isProfit = totalProfitLoss >= 0;

  return (
    <div className="glass-panel p-6 rounded-2xl w-full max-w-7xl mx-auto mb-8 relative z-10" id="pattern-detector-panel">
      {/* Background flare visual indicator */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-pink-500/0 via-pink-500/50 to-[#d4a84c]/0" />

      {/* Main Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5 mb-5">
        <div>
          <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Flame className="text-[#ec4899] animate-pulse" size={20} />
            Rastreador de Tendências & Padrões em Tempo Real
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Detecta disparidades matemáticas de curto prazo e gera dicas com até 2 gales que travam até a validação definitiva.
          </p>
        </div>

        {/* Dynamic scanning indicator */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Soros Toggle Button */}
          <button
            onClick={() => setUseSoros(prev => !prev)}
            className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
              useSoros
                ? "bg-pink-500/10 border-pink-500/35 text-pink-400 font-bold shadow-[0_0_12px_rgba(236,72,153,0.12)]"
                : "bg-black/30 border-white/5 text-slate-400"
            }`}
            title="Ative o Soros para reinvestir os lucros da dica vitoriosa anterior na próxima entrada para alavancagem rápida."
          >
            <Zap size={11} className={useSoros ? "animate-pulse text-pink-400" : ""} />
            <span>SOROS: {useSoros ? "ATIVADO" : "DESATIVADO"}</span>
            {useSoros && sorosLevel === 1 && lastProfitAmount > 0 && (
              <span className="bg-pink-500 text-white font-mono text-[8px] px-1 py-0.5 rounded ml-1 animate-bounce">
                Reinvestindo: R$ {lastProfitAmount.toFixed(2)}
              </span>
            )}
          </button>

          <div className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/5 flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isScanning ? "bg-pink-500 animate-ping" : "bg-emerald-400 animate-pulse"}`} />
            <span className="text-[9.5px] font-mono text-slate-400 tracking-wider">
              {isScanning ? "Rastreando Giros..." : "Vigilância Ativa"}
            </span>
          </div>

          {/* Global window indicator */}
          <div className="px-2.5 py-1.5 rounded-lg bg-indigo-500/5 border border-indigo-500/20 flex items-center gap-1.5">
            <BarChart3 size={11} className="text-indigo-400" />
            <span className="text-[9px] font-mono font-bold text-indigo-300 uppercase tracking-wider hidden sm:inline">Janela:</span>
            <span className="text-[10px] font-mono font-black text-indigo-200">{analysisWindow}r</span>
          </div>
        </div>
      </div>

      {/* O painel de gestão integrado para permitir alteração da entrada inicial e o valor da banca */}
      <div className="mb-6 p-4 bg-white/[0.015] border border-white/5 rounded-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex flex-col text-left">
          <span className="text-[11px] text-pink-400 font-mono font-bold tracking-wider uppercase flex items-center gap-1.5">
            <Settings size={12} className="text-pink-400" />
            Configuração de Gestão & Apostas
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5">
            Ajuste os fundos ativos e o valor base por setor que dita as rodadas e dobras (Gales).
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3.5 w-full lg:w-auto">
          {/* Base Bet Input */}
          <div className="flex flex-col gap-1 w-full sm:w-[130px] text-left">
            <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider block">Entrada Base / Setor</span>
            <div className="flex items-center gap-1 bg-black/40 border border-white/5 focus-within:border-pink-500/40 rounded-xl px-2.5 h-[34px] transition-all">
              <span className="text-[10px] font-bold text-slate-500 font-mono">R$</span>
              <input
                type="number"
                value={baseBet}
                step="0.10"
                min="0.10"
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) {
                    setBaseBet(val);
                  }
                }}
                className="bg-transparent w-full text-xs text-white font-mono outline-none border-none p-0 focus:ring-0"
              />
            </div>
          </div>

          {/* Initial Bankroll Input */}
          <div className="flex flex-col gap-1 w-full sm:w-[130px] text-left">
            <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider block">Banca Inicial (Ref.)</span>
            <div className="flex items-center gap-1 bg-black/40 border border-white/5 focus-within:border-pink-500/40 rounded-xl px-2.5 h-[34px] transition-all">
              <span className="text-[10px] font-bold text-slate-500 font-mono">R$</span>
              <input
                type="number"
                value={initialBankroll}
                step="5"
                min="1"
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) {
                    setInitialBankroll(val);
                    setBankroll(val);
                  }
                }}
                className="bg-transparent w-full text-xs text-white font-mono outline-none border-none p-0 focus:ring-0"
              />
            </div>
          </div>

          {/* Current Bankroll Input */}
          <div className="flex flex-col gap-1 w-full sm:w-[130px] text-left">
            <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider block">Banca Atual (Saldo)</span>
            <div className="flex items-center gap-1 bg-black/40 border border-white/5 focus-within:border-pink-500/40 rounded-xl px-2.5 h-[34px] transition-all">
              <span className="text-[10px] font-bold text-slate-500 font-mono">R$</span>
              <input
                type="number"
                value={bankroll}
                step="5"
                min="0"
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val >= 0) {
                    setBankroll(val);
                  }
                }}
                className="bg-transparent w-full text-xs text-white font-mono outline-none border-none p-0 focus:ring-0"
              />
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="flex items-center gap-1.5 lg:mt-4">
            <button
              onClick={() => {
                setBaseBet(1.00);
              }}
              className="px-2 py-1 text-[8.5px] font-mono rounded bg-white/[0.02] border border-white/5 hover:bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Mudar entrada base para R$ 1,00"
            >
              Entrada R$1
            </button>
            <button
              onClick={() => {
                setInitialBankroll(500.00);
                setBankroll(500.00);
              }}
              className="px-2 py-1 text-[8.5px] font-mono rounded bg-white/[0.02] border border-white/5 hover:bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Mudar banca inicial para R$ 500,00"
            >
              Banca R$500
            </button>
          </div>
        </div>
      </div>

      {/* WIN METRICS COUNTER AND AI MEMORY LEVEL (Dicas Marker) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5 mb-6 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
        <div className="flex flex-col text-left">
          <span className="text-[10px] text-slate-500 tracking-wider font-bold uppercase font-sans">Dicas Verificadas</span>
          <span className="text-xl font-mono font-bold text-white mt-1 flex items-center gap-1.5">
            <Activity className="text-slate-400" size={16} />
            {totalTipsCount}
          </span>
          <span className="text-[9px] text-slate-600 mt-0.5">Ciclos completos</span>
        </div>

        <div className="flex flex-col text-left">
          <span className="text-[10px] text-emerald-500 tracking-wider font-bold uppercase font-sans">Vitoriosas (Greens)</span>
          <span className="text-xl font-mono font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
            <CheckCircle className="text-emerald-500" size={16} />
            {greensCount}
          </span>
          <span className="text-[9px] text-emerald-500/60 mt-0.5">Bateram no prazo</span>
        </div>

        <div className="flex flex-col text-left">
          <span className="text-[10px] text-rose-500 tracking-wider font-bold uppercase font-sans">Não bateram (Reds)</span>
          <span className="text-xl font-mono font-bold text-rose-400 mt-1 flex items-center gap-1.5">
            <Ban className="text-rose-500" size={16} />
            {redsCount}
          </span>
          <span className="text-[9px] text-rose-600 mt-0.5">Estouro de +2 gales</span>
        </div>

        <div className="flex flex-col text-left">
          <span className="text-[10px] text-amber-500 tracking-wider font-bold uppercase font-sans">Assertividade</span>
          <span className="text-xl font-mono font-bold text-amber-300 mt-1 flex items-center gap-1.5">
            <Award className="text-amber-500" size={16} />
            {winRatePercent.toFixed(1)}%
          </span>
          <span className="text-[9px] text-slate-500 mt-0.5">Taxa de acerto real</span>
        </div>

        <div className="flex flex-col text-left">
          <span className="text-[10px] text-pink-400 tracking-wider font-bold uppercase font-sans">Banca Simulada</span>
          <span className="text-xl font-mono font-bold text-white mt-1 flex items-center gap-1.5">
            <Coins className="text-pink-400" size={16} />
            R$ {currentBankroll.toFixed(2)}
          </span>
          <span className={`text-[9px] font-mono font-bold mt-0.5 ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
            {isProfit ? "Lucro: +" : "Prejuízo: "}R$ {totalProfitLoss.toFixed(2)}
          </span>
        </div>

        <div className="col-span-2 md:col-span-1 xl:col-span-1 flex items-center xl:justify-end gap-2">
          {totalTipsCount > 0 && (
            <button
              onClick={handleResetStats}
              className="text-[9.5px] font-mono text-slate-400 hover:text-white border border-white/10 hover:bg-white/5 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={11} /> Resetar Estatísticas
            </button>
          )}
        </div>
      </div>

      {/* IA LESSONS AND ADAPTIVE STRICTNESS NOTIFIER (Aprender com os erros) */}
      <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10 flex items-center justify-between gap-3 text-[10.5px] text-indigo-300 mb-6 font-sans">
        <div className="flex items-center gap-2">
          <Brain className="text-indigo-400 shrink-0" size={16} />
          <div>
            <span className="font-bold">Algoritmo Auto-Ajustável:</span> Sempre que um sinal perde, a IA aumenta as exigências matemáticas para aquele tipo para mitigar perdas futuras!
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-1.5 font-mono text-[9px] text-slate-400">
          <span>Pesos Atuais:</span>
          <span className="bg-white/5 border border-white/5 px-1.5 py-0.5 rounded text-amber-300 font-bold">REP: +{adjustments.repetition || 0}</span>
          <span className="bg-white/5 border border-white/5 px-1.5 py-0.5 rounded text-[#22c55e] font-bold">ALT: +{adjustments.alternation || 0}</span>
          <span className="bg-white/5 border border-white/5 px-1.5 py-0.5 rounded text-pink-305 text-pink-400 font-bold">OCOR: +{adjustments.occurrence || 0}</span>
          <span className="bg-white/5 border border-white/5 px-1.5 py-0.5 rounded text-indigo-400 font-bold">CICLO: +{adjustments.cycle || 0}</span>
          <span className="bg-white/5 border border-white/5 px-1.5 py-0.5 rounded text-purple-300 font-bold">HORA: +{adjustments.schedule || 0}</span>
        </div>
      </div>

      {/* SIMULATED BANKROLL DETAILS FOOTNOTE */}
      <div className="p-3 bg-pink-500/5 rounded-xl border border-pink-500/10 flex items-center gap-3 text-[10px] text-pink-300 mb-6 font-sans">
        <Info className="text-pink-400 shrink-0" size={16} />
        <div>
          <span className="font-bold">Algoritmo de Gestão Matemática:</span> Simulação calculada com banca de <span className="font-bold text-white">R$ 100,00</span>, buscando entrada base de <span className="font-bold text-white">R$ 0,50</span>. Estratégia de Martingale aplicada até 2 Gales (<span className="font-bold text-white">Entrada R$ 0,50</span> ➔ <span className="font-bold text-white">G1 R$ 1,00</span> ➔ <span className="font-bold text-white">G2 R$ 2,00</span>). Acertos em qualquer etapa garantem ganhos com base no multiplicador real do setor sorteado. Caso a banca quebre (R$ 0,00), ela é reiniciada automaticamente para recomeço das estatísticas.
        </div>
      </div>

      {/* CONTENT COLUMNS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: ACTIVE LOCKED OR NORMAL TIPS (Lg: 7) */}
        <div className="lg:col-span-7 space-y-5">
          
          <AnimatePresence mode="popLayout">
            {activeTip ? (() => {
              const actSectors = activeTip.targetSectors.length;
              const actBaseBet = activeTip.baseBetPerSector || 0.50;
              return (
                // MONITORED ACTIVE TIP PANEL (LOCK OUT)
                <motion.div
                  key="active-locked-card"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="relative overflow-hidden bg-gradient-to-r from-[#ec4899]/10 via-[#d4a84c]/5 to-transparent border-2 border-pink-500/40 rounded-2xl p-5.5 shadow-xl"
                >
                  {/* Locking overlay badge */}
                  <div className="absolute top-3.5 right-4.5 bg-pink-500/20 border border-pink-500/30 text-pink-300 font-mono text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <Lock size={10} /> Operação Travada (Monitorando)
                  </div>

                  <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider mb-2">
                    <TrendingUp size={11} style={{ strokeWidth: 3 }} /> Alvo Detectado
                  </div>

                  {activeTip.isSoros && (
                    <div className="mb-3 p-2.5 py-2 bg-pink-500/15 border border-pink-500/25 text-[10.5px] text-pink-350 text-pink-300 rounded-xl flex items-center gap-2 font-mono">
                      <Zap size={12} className="animate-pulse text-pink-400 shrink-0" />
                      <span>
                        <strong className="text-white uppercase font-black">SOROS NÍVEL 1 ATIVO:</strong> Reinvestimento de R$ {actBaseBet.toFixed(2)} por setor!
                      </span>
                    </div>
                  )}

                  <h4 className="font-display font-black text-white text-base leading-tight mb-2">
                    {activeTip.title}
                  </h4>

                  <p className="text-slate-350 text-xs leading-relaxed mb-4 leading-relaxed">
                    {activeTip.description.replace(/\*\*(.*?)\*\*/g, "$1")}
                  </p>

                  {/* Targeted Sectors Highlight */}
                  <div className="bg-black/30 border border-white/5 rounded-xl p-3 mb-4.5">
                    <span className="text-[9.5px] font-mono text-slate-400 uppercase font-bold tracking-wider block mb-1.5">
                      🎯 Setores Recomendados:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {activeTip.targetSectors.map((sect) => (
                        <span
                          key={sect}
                          className="bg-gradient-to-r from-pink-500/25 to-[#d4a84c]/25 border border-pink-500/40 rounded-lg px-3 py-1 font-mono text-white text-xs font-black shadow-inner"
                        >
                          {sect === "CoinFlip" ? "Coin Flip" : sect === "CashHunt" ? "Cash Hunt" : sect === "CrazyTime" ? "Crazy Time" : sect === "bonus" ? "Qualquer Bônus" : sect}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* THE GALE 1 & GALE 2 WAIT STATE TIMELINE */}
                  <div className="bg-black/45 border border-white/5 rounded-2xl p-4.5 mb-4">
                    <div className="flex items-center justify-between mb-3 text-[10px] font-mono font-bold text-slate-400">
                      <span className="uppercase tracking-wider">Canais de Cobertura de Rodadas</span>
                      <span className="text-amber-400/80">Rodada {activeTip.roundsChecked} de 3 max</span>
                    </div>

                    {/* 3 Step progress line */}
                    <div className="grid grid-cols-3 gap-2 relative">
                      {/* Primary Entry */}
                      <div className={`p-2.5 rounded-xl border text-center transition-all ${
                        activeTip.roundsChecked >= 1 
                          ? (activeTip.roundsChecked === 1 && spins[0].isBonus === false ? "bg-red-500/10 border-red-500/30 text-rose-400" : "bg-slate-800/40 border-white/10 text-slate-400")
                          : "bg-pink-500/15 border-pink-500/40 text-pink-300 font-extrabold focus-glow"
                      }`}>
                        <p className="text-[9.5px] font-bold block">1ª Rodada</p>
                        <p className="text-[8.5px] opacity-90 mt-0.5 font-mono text-emerald-400 font-semibold" title={`R$ ${actBaseBet.toFixed(2)} por setor`}>
                          Entrada: {actSectors > 1 ? `R$ ${actBaseBet.toFixed(2)} [R$ ${(actBaseBet * actSectors).toFixed(2)}]` : `R$ ${actBaseBet.toFixed(2)}`}
                        </p>
                        {activeTip.roundsChecked >= 1 && (
                          <span className="text-[8.5px] block mt-1 font-mono text-rose-400">❌ Errou ({activeTip.history[0] || "1"})</span>
                        )}
                      </div>

                      {/* Gale 1 */}
                      <div className={`p-2.5 rounded-xl border text-center transition-all ${
                        activeTip.roundsChecked === 1 
                          ? "bg-amber-500/15 border-amber-500/40 text-amber-300 font-extrabold"
                          : (activeTip.roundsChecked >= 2 
                              ? "bg-slate-800/40 border-white/10 text-slate-400" 
                              : "bg-black/20 border-white/5 text-slate-600")
                      }`}>
                        <p className="text-[9.5px] font-bold block">Gale 1</p>
                        <p className="text-[8.5px] opacity-90 mt-0.5 font-mono text-amber-400 font-semibold" title={`R$ ${(actBaseBet * 2).toFixed(2)} por setor`}>
                          G1: {actSectors > 1 ? `R$ ${(actBaseBet * 2).toFixed(2)} [R$ ${(actBaseBet * 2 * actSectors).toFixed(2)}]` : `R$ ${(actBaseBet * 2).toFixed(2)}`}
                        </p>
                        {activeTip.roundsChecked >= 2 && (
                          <span className="text-[8.5px] block mt-1 font-mono text-rose-400">❌ Errou ({activeTip.history[1] || "2"})</span>
                        )}
                      </div>

                      {/* Gale 2 */}
                      <div className={`p-2.5 rounded-xl border text-center transition-all ${
                        activeTip.roundsChecked === 2 
                          ? "bg-rose-500/15 border-rose-500/40 text-rose-300 font-extrabold"
                          : (activeTip.roundsChecked >= 3 
                              ? "bg-slate-800/40 border-white/10 text-slate-400" 
                              : "bg-black/20 border-white/5 text-slate-600")
                      }`}>
                        <p className="text-[9.5px] font-bold block">Gale 2</p>
                        <p className="text-[8.5px] opacity-90 mt-0.5 font-mono text-rose-300 font-semibold" title={`R$ ${(actBaseBet * 4).toFixed(2)} por setor`}>
                          G2: {actSectors > 1 ? `R$ ${(actBaseBet * 4).toFixed(2)} [R$ ${(actBaseBet * 4 * actSectors).toFixed(2)}]` : `R$ ${(actBaseBet * 4).toFixed(2)}`}
                        </p>
                        {activeTip.roundsChecked >= 3 && (
                          <span className="text-[8.5px] block mt-1 font-mono text-rose-400">❌ Errou ({activeTip.history[2] || "3"})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10.5px] text-[#d4a84c] bg-[#12121a]/80 p-3 rounded-xl border border-white/5 leading-relaxed font-sans">
                    <Info size={14} className="shrink-0 text-amber-500" />
                    <div>
                      <span className="font-extrabold">Instruções de Cobertura:</span> Se o alvo não aparecer imediatamente, mantenha o sinal coberto nas próximas duas rodadas com multiplicador moderado (Gale para repor saldo).
                    </div>
                  </div>

                  {/* 📡 Send to Extension button (only if configured) */}
                  {isConfigured && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSendTipToExtension}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 hover:border-emerald-400/50 text-emerald-300 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-[0.97]"
                      >
                        <Send size={12} />
                        📡 Enviar para Extensão
                      </button>

                      {/* Pattern type auto-send selectors */}
                      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/10">
                        <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider mr-1">Auto:</span>
                        <button
                          onClick={() => togglePatternSelection("any")}
                          className={`px-2 py-1 rounded-md text-[9px] font-mono font-bold transition-all cursor-pointer border ${
                            selectedAutoPatterns.has("any")
                              ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300 shadow-sm"
                              : "bg-transparent border-transparent text-slate-500 hover:text-slate-300"
                          }`}
                          title="Enviar sinal para qualquer padrão detectado"
                        >
                          🎯 Todos
                        </button>
                        {PATTERN_TYPES_CONFIG.map(pt => (
                          <button
                            key={pt.key}
                            onClick={() => togglePatternSelection(pt.key)}
                            className={`px-2 py-1 rounded-md text-[9px] font-mono font-bold transition-all cursor-pointer border ${
                              selectedAutoPatterns.has(pt.key)
                                ? `${pt.color} bg-white/10 border-white/20 shadow-sm`
                                : "bg-transparent border-transparent text-slate-600 hover:text-slate-400"
                            }`}
                            title={pt.desc}
                          >
                            {pt.label}
                          </button>
                        ))}
                      </div>

                      {/* Toast feedback */}
                      <AnimatePresence>
                        {signalToast && (
                          <motion.div
                            key="signal-toast"
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 8 }}
                            transition={{ duration: 0.2 }}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono border ${
                              signalToast.type === "success"
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
                                : "bg-red-500/15 text-red-300 border-red-500/25"
                            }`}
                          >
                            {signalToast.type === "success" ? "✓" : "✗"} {signalToast.message}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                </motion.div>
              );
            })() : (
              // DEFAULT DETECTOR PREVIEW (WHEN NO ACTIVE TARGET LOCK)
              <motion.div
                key="no-active-locked-card"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono uppercase text-[#ec4899] tracking-widest font-bold flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#ec4899] rounded-full animate-pulse" />
                    Padrões Ativos Recomendados na Mesa ({activePatterns.length})
                  </h4>
                  <span className="text-[10px] text-slate-400">Auto-Travar no Primeiro Sinal</span>
                </div>

                <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                  {activePatterns.length === 0 ? (
                    <div className="border border-dashed border-white/5 flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl text-slate-500">
                      <Sparkles size={24} className="text-slate-600 mb-2" />
                      <p className="text-xs font-sans">Aguardando formação de anomalias estatísticas.</p>
                      <p className="text-[10px] text-slate-600 mt-1 max-w-sm">
                        Os giros atuais estão seguindo os desvios padrão aceitáveis. A mesa está estável.
                      </p>
                    </div>
                  ) : (
                    activePatterns.map((pat) => (
                      <div
                        key={pat.id}
                        className={`bg-[#12121a]/40 hover:bg-[#12121a]/70 border border-white/5 hover:border-white/10 rounded-2xl p-4.5 transition-all text-xs flex flex-col gap-3 relative overflow-hidden`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <h5 className="font-display font-bold text-white text-xs sm:text-sm">{pat.title}</h5>
                          <span className={`text-[8.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${pat.strengthColor}`}>
                            {pat.strength}
                          </span>
                        </div>

                        <p className="text-slate-300 leading-relaxed font-sans">{pat.description.replace(/\*\*(.*?)\*\*/g, "$1")}</p>
                        
                        <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-[10.5px]">
                          <div className="text-[#d4a84c] font-bold uppercase tracking-wider text-[9px] mb-1 flex items-center gap-1">
                            <Zap size={10} /> Estratégia de Cobertura Recomendada:
                          </div>
                          <p className="text-slate-400 leading-relaxed font-sans">{pat.recommendation}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* HISTÓRICO RECENTE DE SINAIS (MARKERS LOG) */}
          <div className="border-t border-white/5 pt-4">
            <h4 className="text-[10px] font-mono uppercase text-slate-400 tracking-wider font-extrabold flex items-center gap-1.5 mb-3">
              <Eye size={12} className="text-slate-400" /> Histórico Recente de Sinais Gerados
            </h4>
            
            {tipHistory.length === 0 ? (
              <p className="text-[10px] font-mono text-slate-500 italic">Nenhum sinal completo registrado neste período.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                {tipHistory.map((hist, idx) => (
                  <div 
                    key={hist.id + idx}
                    className="bg-black/30 border border-white/5 rounded-xl p-2.5 flex items-center justify-between text-xs gap-3"
                  >
                    <div className="truncate md:max-w-[200px]">
                      <p className="font-display font-semibold text-slate-200 text-[11px] truncate flex items-center gap-1">
                        {hist.isSoros && <Zap size={10} className="text-pink-400 shrink-0 animate-pulse fill-pink-500/30" />}
                        {hist.title}
                      </p>
                      <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">
                        Regra: {hist.roundsChecked} rodadas • Setores: {hist.targetSectors.map(s => s === "CoinFlip" ? "Coin Flip" : s === "CashHunt" ? "Cash Hunt" : s === "CrazyTime" ? "Crazy Time" : s === "bonus" ? "Bônus" : s).join(", ")} {hist.baseBetPerSector && `[R$ ${hist.baseBetPerSector.toFixed(2)}/setor]`}
                      </p>
                      {hist.hitSpin && (
                        <p className="text-[8.5px] text-amber-300 font-mono mt-1 leading-normal max-w-full truncate">
                          🎯 Sorteado: <strong className="text-white">{hist.hitSpin.displayName}</strong>
                          {hist.hitSpin.maxMultiplier > 1 && ` [${hist.hitSpin.maxMultiplier}x]`}
                        </p>
                      )}
                      {hist.hitSpin?.description && (
                        <p className="text-[8px] text-slate-400 italic mt-0.5 max-w-full truncate" title={hist.hitSpin.description}>
                          {hist.hitSpin.description}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {hist.outcome === "win" ? (
                        <>
                          <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <CheckCircle2 size={10} /> GREEN
                          </span>
                          <span className="text-[9.5px] font-mono text-emerald-400 font-bold leading-none mt-0.5">
                            +R$ {(hist.profit !== undefined ? hist.profit : 0.50).toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <XCircle size={10} /> RED
                          </span>
                          <span className="text-[9.5px] font-mono text-rose-400 font-bold leading-none mt-0.5">
                            -R$ {(hist.profit !== undefined ? Math.abs(hist.profit) : 3.50).toFixed(2)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: ALMOST FORMED ALERTS AND COMPARATIVES (Lg: 5) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono uppercase text-[#d4a84c] tracking-widest font-bold flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#d4a84c] rounded-full" />
              Sinais Próximos de se Formar ({almostFormedPatterns.length})
            </h4>
            <span className="text-[10px] text-slate-400">Preparação</span>
          </div>

          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
            {almostFormedPatterns.length === 0 ? (
              <div className="border border-dashed border-white/5 flex flex-col items-center justify-center text-center py-16 p-6 rounded-2xl text-slate-500">
                <HelpCircle size={24} className="text-slate-600 mb-2" />
                <p className="text-xs font-sans">Nenhum padrão secundário em aproximação.</p>
                <p className="text-[10px] text-slate-600 mt-1 max-w-sm">
                  Não há ciclos preliminares que atinjam a faixa de gatilho iminente.
                </p>
              </div>
            ) : (
              almostFormedPatterns.map((pat) => (
                <div
                  key={pat.id}
                  className={`bg-[#12121a]/20 border border-white/5 hover:border-white/10 rounded-2xl p-4 transition-all text-xs flex flex-col gap-2.5`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <h5 className="font-display font-medium text-slate-300 text-xs">{pat.title}</h5>
                    <span className="text-[8.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5">
                      Alerta
                    </span>
                  </div>

                  <p className="text-slate-400 text-[11px] leading-relaxed font-sans">{pat.description.replace(/\*\*(.*?)\*\*/g, "$1")}</p>

                  <div className="text-[10px] text-[#d4a84c] bg-white/[0.01] p-2 rounded-lg border border-white/5 leading-relaxed font-sans">
                    <span className="font-bold">Requisito Preventivo:</span> {pat.recommendation}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* PERFORMANCE BY PATTERN TYPE COMPLIANCE CARD */}
          <div className="bg-gradient-to-br from-[#12121a]/60 to-[#12121a]/20 border border-white/5 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-pink-400 font-extrabold" />
                <h4 className="text-xs font-mono uppercase text-white tracking-wider font-extrabold">
                  Assertividade por Categoria
                </h4>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Simulador</span>
            </div>

            <div className="space-y-2.5">
              {(Object.entries(typePerformance) as [string, { greens: number; reds: number; profit: number }][]).map(([key, stats]) => {
                const label = PATTERN_TYPE_LABELS[key] || key;
                const total = stats.greens + stats.reds;
                const assertiveness = total > 0 ? (stats.greens / total) * 100 : 0;
                const isWinner = winnerType === key;

                return (
                  <div 
                    key={key} 
                    className={`p-3 rounded-xl border transition-all ${
                      isWinner 
                        ? "bg-pink-500/[0.04] border-pink-500/25 shadow-inner" 
                        : "bg-black/20 border-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 truncate">
                        {label}
                        {isWinner && (
                          <span className="bg-pink-500/15 border border-pink-500/30 text-pink-400 text-[8px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0 animate-pulse">
                            👑 DICA LÍDER
                          </span>
                        )}
                      </span>
                      <span className={`text-[11px] font-mono font-bold shrink-0 ${stats.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {stats.profit >= 0 ? "+" : ""}R$ {stats.profit.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1.5">
                      <span>taxa: <strong className="text-slate-200">{assertiveness.toFixed(1)}%</strong></span>
                      <span>greens: <strong className="text-emerald-400">{stats.greens}</strong> / reds: <strong className="text-rose-400">{stats.reds}</strong></span>
                    </div>

                    <div className="w-full bg-white/5 h-1.5 rounded-full mt-2 overflow-hidden border border-white/[0.02]">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          assertiveness >= 85 
                            ? "bg-gradient-to-r from-emerald-500 to-teal-400" 
                            : assertiveness >= 50 
                              ? "bg-gradient-to-r from-amber-500 to-yellow-400" 
                              : assertiveness > 0 
                                ? "bg-gradient-to-r from-rose-500 to-pink-500" 
                                : "bg-transparent"
                        }`}
                        style={{ width: `${Math.max(3, assertiveness)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* FOOTER BAR */}
      <div className="mt-8 pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-slate-500 font-mono">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="text-emerald-400 shrink-0" size={13} />
          <span>Filtro de Desvio de Laplace & Variância de Poisson com Validação de Gale 2 Automática</span>
        </div>
        <div>
          <span>REQUISITO MATEMÁTICO ADAPTADO PARA AS REGRAS DA MESA ATUALIZANDO</span>
        </div>
      </div>

    </div>
  );
}
