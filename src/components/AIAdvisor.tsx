import { useState } from "react";
import { ParsedSpin, GameStats } from "../types";
import { Cpu, Sparkles, Brain, Zap, RefreshCw, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AIAdvisorProps {
  spins: ParsedSpin[];
  stats: GameStats;
}

export default function AIAdvisor({ spins, stats }: AIAdvisorProps) {
  const [advice, setAdvice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [groqKey, setGroqKey] = useState<string>(() => localStorage.getItem("groq_api_key") || "");
  const [savingKey, setSavingKey] = useState(false);

  const saveApiKey = async () => {
    if (!groqKey.trim()) return;
    setSavingKey(true);
    try {
      const resp = await fetch("/api/save-groq-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: groqKey.trim() }),
      });
      if (resp.ok) {
        localStorage.setItem("groq_api_key", groqKey.trim());
      }
    } catch {}
    setSavingKey(false);
  };

  const fetchAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/groq-analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spinsContext: spins,
          statsContext: stats,
          groqApiKey: groqKey.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao contatar o servidor de IA.");
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setAdvice(data.advice);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro desconhecido ao obter dicas da IA.");
    } finally {
      setIsLoading(false);
    }
  };

  // Safe simple parser that splits by paragraphs and styles bullet points or bold markers
  const renderFormattedAdvice = (text: string) => {
    return text.split("\n").map((paragraph, index) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return <div key={index} className="h-2" />;

      // List item bullet
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        const content = trimmed.substring(1).trim();
        return (
          <li key={index} className="ml-4 list-disc text-slate-300 text-xs leading-relaxed mb-1 font-sans">
            {formatBoldText(content)}
          </li>
        );
      }

      // Ordered list item
      if (/^\d+\./.test(trimmed)) {
        const match = trimmed.match(/^(\d+\.)\s*(.*)/);
        if (match) {
          return (
            <div key={index} className="flex gap-2 mb-2 text-xs leading-relaxed font-sans">
              <span className="font-mono font-bold text-[#d4a84c] shrink-0">{match[1]}</span>
              <span className="text-slate-300">{formatBoldText(match[2])}</span>
            </div>
          );
        }
      }

      // Regular paragraph
      return (
        <p key={index} className="text-slate-300 text-xs leading-relaxed mb-2.5 font-sans">
          {formatBoldText(trimmed)}
        </p>
      );
    });
  };

  // Helper to replace **bold** with <strong> React elements
  const formatBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="text-[#d4a84c] font-semibold font-display">
            {part.substring(2, part.length - 2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="glass-panel p-6 rounded-2xl w-full max-w-7xl mx-auto mb-8 relative overflow-hidden" id="ai-advisor-panel">
      {/* Background visual glowing gradient */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-radial-magenta-animated rounded-full filter blur-[100px] -mr-20 -mt-20 opacity-30 select-none pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-radial-gradient-animated rounded-full filter blur-[100px] -ml-20 -mb-20 opacity-20 select-none pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        
        {/* Core title */}
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#ec4899]/10 border border-[#ec4899]/30 rounded-2xl text-[#ec4899] shrink-0 animate-pulse">
            <Brain size={22} />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-white flex items-center gap-1.5">
              Análise Avançada com IA (Llama-3.3 da Groq)
              <span className="text-[9px] uppercase tracking-wider bg-gradient-to-r from-pink-500 to-[#d4a84c] text-white font-bold px-2 py-0.5 rounded-full leading-none">
                Groq Active
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Processa o histórico e fornece dicas táticas em tempo real baseando-se na distribuição teórica de 54 setores.
            </p>
          </div>
        </div>

        {/* Trigger Button + API Key */}
        <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-1.5 bg-black/30 border border-white/10 rounded-xl px-3 py-1.5">
            <input
              type="password"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder="Chave da API Groq"
              className="bg-transparent text-[10px] text-slate-300 w-28 outline-none placeholder:text-slate-600 font-mono"
            />
            <button
              onClick={saveApiKey}
              disabled={savingKey || !groqKey.trim()}
              className="text-[9px] uppercase font-bold text-[#d4a84c] hover:text-[#ec4899] transition-colors disabled:opacity-30 cursor-pointer"
            >
              {savingKey ? "..." : "Salvar"}
            </button>
          </div>
          <button
            onClick={fetchAnalysis}
            disabled={isLoading}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-[#d4a84c] to-[#ec4899] hover:from-[#e2b85e] hover:to-[#f45fa9] text-black font-extrabold text-xs tracking-wider rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer uppercase"
          >
            {isLoading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Analisando Mesa...</span>
              </>
            ) : (
              <>
                <Cpu size={14} />
                <span>{advice ? "Reanalisar Resultados" : "Gerar Insights de IA"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Visual representation of current analysis outcome */}
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6 border-t border-white/5 pt-6 flex flex-col items-center justify-center py-6 text-center"
          >
            <div className="w-12 h-12 rounded-full border-t-2 border-r-2 border-[#ec4899] animate-spin mb-3" />
            <span className="font-mono text-xs text-slate-400">
              Lendo os últimos 100 giros... Calculando desvios padrão teórico e de Top Slot com IA da Groq...
            </span>
          </motion.div>
        )}

        {error && !isLoading && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6 border-t border-white/5 pt-6"
          >
            <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-mono text-xs">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          </motion.div>
        )}

        {advice && !isLoading && !error && (
          <motion.div
            key="advice"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-6 border-t border-white/5 pt-6"
          >
            <div className="bg-black/30 p-5 rounded-2xl border border-white/5">
              
              {/* Advisor Header banner */}
              <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
                <span className="text-[10px] uppercase font-mono text-[#d4a84c] tracking-widest flex items-center gap-1 font-bold">
                  <Zap size={12} className="text-[#d4a84c]" /> Conselheiro Inteligente Crazy Time
                </span>
                <span className="text-[9px] font-mono text-slate-500">
                  Respondeu às {new Date().toLocaleTimeString("id", { hour: "2-digit", minute: "2-digit" })} UTC
                </span>
              </div>

              {/* Parsed text body */}
              <div className="prose max-w-none text-slate-300 font-sans tracking-wide">
                {renderFormattedAdvice(advice)}
              </div>

              {/* Responsible warning tag */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-1.5 text-[9px] font-mono text-slate-500">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ec4899] shrink-0" />
                <span>Os dados fornecidos são meras observações probabilísticas. Sempre jogue com responsabilidade.</span>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
