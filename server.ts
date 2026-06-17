import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

// ==================== Signal Relay System ====================

interface RegisteredExtension {
  ws: WebSocket;
  extensionId: string;
  connectedAt: Date;
}

const registeredExtensions = new Map<string, RegisteredExtension>();

// Signal history
interface SignalHistoryEntry {
  id: string;
  timestamp: string;
  extensionId: string;
  chip: number | null;
  spots: string[];
  delay: number;
  status: "sent" | "failed" | "queued" | "executed";
  executedAt?: string;
  error?: string;
}

const signalHistory: SignalHistoryEntry[] = [];
const MAX_SIGNAL_HISTORY = 50;

// Betting open state per extension
const bettingOpenState = new Map<string, { open: boolean; since: string }>();

function addSignalHistory(entry: SignalHistoryEntry) {
  signalHistory.unshift(entry);
  if (signalHistory.length > MAX_SIGNAL_HISTORY) {
    signalHistory.length = MAX_SIGNAL_HISTORY;
  }
}

function sendSignalToExtension(extensionId: string, signal: any): boolean {
  const ext = registeredExtensions.get(extensionId);
  if (!ext || ext.ws.readyState !== WebSocket.OPEN) {
    return false;
  }
  try {
    ext.ws.send(JSON.stringify({ type: "signal", ...signal }));
    return true;
  } catch {
    return false;
  }
}

// ==================== Server Setup ====================

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3004");

  app.use(express.json({ limit: "10mb" }));

  // CORS for extension connections
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // ==================== REST Endpoints ====================

  // Proxy Route for Crazy Time API
  app.get("/api/crazytime-history", async (req, res) => {
    try {
      const response = await fetch("https://api-cs.casino.org/svc-evolution-game-events/api/crazytime?size=500", {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
      });

      if (!response.ok) {
        throw new Error(`Public API returned status ${response.status}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      console.error("Error proxying Crazy Time API:", err);
      res.status(500).json({ error: err.message || "Failed to fetch data from Crazy Time API" });
    }
  });

  // API Route - Groq integration
  app.post("/api/groq-analyze", async (req, res) => {
    try {
      const { spinsContext, statsContext } = req.body;
      
      const groqKey = req.body.groqApiKey || process.env.GROQ_API_KEY || "";
      
      if (!groqKey) {
        return res.status(400).json({ error: "Chave do Groq API não configurada" });
      }

      const prompt = `Você é um Mentor de Elite e Estrategista Mestre em Crazy Time da Evolution Gaming. Você conhece profundamente a matemática e as probabilidades do jogo.
      
Informações fundamentais (Matemática Oficial do Jogo):
- Setor 1: 21 segmentos (38.89% probabilidade, Payout 1:1, Retorno total R$2 para cada R$1 apostado)
- Setor 2: 13 segmentos (24.07% probabilidade, Payout 2:1, Retorno total R$3 para cada R$1 apostado)
- Setor 5: 7 segmentos (12.96% probabilidade, Payout 5:1, Retorno total R$6 para cada R$1 apostado)
- Setor 10: 4 segmentos (7.41% probabilidade, Payout 10:1, Retorno total R$11 para cada R$1 apostado)
- Coin Flip: 4 segmentos (7.41% probabilidade, Bônus)
- Pachinko: 2 segmentos (3.70% probabilidade, Bônus)
- Cash Hunt: 2 segmentos (3.70% probabilidade, Bônus)
- Crazy Time: 1 segmento (1.85% probabilidade, Bônus Supremo)

Análise detalhada do estado atual da mesa nas últimas rodadas:
- Total de giros analisados: ${statsContext.totalSpins}
- Distribuição de Bônus observada: ${statsContext.bonusCount} giros (${statsContext.bonusPercentage.toFixed(1)}% do total vs 16.67% teórico)
- Giros consecutivos sem qualquer rodada bônus (Atraso atual): ${statsContext.roundsSinceLastBonus} rodadas.
- Saturação estatística para o próximo bônus (Previsão IA): ${statsContext.predictedBonusChance?.toFixed(1) || "16.7"}%
- Confiança de quebra de jejum de bônus: ${statsContext.predictionConfidence || "Média"}
- Multiplicador Médio dos resultados: ${statsContext.averageMultiplier.toFixed(1)}x
- Maior Multiplicador obtido: ${statsContext.maxMultiplier}x
- Sincronia do Top Slot (Giros combinados com a roleta): ${statsContext.topSlotMatches} vezes.
- Último resultado sorteado: ${statsContext.lastSectorDisplayName} com multiplicador final de ${spinsContext[0]?.maxMultiplier || 1}x.

Amostra recente dos últimos 15 giros (mais recentes primeiro):
${spinsContext.slice(0, 15).map((s: any, idx: number) => `${idx + 1}. Setor: ${s.displayName}, Multiplicador Final: ${s.maxMultiplier}x (Top Slot no setor: ${s.topSlot?.displayName || 'Nenhum'} ${s.topSlot?.multiplier ? s.topSlot.multiplier + 'x' : ''})`).join('\n')}

Por favor, forneça uma análise estruturada contendo:
1. **ESTADO CLIMÁTICO DA MESA**: Análise rápida se a mesa está quente (bônus superando média), fria ou neutra. Avaliar a sincronia do Top Slot.
2. **PREVISÃO DE PRÓXIMO BÔNUS (SINALIA & QUEBRA DE JEJUM)**: Analise o atraso atual de ${statsContext.roundsSinceLastBonus} rodadas sem bônus e a saturação de ${statsContext.predictedBonusChance?.toFixed(1) || "16.7"}%. Preveja a tendência para as próximas rodada com base em probabilidade de bônus.
3. **ESCOLHA DA MELHOR ESTRATÉGIA RECOMENDADA**: Escolha ou crie uma das seguintes estratégias baseada nos desvios estatísticos da mesa atual:
   - *Cobertura de Baixo Risco (Estratégia 83% - Foco em 1, 2)
   - *Caçador de Bônus Seguro (Apostas nos bônus com maior frequência atual)
   - *Estratégia Conservadora Unificada (1 + 2 + pequenos seguros em Bonûs)
   - *Rastreador de Tendências do Top Slot (Entrar nos bônus que estão saindo emparelhados)
4. **JOGADAS E ENTRADAS SUGERIDAS (RECOMENDAÇÕES DIRETAS)**: Quais setores precisos comprar na próxima rodada, indicando pesos adequados (Ex: "30% no 1, 20% no 2, 10% em Pachinko" etc.) e em quantos Gales atuar de acordo com as tendências.

Mantenha um tom altamente profissional de mentor de cassino, seguro, strategic, porém realista e atento à gestão de banca. Toda a resposta deve ser em Português do Brasil de forma clara e instigante.`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: "Você é o Mentor Supremo em estratégias de Crazy Time da Evolution Gaming, um analista altamente capacitado que dá orientações realistas e probabilísticas detalhadas baseadas em matemática aplicada e gestão de banca rigorosa. Nunca prometa lucros automáticos, mas mostre caminhos matemáticos e estratégias de cobertura refinadas em suas respostas."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.5,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API returned error status ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();
      const advice = responseData.choices?.[0]?.message?.content || "Não foi possível gerar as dicas estatísticas.";

      res.json({ advice });
    } catch (err: any) {
      console.error("Erro na API Groq:", err);
      // Fallback: generate local statistical analysis
      const fbSpins: any[] = req.body.spinsContext || [];
      const fbStats: any = req.body.statsContext || {};
      const last15 = fbSpins.slice(0, 15);
      const sectorCounts: Record<string, number> = {};
      const sectorMult: Record<string, number[]> = {};
      for (const s of fbSpins) {
        if (!sectorCounts[s.sectorKey]) { sectorCounts[s.sectorKey] = 0; sectorMult[s.sectorKey] = []; }
        sectorCounts[s.sectorKey]++;
        sectorMult[s.sectorKey].push(s.maxMultiplier);
      }
      const sorted = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]);
      const top1 = sorted[0]?.[0] || "1";
      const top2 = sorted[1]?.[0] || "2";
      const top1Pct = fbStats.totalSpins > 0 ? ((sorted[0]?.[1] || 0) / fbStats.totalSpins * 100).toFixed(1) : "0";
      const top2Pct = fbStats.totalSpins > 0 ? ((sorted[1]?.[1] || 0) / fbStats.totalSpins * 100).toFixed(1) : "0";
      const avgMult1 = sectorMult[top1]?.length ? (sectorMult[top1].reduce((a, b) => a + b, 0) / sectorMult[top1].length).toFixed(1) : "1.0";
      
      // Safe strategy: Covering 1+2 gives ~63% of segments, covering 1+2+5 gives ~76%
      const safeCov1 = 21 + 13; // 34 segments = 63%
      const safeCov2 = 21 + 13 + 7; // 41 segments = 76%
      
      const lastResult = last15[0];
      const lastSectorKey = lastResult?.sectorKey || "N/A";
      const delayText = fbStats.roundsSinceLastBonus > 10 
        ? `⚠️ **ALERTA**: ${fbStats.roundsSinceLastBonus} rodadas sem bônus! Saturação de ${fbStats.predictedBonusChance.toFixed(1)}% — probabilidade de bônus **muito alta** nas próximas rodadas.`
        : fbStats.roundsSinceLastBonus > 5
          ? `🔸 ${fbStats.roundsSinceLastBonus} rodadas sem bônus (${fbStats.predictedBonusChance.toFixed(1)}% de saturação).`
          : `🟢 Apenas ${fbStats.roundsSinceLastBonus} rodadas desde o último bônus.`;

      const advice = `**📊 ANÁLISE ESTATÍSTICA DA MESA**

**1. ESTADO CLIMÁTICO DA MESA**
|📍 Período analisado: ${fbStats.totalSpins} giros
|🎯 Setor mais frequente: **${top1}** (${top1Pct}% das ocorrências, média ${avgMult1}x)
|🥈 Segundo setor: **${top2}** (${top2Pct}%)
|📊 Bônus: ${fbStats.bonusCount} de ${fbStats.totalSpins} giros (${fbStats.bonusPercentage.toFixed(1)}%)
${delayText}

**2. PREVISÃO DE PRÓXIMO BÔNUS**
|📈 Saturação estatística: ${fbStats.predictedBonusChance.toFixed(1)}%
|🔮 Confiança da previsão: **${fbStats.predictionConfidence}**
|💡 Último bônus há ${fbStats.roundsSinceLastBonus} giros

**3. ESTRATÉGIA RECOMENDADA — Cobertura Segura (${safeCov1}/54 = ${((safeCov1/54)*100).toFixed(0)}% dos segmentos)**
✅ **Cobertura 1 + 2**: Cobre ${safeCov1}/54 segmentos (${((safeCov1/54)*100).toFixed(0)}% de acerto teórico)
💰 Distribuição sugerida: 60% no **1**, 40% no **2**
📊 Retorno esperado por aposta:
  • Se sair **1**: Retorno de 1× + aposta = lucro de ${lastSectorKey === "1" ? "uma aposta" : "~10-20%"}
  • Se sair **2**: Retorno de 2× + aposta = lucro de até 100%
🎯 Gale em 1 rodada se necessário

**4. Estratégia Ampliada (${safeCov2}/54 = ${((safeCov2/54)*100).toFixed(0)}% dos segmentos)**
✅ **Cobertura 1 + 2 + 5**: Cobre ${safeCov2}/54 segmentos
💰 Distribuição: 50% no **1**, 30% no **2**, 20% no **5**
📊 Risco vs Retorno equilibrado

**5. Recomendações para a PRÓXIMA RODADA**
🎯 **${top1}** está em tendência (${top1Pct}% das ocorrências)
|🎯 **${top2}** como segundo alvo (${top2Pct}%)${fbStats.roundsSinceLastBonus > 8 ? `\\n🎯 **Bônus**: Alta probabilidade de aparecer (${fbStats.predictedBonusChance.toFixed(1)}%)` : ""}

📌 *Análise local (Groq API indisponível). As probabilidades são baseadas na distribuição real dos ${fbStats.totalSpins} giros analisados.*`;

      res.json({ advice });
    }
  });

  // Save Groq API key
  app.post("/api/save-groq-key", (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: "apiKey é obrigatório" });
    }
    // Store in a simple in-memory variable - persists until server restart
    // Also write to .env for future restarts
    process.env.GROQ_API_KEY = apiKey;
    try {
      const fs = require("fs");
      let envContent = fs.readFileSync(".env", "utf8");
      if (envContent.includes("GROQ_API_KEY=")) {
        envContent = envContent.replace(/GROQ_API_KEY=.*/g, `GROQ_API_KEY=${apiKey}`);
      } else {
        envContent += `\nGROQ_API_KEY=${apiKey}\n`;
      }
      fs.writeFileSync(".env", envContent);
    } catch {}
    console.log("✅ GROQ_API_KEY updated via app");
    res.json({ success: true });
  });

  // ==================== Signal Endpoints ====================

  // List registered extensions (for debugging)
  app.get("/api/extensions", (_req, res) => {
    const list: any[] = [];
    registeredExtensions.forEach((ext, id) => {
      list.push({ extensionId: id, connectedAt: ext.connectedAt });
    });
    res.json({ extensions: list, count: list.length });
  });

  // Queue of pending signals per extension (dedup: latest only)
  const pendingSignals = new Map<string, any>();

  // Send a signal to a specific extension (queues it until betting opens)
  app.post("/api/send-signal", (req, res) => {
    const { extensionId, chip, betAmount, spots, delay, repeat, gales } = req.body;

    if (!extensionId) {
      return res.status(400).json({ error: "extensionId é obrigatório" });
    }

    const signal = {
      chip: chip || null,
      betAmount: betAmount || chip || 0.5,
      spots: spots || [],
      delay: delay || 300,
      repeat: repeat || 1,
      gales: gales || null,
      timestamp: new Date().toISOString()
    };

    // Check if extension is connected
    const ext = registeredExtensions.get(extensionId);
    const isConnected = ext && ext.ws.readyState === WebSocket.OPEN;

    // Check if betting is currently open
    const state = bettingOpenState.get(extensionId);
    const bettingIsOpen = state?.open === true;

    if (isConnected && bettingIsOpen) {
      // Betting is open AND extension connected → send immediately
      const sent = sendSignalToExtension(extensionId, signal);
      if (sent) {
        console.log(`📡 Signal sent immediately to ${extensionId}:`, JSON.stringify(signal));
        addSignalHistory({ id: Date.now().toString(36), timestamp: new Date().toISOString(), extensionId, chip: signal.chip, spots: signal.spots, delay: signal.delay, status: "sent" });
        return res.json({ success: true, message: "Signal sent to extension", extensionId, signal, sent: true, queue: false });
      }
    }

    if (isConnected && !bettingIsOpen) {
      // Extension connected but betting closed → queue it
      pendingSignals.set(extensionId, signal);
      console.log(`📡 Signal queued for ${extensionId} (betting closed):`, JSON.stringify(signal));
      // Notify extension about queued signal
      sendSignalToExtension(extensionId, { type: "signalQueued", ...signal });
      addSignalHistory({ id: Date.now().toString(36), timestamp: new Date().toISOString(), extensionId, chip: signal.chip, spots: signal.spots, delay: signal.delay, status: "queued" });
      return res.json({ success: true, message: "Signal queued — esperando abertura das apostas", extensionId, signal, sent: false, queue: true });
    }

    // Extension not connected at all
    addSignalHistory({ id: Date.now().toString(36), timestamp: new Date().toISOString(), extensionId, chip: signal.chip, spots: signal.spots, delay: signal.delay, status: "failed", error: "Extension not connected" });
    res.status(404).json({ 
      success: false, 
      error: `Extension ${extensionId} not connected. Abra a extensão e conecte primeiro.`,
      connectedExtensions: Array.from(registeredExtensions.keys())
    });
  });

  // Check queued signal for an extension
  app.get("/api/queued-signal", (req, res) => {
    const { extensionId } = req.query;
    if (!extensionId || typeof extensionId !== "string") {
      return res.json({ queued: false, signal: null, queue: Array.from(pendingSignals.entries()).map(([id, sig]) => ({ extensionId: id, spots: sig.spots, betAmount: sig.betAmount, timestamp: sig.timestamp })) });
    }
    const queued = pendingSignals.get(extensionId);
    res.json({ queued: !!queued, signal: queued || null });
  });

  // Signal history
  app.get("/api/signal-history", (_req, res) => {
    res.json({ signals: signalHistory, count: signalHistory.length });
  });

  // Betting status (from extension)
  app.get("/api/betting-status", (req, res) => {
    const { extensionId } = req.query;
    if (!extensionId || typeof extensionId !== "string") {
      // Return all
      const all: Record<string, any> = {};
      bettingOpenState.forEach((val, key) => { all[key] = val; });
      return res.json({ extensions: all });
    }
    const state = bettingOpenState.get(extensionId);
    res.json({
      extensionId,
      open: state?.open || false,
      since: state?.since || null
    });
  });

  // Serve static assets
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // ==================== WebSocket Server ====================

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    console.log("🔌 New WebSocket connection");
    let currentExtensionId: string | null = null;

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "register" && msg.extensionId) {
          currentExtensionId = msg.extensionId;
          registeredExtensions.set(msg.extensionId, {
            ws,
            extensionId: msg.extensionId,
            connectedAt: new Date()
          });
          console.log(`✅ Extension registered: ${msg.extensionId}`);
          ws.send(JSON.stringify({ 
            type: "registered", 
            extensionId: msg.extensionId,
            serverTime: new Date().toISOString()
          }));
        } else if (msg.type === "ping") {
          // Keepalive ping - respond with pong
          ws.send(JSON.stringify({ type: "pong" }));
        } else if (msg.type === "bettingOpen" && currentExtensionId) {
          console.log(`🎰 Betting opened for extension ${currentExtensionId}`);
          bettingOpenState.set(currentExtensionId, {
            open: true,
            since: new Date().toISOString()
          });
          // Flush any queued signal for this extension
          const queued = pendingSignals.get(currentExtensionId);
          if (queued) {
            pendingSignals.delete(currentExtensionId);
            console.log(`📡 Sending queued signal to ${currentExtensionId}:`, JSON.stringify(queued));
            // Send the queued signal
            ws.send(JSON.stringify({ type: "signal", ...queued }));
          }
        } else if (msg.type === "bettingClosed" && currentExtensionId) {
          console.log(`🔒 Betting closed for extension ${currentExtensionId}`);
          bettingOpenState.set(currentExtensionId, {
            open: false,
            since: new Date().toISOString()
          });
        } else if (msg.type === "signalExecuted" && currentExtensionId) {
          const signalId = msg.signalId;
          if (signalId) {
            const log = signalLogs.find(l => l.id === signalId);
            if (log) {
              log.status = "executed";
              log.executedAt = new Date().toISOString();
            }
            console.log(`✅ Signal ${signalId} executed by ${currentExtensionId}`);
          }
        } else if (msg.type === "signalFailed" && currentExtensionId) {
          const signalId = msg.signalId;
          if (signalId) {
            const log = signalLogs.find(l => l.id === signalId);
            if (log) {
              log.status = "failed";
              log.error = msg.error || "Erro na execução";
            }
            console.log(`❌ Signal ${signalId} failed on ${currentExtensionId}: ${msg.error}`);
          }
        }
      } catch (err) {
        console.error("Invalid WS message:", err);
      }
    });

    ws.on("close", () => {
      if (currentExtensionId) {
        registeredExtensions.delete(currentExtensionId);
        console.log(`❌ Extension disconnected: ${currentExtensionId}`);
      }
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
      if (currentExtensionId) {
        registeredExtensions.delete(currentExtensionId);
      }
    });

    // Send initial connection success
    ws.send(JSON.stringify({ type: "connected", message: "Conectado ao servidor de sinais" }));
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔌 WebSocket ready on ws://localhost:${PORT}`);
    console.log(`📡 Signal API: POST http://localhost:${PORT}/api/send-signal`);
  });
}

startServer();
