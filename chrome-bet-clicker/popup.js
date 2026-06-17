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

// ==================== Test Buttons ====================

async function runTest(selector, label, delay = 300) {
  const resultBox = $('testResult');
  resultBox.className = 'test-result show';
  resultBox.textContent = `🔄 ${label}...`;
  
  try {
    // Find active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      resultBox.className = 'test-result show error';
      resultBox.textContent = '❌ Nenhuma aba ativa encontrada';
      return;
    }
    const tabId = tabs[0].id;

    // Inject content script if not already loaded
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    } catch {}
    await new Promise(r => setTimeout(r, 300));

    // Send click command to content script
    const resp = await chrome.tabs.sendMessage(tabId, {
      action: 'clickElements',
      selector,
      delay,
      repeat: 1
    });

    resultBox.className = 'test-result show success';
    resultBox.textContent = `✅ ${label}: ${resp?.clicked || 0} clique(s)`;
    if (resp?.errors?.length) {
      resultBox.textContent += `\n⚠️ ${resp.errors[0]}`;
    }
  } catch (err) {
    resultBox.className = 'test-result show error';
    resultBox.textContent = `❌ ${label}: ${err.message}`;
  }
}

async function testSpot1() {
  await runTest('[data-role="bet-spot-1"]', 'Spot 1');
}

async function testChip() {
  await runTest('[data-role="chip"][data-value="0.5"]', 'Ficha R$ 0,50');
}

async function testBetOnAll() {
  await runTest('[data-role="bet-on-all-button"]', 'Apostar em Todos');
}

async function testTimer() {
  const resultBox = $('testResult');
  resultBox.className = 'test-result show';
  resultBox.textContent = '🔄 Verificando timer...';
  
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) throw new Error('Nenhuma aba');
    const tabId = tabs[0].id;

    // Inject content script
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    } catch {}
    await new Promise(r => setTimeout(r, 300));
    
    const resp = await chrome.tabs.sendMessage(tabId, {
      action: 'getTimerStatus'
    });
    
    resultBox.className = 'test-result show';
    resultBox.textContent = `⏱ Timer: ${resp?.text || 'não encontrado'}\n`;
    resultBox.textContent += `📊 Contagem: ${resp?.count ?? -1}\n`;
    resultBox.textContent += `🎰 Apostas: ${resp?.bettingOpen ? 'ABERTAS 🟢' : 'FECHADAS 🔴'}`;
    if (resp?.hasPendingSignal) resultBox.textContent += '\n⏳ Sinal pendente na fila';
  } catch (err) {
    resultBox.className = 'test-result show error';
    resultBox.textContent = `❌ Timer: ${err.message}`;
  }
}

async function testGale() {
  const resultBox = $('testResult');
  resultBox.className = 'test-result show';
  resultBox.textContent = '🔄 Executando Gale...';
  
  try {
    const spots = ['[data-role="bet-spot-1"]'];
    const chipSelector = '[data-role="chip"][data-value="0.5"]';
    let totalClicks = 0;
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) throw new Error('Nenhuma aba');
    const tabId = tabs[0].id;

    // Inject content script
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    } catch {}
    await new Promise(r => setTimeout(r, 300));

    // Round 1: chip 0.50 + spot 1
    let resp = await chrome.tabs.sendMessage(tabId,
      { action: 'clickElements', selector: chipSelector, delay: 100, repeat: 1 }
    );
    totalClicks += resp?.clicked || 0;
    await new Promise(r => setTimeout(r, 300));

    resp = await chrome.tabs.sendMessage(tabId,
      { action: 'clickElements', selector: spots[0], delay: 100, repeat: 1 }
    );
    totalClicks += resp?.clicked || 0;

    resultBox.className = 'test-result show success';
    resultBox.textContent = `✅ Gale completo: ${totalClicks} cliques (R$ 0,50 → Spot 1)`;
  } catch (err) {
    resultBox.className = 'test-result show error';
    resultBox.textContent = `❌ Gale: ${err.message}`;
  }
}

$('testSpot1').addEventListener('click', testSpot1);
$('testChip').addEventListener('click', testChip);
$('testBetOnAll').addEventListener('click', testBetOnAll);
$('testTimer').addEventListener('click', testTimer);
$('testGale').addEventListener('click', testGale);

// ==================== Init ====================

updateStatus();
