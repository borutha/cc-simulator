// ============================================================
// HELPERS
// ============================================================
function fmt$(n) { return '$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
// Whole-dollar formatter (no cents) — used for large portfolio values in backtest/rebalance
function fmtWhole$(n) {
  const abs = Math.abs(Math.round(n));
  const s = '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n < 0 ? '-' + s : s;
}
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
// SHARED HOLDINGS FILE PARSER  (Schwab XLSX + Fidelity CSV)
// Both return: { rawPositions, accounts }
// ============================================================
function parseHoldingsXLSX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data     = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

        // Find header row: look for 'Security ID'
        let headerIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 30); i++) {
          if (rows[i] && rows[i].some(c => String(c || '').trim() === 'Security ID')) {
            headerIdx = i; break;
          }
        }
        if (headerIdx < 0) { reject(new Error('Cannot find "Security ID" header row')); return; }

        const headers = rows[headerIdx].map(c => String(c || '').trim());
        const col = name => headers.findIndex(h => h === name);

        const C = {
          ticker       : col('Security ID'),
          acctNum      : col('Account Number'),
          acctName     : col('Account Nickname/Title'),
          desc         : col('Description'),
          qty          : col('Quantity'),
          price        : col('Price'),
          value        : col('Market Value'),
          gainLossDollar: col('Gain/Loss $'),
          gainLossPct   : col('Gain/Loss %'),
          activityDate  : col('Activity Date'),
        };
        // Positional fallbacks (col B=index 1 in Schwab layout)
        if (C.ticker   < 0) C.ticker   = 1;
        if (C.acctNum  < 0) C.acctNum  = 3;
        if (C.acctName < 0) C.acctName = 4;
        if (C.desc     < 0) C.desc     = 5;
        if (C.qty      < 0) C.qty      = 7;
        if (C.price    < 0) C.price    = 8;
        if (C.value    < 0) C.value    = 13;
        if (C.gainLossDollar < 0) C.gainLossDollar = 15;
        if (C.gainLossPct    < 0) C.gainLossPct    = 16;
        if (C.activityDate   < 0) C.activityDate   = 17;

        const rawPositions = [];
        const accountSet   = new Set();

        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          const ticker = String(row[C.ticker] || '').trim().toUpperCase();
          if (!ticker || ticker.length > 10 || /^\d/.test(ticker)) continue;

          const acct     = String(row[C.acctNum]  || '').trim();
          const acctName = String(row[C.acctName] || acct).trim();
          const desc     = String(row[C.desc]     || ticker).trim();
          const qty      = parseFloat(row[C.qty])  || 0;
          const price    = parseFloat(row[C.price])|| 0;
          let   value    = parseFloat(row[C.value]);
          if (isNaN(value)) value = parseFloat(String(row[C.value]||'').replace(/[$,]/g,''))||0;
          if (value <= 0 && qty > 0 && price > 0) value = qty * price;
          if (value <= 0) continue;

          const gainLossDollar = parseFloat(row[C.gainLossDollar]) || null;
          const gainLossPct    = parseFloat(row[C.gainLossPct])    || null;
          // Activity date: may be a JS Date object (from cellDates:true) or string
          let activityDate = null;
          const rawDate = row[C.activityDate];
          if (rawDate instanceof Date) {
            activityDate = rawDate.toISOString().slice(0, 10);
          } else if (rawDate && String(rawDate).trim() !== 'N/A') {
            activityDate = String(rawDate).trim();
          }

          rawPositions.push({ acct, acctName, symbol: ticker, desc, qty, value,
                               gainLossDollar, gainLossPct, activityDate });
          if (acct) accountSet.add(acct);
        }
        resolve({ rawPositions, accounts: [...accountSet] });
      } catch(err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsArrayBuffer(file);
  });
}

// Unified dispatcher: XLSX or CSV → { rawPositions, accounts }
async function parseHoldingsFile(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseHoldingsXLSX(file);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const result = parseRebCSV(e.target.result);
        if (result && result.rawPositions.length) resolve(result);
        else reject(new Error('No positions found in CSV'));
      } catch(err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsText(file);
  });
}
