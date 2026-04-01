// v1.2 — COMPARE PORTFOLIOS
// ============================================================
let compHoldingsA = {}, compHoldingsB = {};

function initCompareSearch(side) {
  const inputId = 'compSearch' + side;
  const dropId  = 'compDropdown' + side;
  const input = document.getElementById(inputId);
  let timer = null;

  input.addEventListener('input', function() {
    clearTimeout(timer);
    const q = this.value.trim();
    const dd = document.getElementById(dropId);
    if (!q) { dd.style.display = 'none'; return; }

    // Local match — same QUICK_SUGGESTIONS + anything already loaded in ETF_DATA
    const allKnown = [
      ...QUICK_SUGGESTIONS,
      ...Object.keys(ETF_DATA)
        .filter(t => !QUICK_SUGGESTIONS.find(s => s.ticker === t))
        .map(t => ({ ticker: t, name: ETF_DATA[t].name || t }))
    ];
    const localMatches = allKnown.filter(s =>
      s.ticker.toLowerCase().includes(q.toLowerCase()) ||
      (s.name && s.name.toLowerCase().includes(q.toLowerCase()))
    ).slice(0, 8);

    if (localMatches.length > 0) {
      renderCompDropdown(side, localMatches.map(s => ({
        ticker: s.ticker, name: s.name, source: 'cache',
        yield_annual: ETF_DATA[s.ticker]?.yield_annual
      })));
    } else {
      // Show direct-add option for any typed ticker
      dd.innerHTML = `<div class="sri" onclick="addCompETF('${side}','${q.toUpperCase().trim()}')">
        <div>
          <div class="sri-ticker">${q.toUpperCase().trim()} <span class="sri-cache-tag">ADD</span></div>
          <div class="sri-name">Add "${q.toUpperCase().trim()}" directly (fetches live data)</div>
        </div>
      </div>`;
      dd.style.display = 'block';
    }

    // Live server search (debounced) — mirrors main Simulator
    if (serverOnline && q.length >= 2) {
      timer = setTimeout(async () => {
        try {
          const r = await fetch(`${API}/search?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(5000) });
          const results = await r.json();
          if (results.length > 0) {
            const liveSet = new Set(results.map(r => r.ticker));
            const merged = [
              ...results.map(r => ({ ticker: r.ticker, name: r.name, source: 'live', yield_annual: ETF_DATA[r.ticker]?.yield_annual })),
              ...localMatches.filter(s => !liveSet.has(s.ticker)).map(s => ({ ticker: s.ticker, name: s.name, source: 'cache', yield_annual: ETF_DATA[s.ticker]?.yield_annual }))
            ].slice(0, 10);
            results.forEach(r => {
              if (!ETF_DATA[r.ticker]) ETF_DATA[r.ticker] = { name: r.name, price: 0, yield_annual: 0 };
              if (ETF_SOURCE[r.ticker] !== 'live') fetchLive(r.ticker);
            });
            renderCompDropdown(side, merged);
          }
        } catch {}
      }, 400);
    }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#' + inputId) && !e.target.closest('#' + dropId)) {
      document.getElementById(dropId).style.display = 'none';
    }
  });
}

function renderCompDropdown(side, items) {
  const dd = document.getElementById('compDropdown' + side);
  if (!items.length) { dd.style.display = 'none'; return; }
  const holdings = side === 'A' ? compHoldingsA : compHoldingsB;
  dd.innerHTML = items.map(item => {
    const added = holdings[item.ticker] ? ' <span style="color:#68d391;font-size:10px;">✓ added</span>' : '';
    const yieldStr = item.yield_annual != null ? (item.yield_annual * 100).toFixed(1) + '% yield' : '';
    const srcTag = item.source === 'live'
      ? '<span class="sri-live-tag">LIVE</span>'
      : '<span class="sri-cache-tag">CACHED</span>';
    return `<div class="sri" onclick="addCompETF('${side}','${item.ticker}')">
      <div>
        <div class="sri-ticker">${item.ticker}${srcTag}${added}</div>
        <div class="sri-name">${item.name || ''}</div>
      </div>
      <div class="sri-yield">${yieldStr}</div>
    </div>`;
  }).join('');
  dd.style.display = 'block';
}

async function addCompETF(side, ticker) {
  ticker = ticker.toUpperCase();
  document.getElementById('compDropdown' + side).style.display = 'none';
  document.getElementById('compSearch' + side).value = '';

  const holdings = side === 'A' ? compHoldingsA : compHoldingsB;
  if (holdings[ticker]) return;
  holdings[ticker] = 0;

  const data = await ensureData(ticker);
  if (!data) { delete holdings[ticker]; return; }

  const tickers = Object.keys(holdings);
  const even = Math.round(100 / tickers.length);
  tickers.forEach((t, i) => { holdings[t] = i === tickers.length - 1 ? 100 - even * (tickers.length - 1) : even; });

  renderCompHoldings(side);
}

function removeCompETF(side, ticker) {
  const holdings = side === 'A' ? compHoldingsA : compHoldingsB;
  delete holdings[ticker];
  renderCompHoldings(side);
}

function renderCompHoldings(side) {
  const holdings = side === 'A' ? compHoldingsA : compHoldingsB;
  const container = document.getElementById('compHoldings' + side);
  const tickers = Object.keys(holdings);

  if (tickers.length === 0) {
    container.innerHTML = '<div style="font-size:12px;color:#a0aec0;padding:8px 0;">No ETFs added yet</div>';
    document.getElementById('compAllocBar' + side).style.display = 'none';
    return;
  }

  container.innerHTML = tickers.map(t => {
    const d = ETF_DATA[t];
    const pct = holdings[t];
    return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
      <span style="font-weight:700;font-size:12px;color:#2b6cb0;min-width:44px;">${t}</span>
      <input type="range" style="flex:1;height:4px;" min="0" max="100" value="${pct}"
        oninput="updateCompAlloc('${side}','${t}',this.value)" />
      <input type="number" style="width:46px;border:1px solid #cbd5e0;border-radius:5px;padding:3px 5px;font-size:12px;text-align:center;" min="0" max="100" value="${pct}"
        onchange="updateCompAlloc('${side}','${t}',this.value)" />
      <span style="font-size:11px;color:#718096;">%</span>
      <button onclick="removeCompETF('${side}','${t}')" style="background:none;border:none;color:#cbd5e0;cursor:pointer;font-size:13px;" title="Remove">✕</button>
    </div>`;
  }).join('');

  document.getElementById('compAllocBar' + side).style.display = 'block';
  updateCompAllocBar(side);
}

function updateCompAlloc(side, ticker, val) {
  val = Math.max(0, Math.min(100, parseInt(val) || 0));
  const holdings = side === 'A' ? compHoldingsA : compHoldingsB;
  holdings[ticker] = val;
  renderCompHoldings(side);
}

function updateCompAllocBar(side) {
  const holdings = side === 'A' ? compHoldingsA : compHoldingsB;
  const total = Object.values(holdings).reduce((a,b) => a+b, 0);
  const fill = document.getElementById('compBarFill' + side);
  const text = document.getElementById('compAllocText' + side);
  fill.style.width = Math.min(total, 100) + '%';
  fill.style.background = total === 100 ? '#38a169' : total > 100 ? '#e53e3e' : '#d69e2e';
  text.textContent = total === 100 ? '✓ 100% allocated' : total > 100 ? `⚠ Over by ${total-100}%` : `⚠ ${100-total}% unallocated`;
}

async function runComparison() {
  const tickersA = Object.keys(compHoldingsA);
  const tickersB = Object.keys(compHoldingsB);
  if (tickersA.length === 0 || tickersB.length === 0) {
    alert('Please add ETFs to both Portfolio A and Portfolio B.');
    return;
  }

  // Ensure data for all tickers
  if (serverOnline) {
    await Promise.all([...tickersA, ...tickersB].map(t => ensureData(t)));
  }

  const nameA = document.getElementById('compNameA').value || 'Portfolio A';
  const nameB = document.getElementById('compNameB').value || 'Portfolio B';
  const sizeA = parseFloat(document.getElementById('compSizeA').value.replace(/[$,]/g,'')) || 100000;
  const sizeB = parseFloat(document.getElementById('compSizeB').value.replace(/[$,]/g,'')) || 100000;

  function buildResults(holdings, portfolioSize) {
    let wtdYield=0, totalDiv=0, weighted1Y=0, totalReturn1Y=0;
    const results = [];
    const totalAlloc = Object.values(holdings).reduce((a,b) => a+b, 0);
    Object.entries(holdings).forEach(([t, w]) => {
      const d = ETF_DATA[t];
      if (!d) return;
      const weight = w / 100;
      const invested = portfolioSize * weight;
      const shares = invested / d.price;
      const oneYReturn = (d.price - d.one_y_start) / d.one_y_start;
      const annualDivYield = d.total_div_1y / d.price;
      const annualDivIncome = shares * d.total_div_1y;
      const tr = oneYReturn + (d.total_div_1y / d.one_y_start);
      wtdYield += annualDivYield * weight;
      totalDiv += annualDivIncome;
      weighted1Y += oneYReturn * weight;
      results.push({ ticker:t, weight:w, data:d, invested, shares, annualDivYield, annualDivIncome, oneYReturn, totalReturn1Y:tr });
    });
    totalReturn1Y = weighted1Y + (totalDiv / portfolioSize);
    return { results, wtdYield, totalDiv, weighted1Y, totalReturn1Y };
  }

  const A = buildResults(compHoldingsA, sizeA);
  const B = buildResults(compHoldingsB, sizeB);

  // Build ETF result arrays for projection
  const etfResA = A.results.map(r => ({ ticker: r.ticker, weight: r.weight, invested: r.invested, data: r.data, source: ETF_SOURCE[r.ticker] || 'cache' }));
  const etfResB = B.results.map(r => ({ ticker: r.ticker, weight: r.weight, invested: r.invested, data: r.data, source: ETF_SOURCE[r.ticker] || 'cache' }));

  const projA = projectPortfolio(etfResA, sizeA, 10, 1.0, true);
  const projB = projectPortfolio(etfResB, sizeB, 10, 1.0, true);

  function winner(a, b, higherIsBetter=true) {
    const diff = higherIsBetter ? a - b : b - a;
    if (Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 0.0001) < 0.005) return '<span class="compare-winner winner-tie">TIE</span>';
    return diff > 0
      ? `<span class="compare-winner winner-a">▲ ${nameA}</span>`
      : `<span class="compare-winner winner-b">▲ ${nameB}</span>`;
  }

  const y10A = projA.yearlyData[10];
  const y10B = projB.yearlyData[10];

  const metrics = [
    { label:'Annual Income', a: A.totalDiv, b: B.totalDiv, fmt: fmt$, higherBetter: true },
    { label:'Blended Yield', a: A.wtdYield, b: B.wtdYield, fmt: v => fmtPct(v), higherBetter: true },
    { label:'1Y Total Return', a: A.totalReturn1Y, b: B.totalReturn1Y, fmt: v => fmtPct(v), higherBetter: true },
    { label:'10Y Value (Base)', a: y10A.total_value, b: y10B.total_value, fmt: fmt$, higherBetter: true },
    { label:'Monthly Income', a: A.totalDiv/12, b: B.totalDiv/12, fmt: fmt$, higherBetter: true },
    { label:'Daily Income', a: A.totalDiv/365, b: B.totalDiv/365, fmt: fmt$, higherBetter: true },
    { label:'10Y Monthly Income', a: y10A.income_annual/12, b: y10B.income_annual/12, fmt: fmt$, higherBetter: true },
    { label:'Price Return (1Y)', a: A.weighted1Y, b: B.weighted1Y, fmt: v => fmtPct(v), higherBetter: true },
  ];

  const holdingTableA = A.results.map(r => `
    <tr>
      <td><span class="tkbadge">${r.ticker}</span></td>
      <td><span class="wbadge">${r.weight}%</span></td>
      <td class="pos">${fmtPct(r.annualDivYield)}</td>
      <td class="pos">${fmt$(r.annualDivIncome)}</td>
      <td class="${colorClass(r.oneYReturn)}">${arrow(r.oneYReturn)} ${fmtPct(Math.abs(r.oneYReturn))}</td>
    </tr>`).join('');
  const holdingTableB = B.results.map(r => `
    <tr>
      <td><span class="tkbadge">${r.ticker}</span></td>
      <td><span class="wbadge">${r.weight}%</span></td>
      <td class="pos">${fmtPct(r.annualDivYield)}</td>
      <td class="pos">${fmt$(r.annualDivIncome)}</td>
      <td class="${colorClass(r.oneYReturn)}">${arrow(r.oneYReturn)} ${fmtPct(Math.abs(r.oneYReturn))}</td>
    </tr>`).join('');

  document.getElementById('compareResultsArea').style.display = 'block';
  document.getElementById('compareResultsArea').innerHTML = `
    <div class="compare-results">
      <div class="compare-results-header">📊 Head-to-Head Comparison — ${nameA} vs ${nameB}</div>
      <div class="compare-metric-grid">
        ${metrics.slice(0,4).map(m => `
          <div class="compare-metric">
            <div class="compare-metric-label">${m.label}</div>
            <div class="compare-metric-a">${m.fmt(m.a)}</div>
            <div style="font-size:10px;color:#a0aec0;margin:2px 0;">vs</div>
            <div class="compare-metric-b">${m.fmt(m.b)}</div>
            <div class="compare-metric-diff">${winner(m.a, m.b, m.higherBetter)}</div>
          </div>`).join('')}
      </div>
      <div class="compare-metric-grid">
        ${metrics.slice(4).map(m => `
          <div class="compare-metric">
            <div class="compare-metric-label">${m.label}</div>
            <div class="compare-metric-a">${m.fmt(m.a)}</div>
            <div style="font-size:10px;color:#a0aec0;margin:2px 0;">vs</div>
            <div class="compare-metric-b">${m.fmt(m.b)}</div>
            <div class="compare-metric-diff">${winner(m.a, m.b, m.higherBetter)}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- Holdings detail -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;">
      <div class="results-section">
        <div class="rs-header" style="background:linear-gradient(90deg,#ebf8ff,#f7fafc);">
          <h3 style="color:#2b6cb0;">📋 ${nameA} — ${fmt$(sizeA)}</h3>
          <span>${fmtPct(A.wtdYield)} yield · ${fmt$(A.totalDiv)}/yr</span>
        </div>
        <table><thead><tr><th>ETF</th><th>Weight</th><th>Yield</th><th>Annual Inc.</th><th>1Y Return</th></tr></thead>
        <tbody>${holdingTableA}</tbody>
        </table>
      </div>
      <div class="results-section">
        <div class="rs-header" style="background:linear-gradient(90deg,#f0fff4,#f7fafc);">
          <h3 style="color:#276749;">📋 ${nameB} — ${fmt$(sizeB)}</h3>
          <span>${fmtPct(B.wtdYield)} yield · ${fmt$(B.totalDiv)}/yr</span>
        </div>
        <table><thead><tr><th>ETF</th><th>Weight</th><th>Yield</th><th>Annual Inc.</th><th>1Y Return</th></tr></thead>
        <tbody>${holdingTableB}</tbody>
        </table>
      </div>
    </div>
  `;
}

// Init compare search on load
initCompareSearch('A');
initCompareSearch('B');

