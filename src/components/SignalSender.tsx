import { useState, useEffect, useCallback } from "react";
import { Wifi, WifiOff, Loader2, Copy, Check, History, Send, XCircle, Clock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSignalRelay, mapSectorsToSpots } from "../hooks/useSignalRelay";

interface SignalLog {
  id: string;
  timestamp: string;
  extensionId: string;
  chip: number | null;
  spots: string[];
  delay: number;
  status: "sent" | "failed";
  error?: string;
}

export default function SignalSender() {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [extensions, setExtensions] = useState<any[]>([]);
  const [extensionsLoading, setExtensionsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);
  const [signalLogs, setSignalLogs] = useState<SignalLog[]>([]);

  // Shared relay state — single source of truth for extensionId
  const { extensionId, setExtensionId } = useSignalRelay();

  const fetchExtensions = useCallback(async () => {
    setExtensionsLoading(true);
    try {
      const res = await fetch("/api/extensions");
      const data = await res.json();
      setExtensions(data.extensions || []);
    } catch (err) {
      console.error("Failed to fetch extensions", err);
    } finally {
      setExtensionsLoading(false);
    }
  }, []);

  const fetchSignalHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/signal-history");
      const data = await res.json();
      setSignalLogs(data.signals || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (enabled) {
      fetchExtensions();
      fetchSignalHistory();
      const interval = setInterval(() => {
        fetchExtensions();
        fetchSignalHistory();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [enabled, fetchExtensions, fetchSignalHistory]);

  const copyId = () => {
    if (extensionId) {
      navigator.clipboard.writeText(extensionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <motion.div
      className="glass-panel rounded-2xl border border-white/5 bg-gradient-to-r from-slate-900/40 to-slate-900/20 shadow-lg relative overflow-hidden"
      layout
    >
      <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-full filter blur-xl pointer-events-none" />

      {/* Toggle header */}
      <div className="relative z-10 p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <Wifi size={16} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="font-display font-black text-xs md:text-sm text-white uppercase tracking-wider">
                ENVIO DE SINAIS • EXTENSION RELAY
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Conecte a extensão para receber sinais do simulador e catalogador.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs text-slate-400 font-medium">Ativar</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-white/10 rounded-full peer-checked:bg-emerald-500/50 border border-white/10 peer-checked:border-emerald-500/30 transition-colors relative">
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white/60 peer-checked:bg-emerald-400 transition-all shadow-md ${enabled ? "translate-x-5" : "translate-x-0"}`} />
              </div>
            </div>
          </label>
        </div>
      </div>

      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="relative z-10 px-4 md:px-5 pb-5 pt-1 border-t border-white/5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                {/* Extension ID */}
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5 block">
                    ID da Extensão
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={extensionId}
                      onChange={(e) => setExtensionId(e.target.value)}
                      placeholder="Cole o ID da extensão aqui"
                      className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-emerald-500/40 focus:bg-emerald-500/5 transition-all font-mono"
                    />
                    <button
                      onClick={copyId}
                      className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                      title="Copiar ID"
                    >
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    O ID aparece no popup da extensão ao abri-lo.
                  </p>
                </div>

                {/* Connected Extensions */}
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
                    <Wifi size={11} className="text-emerald-400" />
                    Extensões Conectadas
                  </label>
                  <div className="bg-black/20 rounded-xl border border-white/5 p-3 min-h-[44px]">
                    {extensionsLoading ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Loader2 size={12} className="animate-spin" />
                        Carregando...
                      </div>
                    ) : extensions.length === 0 ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <WifiOff size={12} />
                        Nenhuma extensão conectada
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {extensions.map((ext: any) => (
                          <div
                            key={ext.extensionId}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs ${
                              extensionId === ext.extensionId
                                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                : "text-slate-400"
                            }`}
                          >
                            <span className="font-mono truncate max-w-[220px]">{ext.extensionId}</span>
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span className="text-[10px] text-emerald-400/60">online</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={fetchExtensions}
                    className="mt-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    Atualizar lista
                  </button>
                </div>
              </div>

              {/* Signal History */}
              <div className="mt-4 pt-3 border-t border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                    <History size={11} />
                    Histórico de Sinais Enviados
                    {signalLogs.length > 0 && (
                      <span className="text-[10px] text-slate-500 font-normal">({signalLogs.length})</span>
                    )}
                  </label>
                  <button
                    onClick={fetchSignalHistory}
                    className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    Atualizar
                  </button>
                </div>

                <div className="bg-black/20 rounded-xl border border-white/5 max-h-[200px] overflow-y-auto">
                  {signalLogs.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500 p-3">
                      <Clock size={12} />
                      Nenhum sinal enviado ainda
                    </div>
                  ) : (
                    <div className="divide-y divide-white/[0.03]">
                      {signalLogs.map((log) => (
                        <div key={log.id} className="px-3 py-2 hover:bg-white/[0.02] transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {log.status === "sent" ? (
                                <Send size={10} className="text-emerald-400 shrink-0" />
                              ) : (
                                <XCircle size={10} className="text-rose-400 shrink-0" />
                              )}
                              <span className="text-[10px] font-mono text-slate-300 truncate">
                                {log.spots.join(", ") || "—"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {log.chip && (
                                <span className="text-[10px] font-mono text-amber-400">
                                  R$ {log.chip}
                                </span>
                              )}
                              <span className="text-[9px] text-slate-600 font-mono">
                                {formatTime(log.timestamp)}
                              </span>
                              {log.status === "sent" ? (
                                <span className="text-[9px] text-emerald-500/60">✓</span>
                              ) : (
                                <span className="text-[9px] text-rose-500/60" title={log.error}>✗</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Info bar */}
              <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500">
                <span>
                  {extensions.length > 0
                    ? `🟢 ${extensions.length} extensão(ões) — sinais enviados aparecem acima`
                    : "🔴 Nenhuma extensão conectada. Abra a extensão no navegador e ative a conexão."}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
