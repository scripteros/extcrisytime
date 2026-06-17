// ==================== Content Script ====================

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
  try { el.click(); }
  catch (e) {
    ['mouseenter', 'mousedown', 'mouseup', 'click'].forEach(type => {
      el.dispatchEvent(new MouseEvent(type, {
        bubbles: true, cancelable: true, view: window,
        button: 0, buttons: 1,
        clientX: el.getBoundingClientRect().left + 10,
        clientY: el.getBoundingClientRect().top + 10
      }));
    });
  }
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

  // Betting is open when count is 5 (just reset)
  if (count === 5 && !wasOpen) {
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

  // Betting closed when count is 0
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

async function executeClickSequence(signal) {
  // 1. Click chip value
  if (signal.chip) {
    const chipEls = findElements(`[data-role="chip"][data-value="${signal.chip}"]`);
    for (const el of chipEls) {
      try {
        scrollIntoView(el);
        await new Promise(r => setTimeout(r, 50 + Math.random() * 50));
        clickElement(el);
      } catch {}
    }
    await new Promise(r => setTimeout(r, signal.delay || 300));
  }

  // 2. Click each spot
  if (signal.spots && signal.spots.length > 0) {
    for (const spotLabel of signal.spots) {
      // Map spot label to data-role selector
      const spotMap = {
        'Spot 1': 'bet-spot-1',
        'Spot 2': 'bet-spot-2',
        'Spot 5': 'bet-spot-5',
        'Spot 10': 'bet-spot-10',
        'Bônus Verde': 'bet-spot-b1',
        'Bônus Rosa': 'bet-spot-b2',
        'Bônus Azul': 'bet-spot-b3',
        'Bônus Vermelho': 'bet-spot-b4',
      };
      const role = spotMap[spotLabel] || spotLabel;
      const selector = `[data-role="${role}"]`;
      const els = findElements(selector);
      
      for (const el of els) {
        try {
          scrollIntoView(el);
          await new Promise(r => setTimeout(r, 50 + Math.random() * 50));
          clickElement(el);
        } catch {}
      }
      await new Promise(r => setTimeout(r, signal.delay || 300));
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
          executeClickSequence(message.signal).then(() => {
            chrome.runtime.sendMessage({ action: 'signalExecuted' }).catch(() => {});
          });
          sendResponse({ status: 'executing' });
        } else {
          // Store as pending - will execute when timer hits 5
          pendingSignal = message.signal;
          sendResponse({ status: 'pending' });
        }
      }
      break;

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
      clickElementsFunction(message.selector, message.delay || 300, message.repeat || 1)
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
async function clickElementsFunction(selector, delay, repeat) {
  let clicked = 0;
  const errors = [];
  for (let r = 0; r < (repeat || 1) && !stopRequested; r++) {
    const elements = findElements(selector);
    const visible = elements.filter(el => el.offsetParent !== null || el.getClientRects().length > 0);
    if (visible.length === 0) { errors.push('Nenhum elemento visível'); break; }
    for (let i = 0; i < visible.length && !stopRequested; i++) {
      try {
        scrollIntoView(visible[i]);
        await new Promise(r => setTimeout(r, 50 + Math.random() * 50));
        clickElement(visible[i]);
        clicked++;
      } catch (e) { errors.push(`Erro: ${e.message}`); }
      if (i < visible.length - 1 && delay > 0) await new Promise(r => setTimeout(r, delay));
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
