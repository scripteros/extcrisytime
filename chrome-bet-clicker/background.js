// ==================== Background Service Worker ====================

let wsClient = null;
let wsReconnectTimer = null;
let wsExtensionId = null;

// ==================== WebSocket Signal Client ====================

async function getWsConfig() {
  const config = await chrome.storage.local.get(['wsServerUrl', 'wsExtensionId']);
  let url = config.wsServerUrl || 'wss://roletas.mobap.com.br';
  // Migrar URL antiga (servico -> roletas)
  if (url.includes('servico.mobap.com.br')) {
    url = 'wss://roletas.mobap.com.br';
    await chrome.storage.local.set({ wsServerUrl: url });
  }
  return {
    serverUrl: url,
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
          const signalId = msg.id;
          // Forward to content script with signalId
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab || !tab.id) {
              console.log('[Signal WS] ❌ No active tab');
              sendWsMessage({ type: 'signalFailed', signalId, error: 'No active tab' });
              return;
            }
            chrome.tabs.sendMessage(tab.id, { 
              action: 'executeSignal', 
              signal: msg,
              signalId 
            }).then(response => {
              // Content script confirmed execution
              sendWsMessage({ type: 'signalExecuted', signalId, result: response });
              console.log('[Signal WS] ✅ Signal confirmed:', signalId);
            }).catch(err => {
              console.log('[Signal WS] ❌ Content script error:', err);
              sendWsMessage({ type: 'signalFailed', signalId, error: err.message });
            });
          });
          chrome.action.setBadgeText({ text: '⚡' });
          chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
          setTimeout(() => chrome.action.setBadgeText({ text: 'ON' }), 4000);
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

function sendWsMessage(data) {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    try { wsClient.send(JSON.stringify(data)); } catch {}
  }
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

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['content.js'] });
  } catch {}
  await new Promise(r => setTimeout(r, 300));

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: async (sig) => {
        if (typeof window.executeClickSequence === 'function') {
          if (window.bettingOpen) {
            await window.executeClickSequence(sig);
            return { status: 'executing' };
          } else {
            window.pendingSignal = sig;
            return { status: 'pending' };
          }
        }
        return null;
      },
      args: [{ chip: signal.chip, betAmount: signal.betAmount, spots: signal.spots, delay: signal.delay || 300 }]
    });

    let response = { status: 'executing' };
    if (results) {
      for (const r of results) {
        if (r.result && r.result.status === 'pending') { response.status = 'pending'; break; }
      }
    }

    let desc = '';
    const details = [];
    if (signal.chip) details.push(`Ficha: R$ ${signal.chip}`);
    if (signal.spots) details.push(`Spots: ${signal.spots.length}`);
    desc = details.join(' • ');

    const showNotif = async (title, d) => {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: (t, d) => { if (typeof window.createSignalNotification === 'function') window.createSignalNotification(t, d); },
        args: [title, d]
      });
    };

    if (response && response.status === 'pending') {
      chrome.runtime.sendMessage({ action: 'signalReceived', title: '⏳ Sinal na Fila', desc: `Aguardando abertura das apostas... ${desc}` }).catch(() => {});
      try { await showNotif('⏳ Sinal na Fila', `Aguardando abertura das apostas... ${desc}`); } catch {}
    } else {
      chrome.runtime.sendMessage({ action: 'signalReceived', title: '⚡ Sinal Executado!', desc }).catch(() => {});
      try { await showNotif('⚡ Sinal Executado!', desc); } catch {}
    }
  } catch (err) {
    console.error('[Signal] Execute error:', err);
    await fallbackExecute(tab, signal);
  }
}

async function fallbackExecute(tab, signal) {
  const clickFn = async (selector, delay, repeat, idx) => {
    if (typeof window.clickElementsFunction === 'function') await window.clickElementsFunction(selector, delay, repeat, idx);
  };
  
  if (signal.chip) {
    try {
      var chipIdx = { '0.5': 0, '0,50': 0, '1': 1, '2.5': 2, '2,50': 2, '5': 3, '10': 4, '25': 5 }[String(signal.chip)];
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: (chipValue) => {
          const el = document.querySelector(`[data-role="chip"][data-value="${chipValue}"]`);
          if (el) { el.click(); return { clicked: 1 }; }
          return { clicked: 0 };
        },
        args: [String(signal.chip)]
      });
    } catch {}
    await new Promise(r => setTimeout(r, signal.delay || 300));
  }
  if (signal.spots && signal.spots.length > 0) {
    for (const spotLabel of signal.spots) {
      var spotIdx = { 'Spot 1': 0, '1': 0, 'Spot 2': 1, '2': 1, 'Coin Flip': 2, 'coinflip': 2, 'Pachinko': 3, 'pachinko': 3, 'Spot 5': 4, '5': 4, 'Spot 10': 5, '10': 5, 'Cash Hunt': 6, 'cashhunt': 6, 'Crazy Time': 7, 'crazytime': 7 }[spotLabel];
      if (spotIdx !== undefined) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            func: clickFn,
            args: ['.gAopRU', 100, 1, spotIdx]
          });
        } catch {}
      } else {
        var role = { 'Bônus Verde': 'bet-spot-b1', 'Bônus Rosa': 'bet-spot-b2', 'Bônus Azul': 'bet-spot-b3', 'Bônus Vermelho': 'bet-spot-b4' }[spotLabel] || spotLabel;
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            func: clickFn,
            args: [`[data-role="${role}"]`, signal.delay || 300, 1, null]
          });
        } catch {}
      }
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

    case 'signalExecuted':
      // Forward confirmation from content script to WebSocket
      if (message.signalId) {
        sendWsMessage({ type: 'signalExecuted', signalId: message.signalId });
      }
      break;

    case 'signalFailed':
      if (message.signalId) {
        sendWsMessage({ type: 'signalFailed', signalId: message.signalId, error: message.error || 'Erro no content script' });
      }
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
