import { useState, useCallback, useEffect } from "react";

// ── Storage keys ──────────────────────────────────────────────────────────────
const STORAGE_KEY_EXTENSION_ID = "sr_extension_id";
const STORAGE_KEY_SERVER_URL = "sr_server_url";

// ── Sector → Spot mapping (matches SignalSender layout) ──────────────────────
const SECTOR_TO_SPOT_MAP: Record<string, string> = {
  "1": "Spot 1",
  "2": "Spot 2",
  "5": "Spot 5",
  "10": "Spot 10",
  CoinFlip: "Bônus Verde",
  Pachinko: "Bônus Rosa",
  CashHunt: "Bônus Azul",
  CrazyTime: "Bônus Vermelho",
};

/**
 * Converts an array of sector keys (e.g. ["1", "CoinFlip"]) into spot labels
 * that the extension's /api/send-signal endpoint understands.
 */
export function mapSectorsToSpots(sectors: string[]): string[] {
  // Bonus catch-all expansion
  const expanded: string[] = [];
  for (const s of sectors) {
    if (s === "bonus") {
      expanded.push("Bônus Verde", "Bônus Rosa", "Bônus Azul", "Bônus Vermelho");
    } else if (SECTOR_TO_SPOT_MAP[s]) {
      expanded.push(SECTOR_TO_SPOT_MAP[s]);
    } else {
      // Pass through unknown keys as-is (edge case)
      expanded.push(s);
    }
  }
  return expanded;
}

// ── Config shape ──────────────────────────────────────────────────────────────
export interface SignalPayload {
  extensionId?: string;   // falls back to hook state
  chip: number;
  betAmount?: number;     // alias for chip (used by callers)
  spots: string[];
  delay?: number;
  repeat?: number;
  gales?: { count: number; multiplier: number };
}

export interface SignalResult {
  success: boolean;
  message: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useSignalRelay() {
  const [extensionId, setExtensionId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_EXTENSION_ID) || "";
  });
  const [serverUrl, setServerUrl] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_SERVER_URL) || "";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_EXTENSION_ID, extensionId);
  }, [extensionId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SERVER_URL, serverUrl);
  }, [serverUrl]);

  const sendSignal = useCallback(
    async (payload: SignalPayload): Promise<SignalResult> => {
      const extId = payload.extensionId || extensionId;
      if (!extId || extId.trim().length === 0) {
        return { success: false, message: "Nenhum ID de extensão configurado." };
      }
      if (!payload.spots || payload.spots.length === 0) {
        return { success: false, message: "Nenhum spot selecionado." };
      }

      try {
        const res = await fetch("/api/send-signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            extensionId: extId,
            chip: payload.chip ?? payload.betAmount ?? 0.5,
            betAmount: payload.betAmount ?? payload.chip ?? 0.5,
            spots: payload.spots,
            delay: payload.delay ?? 300,
            repeat: payload.repeat ?? 1,
            gales: payload.gales ?? { count: 1, multiplier: 2 },
          }),
        });

        const data = await res.json();
        if (data.success) {
          return { success: true, message: `Sinal enviado com sucesso para ${extId}` };
        }
        return { success: false, message: data.error || "Erro ao enviar sinal." };
      } catch (err: any) {
        return {
          success: false,
          message: err.message || "Erro de conexão com o servidor.",
        };
      }
    },
    [extensionId],
  );

  const isConfigured = extensionId.trim().length > 0;

  return {
    extensionId,
    setExtensionId,
    serverUrl,
    setServerUrl,
    sendSignal,
    isConfigured,
  };
}

// ── Compact config panel (named export) ───────────────────────────────────────

interface SignalConfigPanelProps {
  extensionId: string;
  onExtensionIdChange: (id: string) => void;
  serverUrl?: string;
  onServerUrlChange?: (url: string) => void;
}

export function SignalConfigPanel({
  extensionId,
  onExtensionIdChange,
  serverUrl,
  onServerUrlChange,
}: SignalConfigPanelProps) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/10 px-3.5 py-2 h-[38px] transition-all hover:bg-white/[0.04]"
      title="Configuração do Relay de Sinais para Extensão"
    >
      {/* Icon */}
      <span className="text-[10px]">📡</span>

      {/* Extension ID */}
      <div className="flex items-center gap-1.5 min-w-0">
        <label className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold shrink-0">
          ID:
        </label>
        <input
          type="text"
          value={extensionId}
          onChange={(e) => onExtensionIdChange(e.target.value)}
          placeholder="meu-extension-id"
          className="bg-transparent w-[120px] text-[11px] text-white font-mono outline-none border-none focus:ring-0 p-0 placeholder-slate-600"
        />
      </div>

      {/* Status dot */}
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          extensionId.trim().length > 0
            ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]"
            : "bg-slate-600"
        }`}
      />

      {/* Optional server URL */}
      {onServerUrlChange !== undefined && (
        <div className="flex items-center gap-1.5 min-w-0 border-l border-white/5 pl-3 ml-1">
          <label className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold shrink-0">
            URL:
          </label>
          <input
            type="text"
            value={serverUrl || ""}
            onChange={(e) => onServerUrlChange(e.target.value)}
            placeholder="/api/send-signal"
            className="bg-transparent w-[100px] text-[11px] text-white font-mono outline-none border-none focus:ring-0 p-0 placeholder-slate-600"
          />
        </div>
      )}
    </div>
  );
}
