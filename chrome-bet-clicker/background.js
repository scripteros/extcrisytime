// ==================== Background Service Worker ====================

let wsClient = null;
let wsReconnectTimer = null;
let wsExtensionId = null;

// ==================== WebSocket Signal Client ====================

async function getWsConfig() {
  const config = await chrome.storage.local.get(['wsServerUrl', 'wsExtensionId']);
  return {
    serverUrl: config.wsServerUrl || 'ws://servico.mobap.com.br:3005',
    extensionId: config.wsExtensionId || null
  };
}

async function ensureExtensionId() {
  const config = await chrome.storage.local.get('wsExtensionId');
  if (config.wsExtensionId) {
    wsExtensionId = config.wsExtensionId;
    return config.wsExtensionId;
  }
  const id = 'ext-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8);
  await chrome.storage.local.set({ wsExtensionId: id });
  wsExtensionId = id;
  return id;
}

async function connectWebSocket() {
  if (wsClient && (wsClient.readyState === WebSocket.OPEN || wsClient.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const config = await getWsConfig();
  if (!config.serverUrl) return;

  await ensureExtensionId();

  await chrome.storage.local.set({ wsEnabled: true });

  try {
    wsClient = new WebSocket(config.serverUrl);

    wsClient.onopen = () => {
      console.log('[Signal WS] Connected');
      wsClient.send(JSON.stringify({ type: 'register', extensionId: wsExtensionId }));
    };

    wsClient.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'registered') {
          chrome.action.setBadgeText({ text: 'ON' });
          chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
          // Notify popup if open
          chrome.runtime.sendMessage({ action: 'wsStatusChanged', connected: true }).catch(() => {});
        } else if (msg.type === 'signal') {
          console.log('[Signal WS] Signal received:', msg);
          executeSignal(msg);
        }
      } catch (err) {
        console.error('[Signal WS] Parse error:', err);
      }
    };

    wsClient.onclose = () => {
      console.log('[Signal WS] Disconnected');
      chrome.action.setBadgeText({ text: '' });
      wsClient = null;
      chrome.runtime.sendMessage({ action: 'wsStatusChanged', connected: false }).catch(() => {});
      onWsDisconnected();
    };

    wsClient.onerror = () => {
      if (wsClient) wsClient.close();
    };
  } catch (err) {
    console.error('[Signal WS] Connection failed:', err);
    onWsDisconnected();
  }
}

function onWsDisconnected() {
  chrome.storage.local.get('wsEnabled').then(result => {
    if (result.wsEnabled) {
      wsReconnectTimer = setTimeout(connectWebSocket, 5000);
    }
  });
}

async function disconnectWebSocket() {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }
  if (wsClient) {
    try { wsClient.close(); } catch {}
    wsClient = null;
  }
  chrome.action.setBadgeText({ text: '' });
  await chrome.storage.local.set({ wsEnabled: false });
  chrome.runtime.sendMessage({ action: 'wsStatusChanged', connected: false }).catch(() => {});
}

// ==================== Execute Signal ====================

async function executeSignal(signal) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || tabs.length === 0) return;

  const tab = tabs[0];

  // Inject content script if needed
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch {}
  await new Promise(r => setTimeout(r, 300));

  // Send signal as pending to content script (it handles timer sync)
  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'executeSignal',
      signal: {
        chip: signal.chip,
        spots: signal.spots,
        delay: signal.delay || 300
      }
    });
    
    let desc = '';
    const details = [];
    if (signal.chip) details.push(`Ficha: R$ ${signal.chip}`);
    if (signal.spots) details.push(`Spots: ${signal.spots.length}`);
    desc = details.join(' • ');

    if (response && response.status === 'pending') {
      // Signal will execute when timer hits 5
      chrome.runtime.sendMessage({
        action: 'signalReceived',
        title: '⏳ Sinal na Fila',
        desc: `Aguardando abertura das apostas... ${desc}`
      }).catch(() => {});
      
      // Also show on page
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'showSignalNotification',
          title: '⏳ Sinal na Fila',
          desc: `Aguardando abertura das apostas... ${desc}`
        });
      } catch {}
    } else {
      // Executed immediately
      chrome.runtime.sendMessage({
        action: 'signalReceived',
        title: '⚡ Sinal Executado!',
        desc: desc
      }).catch(() => {});
      
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'showSignalNotification',
          title: '⚡ Sinal Executado!',
          desc: desc
        });
      } catch {}
    }
  } catch (err) {
    console.error('[Signal] Execute error:', err);
    // Fallback: try direct click execution
    await fallbackExecute(tab, signal);
  }
}

async function fallbackExecute(tab, signal) {
  // 1. Click chip
  if (signal.chip) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'clickElements',
        selector: `[data-role="chip"][data-value="${signal.chip}"]`,
        delay: 100, repeat: 1, order: 'all', index: null
      });
    } catch {}
    await new Promise(r => setTimeout(r, signal.delay || 300));
  }
  // 2. Click spots
  if (signal.spots && signal.spots.length > 0) {
    for (const spotLabel of signal.spots) {
      const spotMap = {
        'Spot 1': 'bet-spot-1', 'Spot 2': 'bet-spot-2',
        'Spot 5': 'bet-spot-5', 'Spot 10': 'bet-spot-10',
        'Bônus Verde': 'bet-spot-b1', 'Bônus Rosa': 'bet-spot-b2',
        'Bônus Azul': 'bet-spot-b3', 'Bônus Vermelho': 'bet-spot-b4',
      };
      const role = spotMap[spotLabel] || spotLabel;
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'clickElements',
          selector: `[data-role="${role}"]`,
          delay: signal.delay || 300, repeat: 1, order: 'all', index: null
        });
      } catch {}
      await new Promise(r => setTimeout(r, signal.delay || 300));
    }
  }
}

// ==================== Message Handler ====================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'connectWs':
      connectWebSocket();
      sendResponse({ ok: true });
      break;

    case 'disconnectWs':
      disconnectWebSocket();
      sendResponse({ ok: true });
      break;

    case 'getWsStatus':
      chrome.storage.local.get('wsEnabled').then(result => {
        sendResponse({
          connected: wsClient && wsClient.readyState === WebSocket.OPEN,
          extensionId: wsExtensionId,
          enabled: result.wsEnabled || false
        });
      });
      return true;

    case 'updateWsConfig':
      chrome.storage.local.set({
        wsServerUrl: message.serverUrl,
        wsExtensionId: message.extensionId
      }).then(() => {
        if (message.extensionId) wsExtensionId = message.extensionId;
        disconnectWebSocket();
        connectWebSocket();
        sendResponse({ ok: true });
      });
      return true;

    case 'bettingOpen':
      if (wsClient && wsClient.readyState === WebSocket.OPEN && wsExtensionId) {
        try { wsClient.send(JSON.stringify({ type: 'bettingOpen', extensionId: wsExtensionId })); } catch {}
      }
      sendResponse({ ok: true });
      break;

    case 'bettingClosed':
      if (wsClient && wsClient.readyState === WebSocket.OPEN && wsExtensionId) {
        try { wsClient.send(JSON.stringify({ type: 'bettingClosed', extensionId: wsExtensionId })); } catch {}
      }
      sendResponse({ ok: true });
      break;
  }
});

// ==================== Auto-connect on startup ====================

chrome.storage.local.get('wsEnabled').then(result => {
  if (result.wsEnabled) connectWebSocket();
});

// ==================== Keepalive ====================

chrome.alarms.create('ws-keepalive', { periodInMinutes: 0.25 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'ws-keepalive') {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      try { wsClient.send(JSON.stringify({ type: 'ping' })); } catch {}
    }
  }
});

// ==================== Install ====================

chrome.runtime.onInstalled.addListener(async () => {
  await ensureExtensionId();
  const { savedSelectors } = await chrome.storage.local.get('savedSelectors');
  if (!savedSelectors || savedSelectors.length === 0) {
    await chrome.storage.local.set({
      savedSelectors: [
        { name: 'Todos os spots', selector: '[data-betspot-destination]' },
        { name: 'Spot #1', selector: '[data-betspot-destination="1"]' },
        { name: 'Spot #2', selector: '[data-betspot-destination="2"]' },
        { name: 'Spot #5', selector: '[data-betspot-destination="5"]' },
        { name: 'Spot #10', selector: '[data-betspot-destination="10"]' }
      ]
    });
  }
});
