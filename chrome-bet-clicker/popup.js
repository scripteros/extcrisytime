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
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      resultBox.className = 'test-result show error';
      resultBox.textContent = '❌ Nenhuma aba ativa encontrada';
      return;
    }
    const tabId = tabs[0].id;

    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: (s) => {
        const els = document.querySelectorAll(s);
        let clicked = 0;
        els.forEach(el => { try { el.click(); clicked++; } catch(e) {} });
        return { success: true, clicked, errors: els.length === 0 ? ['Nenhum elemento encontrado'] : [] };
      },
      args: [selector]
    });

    let resp = null;
    if (results) {
      for (const res of results) {
        if (res.result && res.result.clicked > 0) { resp = res.result; break; }
        if (!resp && res.result) resp = res.result;
      }
    }

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

async function spotClick(opts, label) {
  const resultBox = $('testResult');
  resultBox.className = 'test-result show';
  resultBox.textContent = `🔄 ${label}...`;
  
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) throw new Error('Nenhuma aba');
    const tabId = tabs[0].id;

    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: (s, idx) => {
        const els = document.querySelectorAll(s);
        if (idx !== null && idx !== undefined) {
          if (idx < els.length && els[idx]) {
            els[idx].click();
            return { success: true, clicked: 1, errors: [] };
          }
          return { success: true, clicked: 0, errors: [`Índice ${idx} inválido — apenas ${els.length} elemento(s) encontrado(s)`] };
        }
        let clicked = 0;
        els.forEach(el => { try { el.click(); clicked++; } catch(e) {} });
        return { success: true, clicked, errors: els.length === 0 ? ['Nenhum elemento encontrado'] : [] };
      },
      args: [opts.selector, opts.index !== undefined ? opts.index : null]
    });

    let resp = null;
    if (results) {
      for (const res of results) {
        if (res.result && res.result.clicked > 0) { resp = res.result; break; }
        if (!resp && res.result) resp = res.result;
      }
    }

    resultBox.className = 'test-result show success';
    resultBox.textContent = `✅ ${label}: ${resp?.clicked || 0} clique(s)`;
    if (resp?.errors?.length) resultBox.textContent += `\n⚠️ ${resp.errors[0]}`;
  } catch (err) {
    resultBox.className = 'test-result show error';
    resultBox.textContent = `❌ ${label}: ${err.message}`;
  }
}

async function testSpot1() { await spotClick({ selector: '.gAopRU', index: 0 }, 'Spot 1'); }
async function testSpot2() { await spotClick({ selector: '.gAopRU', index: 1 }, 'Spot 2'); }
async function testCoinFlip() { await spotClick({ selector: '.gAopRU', index: 2 }, 'Coin Flip'); }
async function testPachinko() { await spotClick({ selector: '.gAopRU', index: 3 }, 'Pachinko'); }
async function testSpot5() { await spotClick({ selector: '.gAopRU', index: 4 }, 'Spot 5'); }
async function testSpot10() { await spotClick({ selector: '.gAopRU', index: 5 }, 'Spot 10'); }
async function testCashHunt() { await spotClick({ selector: '.gAopRU', index: 6 }, 'Cash Hunt'); }
async function testCrazyTime() { await spotClick({ selector: '.gAopRU', index: 7 }, 'Crazy Time'); }

async function testChip() {
  await spotClick({ selector: 'circle.Pzxygk', index: 0 }, 'Ficha R$ 0,50 (1ª)');
}

async function testBetOnAll() {
  await spotClick({ selector: '[data-role="bet-on-all-button"]' }, 'Apostar em Todos');
}

async function testTimer() {
  const resultBox = $('testResult');
  resultBox.className = 'test-result show';
  resultBox.textContent = '🔄 Verificando timer...';
  
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) throw new Error('Nenhuma aba');
    const tabId = tabs[0].id;

    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        const el = document.querySelector('.vBiN5X');
        if (!el) return null;
        const text = el.textContent.trim();
        const match = text.match(/APOSTAS FECHAM EM BREVE\s+(\d+)/i);
        const count = match ? parseInt(match[1], 10) : -1;
        return { text, count };
      }
    });

    let resp = null;
    if (results) {
      for (const res of results) {
        if (res.result && res.result.text) { resp = res.result; break; }
      }
    }
    
    resultBox.className = 'test-result show';
    resultBox.textContent = `⏱ Timer: ${resp?.text || 'não encontrado'}\n`;
    resultBox.textContent += `📊 Contagem: ${resp?.count ?? -1}`;
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
    let totalClicks = 0;
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) throw new Error('Nenhuma aba');
    const tabId = tabs[0].id;

    // Click chip (first .ftNWJU.CxpIc9)
    let results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        const els = document.querySelectorAll('.ftNWJU.CxpIc9');
        if (els.length > 0) { els[0].click(); return { clicked: 1 }; }
        return { clicked: 0 };
      }
    });
    if (results) {
      for (const r of results) { if (r.result && r.result.clicked > 0) { totalClicks += r.result.clicked; break; } }
    }
    await new Promise(r => setTimeout(r, 300));

    // Click spot 1 (first .gAopRU)
    results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        const els = document.querySelectorAll('.gAopRU');
        if (els.length > 0) { els[0].click(); return { clicked: 1 }; }
        return { clicked: 0 };
      }
    });
    if (results) {
      for (const r of results) { if (r.result && r.result.clicked > 0) { totalClicks += r.result.clicked; break; } }
    }

    resultBox.className = 'test-result show success';
    resultBox.textContent = `✅ Gale completo: ${totalClicks} cliques (R$ 0,50 → Spot 1)`;
  } catch (err) {
    resultBox.className = 'test-result show error';
    resultBox.textContent = `❌ Gale: ${err.message}`;
  }
}

async function testSignalLink() {
  const resultBox = $('testResult');
  resultBox.className = 'test-result show';
  resultBox.textContent = '🔄 Enviando sinal via API...';
  
  try {
    const status = await sendToBackground('getWsStatus', {});
    if (!status?.extensionId) throw new Error('ID da extensão não encontrado');
    
    const res = await fetch(`http://servico.mobap.com.br:3005/api/send-signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extensionId: status.extensionId,
        chip: 0.5,
        spots: ['Spot 1'],
        delay: 300
      })
    });
    const data = await res.json();
    
    resultBox.className = 'test-result show ' + (data.success ? 'success' : 'error');
    resultBox.textContent = data.success
      ? `✅ Sinal enviado! Aguarde a execução...`
      : `❌ Erro: ${data.error || 'desconhecido'}`;
  } catch (err) {
    resultBox.className = 'test-result show error';
    resultBox.textContent = `❌ Sinal: ${err.message}`;
  }
}

$('testSpot1').addEventListener('click', testSpot1);
$('testSpot2').addEventListener('click', testSpot2);
$('testCoinFlip').addEventListener('click', testCoinFlip);
$('testPachinko').addEventListener('click', testPachinko);
$('testSpot5').addEventListener('click', testSpot5);
$('testSpot10').addEventListener('click', testSpot10);
$('testCashHunt').addEventListener('click', testCashHunt);
$('testCrazyTime').addEventListener('click', testCrazyTime);
$('testChip').addEventListener('click', testChip);
$('testBetOnAll').addEventListener('click', testBetOnAll);
$('testTimer').addEventListener('click', testTimer);
$('testGale').addEventListener('click', testGale);
$('testSignalLink').addEventListener('click', testSignalLink);

$('testDiag').addEventListener('click', async () => {
  const resultBox = $('testResult');
  resultBox.className = 'test-result show';
  resultBox.textContent = '🔍 Diagnosticando frames...';
  
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) throw new Error('Nenhuma aba');
    const tabId = tabs[0].id;

    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        const gAop = document.querySelectorAll('.gAopRU').length;
        const chips = document.querySelectorAll('.ftNWJU.CxpIc9').length;
        const timer = document.querySelectorAll('.vBiN5X').length;
        const iframes = document.querySelectorAll('iframe').length;
        return {
          url: window.location.href.substring(0, 80),
          isTop: window === window.top,
          gAopRU: gAop,
          chips: chips,
          timer: timer,
          iframes: iframes
        };
      }
    });

    let text = `📊 Frames encontrados: ${results.length}\n\n`;
    results.forEach((r, i) => {
      if (r.result) {
        const d = r.result;
        text += `Frame ${i}: ${d.isTop ? '🔝 TOP' : '📦 IFRAME'}\n`;
        text += `  URL: ${d.url}\n`;
        text += `  .gAopRU: ${d.gAopRU} | chips: ${d.chips} | timer: ${d.timer} | iframes: ${d.iframes}\n\n`;
      } else {
        text += `Frame ${i}: ❌ sem resultado (bloqueado?)\n\n`;
      }
    });

    resultBox.className = 'test-result show';
    resultBox.textContent = text;
  } catch (err) {
    resultBox.className = 'test-result show error';
    resultBox.textContent = `❌ Diag: ${err.message}`;
  }
});

// ==================== Init ====================

updateStatus();
