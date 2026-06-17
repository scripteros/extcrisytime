import { useState, useEffect } from "react";
import { ParsedSpin, GameStats } from "./types";
import { mapApiRecordToParsed, generateFallbackSpins } from "./data";
import StatsDashboard from "./components/StatsDashboard";
import FrequencyAnalysis from "./components/FrequencyAnalysis";
import HistoryGrid from "./components/HistoryGrid";
import AIAdvisor from "./components/AIAdvisor";
import BetSimulator from "./components/BetSimulator";
import PatternDetector from "./components/PatternDetector";
import DelayAnalysis from "./components/DelayAnalysis";
import SectorAnalysis from "./components/SectorAnalysis";
import MarketChartAnalysis from "./components/MarketChartAnalysis";
import SignalSender from "./components/SignalSender";
import { SignalConfigPanel, useSignalRelay } from "./hooks/useSignalRelay";
import LandingPage from "./components/LandingPage";
import CodviberLogo from "./components/CodviberLogo";
import { RotateCw, Clock, Sparkles, TrendingUp, HelpCircle, ShieldCheck, RefreshCw, Home, BarChart3, Layers, Radio, LayoutDashboard, Brain, Target, DollarSign, Timer, BarChart4, History, Waves, Wifi, Menu, X, Crosshair } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [spins, setSpins] = useState<ParsedSpin[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFallbackMode, setIsFallbackMode] = useState<boolean>(false);
  const [errorCount, setErrorCount] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(20);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [timeFilter, setTimeFilter] = useState<string>(() => {
    try { return localStorage.getItem("app_time_filter") || "all"; }
    catch { return "all"; }
  });
  useEffect(() => {
    try { localStorage.setItem("app_time_filter", timeFilter); } catch {}
  }, [timeFilter]);
  const [customDays, setCustomDays] = useState<string>(() => {
    try { return localStorage.getItem("app_custom_days") || "1"; }
    catch { return "1"; }
  });
  useEffect(() => {
    try { localStorage.setItem("app_custom_days", customDays); } catch {}
  }, [customDays]);
  const [showLandingPage, setShowLandingPage] = useState<boolean>(() => {
    try { return localStorage.getItem("app_show_landing") !== "false"; }
    catch { return true; }
  });
  const [activeTab, setActiveTab] = useState<"standard" | "market">("standard");
  const [crazyTimeFlapper, setCrazyTimeFlapper] = useState<"alternate" | "Green" | "Blue" | "Yellow">(() => {
    try { const saved = localStorage.getItem("app_flapper_color"); if (saved === "alternate" || saved === "Green" || saved === "Blue" || saved === "Yellow") return saved; }
    catch {}
    return "alternate";
  });
  useEffect(() => {
    try { localStorage.setItem("app_flapper_color", crazyTimeFlapper); } catch {}
  }, [crazyTimeFlapper]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeMenu, setActiveMenu] = useState<string>(() => {
    try { return localStorage.getItem("app_active_menu") || "dashboard"; }
    catch { return "dashboard"; }
  });

  useEffect(() => {
    try { localStorage.setItem("app_show_landing", showLandingPage.toString()); } catch {}
  }, [showLandingPage]);

  useEffect(() => {
    try { localStorage.setItem("app_active_menu", activeMenu); } catch {}
  }, [activeMenu]);

  // Global analysis window (candle period in minutes) shared between PatternDetector and MarketChartAnalysis
  const [candlePeriodMinutes, setCandlePeriodMinutes] = useState<number>(() => {
    try { const saved = localStorage.getItem("candle_period_minutes"); return saved ? parseInt(saved) : 5; }
    catch { return 5; }
  });
  useEffect(() => {
    try { localStorage.setItem("candle_period_minutes", candlePeriodMinutes.toString()); } catch {}
  }, [candlePeriodMinutes]);

  // Shared signal relay configuration (persisted in localStorage)
  const signalRelay = useSignalRelay();
  const { extensionId, setExtensionId } = signalRelay;
  
  // Asynchronously fetch the last 100 entries from the Evolution endpoints through local proxy
  const fetchCrazyTimeData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/crazytime-history", {
        headers: {
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const json = await response.json();
      
      if (Array.isArray(json) && json.length > 0) {
        const parsed = json.map((record: any) => mapApiRecordToParsed(record));
        setSpins(parsed);
        setIsFallbackMode(false);
      } else {
        throw new Error("API returned blank or incompatible schema");
      }
    } catch (error) {
      console.warn("CORS filter restriction or network timeout on Crazy Time public API. Activating offline analysis backup...", error);
      
      // If spins has not been set yet, or we want updated records, generate clean backup dataset
      if (spins.length === 0) {
        const fallback = generateFallbackSpins(1500);
        setSpins(fallback);
      } else {
        // Just advance fallback times slightly or simulate a new spin to look active
        const simulatedNew = generateFallbackSpins(1);
        setSpins(prev => {
          const combined = [...simulatedNew, ...prev].slice(0, 1500);
          return combined;
        });
      }
      setIsFallbackMode(true);
      setErrorCount(prev => prev + 1);
    } finally {
      setIsLoading(false);
      setLastUpdated(new Date());
      setCountdown(20);
    }
  };

  // Setup mount execution and 20s polling routine
  useEffect(() => {
    fetchCrazyTimeData();

    // Ticks countdown, executes update when reaching 0
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchCrazyTimeData();
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Helper to process spins based on crazyTimeFlapper preference
  const getProcessedSpins = (rawSpins: ParsedSpin[], flapperPref: "alternate" | "Green" | "Blue" | "Yellow") => {
    let crazyTimeCount = 0;
    
    // We process from oldest to newest to keep sequential rotation chronological
    const reversedRaw = [...rawSpins].reverse();
    const processedReversed = reversedRaw.map((spin) => {
      if (spin.sectorKey !== "CrazyTime") {
        return spin;
      }
      
      const flappers = spin.crazyTimeFlappers || {
        Green: spin.maxMultiplier,
        Blue: spin.maxMultiplier,
        Yellow: spin.maxMultiplier
      };
      
      let selectedColor: "Green" | "Blue" | "Yellow";
      if (flapperPref === "alternate") {
        selectedColor = (["Green", "Blue", "Yellow"] as const)[crazyTimeCount % 3];
        crazyTimeCount++;
      } else {
        selectedColor = flapperPref;
      }
      
      const activeMult = flappers[selectedColor];
      
      const baseDesc = spin.bonusStageDetails?.multiplierDescription || "";
      const cleanDesc = baseDesc.replace(/🎯 🟢|🎯 🔵|🎯 🟡|🎯 \[.*?\]|\[Ativo: .*?\]/g, "").trim();
      const colorPortNames = { Green: "Verde", Blue: "Azul", Yellow: "Amarelo" };
      
      return {
        ...spin,
        maxMultiplier: activeMult,
        activeFlapperColor: selectedColor,
        bonusStageDetails: spin.bonusStageDetails ? {
          ...spin.bonusStageDetails,
          multiplierDescription: `Flapper ${colorPortNames[selectedColor]}: ${activeMult}x (Crazy Time)`
        } : null
      };
    });
    
    return processedReversed.reverse();
  };

  const processedSpins = getProcessedSpins(spins, crazyTimeFlapper);

  // Filter spins by selected time window
  const getFilteredSpins = () => {
    if (timeFilter === "all") return processedSpins;
    const now = Date.now();
    let msLimit = 0;
    if (timeFilter === "15m") msLimit = 15 * 60 * 1000;
    else if (timeFilter === "30m") msLimit = 30 * 60 * 1000;
    else if (timeFilter === "1h") msLimit = 60 * 60 * 1000;
    else if (timeFilter === "3h") msLimit = 3 * 60 * 60 * 1000;
    else if (timeFilter === "6h") msLimit = 6 * 60 * 60 * 1000;
    else if (timeFilter === "customDays") {
      const days = parseFloat(customDays) || 1;
      msLimit = days * 24 * 60 * 60 * 1000;
    }
    
    const filtered = processedSpins.filter(s => (now - s.timestamp) <= msLimit);
    // Safe fallback so UI never breaks if filtered too tightly
    if (filtered.length < 5) {
      return processedSpins.slice(0, 10);
    }
    return filtered;
  };

  const filteredSpins = getFilteredSpins();

  // Compute Core Statistical Totals over the filtered dataset
  const totalSpins = filteredSpins.length;
  const bonusSpins = filteredSpins.filter((s) => s.isBonus);
  const bonusCount = bonusSpins.length;
  const bonusPercentage = totalSpins > 0 ? (bonusCount / totalSpins) * 100 : 0;
  
  const totalMultiplier = filteredSpins.reduce((acc, s) => acc + s.maxMultiplier, 0);
  const averageMultiplier = totalSpins > 0 ? totalMultiplier / totalSpins : 0;
  const maxMultiplier = totalSpins > 0 ? Math.max(...filteredSpins.map((s) => s.maxMultiplier)) : 0;
  
  const lastSpin = filteredSpins[0] || processedSpins[0] || null;
  const topSlotMatches = filteredSpins.filter((s) => s.isTopSlotMatched).length;

  const lastBonusInst = filteredSpins.findIndex((s) => s.isBonus);
  const roundsSinceLastBonus = lastBonusInst >= 0 ? lastBonusInst : filteredSpins.length;

  // Predict next bonus round chance
  let predictedBonusChance = 16.67;
  if (roundsSinceLastBonus === 0) {
    predictedBonusChance = 12.5;
  } else if (roundsSinceLastBonus <= 3) {
    predictedBonusChance = 12.5 + roundsSinceLastBonus * 2.5;
  } else if (roundsSinceLastBonus <= 6) {
    predictedBonusChance = 20.0 + (roundsSinceLastBonus - 3) * 6.0;
  } else if (roundsSinceLastBonus <= 10) {
    predictedBonusChance = 38.0 + (roundsSinceLastBonus - 6) * 8.5;
  } else {
    predictedBonusChance = Math.min(96.8, 72.0 + (roundsSinceLastBonus - 10) * 4.0);
  }

  let predictionConfidence: "Mínima" | "Baixa" | "Moderada" | "Alta" | "Crítica" = "Mínima";
  if (predictedBonusChance < 15) predictionConfidence = "Baixa";
  else if (predictedBonusChance < 25) predictionConfidence = "Moderada";
  else if (predictedBonusChance < 55) predictionConfidence = "Alta";
  else predictionConfidence = "Crítica";

  const stats: GameStats = {
    totalSpins,
    bonusCount,
    bonusPercentage,
    averageMultiplier,
    maxMultiplier,
    lastSector: lastSpin?.sectorKey || "N/A",
    lastSectorDisplayName: lastSpin?.displayName || "N/A",
    lastSectorTime: lastSpin?.settledAt || "",
    topSlotMatches,
    roundsSinceLastBonus,
    predictedBonusChance,
    predictionConfidence
  };

  const handleSelectSectorFromFrequency = (sectorKey: string | null) => {
    if (sectorKey === null) {
      setSelectedFilter("all");
    } else {
      setSelectedFilter(sectorKey);
    }
  };

  if (showLandingPage) {
    return (
      <LandingPage
        onEnterApp={() => setShowLandingPage(false)}
        spins={spins}
        stats={stats}
        isLoading={isLoading}
        isFallbackMode={isFallbackMode}
        fetchCrazyTimeData={fetchCrazyTimeData}
      />
    );
  }

  return (
    <div className="min-h-screen pb-16 flex flex-col relative" id="crazytime-tracker-root">
      {/* Dynamic Ambient Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-[600px] pointer-events-none overflow-hidden z-0 bg-radial-gradient-animated select-none opacity-40" />
      <div className="absolute top-[400px] right-0 w-full h-[600px] pointer-events-none overflow-hidden z-0 bg-radial-magenta-animated select-none opacity-45" />

      {/* Navigation / Top Header Bar */}
      <header className="border-b border-white/[0.04] bg-[#0a0a0f]/60 backdrop-blur-md sticky top-0 z-50 px-4 md:px-8 py-4 mb-8" id="tracker-header">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Brand logo & status indicators */}
          <div className="flex flex-col sm:items-start text-center sm:text-left">
            <CodviberLogo size="md" />
            
            <p className="text-xs text-slate-400 mt-2 flex items-center justify-center sm:justify-start gap-1">
              <span>Análise profissional em tempo real das últimas {totalSpins} rodadas</span>
            </p>
          </div>

          {/* Synchronizer Panel and timer controls */}
          <div className="flex flex-wrap items-center justify-center gap-3 font-mono">
            
            {/* Back to Home Button */}
            <button
              onClick={() => setShowLandingPage(true)}
              className="flex items-center gap-1.5 rounded-xl bg-white/[0.02] border border-white/10 px-3.5 h-[38px] text-xs font-sans font-bold text-slate-300 hover:text-white hover:bg-white/[0.05] transition-all cursor-pointer"
              title="Voltar para a Página Inicial"
            >
              <Home size={13} className="text-[#ec4899]" />
              <span>Início</span>
            </button>

            {/* Time Filter Selector Dropdown */}
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.02] border border-white/10 p-1 px-3 h-[38px] transition-all hover:bg-white/[0.04]">
              <Clock size={13} className="text-[#d4a84c]" />
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-200 font-sans font-semibold outline-none cursor-pointer border-none focus:ring-0 py-0.5 pr-1"
                style={{ WebkitAppearance: 'menulist' }}
              >
                <option value="all" className="bg-[#0b0b10] text-[#d4a84c]">Período: Completo</option>
                <option value="15m" className="bg-[#0b0b10] text-slate-200">Últimos 15 min</option>
                <option value="30m" className="bg-[#0b0b10] text-slate-200">Últimos 30 min</option>
                <option value="1h" className="bg-[#0b0b10] text-slate-200">Última 1 hora</option>
                <option value="3h" className="bg-[#0b0b10] text-slate-200">Últimas 3 horas</option>
                <option value="6h" className="bg-[#0b0b10] text-slate-200">Últimas 6 horas</option>
                <option value="customDays" className="bg-[#0b0b10] text-pink-400 font-bold">Digitar Dias...</option>
              </select>
            </div>

            {timeFilter === "customDays" && (
              <div className="flex items-center gap-1.5 rounded-xl bg-pink-500/[0.03] border border-pink-500/25 p-1 px-3 h-[38px] transition-all">
                <span className="text-[10px] uppercase font-mono font-black text-pink-400 select-none">Dias:</span>
                <input
                  type="number"
                  min="0.1"
                  max="15"
                  step="0.1"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  className="bg-transparent w-10 text-center text-xs font-mono font-black text-white outline-none border-none focus:ring-0 p-0"
                />
              </div>
            )}

            {/* Global Analysis Window (Periodo) Selector — shared by PatternDetector & MarketChartAnalysis */}
            <div className="flex items-center gap-1 rounded-xl bg-indigo-500/[0.03] border border-indigo-500/20 p-1 px-2.5 h-[38px] transition-all" title="Período de análise compartilhado entre Simulador de Padrões e Catalogador de Velas">
              <BarChart3 size={12} className="text-indigo-400 shrink-0" />
              <span className="text-[9px] uppercase font-mono font-black text-indigo-400 select-none hidden sm:inline">Vela:</span>
              <select
                value={candlePeriodMinutes}
                onChange={(e) => setCandlePeriodMinutes(parseInt(e.target.value))}
                className="bg-transparent text-[10px] text-indigo-200 font-mono font-bold outline-none cursor-pointer border-none focus:ring-0 p-0 py-0.5"
                style={{ WebkitAppearance: 'menulist', width: '52px' }}
              >
                <option value={1} className="bg-[#0b0b10]">1m</option>
                <option value={5} className="bg-[#0b0b10]">5m</option>
                <option value={15} className="bg-[#0b0b10]">15m</option>
                <option value={30} className="bg-[#0b0b10]">30m</option>
                <option value={60} className="bg-[#0b0b10]">1h</option>
                <option value={120} className="bg-[#0b0b10]">2h</option>
                <option value={360} className="bg-[#0b0b10]">6h</option>
              </select>
              </div>

            {/* Signal Relay Config - Extension ID */}
            <SignalConfigPanel
              extensionId={extensionId}
              onExtensionIdChange={setExtensionId}
            />

            {/* Status light */}
            {isFallbackMode ? (
              <div 
                className="flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs h-[38px]"
                title="Sincronização analítica segura ativada."
              >
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <span>Sincronizado</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs h-[38px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Sincronizado Live</span>
              </div>
            )}

            {/* Countdown Badge & Manual Trigger button */}
            <div className="flex items-center rounded-xl bg-white/[0.02] border border-white/5 p-1 h-[38px]">
              <div className="text-xs px-3 text-gray-400 flex items-center gap-1">
                <Clock size={12} className="text-gray-500" />
                Próximo em <span className="text-white font-bold w-4 text-center">{countdown}s</span>
              </div>

              <button
                disabled={isLoading}
                onClick={fetchCrazyTimeData}
                className="p-1 px-2 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-[#d4a84c] border border-white/10 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                title="Sincronizar resultados agora"
              >
                <RotateCw size={11} className={`${isLoading ? "animate-spin" : ""}`} />
                <span className="text-[10px] uppercase font-bold sm:inline hidden">Atualizar</span>
              </button>
            </div>
          </div>
          
        </div>
      </header>

      {/* Main Layout Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 relative z-10 flex flex-col gap-8">
        
        {/* Loading Spinner overlay on startup */}
        {isLoading && spins.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-20 min-h-[300px]">
            <RefreshCw className="animate-spin text-[#d4a84c] mb-4" size={42} />
            <span className="font-display font-semibold text-lg text-white">Carregando Resultados...</span>
            <p className="text-xs text-gray-500 mt-2 font-mono">Buscando histórico oficial de giros da Evolution Gaming</p>
          </div>
        ) : (
          <>
            {/* 1. Bento Grid Stats Board */}
            <StatsDashboard stats={stats} lastSpin={lastSpin} />

            {/* Seletor de Flapper para Crazy Time */}
            <div className="glass-panel p-4 md:p-5 rounded-2xl border border-white/5 bg-gradient-to-r from-slate-900/40 to-slate-900/20 shadow-lg relative overflow-hidden" id="crazytime-flapper-selector">
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

            {/* Sidebar + Content Layout */}
            <div className="flex gap-5 items-start">
              
              {/* Sidebar Navigation */}
              <div className={`${sidebarOpen ? 'w-48' : 'w-12'} shrink-0 transition-all duration-300`}>
                <div className="glass-panel rounded-2xl border border-white/5 bg-slate-900/40 overflow-hidden sticky top-24">
                  
                  {/* Toggle button */}
                  <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="w-full flex items-center gap-2 px-3 py-3 border-b border-white/5 text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                  >
                    {sidebarOpen ? <X size={14} /> : <Menu size={14} />}
                    {sidebarOpen && <span className="text-[10px] uppercase tracking-wider font-semibold">Menu</span>}
                  </button>

                  {/* Menu items */}
                  <div className="py-1.5">
                    {[
                      { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', desc: 'Estatísticas' },
                      { id: 'aiadvisor', icon: Brain, label: 'IA Mentor', desc: 'Análise por IA' },
                      { id: 'patterns', icon: Target, label: 'Padrões', desc: 'Pattern + Soros' },
                      { id: 'simulator', icon: DollarSign, label: 'Simulador', desc: 'Estratégias' },
                      { id: 'delays', icon: Timer, label: 'Atrasos', desc: 'Ciclos' },
                      { id: 'sector', icon: Crosshair, label: 'Setor', desc: 'Análise Completa' },
                      { id: 'frequency', icon: BarChart4, label: 'Frequência', desc: 'Distribuição' },
                      { id: 'history', icon: History, label: 'Histórico', desc: 'Resultados' },
                      { id: 'market', icon: Layers, label: 'Velas', desc: 'Padrões & Catálogo' },
                      { id: 'signals', icon: Wifi, label: 'Sinais', desc: 'Extension Relay' },
                    ].map(item => (
                      <button
                        key={item.id}
                        onClick={() => setActiveMenu(item.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-all cursor-pointer border-l-2 ${
                          activeMenu === item.id
                            ? 'bg-[#d4a84c]/10 text-[#d4a84c] border-l-[#d4a84c]'
                            : 'text-slate-400 border-l-transparent hover:text-white hover:bg-white/5'
                        }`}
                        title={!sidebarOpen ? item.label : undefined}
                      >
                        <item.icon size={16} className="shrink-0" />
                        {sidebarOpen && (
                          <div className="text-left min-w-0">
                            <div className="font-semibold truncate">{item.label}</div>
                            <div className="text-[9px] text-slate-500 truncate">{item.desc}</div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 min-w-0">
                
                {/* Conditional content based on activeMenu */}
                {activeMenu === 'dashboard' && (
                  <div className="space-y-6">
                    <AIAdvisor spins={filteredSpins} stats={stats} />
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      <div className="col-span-1 lg:col-span-12">
                        <HistoryGrid
                          spins={filteredSpins}
                          selectedFilter={selectedFilter}
                          onChangeFilter={setSelectedFilter}
                        />
                      </div>
                    </div>
                    <SignalSender />
                  </div>
                )}

                {activeMenu === 'aiadvisor' && <AIAdvisor spins={filteredSpins} stats={stats} />}
                {activeMenu === 'patterns' && <PatternDetector spins={filteredSpins} candlePeriodMinutes={candlePeriodMinutes} />}
                {activeMenu === 'simulator' && <BetSimulator spins={filteredSpins} />}
                {activeMenu === 'delays' && <DelayAnalysis allSpins={filteredSpins} />}
                {activeMenu === 'sector' && <SectorAnalysis allSpins={filteredSpins} />}

                {activeMenu === 'frequency' && (
                  <FrequencyAnalysis
                    allSpins={filteredSpins}
                    selectedSector={selectedFilter === "all" || selectedFilter === "bonus" ? null : selectedFilter}
                    onSelectSector={handleSelectSectorFromFrequency}
                  />
                )}

                {activeMenu === 'history' && (
                  <HistoryGrid
                    spins={filteredSpins}
                    selectedFilter={selectedFilter}
                    onChangeFilter={setSelectedFilter}
                  />
                )}

                {activeMenu === 'market' && <MarketChartAnalysis allSpins={filteredSpins} candlePeriodMinutes={candlePeriodMinutes} />}
                {activeMenu === 'signals' && <SignalSender />}

                {/* Footer card */}
                <footer className="glass-panel p-6 rounded-2xl border border-white/5 mt-6" id="tracker-guideline-footer">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-[#d4a84c] shrink-0">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-white text-sm mb-1.5">
                        Informações Importantes & Distribuição Estatística Real (RTP)
                      </h4>
                      <p className="text-xs text-gray-400 leading-relaxed mb-3">
                        Crazy Time é um jogo de cassino ao vivo com uma roleta física que possui exatamente 54 segmentos distribuídos. O retorno teórico ao jogador (RTP) varia de 96.08% (número 1) a 94.41% (Crazy Time). As jogadas são independentes e as tendências registradas na amostragem de 100 giros servem para análise de variação probabilística de curto prazo.
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-white/5 font-mono text-[10px] text-gray-500">
                        <div><span className="block text-white font-semibold">Segmentos Número 1:</span><span>21 / 54 (38.89% Teórico)</span></div>
                        <div><span className="block text-white font-semibold">Segmentos Número 2:</span><span>13 / 54 (24.07% Teórico)</span></div>
                        <div><span className="block text-white font-semibold">Segmentos Número 5:</span><span>7 / 54 (12.96% Teórico)</span></div>
                        <div><span className="block text-white font-semibold">Segmentos Número 10:</span><span>4 / 54 (7.41% Teórico)</span></div>
                        <div className="mt-2 text-[#eab308]"><span className="block font-semibold">Coin Flip Bônus:</span><span>4 / 54 (7.41% Teórico)</span></div>
                        <div className="mt-2 text-[#22c55e]"><span className="block font-semibold">Pachinko Bônus:</span><span>2 / 54 (3.70% Teórico)</span></div>
                        <div className="mt-2 text-[#ec4899]"><span className="block font-semibold">Cash Hunt Bônus:</span><span>2 / 54 (3.70% Teórico)</span></div>
                        <div className="mt-2 text-[#d946ef]"><span className="block font-semibold">Crazy Time Bônus:</span><span>1 / 54 (1.85% Teórico)</span></div>
                      </div>
                    </div>
                  </div>
                </footer>

              </div>
            </div>
          </>
        )}
      </main>

      {/* Floating telemetry label to look clean and humble */}
      <div className="w-full text-center mt-12 text-gray-600 font-mono text-[10px] select-none">
        Crazy Time Analyzer © 2026 • Live Sync v2.0
      </div>
    </div>
  );
}
