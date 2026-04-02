// ============================================================
// v1.2 — PORTFOLIO REBALANCING TAB
// Two modes:
//   1. Upload CSV (Fidelity export)
//   2. Build from scratch (manual search + value entry)
//
// Features:
//   - Delete a position → value moves to "Available Cash" pool
//   - Editable desired % per row with live buy/sell amounts
//   - Present vs Future doughnut charts
// ============================================================

// ---- STATE ----
let rebPositions  = [];   // { symbol, desc, value, qty, isManual, isCash }
let rebRaw        = null; // { rawPositions, accounts } from CSV
let rebFilter     = 'ALL';
let rebDesired    = {};   // symbol -> desired %
let rebCash       = 0;    // available cash pool (from deleted positions)
let rebMode       = null; // 'csv' | 'manual' | null
let rebChartPresent = null;
let rebChartFuture  = null;

const REB_CASH_KEY = '__CASH__';

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
  const rows  = [];

  for (const line of lines) {
    if (!line.trim()) continue;
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

  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] && rows[i][0].toLowerCase().includes('account name')) {
      headerIdx = i; break;
    }
  }
  if (headerIdx < 0) return null;

  const accounts     = new Set();
  const rawPositions = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r      = rows[i];
    if (r.length < 7) continue;
    const acct   = (r[0] || '').trim();
    const symbol = (r[1] || '').trim().replace(/\*+$/, '');
    const desc   = (r[2] || '').trim();
    const qty    = parseFloat((r[3] || '').replace(/[$,"]/g, '')) || 0;
    const value  = parseRebDollar(r[6]);

    if (!acct) continue;
    if (!symbol || r[1].includes('*')) continue; // skip cash/MM
    if (value <= 0) continue;

    accounts.add(acct);
    rawPositions.push({ acct, symbol, desc, qty, value });
  }

  return { rawPositions, accounts: [...accounts] };
}

function mergePositions(rawPositions, filterAcct) {
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

// ---- HELPERS ----

function getRebTotal() {
  const posTotal = rebPositions.reduce((s, p) => s + p.value, 0);
  return posTotal + rebCash;
}

function getRebDesired(sym) {
  return rebDesired[sym] !== undefined ? rebDesired[sym] : 0;
}

function rebFmt$(n) {
  const abs = Math.abs(Math.round(n));
  const s   = '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
    opt.value = a; opt.textContent = a;
    sel.appendChild(opt);
  }
}

// ---- MODE SWITCHING ----

function rebSetMode(mode) {
  rebMode = mode;
  rebPositions = [];
  rebDesired   = {};
  rebCash      = 0;
  rebRaw       = null;

  document.getElementById('rebModeCSV').classList.toggle('active', mode === 'csv');
  document.getElementById('rebModeManual').classList.toggle('active', mode === 'manual');
  document.getElementById('rebCSVSection').style.display    = mode === 'csv'    ? 'block' : 'none';
  document.getElementById('rebManualSection').style.display = mode === 'manual' ? 'block' : 'none';

  // Reset filter
  const filterRow = document.getElementById('rebFilterRow');
  if (filterRow) filterRow.style.display = 'none';

  document.getElementById('rebContent').style.display   = 'none';
  document.getElementById('rebAddSection').style.display = 'none';
  document.getElementById('rebBtSection').style.display  = 'none';
}

// ---- CSV MODE ----

async function handleRebFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const errEl = document.getElementById('rebUploadError');
  errEl.style.display = 'none';
  try {
    const result = await parseHoldingsFile(file);
    rebRaw    = result;
    rebFilter = 'ALL';
    rebCash   = 0;

    populateAccountFilter(result.accounts);
    document.getElementById('rebFilterRow').style.display = 'flex';

    rebPositions = mergePositions(result.rawPositions, 'ALL');
    _prefillDesired();

    document.getElementById('rebContent').style.display   = 'block';
    document.getElementById('rebAddSection').style.display = 'flex';
    document.getElementById('rebBtSection').style.display  = 'block';
    renderRebalance();
  } catch(err) {
    errEl.textContent = '⚠️ Could not parse file: ' + err.message + '. Use a Fidelity CSV or Schwab XLSX export.';
    errEl.style.display = 'block';
  }
}

function applyRebAccountFilter() {
  if (!rebRaw) return;
  rebFilter    = document.getElementById('rebAccountFilter').value;
  rebCash      = 0;
  rebDesired   = {};
  rebPositions = mergePositions(rebRaw.rawPositions, rebFilter);
  _prefillDesired();
  renderRebalance();
}

// ---- MANUAL MODE ----

// Search dropdown for manual mode (reuses ETF_DATA + live server same as Simulator)
function initRebSearch() {
  const input = document.getElementById('rebSearchInput');
  const dd    = document.getElementById('rebSearchDropdown');
  if (!input) return;
  let timer = null;

  input.addEventListener('input', function() {
    clearTimeout(timer);
    const q = this.value.trim().toUpperCase();
    dd.style.display = 'none';
    if (!q) return;

    // Local match first
    const allKnown = [
      ...QUICK_SUGGESTIONS,
      ...Object.keys(ETF_DATA).filter(k => !QUICK_SUGGESTIONS.find(s => s.ticker === k))
        .map(k => ({ ticker: k, name: ETF_DATA[k].name || k, yield_annual: ETF_DATA[k].yield_annual || 0, source: 'cache' }))
    ];
    const local = allKnown.filter(s =>
      s.ticker.startsWith(q) || s.name.toUpperCase().includes(q)
    ).slice(0, 8);

    _renderRebDropdown(local, q);

    if (serverOnline) {
      timer = setTimeout(async () => {
        try {
          const res  = await fetch(`${API}/search?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          const live = (data.results || []).slice(0, 6).map(r => ({
            ticker: r.ticker, name: r.name || r.ticker,
            yield_annual: r.yield_annual || 0, source: 'live'
          }));
          _renderRebDropdown(live.length ? live : local, q);
        } catch(e) { /* keep local results */ }
      }, 400);
    }
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { dd.style.display = 'none'; this.value = ''; }
  });
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dd.contains(e.target)) dd.style.display = 'none';
  });
}

function _renderRebDropdown(items, q) {
  const dd = document.getElementById('rebSearchDropdown');
  if (!items.length) { dd.style.display = 'none'; return; }

  dd.innerHTML = items.map(it => {
    const yld  = it.yield_annual ? (it.yield_annual * 100).toFixed(1) + '%' : '';
    // Show LIVE tag when server is online (price data will be fetched on add),
    // or CACHE when offline — reflects data availability, not just search source
    const tag  = it.source === 'live'
      ? '<span class="sri-live-tag">LIVE</span>'
      : (serverOnline ? '<span class="sri-live-tag">LIVE</span>' : '<span class="sri-cache-tag">CACHE</span>');
    const safeName = (it.name || it.ticker).replace(/'/g, "\\'");
    return `<div class="sri" onclick="rebManualAddFromSearch('${it.ticker}','${safeName}')">
      <div><div class="sri-ticker">${it.ticker}${tag}</div><div class="sri-name">${it.name || it.ticker}</div></div>
      <div class="sri-yield">${yld}</div>
    </div>`;
  }).join('');

  // Direct-add option if no exact match
  if (!items.find(it => it.ticker === q)) {
    dd.innerHTML += `<div class="sri" onclick="rebManualAddFromSearch('${q}','${q}')">
      <div><div class="sri-ticker">${q}</div><div class="sri-name" style="color:#2b6cb0;">Add "${q}" directly</div></div>
    </div>`;
  }
  dd.style.display = 'block';
}

function rebManualAddFromSearch(ticker, name) {
  document.getElementById('rebSearchInput').value = '';
  document.getElementById('rebSearchDropdown').style.display = 'none';

  // If ticker was deleted and then re-added, allow it (just re-insert with 0 value)
  const existing = rebPositions.find(p => p.symbol === ticker);
  if (existing) {
    // Already in table — just focus its value field
    const inp = document.getElementById('rebVal_' + ticker);
    if (inp) inp.focus();
    return;
  }

  rebPositions.push({ symbol: ticker, desc: name, value: 0, qty: 0, isManual: true });
  rebDesired[ticker] = 0;

  document.getElementById('rebContent').style.display   = 'block';
  document.getElementById('rebAddSection').style.display = 'flex';
  document.getElementById('rebBtSection').style.display  = 'block';
  renderRebalance();

  // Focus the value input for the newly added row
  setTimeout(() => {
    const inp = document.getElementById('rebVal_' + ticker);
    if (inp) inp.focus();
  }, 50);
}

function setRebPositionValue(ticker, val) {
  const pos = rebPositions.find(p => p.symbol === ticker);
  if (pos) pos.value = parseFloat(val) || 0;
  _prefillDesiredSingle(ticker);
  renderRebalance();
}

// ---- DELETE POSITION → CASH ----

function deleteRebPosition(sym) {
  const idx = rebPositions.findIndex(p => p.symbol === sym);
  if (idx < 0) return;

  const pos = rebPositions[idx];
  rebCash += pos.value;                   // move value to cash pool
  rebPositions.splice(idx, 1);            // remove from positions
  delete rebDesired[sym];

  // Ensure cash row has a desired% entry
  if (rebDesired[REB_CASH_KEY] === undefined) rebDesired[REB_CASH_KEY] = 0;

  renderRebalance();
}

function setRebCashValue(val) {
  rebCash = parseFloat(val) || 0;
  renderRebalance();
}

// ---- DESIRED % ----

function setRebDesired(sym, val) {
  rebDesired[sym] = parseFloat(val) || 0;
  renderRebalance();
}

function _prefillDesired() {
  rebDesired = {};
  const total = getRebTotal();
  for (const p of rebPositions) {
    rebDesired[p.symbol] = total > 0 ? parseFloat((p.value / total * 100).toFixed(2)) : 0;
  }
  if (rebCash > 0) {
    rebDesired[REB_CASH_KEY] = total > 0 ? parseFloat((rebCash / total * 100).toFixed(2)) : 0;
  }
}

function _prefillDesiredSingle(sym) {
  const total = getRebTotal();
  const pos   = rebPositions.find(p => p.symbol === sym);
  if (pos && total > 0) {
    rebDesired[sym] = parseFloat((pos.value / total * 100).toFixed(2));
  }
}

function distributeRebEvenly() {
  const syms = [
    ...rebPositions.map(p => p.symbol),
    ...(rebCash > 0 ? [REB_CASH_KEY] : [])
  ];
  if (!syms.length) return;
  const pct = parseFloat((100 / syms.length).toFixed(2));
  for (const s of syms) rebDesired[s] = pct;
  renderRebalance();
}

function resetRebDesired() { _prefillDesired(); renderRebalance(); }

// ---- MAIN RENDER ----

function renderRebalance() {
  const total     = getRebTotal();
  const container = document.getElementById('rebTable');
  if (!container) return;

  // Build full row list: positions + optional cash row
  const allRows = [...rebPositions];
  if (rebCash > 0) {
    allRows.unshift({ symbol: REB_CASH_KEY, desc: 'Available Cash (from sold positions)', value: rebCash, qty: 0, isCash: true });
  }

  // Desired % sum
  let desiredSum = allRows.reduce((s, r) => s + getRebDesired(r.symbol), 0);
  const unassigned = Math.max(0, 100 - desiredSum);

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
      <div>
        <span style="font-size:13px;color:#4a5568;">Total Portfolio Value: </span>
        <strong style="font-size:16px;color:#2b6cb0;">${rebFmt$(total)}</strong>
        ${rebCash > 0 ? `<span style="font-size:13px;color:#4a5568;margin-left:16px;">💵 Available Cash: </span><strong style="font-size:16px;color:#276749;">${rebFmt$(rebCash)}</strong>` : ''}
      </div>
      <div style="font-size:12px;color:${Math.abs(desiredSum - 100) < 0.01 ? '#276749' : '#c05621'};">
        Desired: <strong>${desiredSum.toFixed(2)}%</strong>
        ${Math.abs(desiredSum - 100) < 0.01 ? ' ✓' : ` · ${unassigned.toFixed(2)}% unassigned`}
      </div>
    </div>
    <div style="overflow-x:auto;">
    <table class="reb-table">
      <thead>
        <tr>
          <th style="width:32px;"></th>
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
    const isCash   = pos.isCash;
    const isManual = pos.isManual;
    const curPct   = total > 0 ? pos.value / total * 100 : 0;
    const desPct   = getRebDesired(pos.symbol);
    const target   = total * desPct / 100;
    const delta    = target - pos.value;

    const deltaClass = delta > 1 ? 'reb-buy' : delta < -1 ? 'reb-sell' : 'reb-ok';
    const deltaLabel = Math.abs(delta) < 1 ? '—' :
      (delta > 0 ? '▲ Buy ' : '▼ Sell ') + rebFmt$(Math.abs(delta));

    const symbolCell = isCash
      ? `<td style="text-align:center;">—</td>
         <td colspan="0"><strong style="color:#276749;">💵 Cash</strong></td>
         <td style="font-size:12px;color:#4a5568;">${pos.desc}</td>`
      : `<td style="text-align:center;">
           <button class="reb-del-btn" onclick="deleteRebPosition('${pos.symbol}')" title="Remove position — value moves to Cash pool">✕</button>
         </td>
         <td>
           <strong style="color:${isCash ? '#276749' : '#2b6cb0'};">${pos.symbol}</strong>
           ${isManual ? ' <span class="reb-new-tag">new</span>' : ''}
         </td>
         <td style="font-size:12px;color:#4a5568;">${pos.desc}</td>`;

    // Value cell — editable for manual mode positions (text input to avoid spinner arrows)
    const valueCell = (isManual && rebMode === 'manual')
      ? `<td style="text-align:right;">
           <input type="text" inputmode="numeric" id="rebVal_${pos.symbol}"
             value="${pos.value > 0 ? Math.round(pos.value) : ''}" placeholder="e.g. 25000"
             oninput="setRebPositionValue('${pos.symbol}', this.value.replace(/[^0-9.]/g,''))"
             onblur="this.value=this.value.replace(/[^0-9.]/g,'')"
             style="width:110px;text-align:right;border:1px solid #90cdf4;border-radius:6px;padding:4px 8px;font-size:12px;background:#ebf8ff;" />
         </td>`
      : `<td style="text-align:right;">${rebFmt$(pos.value)}</td>`;

    // Cash value — also editable, no spinner
    const cashValueCell = isCash
      ? `<td style="text-align:right;">
           <input type="text" inputmode="numeric" value="${rebCash > 0 ? Math.round(rebCash) : ''}" placeholder="e.g. 5000"
             oninput="setRebCashValue(this.value.replace(/[^0-9.]/g,''))"
             style="width:110px;text-align:right;border:1px solid #9ae6b4;border-radius:6px;padding:4px 8px;font-size:12px;background:#f0fff4;" />
         </td>`
      : valueCell;

    html += `
      <tr class="${isCash ? 'reb-cash-row' : isManual ? 'reb-manual-row' : ''}">
        ${isCash
          ? `<td style="text-align:center;">—</td>
             <td><strong style="color:#276749;">💵 Cash</strong></td>
             <td style="font-size:12px;color:#4a5568;">${pos.desc}</td>`
          : `<td style="text-align:center;">
               <button class="reb-del-btn" onclick="deleteRebPosition('${pos.symbol}')" title="Remove position — value moves to Cash pool">✕</button>
             </td>
             <td>
               <strong style="color:#2b6cb0;">${pos.symbol}</strong>
               ${isManual ? ' <span class="reb-new-tag">new</span>' : ''}
             </td>
             <td style="font-size:12px;color:#4a5568;">${pos.desc}</td>`
        }
        ${isCash ? cashValueCell : valueCell}
        <td style="text-align:right;">${rebFmtPct(curPct / 100)}</td>
        <td style="text-align:center;">
          <div style="display:flex;align-items:center;gap:4px;justify-content:center;">
            <input type="text" inputmode="decimal"
              value="${desPct || ''}" placeholder="0"
              oninput="setRebDesired('${pos.symbol}', this.value.replace(/[^0-9.]/g,''))"
              style="width:64px;text-align:center;border:1px solid #cbd5e0;border-radius:6px;padding:4px 6px;font-size:13px;" />
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

  const presentRows   = allRows.filter(p => p.value > 0);
  const presentLabels = presentRows.map(p => p.symbol === REB_CASH_KEY ? '💵 Cash' : p.symbol);
  const presentData   = presentRows.map(p => p.value);

  const futureRows    = allRows.filter(p => getRebDesired(p.symbol) > 0);
  const futureLabels  = futureRows.map(p => p.symbol === REB_CASH_KEY ? '💵 Cash' : p.symbol);
  const futureData    = futureRows.map(p => total * getRebDesired(p.symbol) / 100);

  if (rebChartPresent) rebChartPresent.destroy();
  if (rebChartFuture)  rebChartFuture.destroy();

  const futureMsgEl = document.getElementById('rebFutureMsg');

  const chartOpts = (title) => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12, padding: 8 } },
      title:  { display: true, text: title, font: { size: 13, weight: 'bold' }, color: '#2d3748', padding: { bottom: 8 } },
      tooltip: { callbacks: { label(ctx) {
        const val = ctx.raw;
        const pct = total > 0 ? (val / total * 100).toFixed(1) : '0';
        return ` ${ctx.label}: $${val.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${pct}%)`;
      }}}
    }
  });

  const colors = REB_CHART_COLORS;

  if (presentData.length) {
    rebChartPresent = new Chart(presentCanvas, {
      type: 'doughnut',
      data: { labels: presentLabels, datasets: [{ data: presentData, backgroundColor: colors.slice(0, presentLabels.length), borderWidth: 1 }] },
      options: chartOpts('📊 Present Allocation')
    });
  }

  if (futureData.length > 0) {
    if (futureMsgEl) futureMsgEl.style.display = 'none';
    rebChartFuture = new Chart(futureCanvas, {
      type: 'doughnut',
      data: { labels: futureLabels, datasets: [{ data: futureData, backgroundColor: colors.slice(0, futureLabels.length), borderWidth: 1 }] },
      options: chartOpts('🎯 Future Allocation')
    });
  } else {
    if (futureMsgEl) futureMsgEl.style.display = 'block';
  }
}

// ---- ADD TICKER (action bar) ----

function addRebTicker() {
  const input = document.getElementById('rebAddTicker');
  const sym   = (input.value || '').trim().toUpperCase();
  if (!sym) return;
  if (rebPositions.find(p => p.symbol === sym)) { input.value = ''; return; }
  rebPositions.push({ symbol: sym, desc: sym, value: 0, qty: 0, isManual: true });
  rebDesired[sym] = 0;
  input.value = '';
  document.getElementById('rebContent').style.display  = 'block';
  document.getElementById('rebBtSection').style.display = 'block';
  renderRebalance();
  setTimeout(() => { const v = document.getElementById('rebVal_' + sym); if (v) v.focus(); }, 50);
}

// ---- INIT ----
// Called once DOM is ready — sets up manual search
document.addEventListener('DOMContentLoaded', () => {
  initRebSearch();
});
