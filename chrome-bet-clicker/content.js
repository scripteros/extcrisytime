// ==================== Content Script ====================

if (!window.srContentScriptLoaded) {
window.srContentScriptLoaded = true;

let stopRequested = false;
let pendingSignal = null;
let bettingOpen = false;
let timerCheckInterval = null;

// ==================== Element Finders ====================

function findElements(selector) {
  try {
    if (selector.includes(',')) {
      const parts = selector.split(',').map(s => s.trim()).filter(Boolean);
      const results = [];
      for (const part of parts) results.push(...Array.from(document.querySelectorAll(part)));
      return results;
    }
    return Array.from(document.querySelectorAll(selector));
  } catch (e) {
    return [];
  }
}

function clickElement(el) {
  try { el.click(); } catch (e) {}
  
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  const target = document.elementFromPoint(x, y) || el;

  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
    try {
      let event;
      if (type.startsWith('pointer')) {
        event = new PointerEvent(type, {
          bubbles: true, cancelable: true, view: window,
          button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true,
          clientX: x, clientY: y
        });
      } else {
        event = new MouseEvent(type, {
          bubbles: true, cancelable: true, view: window,
          button: 0, buttons: 1,
          clientX: x, clientY: y
        });
      }
      target.dispatchEvent(event);
    } catch (e) {}
  });
}

function scrollIntoView(el) {
  try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {}
}

// ==================== Betting Timer Watcher ====================

function getTimerText() {
  const el = document.querySelector('.vBiN5X');
  if (!el) return null;
  return el.textContent.trim();
}

function parseTimerCount(text) {
  // Check if betting is explicitly OPEN (FAÇA SUAS APOSTAS)
  if (/faça\s+suas\s+apostas/i.test(text)) return 5;
  // Check countdown format: "APOSTAS FECHAM EM BREVE 5"
  const match = text.match(/APOSTAS FECHAM EM BREVE\s+(\d+)/i);
  if (!match) return -1;
  return parseInt(match[1], 10);
}

function checkTimer() {
  const text = getTimerText();
  if (!text) return;

  const count = parseTimerCount(text);
  if (count === -1) return;

  const wasOpen = bettingOpen;

  // Betting is open when count is 5 (just reset) OR when "FAÇA SUAS APOSTAS" is showing
  if ((count === 5 || /faça\s+suas\s+apostas/i.test(text)) && !wasOpen) {
    bettingOpen = true;
    console.log('[SR] ⏰ Apostas abertas!');
    chrome.runtime.sendMessage({ action: 'bettingOpen' }).catch(() => {});

    // Execute pending signal immediately
    if (pendingSignal) {
      console.log('[SR] ⚡ Executando sinal pendente');
      const signal = pendingSignal;
      pendingSignal = null;
      executeClickSequence(signal);
    }
  }

  // Betting closed when count is 0 or text no longer matches open
  if (count === 0) {
    bettingOpen = false;
  }
}

function startTimerWatcher() {
  if (timerCheckInterval) return;
  // Check every 500ms for timer changes
  timerCheckInterval = setInterval(checkTimer, 500);
}

function stopTimerWatcher() {
  if (timerCheckInterval) {
    clearInterval(timerCheckInterval);
    timerCheckInterval = null;
  }
}

// ==================== Click Execution ====================

var CHIP_VALUE = 0.50; // Each spot click adds R$ 0.50

async function executeClickSequence(signal) {
  // Calculate default bet amount
  var defaultBet = signal.betAmount || signal.chip || 0.50;

  // Click each spot the required number of times
  if (signal.spots && signal.spots.length > 0) {
    for (var s = 0; s < signal.spots.length; s++) {
      var spotLabel = signal.spots[s];
      // Support both string and { name, amount } formats
      var spotName = typeof spotLabel === 'object' ? (spotLabel.name || spotLabel.label) : spotLabel;
      var spotAmount = typeof spotLabel === 'object' ? (spotLabel.amount || spotLabel.bet || defaultBet) : defaultBet;
      
      var clicks = Math.max(1, Math.round(spotAmount / CHIP_VALUE));
      
      // Map spot to .gAopRU index
      var gAopIndexMap = {
        'Spot 1': 0, '1': 0,
        'Spot 2': 1, '2': 1,
        'Spot 5': 4, '5': 4,
        'Spot 10': 5, '10': 5,
      };
      var idx = gAopIndexMap[spotName];
      
      if (idx !== undefined) {
        var els = findElements('.gAopRU');
        var el = els[idx];
        if (el) {
          scrollIntoView(el);
          // Click N times to build the desired amount (each click = R$ 0.50)
          for (var c = 0; c < clicks; c++) {
            await new Promise(function(r) { return setTimeout(r, 120 + Math.random() * 60); });
            clickElement(el);
          }
        }
      } else {
        // Fallback for bonus spots
        for (var c = 0; c < clicks; c++) {
          var els = findElements('[data-role="' + spotName + '"]');
          for (var e = 0; e < els.length; e++) {
            scrollIntoView(els[e]);
            await new Promise(function(r) { return setTimeout(r, 80 + Math.random() * 40); });
            clickElement(els[e]);
          }
        }
      }
      await new Promise(function(r) { return setTimeout(r, signal.delay || 300); });
    }
  }
}

// ==================== Message Handler ====================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'executeSignal':
      // Store as pending and execute when betting opens
      if (message.signal) {
        if (bettingOpen) {
          // Betting is already open, execute immediately
          (async () => {
            await executeClickSequence(message.signal);
            chrome.runtime.sendMessage({ action: 'signalExecuted', signalId: message.signalId }).catch(() => {});
          })();
          sendResponse({ status: 'executing' });
        } else {
          // Store as pending - will execute when timer hits 5
          pendingSignal = { ...message.signal, signalId: message.signalId };
          sendResponse({ status: 'pending' });
        }
      }
      // Keep sendResponse channel open
      return true;

    case 'getTimerStatus':
      const text = getTimerText();
      const count = text ? parseTimerCount(text) : -1;
      sendResponse({ 
        text: text || 'Timer não encontrado',
        count, 
        bettingOpen,
        hasPendingSignal: !!pendingSignal
      });
      break;

    case 'clickElements':
      clickElementsFunction(message.selector, message.delay || 300, message.repeat || 1, message.index)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'stopClicking':
      stopRequested = true;
      sendResponse({ stopped: true });
      break;

    case 'showSignalNotification':
      createSignalNotification(message.title || 'Sinal Recebido!', message.desc || '');
      sendResponse({ ok: true });
      break;
  }
});

// Legacy click function
async function clickElementsFunction(selector, delay, repeat, index = null) {
  let clicked = 0;
  const errors = [];
  for (let r = 0; r < (repeat || 1) && !stopRequested; r++) {
    let elements = findElements(selector);
    
    // If index is specified, click only that element
    if (index !== null && typeof index === 'number') {
      if (index < elements.length && elements[index]) {
        const el = elements[index];
        if (el.offsetParent !== null || el.getClientRects().length > 0) {
          try {
            scrollIntoView(el);
            await new Promise(r => setTimeout(r, 50 + Math.random() * 50));
            clickElement(el);
            clicked++;
            return { success: true, clicked, errors };
          } catch (e) { errors.push(`Erro ao clicar [${index}]: ${e.message}`); }
        } else {
          errors.push(`Elemento [${index}] não está visível`);
        }
      } else {
        errors.push(`Índice ${index} inválido — apenas ${elements.length} elemento(s) encontrado(s)`);
      }
      break;
    }
    
    // Normal: click all without visibility check to bypass svg rendering issues
    if (elements.length === 0) { errors.push('Nenhum elemento encontrado'); break; }
    for (let i = 0; i < elements.length && !window.stopRequested; i++) {
      try {
        scrollIntoView(elements[i]);
        await new Promise(r => setTimeout(r, 50 + Math.random() * 50));
        clickElement(elements[i]);
        clicked++;
      } catch (e) { errors.push(`Erro: ${e.message}`); }
      if (i < elements.length - 1 && delay > 0) await new Promise(r => setTimeout(r, delay));
    }
  }
  stopRequested = false;
  return { success: true, clicked, errors };
}

// ==================== Signal Notification Overlay ====================

function createSignalNotification(title, desc) {
  const existing = document.getElementById('sr-signal-notification');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'sr-signal-notification';
  overlay.innerHTML = `
    <div style="position:fixed;top:20px;right:20px;z-index:999999;background:linear-gradient(135deg,#0f172a,#1e293b);border:1px solid #22c55e;border-radius:12px;padding:16px 20px;box-shadow:0 8px 32px rgba(0,0,0,0.5),0 0 20px rgba(34,197,94,0.15);max-width:320px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;animation:srSignalSlideIn 0.3s ease">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;border-radius:50%;background:#22c55e;display:flex;align-items:center;justify-content:center;font-size:18px;animation:srSignalPulse 0.8s ease infinite">⚡</div>
        <div style="flex:1"><div style="color:#f1f5f9;font-weight:700;font-size:13px;margin-bottom:2px">${title}</div><div style="color:#94a3b8;font-size:11px">${desc}</div></div>
        <button onclick="this.closest('#sr-signal-notification').remove()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:16px;padding:4px">✕</button>
      </div>
    </div>
    <style>
      @keyframes srSignalSlideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes srSignalPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
    </style>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => {
    const el = document.getElementById('sr-signal-notification');
    if (el) { el.style.transition = 'opacity 0.3s ease, transform 0.3s ease'; el.style.opacity = '0'; el.style.transform = 'translateX(100px)'; setTimeout(() => el.remove(), 300); }
  }, 6000);
}

// ==================== Init ====================

startTimerWatcher();
chrome.runtime.sendMessage({ action: 'contentScriptReady' }).catch(() => {});

window.clickElementsFunction = clickElementsFunction;
window.getTimerText = getTimerText;
window.parseTimerCount = parseTimerCount;
window.executeClickSequence = executeClickSequence;
window.createSignalNotification = createSignalNotification;
Object.defineProperty(window, 'pendingSignal', { get: () => pendingSignal, set: (v) => pendingSignal = v });
Object.defineProperty(window, 'bettingOpen', { get: () => bettingOpen, set: (v) => bettingOpen = v });

}
