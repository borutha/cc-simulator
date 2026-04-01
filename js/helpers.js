// ============================================================
// HELPERS
// ============================================================
function fmt$(n) { return '$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtPct(n, d=2) { return (n*100).toFixed(d)+'%'; }
function colorClass(n) { return n>=0?'pos':'neg'; }
function arrow(n) { return n>=0?'▲':'▼'; }
function getPortfolioSize() { return parseFloat(document.getElementById('portfolioSize').value.replace(/[$,]/g,'')) || 100000; }
function setPortfolio(amt) {
  document.getElementById('portfolioSize').value = '$'+amt.toLocaleString('en-US');
  renderHoldings();
}

document.getElementById('portfolioSize').addEventListener('blur', function() {
  const n = parseFloat(this.value.replace(/[$,]/g,'')) || 100000;
  this.value = '$'+n.toLocaleString('en-US');
  renderHoldings();
});
document.getElementById('portfolioSize').addEventListener('focus', function() {
  this.value = this.value.replace(/[$,]/g,'');
});

// ============================================================
// INIT
// ============================================================
checkServer();
setInterval(checkServer, 15000); // re-check every 15s

// ============================================================
// v1.2 — TAB SWITCHING
// ============================================================
function switchTab(name) {
  document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  // highlight the clicked tab button by matching its onclick attribute
  document.querySelectorAll('.main-tab').forEach(t => {
    if ((t.getAttribute('onclick') || '').includes("'" + name + "'")) {
      t.classList.add('active');
    }
  });
}

// ============================================================
// v1.2 — SNAPSHOT (Save as PNG)
// ============================================================
function saveSnapshot() {
  const panel = document.getElementById('resultsPanel');
  if (!panel || panel.style.display === 'none') {
    showToast('⚠️ Please calculate a portfolio first');
    return;
  }
  showToast('📸 Generating snapshot…');
  html2canvas(panel, { backgroundColor: '#f0f4f8', scale: 1.5, useCORS: true }).then(canvas => {
    const link = document.createElement('a');
    const name = document.getElementById('compNameA')?.value || 'portfolio';
    const date = new Date().toISOString().slice(0,10);
    link.download = `cc-portfolio-snapshot-${date}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('✅ Snapshot downloaded!');
  }).catch(() => showToast('⚠️ Snapshot failed — try again'));
}

function showToast(msg) {
  const t = document.getElementById('snapshotToast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// Show snapshot button once results are shown (hook via MutationObserver)
new MutationObserver(() => {
  const rp = document.getElementById('resultsPanel');
  if (rp && rp.style.display !== 'none' && rp.innerHTML.length > 100) {
    document.getElementById('snapshotBtn').style.display = 'flex';
  }
}).observe(document.getElementById('resultsPanel'), { childList: true, subtree: false, attributes: true, attributeFilter: ['style'] });

// ============================================================
