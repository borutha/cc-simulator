// ============================================================
// v1.2 — PORTFOLIO REBALANCING TAB
// Parses Fidelity CSV exports, shows current allocations,
// lets user set desired %, displays buy/sell amounts, and
// renders Present vs Future doughnut charts.
// ============================================================

let rebPositions = [];      // parsed + merged positions
let rebChartPresent = null;
let rebChartFuture  = null;

// ---- CSV PARSING ----

function parseRebDollar(s) {
  if (!s) return 0;
  s = String(s).trim().replace(/^"|"$/g, '').trim();
  const neg = s.startsWith('(') && s.endsWith(')');
  s = s.replace(/[$,()\s]/g, '');
  const n = parseFloat(s) || 0;
  return neg ? -n : n;
}

function parseRebCSV(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    // Split respecting quoted fields
    const fields = [];
    let inQ = false, cur = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; cur += c; }
      else if (c === ',' && !inQ) { fields.push(cur); cur = ''; }
      else cur += c;
    }
    fields.push(cur);
    rows.push(fields);
  }

  // Find header row
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] && rows[i][0].toLowerCase().includes('account name')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  // Collect accounts (for filter dropdown)
  const accounts = new Set();
  const rawPositions = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 7) continue;

    const acct   = (r[0] || '').trim();
    const symbol = (r[1] || '').trim().replace(/\*+$/, '');
    const desc   = (r[2] || '').trim();
    const qty    = parseFloat((r[3] || '').replace(/[$,"]/g, '')) || 0;
    const price  = parseRebDollar(r[4]);
    const value  = parseRebDollar(r[6]);

    if (!acct) continue;

    // Skip cash / money market rows
    if (!symbol || r[1].includes('*')) continue;
    // Skip rows where symbol looks like a fund ID with no real ticker (MICROSOFT 401K long codes)
    // We include them but mark them as non-ETF

    if (value <= 0) continue;

    accounts.add(acct);
    rawPositions.push({ acct, symbol, desc, qty, price, value });
  }

  return { rawPositions, accounts: [...accounts] };
}

function mergePositions(rawPositions, filterAcct) {
  // Group by symbol, summing values (optionally filtered by account)
  const map = {};
  for (const p of rawPositions) {
    if (filterAcct && filterAcct !== 'ALL' && p.acct !== filterAcct) continue;
    if (!map[p.symbol]) {
      map[p.symbol] = { symbol: p.symbol, desc: p.desc, value: 0, qty: 0 };
    }
    map[p.symbol].value += p.value;
    map[p.symbol].qty   += p.qty;
  }
  return Object.values(map).sort((a, b) => b.value - a.value);
}

// ---- STATE ----

let rebRaw = null;          // { rawPositions, accounts }
let rebFilter = 'ALL';
let rebDesired = {};        // ticker -> desired %
let rebManual  = {};        // manually added tickers { ticker: { price, value } }

function getRebTotal() {
  return rebPositions.reduce((s, p) => s + p.value, 0);
}

function getRebDesired(sym) {
  return rebDesired[sym] !== undefined ? rebDesired[sym] : 0;
}

// ---- RENDER HELPERS ----

function rebFmt$(n) {
  const abs = Math.abs(n);
  const s = '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? '-' + s : s;
}

function rebFmtPct(n) {
  return (n * 100).toFixed(2) + '%';
}

function populateAccountFilter(accounts) {
  const sel = document.getElementById('rebAccountFilter');
  sel.innerHTML = '<option value="ALL">All Accounts</option>';
  for (const a of accounts) {
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a;
    sel.appendChild(opt);
  }
}

// ---- MAIN RENDER ----

function renderRebalance() {
  const total = getRebTotal();
  const container = document.getElementById('rebTable');
  if (!container) return;

  // Compute desired total %
  let desiredSum = 0;
  for (const p of rebPositions) desiredSum += getRebDesired(p.symbol);
  for (const sym of Object.keys(rebManual)) desiredSum += getRebDesired(sym);

  const allRows = [...rebPositions];
  // Add manual positions
  for (const [sym, info] of Object.entries(rebManual)) {
    if (!allRows.find(r => r.symbol === sym)) {
      allRows.push({ symbol: sym, desc: info.desc || sym, value: info.value || 0, qty: 0, isManual: true });
    }
  }

  const desiredPctRemaining = Math.max(0, 100 - desiredSum).toFixed(2);

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
      <div>
        <span style="font-size:13px;color:#4a5568;">Total Portfolio Value: </span>
        <strong style="font-size:16px;color:#2b6cb0;">${rebFmt$(total)}</strong>
      </div>
      <div style="font-size:12px;color:${Math.abs(desiredSum - 100) < 0.01 ? '#276749' : '#e53e3e'};">
        Desired allocation: <strong>${desiredSum.toFixed(2)}%</strong>
        ${Math.abs(desiredSum - 100) < 0.01 ? ' ✓' : ` (${desiredPctRemaining}% unassigned)`}
      </div>
    </div>
    <div style="overflow-x:auto;">
    <table class="reb-table">
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Description</th>
          <th style="text-align:right;">Current Value</th>
          <th style="text-align:right;">Current %</th>
          <th style="text-align:center;">Desired %</th>
          <th style="text-align:right;">Target Value</th>
          <th style="text-align:right;">Buy / Sell</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const pos of allRows) {
    const curPct  = total > 0 ? pos.value / total * 100 : 0;
    const desPct  = getRebDesired(pos.symbol);
    const target  = total * desPct / 100;
    const delta   = target - pos.value;

    const deltaClass = delta > 1 ? 'reb-buy' : delta < -1 ? 'reb-sell' : 'reb-ok';
    const deltaLabel = Math.abs(delta) < 1 ? '—' : (delta > 0 ? '▲ Buy ' : '▼ Sell ') + rebFmt$(Math.abs(delta));

    html += `
      <tr class="${pos.isManual ? 'reb-manual-row' : ''}">
        <td><strong style="color:#2b6cb0;">${pos.symbol}</strong>${pos.isManual ? ' <span style="font-size:9px;color:#718096;border:1px solid #cbd5e0;border-radius:3px;padding:1px 4px;">new</span>' : ''}</td>
        <td style="font-size:12px;color:#4a5568;">${pos.desc}</td>
        <td style="text-align:right;">${rebFmt$(pos.value)}</td>
        <td style="text-align:right;">${rebFmtPct(curPct / 100)}</td>
        <td style="text-align:center;">
          <div style="display:flex;align-items:center;gap:4px;justify-content:center;">
            <input type="number" class="reb-pct-input" min="0" max="100" step="0.5"
              value="${desPct}"
              oninput="setRebDesired('${pos.symbol}', this.value)"
              style="width:64px;text-align:center;border:1px solid #cbd5e0;border-radius:6px;padding:4px 6px;font-size:13px;"
            />
            <span style="font-size:11px;color:#718096;">%</span>
          </div>
        </td>
        <td style="text-align:right;">${desPct > 0 ? rebFmt$(target) : '—'}</td>
        <td style="text-align:right;" class="${deltaClass}">${desPct > 0 ? deltaLabel : '—'}</td>
      </tr>
    `;
  }

  html += `</tbody></table></div>`;
  container.innerHTML = html;

  renderRebCharts(allRows, total);
}

function setRebDesired(sym, val) {
  rebDesired[sym] = parseFloat(val) || 0;
  renderRebalance();
}

// ---- CHARTS ----

const REB_CHART_COLORS = [
  '#4299e1','#48bb78','#ed8936','#9f7aea','#f56565','#38b2ac','#ed64a6','#ecc94b',
  '#667eea','#fc8181','#68d391','#fbd38d','#b794f4','#76e4f7','#f6ad55','#81e6d9',
  '#a3bffa','#fbb6ce','#9ae6b4','#faf089',
];

function renderRebCharts(allRows, total) {
  const presentCanvas = document.getElementById('rebChartPresent');
  const futureCanvas  = document.getElementById('rebChartFuture');
  if (!presentCanvas || !futureCanvas) return;

  // Present data (current values)
  const presentLabels = allRows.filter(p => p.value > 0).map(p => p.symbol);
  const presentData   = allRows.filter(p => p.value > 0).map(p => p.value);

  // Future data (desired %, applied to total)
  const futureRows    = allRows.filter(p => getRebDesired(p.symbol) > 0);
  const futureLabels  = futureRows.map(p => p.symbol);
  const futureData    = futureRows.map(p => total * getRebDesired(p.symbol) / 100);

  const colors = REB_CHART_COLORS;

  if (rebChartPresent) rebChartPresent.destroy();
  if (rebChartFuture)  rebChartFuture.destroy();

  const chartOpts = (title) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12, padding: 8 } },
      title:  { display: true, text: title, font: { size: 13, weight: 'bold' }, color: '#2d3748', padding: { bottom: 8 } },
      tooltip: {
        callbacks: {
          label(ctx) {
            const val = ctx.raw;
            const pct = total > 0 ? (val / total * 100).toFixed(1) : '0';
            return ` ${ctx.label}: $${val.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${pct}%)`;
          }
        }
      }
    }
  });

  rebChartPresent = new Chart(presentCanvas, {
    type: 'doughnut',
    data: {
      labels: presentLabels,
      datasets: [{ data: presentData, backgroundColor: colors.slice(0, presentLabels.length), borderWidth: 1 }]
    },
    options: chartOpts('📊 Present Allocation')
  });

  if (futureData.length > 0) {
    rebChartFuture = new Chart(futureCanvas, {
      type: 'doughnut',
      data: {
        labels: futureLabels,
        datasets: [{ data: futureData, backgroundColor: colors.slice(0, futureLabels.length), borderWidth: 1 }]
      },
      options: chartOpts('🎯 Future Allocation')
    });
  } else {
    futureCanvas.getContext('2d').clearRect(0, 0, futureCanvas.width, futureCanvas.height);
    document.getElementById('rebFutureMsg').style.display = 'block';
  }
}

// ---- CSV UPLOAD HANDLER ----

function handleRebFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    const result = parseRebCSV(ev.target.result);
    if (!result || !result.rawPositions.length) {
      document.getElementById('rebUploadError').textContent = 'Could not parse file. Please use a Fidelity portfolio CSV export.';
      document.getElementById('rebUploadError').style.display = 'block';
      return;
    }
    document.getElementById('rebUploadError').style.display = 'none';
    rebRaw = result;
    rebFilter = 'ALL';
    rebDesired = {};
    rebManual  = {};

    populateAccountFilter(result.accounts);
    document.getElementById('rebAccountFilter').style.display = 'block';
    document.getElementById('rebAccountFilterLabel').style.display = 'block';

    rebPositions = mergePositions(result.rawPositions, 'ALL');
    // Pre-fill desired % with current %
    const total = getRebTotal();
    for (const p of rebPositions) {
      rebDesired[p.symbol] = total > 0 ? parseFloat((p.value / total * 100).toFixed(2)) : 0;
    }

    document.getElementById('rebContent').style.display = 'block';
    document.getElementById('rebAddSection').style.display = 'flex';
    renderRebalance();
  };
  reader.readAsText(file);
}

function applyRebAccountFilter() {
  if (!rebRaw) return;
  rebFilter = document.getElementById('rebAccountFilter').value;
  rebManual = {};
  rebDesired = {};
  rebPositions = mergePositions(rebRaw.rawPositions, rebFilter);
  const total = getRebTotal();
  for (const p of rebPositions) {
    rebDesired[p.symbol] = total > 0 ? parseFloat((p.value / total * 100).toFixed(2)) : 0;
  }
  renderRebalance();
}

// ---- ADD MANUAL TICKER ----

function addRebTicker() {
  const input = document.getElementById('rebAddTicker');
  const sym = input.value.trim().toUpperCase();
  if (!sym) return;
  if (rebPositions.find(p => p.symbol === sym) || rebManual[sym]) {
    input.value = '';
    return;
  }
  rebManual[sym] = { desc: sym, value: 0 };
  rebDesired[sym] = 0;
  input.value = '';
  renderRebalance();
}

// ---- DISTRIBUTE EVENLY ----

function distributeRebEvenly() {
  const allSymbols = [
    ...rebPositions.map(p => p.symbol),
    ...Object.keys(rebManual).filter(s => !rebPositions.find(p => p.symbol === s))
  ];
  if (allSymbols.length === 0) return;
  const pct = parseFloat((100 / allSymbols.length).toFixed(2));
  for (const sym of allSymbols) rebDesired[sym] = pct;
  renderRebalance();
}

// ---- RESET ----
function resetRebDesired() {
  const total = getRebTotal();
  for (const p of rebPositions) {
    rebDesired[p.symbol] = total > 0 ? parseFloat((p.value / total * 100).toFixed(2)) : 0;
  }
  for (const sym of Object.keys(rebManual)) rebDesired[sym] = 0;
  renderRebalance();
}
