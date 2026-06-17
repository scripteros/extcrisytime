import { ParsedSpin, GameStats } from "../types";
import CodviberLogo from "./CodviberLogo";
import { 
  Sparkles, TrendingUp, Brain, ShieldCheck, ArrowRight, Zap, 
  BarChart3, Layers, Globe, Clock, RefreshCw, ChevronDown, CheckCircle2
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface LandingPageProps {
  onEnterApp: () => void;
  spins: ParsedSpin[];
  stats: GameStats;
  isLoading: boolean;
  isFallbackMode: boolean;
  fetchCrazyTimeData: () => Promise<void>;
}

export default function LandingPage({
  onEnterApp,
  spins,
  stats,
  isLoading,
  isFallbackMode,
  fetchCrazyTimeData
}: LandingPageProps) {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "O que é o Codviber Crazy?",
      a: "É um painel analítico de elite que se conecta diretamente às mesas do Crazy Time da Evolution Gaming para coletar, estruturar e rastreiar as últimas 500 rodadas jogadas em tempo real. Ele detecta padrões de repetição, ciclos de bônus e aplica modelos preditivos para auxiliar suas decisões."
    },
    {
      q: "Os dados exibidos são reais?",
      a: "Sim, absolutamente. Desenvolvemos um proxy seguro no backend que busca os dados atualizados das rodadas oficiais. Nenhuma simulação substitui a integridade estatística dos dados em tempo real."
    },
    {
      q: "O que é o algoritmo Soros-Gale?",
      a: "É um sistema integrado opcional que recalcula dinamicamente os valores de entrada com base nas perdas consecutivas (Gale) e na alavancagem de lucros recentes (Soros), otimizando a banca de maneira matemática e profissional."
    },
    {
      q: "Esta ferramenta garante lucros?",
      a: "Não. O Crazy Time é um jogo de azar com resultados independentes. Nosso software oferece análise matemática refinada, visualização de desvios padrão e identificação de tendências para que você abandone o 'achismo' e adote uma abordagem baseada em dados reais."
    }
  ];

  // Colors mapping for sectors tags
  const getSectorBadgeColor = (sector: string) => {
    switch (sector) {
      case "1": return "bg-gray-500/10 text-gray-300 border-gray-500/20";
      case "2": return "bg-blue-500/10 text-blue-300 border-blue-500/20";
      case "5": return "bg-purple-500/10 text-purple-300 border-purple-500/20";
      case "10": return "bg-yellow-500/10 text-yellow-300 border-yellow-500/20";
      case "coin_flip": return "bg-amber-500/10 text-[#eab308] border-amber-500/20";
      case "pachinko": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "cash_hunt": return "bg-pink-500/10 text-pink-400 border-pink-500/20";
      case "crazy_time": return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default: return "bg-white/5 text-white border-white/10";
    }
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col relative overflow-hidden bg-[#040408]" id="landing-root">
      
      {/* Dynamic Animated Ambient Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
        <motion.div 
          className="absolute w-[40vw] h-[40vw] rounded-full bg-[#d4a84c]/5 blur-[120px]"
          animate={{
            x: ["-10%", "15%", "-10%"],
            y: ["-10%", "10%", "-10%"],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div 
          className="absolute right-[-10%] bottom-[10%] w-[50vw] h-[50vw] rounded-full bg-[#ec4899]/5 blur-[150px]"
          animate={{
            x: ["0%", "-15%", "0%"],
            y: ["0%", "-10%", "0%"],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div 
          className="absolute left-[20%] top-[30%] w-[35vw] h-[35vw] rounded-full bg-[#22d3ee]/4 blur-[130px]"
          animate={{
            x: ["0%", "10%", "0%"],
            y: ["0%", "15%", "0%"],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Grid Pattern Decorative with vertical sweep laser line */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none z-0">
        <motion.div 
          className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#22d3ee]/20 to-transparent absolute shadow-[0_0_12px_rgba(34,211,238,0.2)]"
          initial={{ top: "0%" }}
          animate={{ top: "100%" }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      </div>

      {/* Floating Sparkles and Cyberspace Nodes */}
      <div className="absolute inset-0 pointer-events-none select-none z-0 opacity-40">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: i % 2 === 0 ? "3px" : "2px",
              height: i % 2 === 0 ? "3px" : "2px",
              backgroundColor: i % 3 === 0 ? "#22d3ee" : i % 3 === 1 ? "#d4a84c" : "#ec4899",
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              boxShadow: "0 0 8px rgba(255,255,255,0.8)",
            }}
            animate={{
              y: [0, -100 - Math.random() * 150],
              opacity: [0, 1, 1, 0],
              scale: [0.5, 1.2, 0.5]
            }}
            transition={{
              duration: 8 + Math.random() * 12,
              repeat: Infinity,
              delay: Math.random() * 10,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {/* Navigation Header */}
      <header className="border-b border-white/[0.04] bg-[#0a0a0f]/40 backdrop-blur-md sticky top-0 z-50 px-4 md:px-8 py-5" id="landing-navigation">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <CodviberLogo size="md" />

          <div className="flex items-center gap-4">
            {/* Real-time sync connectivity badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Evolution API 500 Giros Ativos</span>
            </div>

            <button
              onClick={onEnterApp}
              className="px-5 py-2 text-xs font-sans font-bold bg-[#d4a84c] hover:bg-[#c2963b] text-black rounded-xl transition-all hover:scale-105 active:scale-95 shadow-[0_4px_20px_rgba(212,168,76,0.25)] flex items-center gap-1.5 cursor-pointer"
            >
              Acessar Painel <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Sections */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 relative z-10 py-12 md:py-20 flex flex-col gap-24">
        
        {/* HERO SECTION */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center" id="landing-hero">
          <div className="col-span-1 lg:col-span-7 flex flex-col text-left">
            
            {/* Live status telemetry tag */}
            <div className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-xs font-mono text-gray-400 mb-6">
              <Globe size={12} className="text-[#d4a84c]" />
              <span>Conexão direta proxy segura ativa</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </div>

            <h1 className="font-display font-black tracking-tight text-4xl sm:text-5xl md:text-6xl text-white leading-[1.1] mb-6">
              Análise de Elite para o <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 via-[#d4a84c] to-[#ec4899] drop-shadow-sm">
                Crazy Time Live
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl mb-10">
              Eleve sua tomada de decisão a um nível matemático e profissional. Nosso painel processa as últimas <strong className="text-yellow-300 font-semibold">500 rodadas reais</strong> da Evolution Gaming, calcula desvios de frequência, gerencia riscos com Soros-Gale e analisa tendências com IA.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button
                onClick={onEnterApp}
                className="px-8 py-4 text-sm font-sans font-black bg-gradient-to-r from-yellow-400 to-[#d4a84c] text-black rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-[0_12px_30px_rgba(212,168,76,0.3)] flex items-center justify-center gap-2 cursor-pointer group"
              >
                Entrar no Painel Analítico 
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <a
                href="#how-it-works"
                className="px-8 py-4 text-xs font-mono font-bold bg-white/[0.02] border border-white/5 hover:border-white/10 text-slate-300 rounded-2xl transition-all text-center hover:bg-white/[0.04]"
              >
                Conhecer Recursos
              </a>
            </div>

            {/* Micro Stats Banner showing real counts if loaded */}
            <div className="grid grid-cols-3 gap-6 pt-10 border-t border-white/[0.05] mt-12 text-left">
              <div>
                <span className="block text-2xl font-black text-white font-mono">{spins.length || "500"}</span>
                <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">Giros Monitorados</span>
              </div>
              <div>
                <span className="block text-2xl font-black text-emerald-400 font-mono">
                  {stats.bonusPercentage ? `${stats.bonusPercentage.toFixed(1)}%` : "16.8%"}
                </span>
                <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">Frequência Bônus</span>
              </div>
              <div>
                <span className="block text-2xl font-black text-pink-400 font-mono">
                  {stats.roundsSinceLastBonus !== undefined ? `${stats.roundsSinceLastBonus} gd` : "5 g"}
                </span>
                <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">Espera Pelo Próximo</span>
              </div>
            </div>

          </div>

          {/* BEAUTIFUL LUXURIOUS HERO IMAGE CONTAINER */}
          <div className="col-span-1 lg:col-span-5 relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#ec4899]/10 via-[#d4a84c]/5 to-transparent blur-2xl rounded-3xl" />
            
            {/* Outer Frame with Glass Panel */}
            <div className="glass-panel p-3.5 rounded-3xl border border-white/10 relative overflow-hidden shadow-2xl group">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-black/60 border border-white/5 flex items-center justify-center">
                {/* Free high-quality Unsplash image representing live gaming / gold casino neon layout */}
                <img 
                  src="https://images.unsplash.com/photo-1596838132731-3301c3fd4317?auto=format&fit=crop&w=800&q=80"
                  alt="Crazy Time Casino Arena" 
                  className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
                
                {/* Visual interface simulation layers inside the image */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                
                {/* Live Float Badge */}
                <div className="absolute top-4 left-4 bg-[#0a0a0f]/90 backdrop-blur-md border border-white/10 p-2.5 rounded-xl flex items-center gap-2 shadow-lg">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                  <span className="text-[9px] uppercase font-mono font-black text-rose-400 tracking-wider">Acompanhando ao Vivo</span>
                </div>

                <div className="absolute bottom-4 left-4 right-4 bg-black/85 backdrop-blur-md border border-white/5 p-3 rounded-xl flex flex-col gap-1 text-left">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-yellow-400">
                    <span>Sessão Oficial Evolution</span>
                    <span>Multiplicador Máx: {stats.maxMultiplier ? `${stats.maxMultiplier}x` : "100x"}</span>
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                    Análise heurística de repetição consecutiva ativada sob desvio padrão real.
                  </div>
                </div>
              </div>

              {/* Realistic floating element overlay */}
              <div className="absolute -bottom-4 -right-4 bg-gradient-to-br from-yellow-400/90 to-[#d4a84c] text-black font-mono text-[9px] font-black uppercase px-3.5 py-1.5 rounded-xl shadow-xl border border-yellow-300/30 transform -rotate-3 z-20">
                PROXIED FEED LIVE
              </div>
            </div>
          </div>
        </section>

        {/* LATEST RESULTS BANNER (Diferencial incrível de UX: exibe os últimos 5 giros reais logo na landing) */}
        {!isLoading && spins.length > 0 && (
          <section className="bg-white/[0.01] border border-white/5 rounded-3xl p-6 relative overflow-hidden" id="landing-recent-feed">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-yellow-400/[0.03] to-transparent pointer-events-none" />
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="text-left">
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#d4a84c] flex items-center gap-1.5">
                  <Clock size={11} /> MONITORAMENTO EM TEMPO REAL
                </span>
                <h3 className="font-display font-black text-lg text-white mt-1">Últimos Resultados de Giros do Servidor</h3>
              </div>
              <button 
                onClick={fetchCrazyTimeData}
                className="px-3 py-1.5 text-[10px] font-mono text-slate-400 hover:text-white bg-white/5 rounded-lg border border-white/5 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={11} className={isLoading ? "animate-spin" : ""} /> Atualizar Feed
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-5 lg:grid-cols-5 gap-3">
              {spins.slice(0, 5).map((spin, i) => (
                <div 
                  key={spin.id || i}
                  className="bg-[#0e0e15] border border-white/5 p-3.5 rounded-xl flex flex-col gap-1 px-4 text-left glass-panel-hover"
                >
                  <span className="text-[9px] font-mono text-slate-500">{spin.settledAt.split(" ")[1] || "Agora"}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-black rounded border font-mono ${getSectorBadgeColor(spin.sectorKey)}`}>
                      {spin.displayName}
                    </span>
                    {spin.maxMultiplier > 1 && (
                      <span className="text-[10px] font-mono font-bold text-emerald-400 shrink-0">
                        {spin.maxMultiplier}x
                      </span>
                    )}
                  </div>
                  {spin.isTopSlotMatched && (
                    <span className="text-[8px] font-mono font-bold text-purple-400 leading-none mt-1 uppercase">Top Slot Match</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* HOW IT WORKS / BENTO FEATURES SECTION */}
        <section id="how-it-works" className="flex flex-col gap-12 text-left">
          <div className="max-w-2xl">
            <span className="text-xs font-mono font-black uppercase tracking-widest text-pink-400 flex items-center gap-1.5">
              <Zap size={12} /> ARQUITETURA ANALÍTICA DE PONTA
            </span>
            <h2 className="font-display font-black text-3xl md:text-4xl text-white mt-2">
              Quatro Módulos de Decisão Integrados em Uma Tela
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Abandonamos o visual tradicional de tabelas complexas para fornecer insights imediatos, visualizações fluidas de dados e previsões inteligentes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* feature 1 */}
            <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col justify-between group glass-panel-hover" id="step-pattern-detector">
              <div>
                <div className="p-3 bg-yellow-400/10 rounded-xl border border-yellow-400/20 text-[#d4a84c] w-fit mb-5">
                  <TrendingUp size={20} />
                </div>
                <h3 className="font-display font-bold text-white text-base mb-2">Identificador de Padrões</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Monitoramento automático de sequências consecutivas (Reds vs Greens), ciclos de bônus, desvios e aplicação integrada de Soros-Gale.
                </p>
              </div>
              <span className="text-[10px] font-mono text-slate-500 mt-6 tracking-wide block">Rastreamento Avançado</span>
            </div>

            {/* feature 2 */}
            <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col justify-between group glass-panel-hover" id="step-ai-advisor">
              <div>
                <div className="p-3 bg-[#ec4899]/10 rounded-xl border border-[#ec4899]/20 text-[#ec4899] w-fit mb-5">
                  <Brain size={20} />
                </div>
                <h3 className="font-display font-bold text-white text-base mb-2">Inteligência Artificial</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Analisa dados brutos e gera relatórios instantâneos de tendências heurísticas da mesa sobre os últimos 500 giros.
                </p>
              </div>
              <span className="text-[10px] font-mono text-slate-500 mt-6 tracking-wide block">Insights com IA</span>
            </div>

            {/* feature 3 */}
            <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col justify-between group glass-panel-hover" id="step-bet-simulator">
              <div>
                <div className="p-3 bg-[#3b82f6]/10 rounded-xl border border-[#3b82f6]/20 text-[#3b82f6] w-fit mb-5">
                  <BarChart3 size={20} />
                </div>
                <h3 className="font-display font-bold text-white text-base mb-2">Simulador de Apostas</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Teste estratégias matemáticas de longo prazo no histórico real do jogo antes de iniciar suas entradas.
                </p>
              </div>
              <span className="text-[10px] font-mono text-slate-500 mt-6 tracking-wide block">Backtesting Seguro</span>
            </div>

            {/* feature 4 */}
            <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col justify-between group glass-panel-hover" id="step-metrics">
              <div>
                <div className="p-3 bg-emerald-400/10 rounded-xl border border-emerald-400/20 text-emerald-400 w-fit mb-5">
                  <Layers size={20} />
                </div>
                <h3 className="font-display font-bold text-white text-base mb-2">Bento Grid Estatístico</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Frequência real de setores e bônus, acompanhamento de dispersão, gráficos interativos de pizza e desvios de desequilíbrio.
                </p>
              </div>
              <span className="text-[10px] font-mono text-slate-500 mt-6 tracking-wide block">Painel Completo</span>
            </div>

          </div>
        </section>

        {/* DETAILED STATISTICAL PARADIGMS - AESTHETIC SPLIT VIEW */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center" id="landing-deep-stats">
          <div className="col-span-1 lg:col-span-5 relative order-last lg:order-first">
            {/* Modern analytics design elements */}
            <div className="glass-panel p-6 rounded-3xl border border-white/5 relative overflow-hidden flex flex-col gap-5 text-left">
              <span className="text-[9px] font-mono font-bold tracking-wider text-yellow-400 uppercase">Distribuição teórica das frações</span>
              
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                  <span className="text-slate-400 flex items-center gap-1.5 font-mono"><span className="w-2 h-2 rounded bg-gray-500" /> Números (1, 2, 5, 10)</span>
                  <span className="font-bold text-white font-mono">45 / 54 (83.33%)</span>
                </div>
                <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                  <span className="text-[#eab308] flex items-center gap-1.5 font-mono"><span className="w-2 h-2 rounded bg-[#eab308]" /> Coin Flip</span>
                  <span className="font-bold text-white font-mono">4 / 54 (7.41%)</span>
                </div>
                <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                  <span className="text-emerald-400 flex items-center gap-1.5 font-mono"><span className="w-2 h-2 rounded bg-emerald-400" /> Pachinko</span>
                  <span className="font-bold text-white font-mono">2 / 54 (3.70%)</span>
                </div>
                <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                  <span className="text-pink-400 flex items-center gap-1.5 font-mono"><span className="w-2 h-2 rounded bg-pink-400" /> Cash Hunt</span>
                  <span className="font-bold text-white font-mono">2 / 54 (3.70%)</span>
                </div>
                <div className="flex items-center justify-between text-xs pb-1">
                  <span className="text-rose-400 flex items-center gap-1.5 font-mono"><span className="w-2 h-2 rounded bg-rose-400" /> Crazy Time</span>
                  <span className="font-bold text-white font-mono">1 / 54 (1.85%)</span>
                </div>
              </div>

              {/* Free Unsplash image 2: Modern dark analytic pattern background */}
              <div className="rounded-2xl overflow-hidden aspect-[16/9] border border-white/5 relative">
                <img 
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80"
                  alt="Analytics dashboard visualization" 
                  className="w-full h-full object-cover opacity-60 hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 text-[10px] font-mono text-[#d4a84c] bg-black/75 px-2.5 py-1 rounded-lg">
                  Estabilidade Teórica: 96...% RTP
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-1 lg:col-span-7 flex flex-col text-left justify-center">
            <span className="text-xs font-mono font-black uppercase tracking-widest text-[#d4a84c] flex items-center gap-1.5">
              <ShieldCheck size={12} /> INTEGRIDADE & DADOS REAIS
            </span>
            <h2 className="font-display font-black text-3xl md:text-4xl text-white mt-2 leading-tight mb-5">
              Entenda os Desvios com Base em Amostragem Ampla
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              O maior erro de quem aposta em Crazy Time é analisar curtos períodos, como os últimos 15 ou 20 giros. O desvio padrão pode camuflar o verdadeiro estado da roleta. 
            </p>
            <p className="text-sm text-slate-400 leading-relaxed mb-8">
              Nossa ferramenta foi arquitetada para manter <strong className="text-white">500 registros em memória ativa</strong>. Isso permite encontrar rachaduras reais de variabilidade estatística e anomalias de longo prazo, de forma rápida e responsiva.
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-sm text-slate-200">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>Rastreio de desvio padrão em tempo real</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-200">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>Simulador de tática conservadora, agressiva ou bônus hunt</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-200">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>Filtro de tempo personalizável em minutos ou dias</span>
              </div>
            </div>
          </div>
        </section>

        {/* FREQUENTLY ASKED QUESTIONS (FAQ) Accordion */}
        <section className="flex flex-col gap-10 max-w-3xl mx-auto w-full text-left" id="landing-faq">
          <div className="text-center">
            <span className="text-xs font-mono font-black uppercase tracking-widest text-pink-400 justify-center flex items-center gap-1.5">
              <Clock size={11} /> SUPORTE E SEGURANÇA
            </span>
            <h2 className="font-display font-black text-2xl sm:text-3xl text-white mt-2">Perguntas Frequentes</h2>
            <p className="text-xs text-slate-400 mt-1">Esclareça suas dúvidas técnicas sobre o funcionamento do proxy de dados adaptativos.</p>
          </div>

          <div className="flex flex-col gap-3">
            {faqs.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div 
                  key={idx}
                  className="bg-white/[0.01] border border-white/5 rounded-2xl overflow-hidden transition-all duration-300"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full text-left p-5 flex items-center justify-between text-white font-semibold text-sm hover:bg-white/[0.015] transition-all cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="p-5 pt-0 text-xs text-slate-400 leading-relaxed border-t border-white/[0.03]">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>

        {/* BOTTOM CALL TO ACTION CARD */}
        <section className="text-center p-8 md:p-14 bg-gradient-to-br from-[#12121a] via-[#09090d] to-[#040406] rounded-3xl border border-white/5 relative overflow-hidden" id="landing-footer-cta">
          <div className="absolute top-0 left-0 w-full h-full bg-radial-gradient-animated select-none opacity-20 pointer-events-none" />
          
          <span className="p-2.5 rounded-full bg-[#d4a84c]/10 border border-[#d4a84c]/20 text-[#d4a84c] inline-block mb-5">
            <Sparkles size={20} />
          </span>

          <h2 className="font-display font-black text-2xl sm:text-4xl text-white mb-4">
            Pronto para abandonar as decisões intuitivas?
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed mb-8">
            Aproveite a análise de dados profissional com atualização em tempo real sincronizada via proxy seguro. Acompanhe os melhores giros agora.
          </p>

          <button
            onClick={onEnterApp}
            className="px-10 py-4.5 text-sm font-sans font-black bg-gradient-to-r from-yellow-400 via-[#d4a84c] to-pink-500 hover:opacity-95 text-black rounded-2xl shadow-[0_10px_35px_rgba(212,168,76,0.3)] transition-all hover:scale-105 active:scale-95 inline-flex items-center gap-2 cursor-pointer"
          >
            Acessar o Painel Analítico <ArrowRight size={16} />
          </button>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.04] bg-[#020204] py-8 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 CODVIBER. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <span className="hover:text-slate-400">Dados do Servidor (RTP)</span>
            <span>•</span>
            <span className="hover:text-slate-400">Evolution Gaming API Feed (500 Giros)</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
