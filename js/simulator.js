async function calculatePortfolio() {
  const tickers = Object.keys(holdings);
  if (tickers.length === 0) { alert('Please add at least one ETF.'); return; }
  const totalAlloc = Object.values(holdings).reduce((a,b)=>a+b,0);
  if (totalAlloc > 100) { alert(`Total is ${totalAlloc}%. Please reduce to ≤100%.`); return; }

  const btn = document.getElementById('calcBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin" style="vertical-align:middle;margin-right:8px;"></span> Fetching live data…';

  // Ensure all tickers have fresh data
  if (serverOnline) {
    await Promise.all(tickers.map(t => ensureData(t)));
  }

  btn.disabled = false;
  btn.innerHTML = '⚡ Calculate Portfolio Performance';

  const portfolioSize = getPortfolioSize();
  let wtdYield=0, totalDivAnnual=0, weightedYTD=0, weighted3M=0, weighted6M=0, weighted1Y=0;
  const etfResults = [];

  tickers.forEach(t => {
    const d = ETF_DATA[t];
    if (!d) return;
    const w = holdings[t] / 100;
    const invested = portfolioSize * w;
    const shares = invested / d.price;

    const ytdReturn   = (d.price - d.ytd_start)     / d.ytd_start;
    const threeReturn = (d.price - d.three_m_start)  / d.three_m_start;
    const sixReturn   = (d.price - d.six_m_start)    / d.six_m_start;
    const oneYReturn  = (d.price - d.one_y_start)    / d.one_y_start;
    const annualDivIncome = shares * d.total_div_1y;
    const annualDivYield  = d.total_div_1y / d.price;
    const totalReturn1Y   = oneYReturn + (d.total_div_1y / d.one_y_start);
    const recentDiv = d.recent_divs.length > 0 ? d.recent_divs[d.recent_divs.length-1][1] : d.total_div_1y/12;

    weightedYTD   += ytdReturn   * w;
    weighted3M    += threeReturn * w;
    weighted6M    += sixReturn   * w;
    weighted1Y    += oneYReturn  * w;
    wtdYield      += annualDivYield * w;
    totalDivAnnual+= annualDivIncome;

    etfResults.push({ ticker:t, data:d, weight:holdings[t], invested, shares,
      ytdReturn, threeReturn, sixReturn, oneYReturn, totalReturn1Y,
      annualDivYield, annualDivIncome, recentDiv,
      source: ETF_SOURCE[t] || 'cache' });
  });

  const portfolioAllocated = portfolioSize * (totalAlloc / 100);
  const cashBuffer = portfolioSize * ((100 - totalAlloc) / 100);
  const totalReturn1Y = weighted1Y + (totalDivAnnual / portfolioAllocated);
  const liveCount = etfResults.filter(r => r.source === 'live').length;

  // Store for DRIP slider re-render; reset per-scenario overrides on fresh calc
  _lastEtfResults = etfResults;
  _lastPortfolioValue = portfolioAllocated;
  _scenarioOverrides = { bear: { price: null, div: null }, base: { price: null, div: null }, bull: { price: null, div: null } };

  renderResults(etfResults, portfolioSize, portfolioAllocated, totalDivAnnual, wtdYield,
    weightedYTD, weighted3M, weighted6M, weighted1Y, totalReturn1Y, cashBuffer, liveCount);
}

// ============================================================
// RENDER
// ============================================================
function renderResults(etfResults, portfolioSize, portfolioAllocated, totalDivAnnual, wtdYield,
    weightedYTD, weighted3M, weighted6M, weighted1Y, totalReturn1Y, cashBuffer, liveCount) {

  Object.values(charts).forEach(c => c.destroy());
  charts = {};
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('resultsPanel').style.display = 'block';

  const totalAlloc = Object.values(holdings).reduce((a,b)=>a+b,0);
  const dataNote = serverOnline
    ? `${liveCount}/${etfResults.length} ETFs live · ${etfResults.length - liveCount} cached`
    : `Offline mode · cached data (Mar 2026)`;

  document.getElementById('resultsPanel').innerHTML = `
    <!-- SUMMARY CARDS -->
    <div class="summary-cards">
      <div class="sc">
        <div class="sc-label">Portfolio Value</div>
        <div class="sc-value">${fmt$(portfolioSize)}</div>
        <div class="sc-sub">${fmt$(portfolioAllocated)} invested${cashBuffer>100?' · '+fmt$(cashBuffer)+' cash':''}</div>
      </div>
      <div class="sc">
        <div class="sc-label">Est. Annual Income</div>
        <div class="sc-value pos">${fmt$(totalDivAnnual)}</div>
        <div class="sc-sub">Blended yield: ${fmtPct(wtdYield)}</div>
      </div>
      <div class="sc">
        <div class="sc-label">Monthly / Daily Income</div>
        <div class="sc-value pos">${fmt$(totalDivAnnual/12)}</div>
        <div class="sc-sub">Daily: ${fmt$(totalDivAnnual/365)}</div>
      </div>
      <div class="sc">
        <div class="sc-label">1Y Total Return</div>
        <div class="sc-value ${colorClass(totalReturn1Y)}">${arrow(totalReturn1Y)} ${fmtPct(Math.abs(totalReturn1Y))}</div>
        <div class="sc-sub">Price only: ${arrow(weighted1Y)} ${fmtPct(Math.abs(weighted1Y))}</div>
      </div>
    </div>

    <!-- PRICE PERFORMANCE -->
    <div class="results-section">
      <div class="rs-header">
        <h3>📊 Price Performance by Period</h3>
        <span>${dataNote}</span>
      </div>
      <table>
        <thead><tr>
          <th>ETF</th><th>Weight</th><th>Invested</th>
          <th>YTD</th><th>3 Month</th><th>6 Month</th><th>1 Year</th>
        </tr></thead>
        <tbody>
          ${etfResults.map(r => `<tr>
            <td>
              <span class="tkbadge">${r.ticker}</span>
              ${r.source==='live' ? '<span class="sri-live-tag" style="font-size:9px;background:#22543d;color:#68d391;border:1px solid #276749;border-radius:3px;padding:1px 4px;margin-left:4px;">LIVE</span>' : ''}
              <span class="fname">${r.data.name.substring(0,38)}${r.data.name.length>38?'…':''}</span>
            </td>
            <td><span class="wbadge">${r.weight}%</span></td>
            <td>${fmt$(r.invested)}</td>
            <td class="${colorClass(r.ytdReturn)}">${arrow(r.ytdReturn)} ${fmtPct(Math.abs(r.ytdReturn))}</td>
            <td class="${colorClass(r.threeReturn)}">${arrow(r.threeReturn)} ${fmtPct(Math.abs(r.threeReturn))}</td>
            <td class="${colorClass(r.sixReturn)}">${arrow(r.sixReturn)} ${fmtPct(Math.abs(r.sixReturn))}</td>
            <td class="${colorClass(r.oneYReturn)}">${arrow(r.oneYReturn)} ${fmtPct(Math.abs(r.oneYReturn))}</td>
          </tr>`).join('')}
          <tr class="total-row">
            <td><span style="color:#a0aec0;">📊 PORTFOLIO WEIGHTED</span></td>
            <td><span class="wbadge">${totalAlloc}%</span></td>
            <td>${fmt$(portfolioAllocated)}</td>
            <td class="${colorClass(weightedYTD)}">${arrow(weightedYTD)} ${fmtPct(Math.abs(weightedYTD))}</td>
            <td class="${colorClass(weighted3M)}">${arrow(weighted3M)} ${fmtPct(Math.abs(weighted3M))}</td>
            <td class="${colorClass(weighted6M)}">${arrow(weighted6M)} ${fmtPct(Math.abs(weighted6M))}</td>
            <td class="${colorClass(weighted1Y)}">${arrow(weighted1Y)} ${fmtPct(Math.abs(weighted1Y))}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- DIVIDEND INCOME -->
    <div class="results-section">
      <div class="rs-header">
        <h3>💰 Dividend Income Analysis</h3>
        <span>Trailing 12 months · ${fmt$(portfolioSize)} portfolio</span>
      </div>
      <table>
        <thead><tr>
          <th>ETF</th><th>Freq</th><th>Annual Yield</th>
          <th>Annual Income</th><th>Monthly Income</th><th>Daily Income</th><th>Last Div</th>
        </tr></thead>
        <tbody>
          ${etfResults.map(r => `<tr>
            <td><span class="tkbadge">${r.ticker}</span><span class="fname">${r.data.category}</span></td>
            <td style="color:#a0aec0;text-transform:capitalize;">${r.data.divFreq}</td>
            <td class="pos" style="font-weight:700;">${fmtPct(r.annualDivYield)}</td>
            <td class="pos">${fmt$(r.annualDivIncome)}</td>
            <td class="pos">${fmt$(r.annualDivIncome/12)}</td>
            <td class="pos">${fmt$(r.annualDivIncome/365)}</td>
            <td>${fmt$(r.recentDiv)}</td>
          </tr>`).join('')}
          <tr class="total-row">
            <td><span style="color:#a0aec0;">📊 TOTAL</span></td>
            <td>—</td>
            <td class="pos" style="font-weight:700;">${fmtPct(wtdYield)}</td>
            <td class="pos">${fmt$(totalDivAnnual)}</td>
            <td class="pos">${fmt$(totalDivAnnual/12)}</td>
            <td class="pos">${fmt$(totalDivAnnual/365)}</td>
            <td>—</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- NAV EROSION & TOTAL RETURN -->
    <div class="results-section">
      <div class="rs-header">
        <h3>🧮 NAV Erosion & Total Return (1 Year)</h3>
        <span>Total Return = Price Change + Dividends Collected</span>
      </div>
      <table>
        <thead><tr>
          <th>ETF</th><th>1Y Ago Price</th><th>Current Price</th>
          <th>Price Change</th><th>Divs/Share (1Y)</th><th>NAV Change</th><th>Total Return</th>
        </tr></thead>
        <tbody>
          ${etfResults.map(r => {
            const priceChange = r.data.price - r.data.one_y_start;
            const isErosion = priceChange < 0;
            return `<tr>
              <td><span class="tkbadge">${r.ticker}</span></td>
              <td>${fmt$(r.data.one_y_start)}</td>
              <td>${fmt$(r.data.price)}</td>
              <td class="${colorClass(priceChange)}">${arrow(priceChange)} ${fmt$(Math.abs(priceChange))} (${fmtPct(Math.abs(r.oneYReturn))})</td>
              <td class="pos">+${fmt$(r.data.total_div_1y)}</td>
              <td><span class="nav-pill ${isErosion?'nav-bad':'nav-ok'}">
                ${isErosion ? '▼ '+fmt$(Math.abs(priceChange)) : '▲ '+fmt$(priceChange)}
              </span></td>
              <td class="${colorClass(r.totalReturn1Y)}" style="font-weight:700;">
                ${arrow(r.totalReturn1Y)} ${fmtPct(Math.abs(r.totalReturn1Y))}
              </td>
            </tr>`;
          }).join('')}
          <tr class="total-row">
            <td><span style="color:#a0aec0;">📊 PORTFOLIO</span></td>
            <td>—</td><td>—</td>
            <td class="${colorClass(weighted1Y)}">${arrow(weighted1Y)} ${fmtPct(Math.abs(weighted1Y))}</td>
            <td class="pos">+${fmt$(totalDivAnnual)} total</td>
            <td>—</td>
            <td class="${colorClass(totalReturn1Y)}" style="font-weight:700;">${arrow(totalReturn1Y)} ${fmtPct(Math.abs(totalReturn1Y))}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ===================== PROJECTION SECTION ===================== -->
    <div id="projectionContainer">${renderProjectionHTML(etfResults, portfolioAllocated)}</div>

    <!-- CHARTS -->
    <div class="charts-grid">
      <div class="chart-card"><h3>Portfolio Allocation</h3><div class="chart-box"><canvas id="allocChart"></canvas></div></div>
      <div class="chart-card"><h3>Annual Dividend Yield by ETF</h3><div class="chart-box"><canvas id="yieldChart"></canvas></div></div>
      <div class="chart-card"><h3>Price Return vs Total Return (1Y)</h3><div class="chart-box"><canvas id="returnChart"></canvas></div></div>
      <div class="chart-card"><h3>Projected Monthly Income</h3><div class="chart-box"><canvas id="incomeChart"></canvas></div></div>
    </div>
    <div class="charts-grid">
      <div class="chart-card" style="grid-column:1/-1;"><h3>📈 Portfolio Growth Projection — Base Scenario (Dividends Reinvested)</h3><div class="chart-box-tall"><canvas id="projChart"></canvas></div></div>
    </div>

    <!-- RECENT DIVIDENDS -->
    <div class="results-section">
      <div class="rs-header">
        <h3>📅 Recent Dividend Payments</h3>
        <span>Per-share · ex-date · your income</span>
      </div>
      <table>
        <thead><tr>
          <th>ETF</th>
          ${Array.from({length:8},(_,i)=>`<th>Pay ${8-i}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${etfResults.map(r => {
            const divs = r.data.recent_divs.slice(-8);
            const cells = Array.from({length:8}, (_,i) => {
              const idx = divs.length - 1 - (7 - i);
              const d = idx >= 0 ? divs[idx] : null;
              if (!d) return '<td style="color:#4a5568;">—</td>';
              return `<td>
                <div class="pos" style="font-weight:600;">${fmt$(d[1])}</div>
                <div style="font-size:10px;color:#718096;">${d[0].substring(5)}</div>
                <div style="font-size:10px;color:#4a5568;">${fmt$(r.shares * d[1])}</div>
              </td>`;
            });
            return `<tr>
              <td><span class="tkbadge">${r.ticker}</span><span class="fname">${r.weight}% · ${fmt$(r.invested)}</span></td>
              ${cells.join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <div style="padding:10px 16px;font-size:11px;color:#4a5568;">Per-share · ex-date · your portfolio income from that payment</div>
    </div>

    <div class="data-footer">
      ${serverOnline
        ? `⚡ Live data from Yahoo Finance via ${API} · ${liveCount}/${etfResults.length} ETFs refreshed`
        : `📦 Offline mode · built-in data as of March 2, 2026 · run cc_simulator_server.py for live quotes`}
      &nbsp;·&nbsp; Past performance does not guarantee future results
    </div>
    <div class="fin-disclaimer">
      ⚠️ <strong>Financial Disclaimer:</strong> I am not a financial advisor. This simulator is for educational purposes only.
      Tax laws vary by state/country. Past performance does not guarantee future results. Always consult a qualified financial or tax professional before making investment decisions.
    </div>
  `;

  setTimeout(() => renderCharts(etfResults, totalDivAnnual), 50);
}

// ============================================================
// PROJECTION LOGIC
// ============================================================
function getProjData(ticker) {
  if (PROJ[ticker]) return PROJ[ticker];
  // Live-fetched ETF: derive from its stored data
  const d = ETF_DATA[ticker];
  if (d) return buildProjFromLive(d);
  return { price_cagr:0.08, div_yield:0.08, basis_years:1, basis:'Estimated', underlying_cagr:0.15 };
}

// ============================================================
// CORRECT PROJECTION MODEL
//
// Two scenarios:
//   reinvest=true  → compound the total_cagr (price + divs reinvested)
//                    value(t) = start × (1 + wtdTotalCagr × scenario_adj)^t
//   reinvest=false → price grows at price_cagr, dividends taken as cash
//                    price_value(t) = start × (1 + wtdPriceCagr × adj)^t
//                    income(t) = price_value(t) × wtdDivYield
//
// scenario_adj scales the total_cagr for bear/base/bull without
// double-compounding the yield component.
// ============================================================
function projectPortfolio(etfResults, startValue, years, total_cagr_adj, reinvest, dripPct, rateOverride) {
  // dripPct: 0.0 = all income taken as cash, 1.0 = all reinvested (legacy reinvest=true === dripPct=1)
  if (dripPct === undefined) dripPct = reinvest ? 1.0 : 0.0;
  let wtdTotalCagr = 0;
  let wtdPriceCagr = 0;
  let wtdDivYield  = 0;
  const totalW = etfResults.reduce((a,r) => a + r.weight, 0) || 100;

  etfResults.forEach(r => {
    const p = getProjData(r.ticker);
    const w = r.weight / totalW;
    wtdTotalCagr += p.total_cagr * w;
    wtdPriceCagr += p.price_cagr * w;
    wtdDivYield  += p.div_yield  * w;
  });

  // If per-scenario overrides provided, use them directly; otherwise apply scenario adj
  let adjPrice, adjDiv;
  if (rateOverride && rateOverride.price !== null && rateOverride.div !== null) {
    adjPrice = rateOverride.price;
    adjDiv   = rateOverride.div;
  } else if (rateOverride && rateOverride.price !== null) {
    adjPrice = rateOverride.price;
    adjDiv   = wtdDivYield * Math.pow(total_cagr_adj, 0.5);
  } else if (rateOverride && rateOverride.div !== null) {
    adjPrice = wtdPriceCagr * total_cagr_adj;
    adjDiv   = rateOverride.div;
  } else {
    adjPrice = wtdPriceCagr * total_cagr_adj;
    adjDiv   = wtdDivYield  * Math.pow(total_cagr_adj, 0.5);
  }
  const adjTotal = adjPrice + adjDiv;

  // DRIP blending: effective growth rate is between price-only and total-return,
  // depending on what fraction of dividends are reinvested.
  // effectiveCagr = adjPrice + dripPct * adjDiv  (partial reinvestment)
  // income fraction = (1 - dripPct) of dividends, paid on the growing NAV base
  const effectiveCagr = adjPrice + dripPct * adjDiv;

  const yearlyData = [{
    year:0, drip_value:startValue, price_value:startValue,
    income_annual:startValue * adjDiv * (1 - dripPct), total_value:startValue, cumulative_income:0
  }];
  let cumulativeIncome = 0;

  for (let y = 1; y <= years; y++) {
    // Portfolio value grows at blended rate (price + reinvested portion of div)
    const portfolioValue = startValue * Math.pow(1 + effectiveCagr, y);
    // NAV track for income base: use price-only growth (income paid on NAV, not on reinvested gains)
    const priceValue = startValue * Math.pow(1 + adjPrice, y);
    // Cash income = non-reinvested portion of div yield × price-only NAV
    const income = priceValue * adjDiv * (1 - dripPct);
    cumulativeIncome += income;
    // For legacy compatibility keep drip_value as full-reinvest value
    const dripValue = startValue * Math.pow(1 + adjTotal, y);
    yearlyData.push({ year:y, drip_value:dripValue, price_value:priceValue,
      income_annual:income, total_value:portfolioValue, cumulative_income:cumulativeIncome });
  }

  return { yearlyData, wtdTotalCagr: adjTotal, wtdPriceCagr: adjPrice, wtdDivYield: adjDiv };
}

function reRenderProjection() {
  if (!_lastEtfResults) return;
  const container = document.getElementById('projectionContainer');
  if (!container) return;
  container.innerHTML = renderProjectionHTML(_lastEtfResults, _lastPortfolioValue);
}

function renderProjectionHTML(etfResults, startValue) {
  // Three scenarios scaling the total_cagr
  // Bear: 70% of historical total return | Base: 100% | Bull: 130%
  const MILESTONES = [1, 5, 10, 15];
  const scenarios = [
    { id:'bear', label:'🐻 Bear Case', desc:'', adj:0.70 },
    { id:'base', label:'📊 Base Case', desc:'', adj:1.00 },
    { id:'bull', label:'🐂 Bull Case', desc:'', adj:1.30 },
  ];

  // Read current DRIP % from slider (default 100% if not yet rendered)
  const dripSlider = document.getElementById('dripSlider');
  const dripPct = dripSlider ? parseInt(dripSlider.value) / 100 : 1.0;

  // Compute raw weighted rates directly from ETF data (unscaled, for slider defaults)
  const totalW = etfResults.reduce((a,r) => a + r.weight, 0) || 100;
  let rawPriceCagr = 0, rawDivYield = 0;
  etfResults.forEach(r => {
    const p = getProjData(r.ticker);
    const w = r.weight / totalW;
    rawPriceCagr += p.price_cagr * w;
    rawDivYield  += p.div_yield  * w;
  });
  const basePriceRate = rawPriceCagr;
  const baseDivRate   = rawDivYield;

  const computed = scenarios.map(s => {
    // Default rates for this scenario (what we'd use without override)
    const defPrice = basePriceRate * s.adj;
    const defDiv   = baseDivRate   * Math.pow(s.adj, 0.5);
    // Read overrides (or fall back to defaults)
    const ovr = _scenarioOverrides[s.id];
    const usePrice = (ovr && ovr.price !== null) ? ovr.price : defPrice;
    const useDiv   = (ovr && ovr.div   !== null) ? ovr.div   : defDiv;
    const adjRate  = usePrice + useDiv;
    const desc = `${(adjRate*100).toFixed(1)}% total · ${(usePrice*100).toFixed(1)}% price + ${(useDiv*100).toFixed(1)}% div`;
    const proj = projectPortfolio(etfResults, startValue, 15, s.adj, true, dripPct,
      { price: usePrice, div: useDiv });
    return { ...s, desc, proj, defPrice, defDiv, usePrice, useDiv };
  });

  // Weighted avg rates for base display
  const base = computed[1].proj;

  // Build per-ETF projection table rows
  const etfRows = etfResults.map(r => {
    const p = getProjData(r.ticker);
    const w = r.weight;
    const invested = startValue * w / 100;
    // Use DRIP-blended rate: price_cagr + dripPct × div_yield
    const blendedCagr = p.price_cagr + dripPct * p.div_yield;
    const v1  = invested * Math.pow(1 + blendedCagr, 1);
    const v5  = invested * Math.pow(1 + blendedCagr, 5);
    const v10 = invested * Math.pow(1 + blendedCagr, 10);
    const v15 = invested * Math.pow(1 + blendedCagr, 15);
    const srcClass = p.basis_years >= 9 ? 'src-10y' : p.basis_years >= 3 ? 'src-full' : 'src-bm';
    const srcLabel = p.basis_years >= 9 ? '10YR' : p.basis_years >= 3 ? `${p.basis_years.toFixed(0)}YR` : 'MODEL';
    const specWarning = p.basis.includes('⚠') ? ' ⚠' : '';
    return `<tr>
      <td><span class="tkbadge">${r.ticker}</span><span class="data-src-tag ${srcClass}">${srcLabel}</span>
          <span class="fname" style="font-size:10px;">${p.basis}</span></td>
      <td><span class="wbadge">${w}%</span></td>
      <td>${fmt$(invested)}</td>
      <td style="color:#a0aec0;">${(p.price_cagr*100).toFixed(1)}%</td>
      <td style="color:#68d391;">${(p.div_yield*100).toFixed(1)}%</td>
      <td style="color:#63b3ed;font-weight:600;">${(p.total_cagr*100).toFixed(1)}%</td>
      <td class="pos">${fmt$(v1)}</td>
      <td class="pos">${fmt$(v5)}</td>
      <td class="pos" style="font-weight:700;">${fmt$(v10)}</td>
      <td class="pos" style="font-weight:700;">${fmt$(v15)}</td>
    </tr>`;
  }).join('');

  // Milestone cards HTML
  const scenarioHTML = computed.map(s => {
    const milestoneHTML = MILESTONES.map(yr => {
      const pt = s.proj.yearlyData[yr];
      const gain = ((pt.total_value - startValue) / startValue * 100).toFixed(0);
      const monthly = (pt.income_annual / 12);
      return `<div class="proj-milestone">
        <div>
          <div class="proj-year">${yr === 1 ? 'First Year' : yr + ' Years'}</div>
          <div class="proj-gain ${s.id==='bear'?'neg':s.id==='bull'?'pos':''}">+${gain}% · ${fmt$(monthly)}/mo income</div>
        </div>
        <div class="proj-value">${fmt$(pt.total_value)}</div>
      </div>`;
    }).join('');

    // Rate sliders
    const priceVal = Math.round(s.usePrice * 1000) / 10;   // e.g. 0.105 → 10.5
    const divVal   = Math.round(s.useDiv   * 1000) / 10;
    const defPriceVal = Math.round(s.defPrice * 1000) / 10;
    const defDivVal   = Math.round(s.defDiv   * 1000) / 10;
    const priceIsOverridden = Math.abs(priceVal - defPriceVal) > 0.05;
    const divIsOverridden   = Math.abs(divVal   - defDivVal)   > 0.05;
    const sid = s.id;

    const rateSliders = `
      <div class="scenario-rate-ctrl">
        <div class="scenario-rate-row">
          <span class="scenario-rate-label price-label">📈 Price CAGR</span>
          <input type="range" class="scenario-rate-slider price-slider"
            min="-10" max="40" step="0.5" value="${priceVal}"
            oninput="
              const pv = parseFloat(this.value);
              document.getElementById('price-disp-${sid}').textContent = pv.toFixed(1) + '%';
              _scenarioOverrides['${sid}'].price = pv / 100;
              clearTimeout(window._scenarioTimer);
              window._scenarioTimer = setTimeout(() => reRenderProjection(), 250);
            " />
          <span class="scenario-rate-val${priceIsOverridden?' overridden':''}" id="price-disp-${sid}">${priceVal.toFixed(1)}%</span>
          <button class="scenario-rate-reset" title="Reset to default"
            onclick="_scenarioOverrides['${sid}'].price=null; reRenderProjection();">↺</button>
        </div>
        <div class="scenario-rate-row">
          <span class="scenario-rate-label div-label">💰 Div Yield</span>
          <input type="range" class="scenario-rate-slider div-slider"
            min="0" max="50" step="0.5" value="${divVal}"
            oninput="
              const dv = parseFloat(this.value);
              document.getElementById('div-disp-${sid}').textContent = dv.toFixed(1) + '%';
              _scenarioOverrides['${sid}'].div = dv / 100;
              clearTimeout(window._scenarioTimer);
              window._scenarioTimer = setTimeout(() => reRenderProjection(), 250);
            " />
          <span class="scenario-rate-val${divIsOverridden?' overridden':''}" id="div-disp-${sid}">${divVal.toFixed(1)}%</span>
          <button class="scenario-rate-reset" title="Reset to default"
            onclick="_scenarioOverrides['${sid}'].div=null; reRenderProjection();">↺</button>
        </div>
        <div class="scenario-rate-default">Default: ${defPriceVal.toFixed(1)}% price · ${defDivVal.toFixed(1)}% div</div>
      </div>`;

    return `<div class="proj-scenario ${s.id}">
      <div class="proj-scenario-label">${s.label}</div>
      ${rateSliders}
      ${milestoneHTML}
    </div>`;
  }).join('');

  // Income projection at year 10 base
  const y10base = computed[1].proj.yearlyData[10];
  const y10bear = computed[0].proj.yearlyData[10];
  const y10bull = computed[2].proj.yearlyData[10];
  const annualInc10 = y10base.income_annual;

  // DRIP description helper
  const dripPctDisplay = Math.round(dripPct * 100);
  const incomePctDisplay = 100 - dripPctDisplay;
  const dripDescText = dripPctDisplay === 100 ? 'All dividends reinvested'
    : dripPctDisplay === 0  ? 'All dividends taken as income'
    : `${dripPctDisplay}% reinvested · ${incomePctDisplay}% taken as income`;

  return `
  <div class="proj-section">
    <div class="proj-header">
      <h3>🔮 Portfolio Value Projection — 5, 10 & 15 Years</h3>
      <p>Based on historical price CAGR + dividend yield per ETF · Three scenarios shown</p>
      <div class="drip-control">
        <span class="drip-label">DRIP %</span>
        <input type="range" class="drip-slider" id="dripSlider" min="0" max="100" step="5"
          value="${dripPctDisplay}"
          style="--drip-pct:${dripPctDisplay}%"
          oninput="
            this.style.setProperty('--drip-pct', this.value + '%');
            document.getElementById('dripPctDisplay').textContent = this.value + '%';
            const ip = 100 - parseInt(this.value);
            document.getElementById('dripDescText').textContent =
              this.value == 100 ? 'All dividends reinvested' :
              this.value == 0   ? 'All dividends taken as income' :
              this.value + '% reinvested · ' + ip + '% as income';
            clearTimeout(window._dripTimer);
            window._dripTimer = setTimeout(() => reRenderProjection(), 300);
          " />
        <span class="drip-pct-display" id="dripPctDisplay">${dripPctDisplay}%</span>
        <span class="drip-desc" id="dripDescText">${dripDescText}</span>
      </div>
    </div>

    <!-- Scenario columns -->
    <div class="proj-scenarios">${scenarioHTML}</div>

    <!-- Income summary at year 10 -->
    <div class="proj-income-row">
      <div class="proj-income-cell">
        <div class="proj-income-label">Year 10 Annual Income (Base)</div>
        <div class="proj-income-value">${fmt$(annualInc10)}</div>
        <div class="proj-income-sub">${fmt$(annualInc10/12)}/month</div>
      </div>
      <div class="proj-income-cell">
        <div class="proj-income-label">Year 10 Monthly (Bear)</div>
        <div class="proj-income-value" style="color:#fc8181;">${fmt$(y10bear.income_annual/12)}</div>
        <div class="proj-income-sub">Bear scenario</div>
      </div>
      <div class="proj-income-cell">
        <div class="proj-income-label">Year 10 Monthly (Bull)</div>
        <div class="proj-income-value">${fmt$(y10bull.income_annual/12)}</div>
        <div class="proj-income-sub">Bull scenario</div>
      </div>
      <div class="proj-income-cell">
        <div class="proj-income-label">Blended Portfolio Rate</div>
        <div class="proj-income-value" style="color:#a0aec0;">${(base.wtdPriceCagr*100).toFixed(1)}% + ${(base.wtdDivYield*100).toFixed(1)}%</div>
        <div class="proj-income-sub">Price CAGR + Div Yield</div>
      </div>
    </div>

    <!-- Per-ETF breakdown -->
    <div style="border-top:1px solid #2d3748;">
      <div style="padding:12px 20px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#718096;">Per-ETF Projection Breakdown (Base · DRIP ${dripPctDisplay}%)</div>
      <table class="proj-etf-table">
        <thead><tr>
          <th>ETF &amp; Data Basis</th><th>Weight</th><th>Invested</th>
          <th>Price CAGR</th><th>Div Yield</th><th>Total Rate</th>
          <th>1 Year</th><th>5 Years</th><th>10 Years</th><th>15 Years</th>
        </tr></thead>
        <tbody>${etfRows}</tbody>
      </table>
    </div>

    <div class="proj-assumptions">
      <strong>Methodology:</strong>
      ETFs with ≥9yr history use their own 10-year price CAGR + average annual dividend yield.
      Newer ETFs use their full available history; single-stock YieldMax ETFs use ETF history with conservative NAV decay assumptions.
      ETFs &lt;3yr old use their underlying index's 10-year CAGR adjusted for covered call premium drag (~2–4%).
      <span class="data-src-tag src-10y" style="margin:0 2px;">10YR</span> = 10yr ETF data &nbsp;
      <span class="data-src-tag src-full" style="margin:0 2px;">NYR</span> = N years ETF data &nbsp;
      <span class="data-src-tag src-bm" style="margin:0 2px;">MODEL</span> = index-based model.
      <strong>Not financial advice. Past performance does not guarantee future results.</strong>
    </div>
  </div>`;
}

// ============================================================
// CHARTS
// ============================================================
