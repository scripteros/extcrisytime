// ==================== Popup Script ====================

const $ = id => document.getElementById(id);
const extensionIdInput = $('extensionId');
const btnCopy = $('btnCopy');
const statusDot = $('statusDot');
const statusText = $('statusText');
const toggleWs = $('toggleWs');
const signalIndicator = $('signalIndicator');
const signalTitle = $('signalTitle');
const signalDesc = $('signalDesc');

// ==================== Chrome Messaging ====================

async function sendToBackground(action, data = {}) {
  return chrome.runtime.sendMessage({ action, ...data });
}

// ==================== Status ====================

function setStatus(connected) {
  if (connected) {
    statusDot.className = 'dot online';
    statusText.textContent = 'Conectado';
    toggleWs.checked = true;
  } else {
    statusDot.className = 'dot offline';
    statusText.textContent = 'Desconectado';
    toggleWs.checked = false;
  }
}

function showSignal(title, desc) {
  signalTitle.textContent = title;
  signalDesc.textContent = desc;
  signalIndicator.classList.add('show');
  setTimeout(() => {
    signalIndicator.classList.remove('show');
  }, 4000);
}

// ==================== Toggle WebSocket ====================

toggleWs.addEventListener('change', async () => {
  if (toggleWs.checked) {
    await sendToBackground('connectWs', {});
  } else {
    await sendToBackground('disconnectWs', {});
  }
  updateStatus();
});

// ==================== Copy ID ====================

btnCopy.addEventListener('click', () => {
  if (extensionIdInput.value) {
    navigator.clipboard.writeText(extensionIdInput.value).catch(() => {
      extensionIdInput.select();
      document.execCommand('copy');
    });
  }
});

// ==================== Listen for signals from background ====================

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'signalReceived') {
    showSignal(message.title || 'Sinal Recebido!', message.desc || '');
  }
});

// ==================== Update Status ====================

async function updateStatus() {
  try {
    const status = await sendToBackground('getWsStatus', {});
    if (status) {
      setStatus(status.connected);
      if (status.extensionId) {
        extensionIdInput.value = status.extensionId;
      }
    }
  } catch {}
}

// ==================== Init ====================

updateStatus();
