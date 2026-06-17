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
  status: "sent" | "failed";
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

  app.use(express.json());

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
      
      const groqKey = process.env.GROQ_API_KEY || "gsk_db...9VkI";
      
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
      res.status(500).json({ error: err.message || "Erro interno ao processar inteligência artificial." });
    }
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

  // Send a signal to a specific extension
  app.post("/api/send-signal", (req, res) => {
    const { extensionId, chip, spots, delay, repeat, gales } = req.body;

    if (!extensionId) {
      return res.status(400).json({ error: "extensionId é obrigatório" });
    }

    const signal = {
      chip: chip || null,
      spots: spots || [],
      delay: delay || 300,
      repeat: repeat || 1,
      gales: gales || null,
      timestamp: new Date().toISOString()
    };

    const sent = sendSignalToExtension(extensionId, signal);

    if (sent) {
      console.log(`📡 Signal sent to extension ${extensionId}:`, JSON.stringify(signal));
      addSignalHistory({
        id: Date.now().toString(36),
        timestamp: new Date().toISOString(),
        extensionId,
        chip: signal.chip,
        spots: signal.spots,
        delay: signal.delay,
        status: "sent"
      });
      res.json({ success: true, message: "Signal sent to extension", extensionId, signal });
    } else {
      addSignalHistory({
        id: Date.now().toString(36),
        timestamp: new Date().toISOString(),
        extensionId,
        chip: signal.chip,
        spots: signal.spots,
        delay: signal.delay,
        status: "failed",
        error: "Extension not connected"
      });
      res.status(404).json({ 
        success: false, 
        error: `Extension ${extensionId} not connected. Connect the extension first.`,
        connectedExtensions: Array.from(registeredExtensions.keys())
      });
    }
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
        } else if (msg.type === "bettingClosed" && currentExtensionId) {
          console.log(`🔒 Betting closed for extension ${currentExtensionId}`);
          bettingOpenState.set(currentExtensionId, {
            open: false,
            since: new Date().toISOString()
          });
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
