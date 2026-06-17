# Signal Relay — Crazy Time Extension

Extensão Chrome que recebe sinais do app **Codviber Crazy** em tempo real via WebSocket e executa cliques automaticamente na página de apostas.

## Funcionalidades

- 📡 Conexão WebSocket com servidor de sinais
- 🔌 Auto-reconexão e keepalive
- ⚡ Notificação visual na página ao receber sinal
- 🔗 ID único por extensão

## Como usar

1. Carregue em `chrome://extensions/` (Modo desenvolvedor → Carregar sem compactação)
2. Abra o popup e **copie o ID da extensão**
3. Ligue o toggle **Conectar**
4. Cole o ID no app (porta 3005) em "Signal Sender"
5. Quando o app enviar um sinal, a extensão executa automaticamente

## Estrutura

```
├── manifest.json      # Config Manifest V3
├── background.js      # Service worker + WebSocket
├── content.js         # Injetado na página, executa cliques
├── popup.html         # Interface do popup
├── popup.js           # Lógica do popup
└── icons/             # Ícones da extensão
```
