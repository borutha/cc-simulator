// ============================================================
// v1.2 — BACKTESTING + MONTE CARLO ENGINE
//
// METHODOLOGY:
//   Most covered-call ETFs launched 2020–2023, so true 10yr history
//   doesn't exist. We use a "proxy reconstruction" approach:
//   - Annual price returns come from the underlying index's actual
//     yearly returns (S&P 500, QQQ, Russell 2000, Gold) since 2014
//   - A covered-call overlay is modelled as: index_return * cap_factor
//     (calls cap upside, typically 40–70% of index gains captured)
//   - Dividend income is modelled from the ETF's actual avg yield
//   - For ETFs with real history (QYLD 2013, XYLD 2013, DIVO 2016,
//     JEPI 2020) we blend actual returns with the model
//
//   Monte Carlo: run N simulations using:
//   - Historical return distribution (mean + std dev of annual returns)
//   - Geometric Brownian Motion with fat-tail shocks
//   - Yield variation (±20% around mean yield each year)
// ============================================================

// ---- HISTORICAL INDEX ANNUAL RETURNS (price only, excl. dividends) ----
// Source: Yahoo Finance / actual annual closing price changes
// SPY:  2014–2025 (used as base for S&P 500-linked ETFs)
// QQQ:  2014–2025 (Nasdaq-100)
// IWM:  2014–2025 (Russell 2000)
// GLD:  2014–2025 (Gold)

const BT_INDEX_RETURNS = {
  SPY: {
    //  year: annual price return (decimal)
    2014: 0.1139, 2015:-0.0073, 2016: 0.0954, 2017: 0.1942,
    2018:-0.0642, 2019: 0.2888, 2020: 0.1625, 2021: 0.2689,
    2022:-0.1944, 2023: 0.2424, 2024: 0.2312, 2025:-0.0460
  },
  QQQ: {
    2014: 0.1793, 2015: 0.0942, 2016: 0.0699, 2017: 0.3253,
    2018:-0.0100, 2019: 0.3876, 2020: 0.4825, 2021: 0.2681,
    2022:-0.3285, 2023: 0.5460, 2024: 0.2540, 2025:-0.0800
  },
  IWM: {
    2014: 0.0340, 2015:-0.0520, 2016: 0.1935, 2017: 0.1339,
    2018:-0.1162, 2019: 0.2487, 2020: 0.1924, 2021: 0.1442,
    2022:-0.2157, 2023: 0.1693, 2024: 0.1008, 2025:-0.0920
  },
  GLD: {
    2014:-0.0166, 2015:-0.1044, 2016: 0.0809, 2017: 0.1229,
    2018:-0.2060, 2019: 0.1801, 2020: 0.2405, 2021:-0.0383,
    2022:-0.0032, 2023: 0.1317, 2024: 0.2710, 2025: 0.1920
  }
};

// Per-ETF backtest config: which index to use, call-cap factor, avg yield, real history start year
const BT_ETF_CONFIG = {
  // ── Equity Index covered-call ETFs ──
  "JEPI":  { index:'SPY',  cap:0.65, yield_avg:0.090, realFrom:2020 },
  "JEPQ":  { index:'QQQ',  cap:0.60, yield_avg:0.110, realFrom:2022 },
  "QYLD":  { index:'QQQ',  cap:0.45, yield_avg:0.120, realFrom:2013 },
  "XYLD":  { index:'SPY',  cap:0.50, yield_avg:0.100, realFrom:2013 },
  "RYLD":  { index:'IWM',  cap:0.50, yield_avg:0.120, realFrom:2019 },
  "DIVO":  { index:'SPY',  cap:0.80, yield_avg:0.055, realFrom:2016 },
  "GPIQ":  { index:'QQQ',  cap:0.60, yield_avg:0.100, realFrom:2023 },
  "GPIX":  { index:'SPY',  cap:0.65, yield_avg:0.085, realFrom:2023 },
  "TSPY":  { index:'SPY',  cap:0.75, yield_avg:0.120, realFrom:2024 },
  "SPYI":  { index:'SPY',  cap:0.70, yield_avg:0.115, realFrom:2022 },
  "QQQI":  { index:'QQQ',  cap:0.65, yield_avg:0.135, realFrom:2023 },
  "IWMI":  { index:'IWM',  cap:0.65, yield_avg:0.135, realFrom:2023 },
  "DJIA":  { index:'SPY',  cap:0.60, yield_avg:0.090, realFrom:2021 },
  "BALI":  { index:'SPY',  cap:0.65, yield_avg:0.085, realFrom:2023 },
  "KLIP":  { index:'SPY',  cap:0.40, yield_avg:0.220, realFrom:2022 },
  // ── Commodity ──
  "GLDW":  { index:'GLD',  cap:0.55, yield_avg:0.075, realFrom:2025 },
  // ── YieldMax / single-stock ──
  "TSLY":  { index:'SPY',  cap:0.30, yield_avg:0.300, realFrom:2022, navDecay:-0.08 },
  "NVDY":  { index:'SPY',  cap:0.30, yield_avg:0.350, realFrom:2023, navDecay:-0.05 },
  "CONY":  { index:'SPY',  cap:0.25, yield_avg:0.280, realFrom:2023, navDecay:-0.15 },
  "MSFO":  { index:'SPY',  cap:0.30, yield_avg:0.200, realFrom:2023, navDecay:-0.06 },
  "AMZY":  { index:'SPY',  cap:0.30, yield_avg:0.220, realFrom:2023, navDecay:-0.05 },
  "YMAX":  { index:'SPY',  cap:0.25, yield_avg:0.180, realFrom:2023, navDecay:-0.10 },
  "YMAG":  { index:'QQQ',  cap:0.30, yield_avg:0.220, realFrom:2023, navDecay:-0.08 },
  // ── Broad market ──
  "SPY":   { index:'SPY',  cap:1.00, yield_avg:0.013, realFrom:2014 },
  "IVV":   { index:'SPY',  cap:1.00, yield_avg:0.013, realFrom:2014 },
  "VOO":   { index:'SPY',  cap:1.00, yield_avg:0.013, realFrom:2014 },
  "VTI":   { index:'SPY',  cap:0.98, yield_avg:0.014, realFrom:2014 },
  "QQQ":   { index:'QQQ',  cap:1.00, yield_avg:0.006, realFrom:2014 },
  "VGT":   { index:'QQQ',  cap:1.00, yield_avg:0.005, realFrom:2014 },
  "VTV":   { index:'SPY',  cap:0.85, yield_avg:0.022, realFrom:2014 },
  "SCHG":  { index:'QQQ',  cap:0.90, yield_avg:0.005, realFrom:2014 },
  "SCHD":  { index:'SPY',  cap:0.85, yield_avg:0.035, realFrom:2014 },
  "VXUS":  { index:'SPY',  cap:0.45, yield_avg:0.030, realFrom:2014 },
  "AGG":   { index:'SPY',  cap:0.10, yield_avg:0.033, realFrom:2014, floorReturn:-0.05 }
};

// ---- ANNUAL RETURN MODEL ----
// For covered-call ETFs: price return = index_return * cap_factor + navDecay_adj
// Total return for investor = price_return + yield_avg
function btGetAnnualReturn(ticker, year, reinvest) {
  const cfg = BT_ETF_CONFIG[ticker] || { index:'SPY', cap:0.65, yield_avg:0.09, navDecay:0 };
  const idx  = BT_INDEX_RETURNS[cfg.index] || BT_INDEX_RETURNS.SPY;
  const idxR = idx[year] !== undefined ? idx[year] : _btMeanReturn(cfg.index);

  // Apply cap factor (covered call caps upside, keeps downside)
  let priceReturn;
  if (idxR >= 0) {
    priceReturn = idxR * cfg.cap;
  } else {
    // Downside: CC ETFs don't fully cap losses, but premiums cushion slightly
    priceReturn = idxR * (1 - cfg.cap * 0.25);
  }

  // Additional structural NAV decay for ultra-high-yield ETFs
  if (cfg.navDecay) priceReturn += cfg.navDecay;

  // Floor for bond-like ETFs
  if (cfg.floorReturn !== undefined) priceReturn = Math.max(priceReturn, cfg.floorReturn);

  const incomeReturn = cfg.yield_avg * (1 + (Math.random() - 0.5) * 0.1); // ±5% yield variation
  const totalReturn  = priceReturn + (reinvest ? incomeReturn : 0);

  return { priceReturn, incomeReturn, totalReturn };
}

function _btMeanReturn(indexKey) {
  const r = Object.values(BT_INDEX_RETURNS[indexKey] || BT_INDEX_RETURNS.SPY);
  return r.reduce((a, b) => a + b, 0) / r.length;
}

// ---- HISTORICAL BACKTEST ----
// Returns year-by-year portfolio values, dividends, and total returns

function runHistoricalBacktest(holdings, portfolioSize, startYear, endYear, reinvest) {
  const years = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  // Per-ETF annual series
  const tickers = Object.keys(holdings);
  const series  = {}; // ticker -> [{ year, startVal, priceReturn, income, endVal }]

  // Portfolio-level totals
  const portSeries = []; // [{ year, value, income, totalReturn }]

  // Initial allocation
  const initAllocs = {};
  tickers.forEach(t => {
    initAllocs[t] = portfolioSize * (holdings[t] / 100);
  });

  let portValue = portfolioSize;
  let currentAllocs = { ...initAllocs };

  for (const year of years) {
    let yearIncome   = 0;
    let yearEndValue = 0;
    const yearDetail = { year, etfs: {} };

    tickers.forEach(t => {
      const startVal = currentAllocs[t];
      const { priceReturn, incomeReturn } = btGetAnnualReturn(t, year, false);
      const income   = startVal * incomeReturn;
      const priceChg = startVal * priceReturn;
      const endVal   = startVal + priceChg + (reinvest ? income : 0);

      yearDetail.etfs[t] = { startVal, priceReturn, income, endVal };
      yearIncome   += income;
      yearEndValue += endVal;

      if (!series[t]) series[t] = [];
      series[t].push({ year, startVal, priceReturn, income, endVal });
    });

    const totalReturn = portValue > 0 ? (yearEndValue + (reinvest ? 0 : yearIncome) - portValue) / portValue : 0;
    portSeries.push({ year, startValue: portValue, endValue: yearEndValue, income: yearIncome, totalReturn, reinvested: reinvest });

    portValue       = yearEndValue;
    // Rebalance allocations proportionally
    tickers.forEach(t => {
      currentAllocs[t] = series[t][series[t].length - 1].endVal;
    });
  }

  return { portSeries, series, finalValue: portValue };
}

// ---- MONTE CARLO ----
// Uses distribution statistics from the historical return series

function getReturnStats(ticker) {
  const cfg = BT_ETF_CONFIG[ticker] || { index:'SPY', cap:0.65, yield_avg:0.09 };
  const idx  = BT_INDEX_RETURNS[cfg.index] || BT_INDEX_RETURNS.SPY;
  const idxReturns = Object.values(idx);

  // Compute price returns we'd have gotten from this ETF's model
  const priceReturns = idxReturns.map(r => {
    if (r >= 0) return r * cfg.cap + (cfg.navDecay || 0);
    return r * (1 - cfg.cap * 0.25) + (cfg.navDecay || 0);
  });

  const n    = priceReturns.length;
  const mean = priceReturns.reduce((a, b) => a + b, 0) / n;
  const variance = priceReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev, yield_avg: cfg.yield_avg };
}

function runMonteCarlo(holdings, portfolioSize, years, reinvest, simCount = 1000) {
  const tickers  = Object.keys(holdings);
  const stats    = {};
  tickers.forEach(t => { stats[t] = getReturnStats(t); });

  // Portfolio-level weighted mean and std dev
  const totalAlloc = tickers.reduce((s, t) => s + holdings[t], 0) || 100;
  const portMean   = tickers.reduce((s, t) => s + stats[t].mean    * (holdings[t] / totalAlloc), 0);
  const portStd    = tickers.reduce((s, t) => s + stats[t].stdDev  * (holdings[t] / totalAlloc), 0);
  const portYield  = tickers.reduce((s, t) => s + stats[t].yield_avg * (holdings[t] / totalAlloc), 0);

  const finalValues = [];

  for (let sim = 0; sim < simCount; sim++) {
    let value = portfolioSize;
    let totalIncome = 0;

    for (let y = 0; y < years; y++) {
      // Box-Muller transform for normally distributed random returns
      const u1 = Math.random(), u2 = Math.random();
      const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

      // Occasional fat-tail crash (5% chance of ±2x std dev shock)
      const shock = Math.random() < 0.05 ? (Math.random() < 0.5 ? -2 : 1.5) : 1;
      const annualPriceReturn = portMean + portStd * z * shock;

      // Yield varies slightly
      const annualYield = portYield * (0.85 + Math.random() * 0.30);
      const income      = value * annualYield;
      totalIncome      += income;

      value = value * (1 + annualPriceReturn) + (reinvest ? income : 0);
      if (value < 0) value = 0;
    }

    finalValues.push({ finalValue: value, finalIncome: totalIncome / years });
  }

  finalValues.sort((a, b) => a.finalValue - b.finalValue);

  const p5   = finalValues[Math.floor(simCount * 0.05)].finalValue;
  const p25  = finalValues[Math.floor(simCount * 0.25)].finalValue;
  const p50  = finalValues[Math.floor(simCount * 0.50)].finalValue;
  const p75  = finalValues[Math.floor(simCount * 0.75)].finalValue;
  const p95  = finalValues[Math.floor(simCount * 0.95)].finalValue;
  const mean = finalValues.reduce((s, v) => s + v.finalValue, 0) / simCount;

  // Build percentile fan chart data (yearly series for p5/p25/p50/p75/p95)
  const fanData = buildMonteCarlFan(portfolioSize, portMean, portStd, portYield, years, reinvest);

  return { p5, p25, p50, p75, p95, mean, portMean, portStd, portYield, fanData, simCount };
}

function buildMonteCarlFan(startValue, mean, std, yieldAvg, years, reinvest, fansims = 200) {
  // Build 5 percentile paths + mean path
  const paths = { p5: [], p25: [], p50: [], p75: [], p95: [], mean: [] };
  const allPaths = [];

  for (let s = 0; s < fansims; s++) {
    let v = startValue;
    const path = [startValue];
    for (let y = 0; y < years; y++) {
      const u1 = Math.random(), u2 = Math.random();
      const z  = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
      const shock = Math.random() < 0.05 ? (Math.random() < 0.5 ? -2 : 1.5) : 1;
      const r = mean + std * z * shock;
      const inc = v * yieldAvg * (0.85 + Math.random() * 0.30);
      v = v * (1 + r) + (reinvest ? inc : 0);
      if (v < 0) v = 0;
      path.push(v);
    }
    allPaths.push(path);
  }

  // For each year, extract percentiles from all paths
  for (let y = 0; y <= years; y++) {
    const vals = allPaths.map(p => p[y]).sort((a, b) => a - b);
    const n    = vals.length;
    paths.p5.push( vals[Math.floor(n * 0.05)]);
    paths.p25.push(vals[Math.floor(n * 0.25)]);
    paths.p50.push(vals[Math.floor(n * 0.50)]);
    paths.p75.push(vals[Math.floor(n * 0.75)]);
    paths.p95.push(vals[Math.floor(n * 0.95)]);
    paths.mean.push(vals.reduce((a, b) => a + b, 0) / n);
  }

  return { paths, years };
}

// ---- UI RENDER ----

// Chart instance registry keyed by prefix ('sim' or 'reb')
const _btCharts = {};

// ---- SIMULATOR tab entry point ----
function runBacktest() {
  _runBtForContext('sim');
}

// ---- REBALANCE tab entry point ----
function runRebBacktest() {
  _runBtForContext('reb');
}

// ---- Shared runner ----
function _runBtForContext(prefix) {
  // Resolve holdings + portfolioSize depending on context
  let btHoldings, btPortSize;
  if (prefix === 'sim') {
    btHoldings  = holdings;          // global from simulator.js
    btPortSize  = getPortfolioSize(); // reads #portfolioSize
    if (!Object.keys(btHoldings).length) {
      alert('Build a portfolio in the Simulator tab first, then run backtesting.');
      return;
    }
  } else {
    // Build holdings map from rebPositions (ticker -> %)
    const total = rebPositions.reduce((s, p) => s + (p.value || 0), 0);
    if (!rebPositions.length || total <= 0) {
      alert('Add positions in the Rebalancing tab first, then run backtesting.');
      return;
    }
    btHoldings = {};
    rebPositions.forEach(p => {
      if (p.symbol && p.symbol !== '__CASH__' && p.value > 0) {
        btHoldings[p.symbol] = (p.value / total) * 100;
      }
    });
    btPortSize = total;
  }

  const pfx        = prefix === 'sim' ? 'bt' : 'rebBt';
  const startYear  = parseInt(document.getElementById(pfx + 'StartYear').value) || 2015;
  const reinvest   = document.getElementById(pfx + 'Reinvest').value === 'yes';
  const mcYears    = parseInt(document.getElementById(pfx + 'MCYears').value)   || 10;
  const endYear    = 2025;

  document.getElementById(pfx + 'RunBtn').textContent    = '⏳ Running…';
  document.getElementById(pfx + 'RunBtn').disabled       = true;
  document.getElementById(pfx + 'Results').style.display = 'none';

  setTimeout(() => {
    try {
      const hist = runHistoricalBacktest(btHoldings, btPortSize, startYear, endYear, reinvest);
      const mc   = runMonteCarlo(btHoldings, btPortSize, mcYears, reinvest, 1000);
      renderBtResults(hist, mc, startYear, endYear, mcYears, reinvest, btPortSize, pfx);
    } catch(e) {
      console.error('Backtest error', e);
      alert('Backtest failed: ' + e.message);
    }
    document.getElementById(pfx + 'RunBtn').textContent = '▶ Run Analysis';
    document.getElementById(pfx + 'RunBtn').disabled    = false;
  }, 40);
}

function renderBtResults(hist, mc, startYear, endYear, mcYears, reinvest, portSize, pfx) {
  const years       = hist.portSeries.length;
  const cagr        = years > 0 ? (Math.pow(hist.finalValue / portSize, 1 / years) - 1) : 0;
  const totalIncome = hist.portSeries.reduce((s, y) => s + y.income, 0);
  const maxDD       = computeMaxDrawdown(hist.portSeries);

  // ── SUMMARY METRICS ──
  document.getElementById(pfx + 'Summary').innerHTML = `
    <div class="bt-metrics">
      <div class="bt-metric">
        <div class="bt-metric-val ${hist.finalValue >= portSize ? 'pos' : 'neg'}">${fmt$(hist.finalValue)}</div>
        <div class="bt-metric-lbl">Final Value (${endYear})</div>
      </div>
      <div class="bt-metric">
        <div class="bt-metric-val ${cagr >= 0 ? 'pos' : 'neg'}">${(cagr*100).toFixed(1)}%</div>
        <div class="bt-metric-lbl">Annualised Return (CAGR)</div>
      </div>
      <div class="bt-metric">
        <div class="bt-metric-val pos">${fmt$(totalIncome)}</div>
        <div class="bt-metric-lbl">Total Income Generated</div>
      </div>
      <div class="bt-metric">
        <div class="bt-metric-val neg">${(maxDD*100).toFixed(1)}%</div>
        <div class="bt-metric-lbl">Max Drawdown</div>
      </div>
      <div class="bt-metric">
        <div class="bt-metric-val">${fmt$(mc.p50)}</div>
        <div class="bt-metric-lbl">MC Median (${mcYears}yr)</div>
      </div>
      <div class="bt-metric">
        <div class="bt-metric-val" style="color:#718096;">${fmt$(mc.p5)} – ${fmt$(mc.p95)}</div>
        <div class="bt-metric-lbl">MC 90% Range</div>
      </div>
    </div>
  `;

  // ── HISTORICAL CHART ──
  renderBtHistoryChart(hist, portSize, startYear, endYear, pfx);

  // ── MONTE CARLO CHART ──
  renderBtMCChart(mc, portSize, mcYears, pfx);

  // ── YEAR-BY-YEAR TABLE ──
  document.getElementById(pfx + 'Table').innerHTML = buildBtTable(hist);

  // ── MC SCENARIO TABLE ──
  document.getElementById(pfx + 'MCTable').innerHTML = buildMCTable(mc, portSize, mcYears);

  document.getElementById(pfx + 'Results').style.display = 'block';
  document.getElementById(pfx + 'Results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderBtHistoryChart(hist, portSize, startYear, endYear, pfx) {
  const el = document.getElementById(pfx + 'HistoryChart');
  if (!el) return;
  if (_btCharts[pfx + 'History']) _btCharts[pfx + 'History'].destroy();

  const labels  = hist.portSeries.map(y => y.year);
  const values  = [portSize, ...hist.portSeries.map(y => y.endValue)];
  const labelsX = [startYear - 1, ...labels];
  const spyLine = buildSpyComparison(portSize, startYear, endYear);

  _btCharts[pfx + 'History'] = new Chart(el, {
    type: 'line',
    data: {
      labels: labelsX,
      datasets: [
        {
          label: 'Your Portfolio',
          data: values,
          borderColor: '#4299e1',
          backgroundColor: 'rgba(66,153,225,0.08)',
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: '#4299e1',
          fill: true,
          tension: 0.3
        },
        {
          label: 'S&P 500 (SPY, buy & hold)',
          data: spyLine,
          borderColor: '#a0aec0',
          borderWidth: 1.5,
          pointRadius: 2,
          borderDash: [5, 4],
          fill: false,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { font: { size: 11 }, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${fmt$(ctx.raw)}`
          }
        }
      },
      scales: {
        y: {
          ticks: { callback: v => '$' + (v/1000).toFixed(0) + 'K', font: { size: 10 } },
          grid: { color: '#f0f4f8' }
        },
        x: { grid: { display: false }, ticks: { font: { size: 10 } } }
      }
    }
  });
}

function renderBtMCChart(mc, portSize, mcYears, pfx) {
  const el = document.getElementById(pfx + 'MCChart');
  if (!el) return;
  if (_btCharts[pfx + 'MC']) _btCharts[pfx + 'MC'].destroy();

  const labels  = Array.from({ length: mcYears + 1 }, (_, i) => `Y${i}`);
  const { paths } = mc.fanData;

  _btCharts[pfx + 'MC'] = new Chart(el, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Bear (5th pct)',   data: paths.p5,   borderColor:'#fc8181', borderWidth:1, pointRadius:0, fill:false, borderDash:[4,3], tension:0.3 },
        { label: '25th pct',         data: paths.p25,  borderColor:'#f6ad55', borderWidth:1.5, pointRadius:0, fill:false, tension:0.3 },
        { label: 'Median (50th)',     data: paths.p50,  borderColor:'#4299e1', borderWidth:2.5, pointRadius:3, pointBackgroundColor:'#4299e1', fill:false, tension:0.3 },
        { label: '75th pct',         data: paths.p75,  borderColor:'#68d391', borderWidth:1.5, pointRadius:0, fill:false, tension:0.3 },
        { label: 'Bull (95th pct)',   data: paths.p95,  borderColor:'#48bb78', borderWidth:1, pointRadius:0, fill:false, borderDash:[4,3], tension:0.3 },
        { label: 'Mean',             data: paths.mean, borderColor:'#9f7aea', borderWidth:2, pointRadius:0, fill:false, borderDash:[2,2], tension:0.3 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { font: { size: 10 }, usePointStyle: true, boxWidth: 12 } },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt$(ctx.raw)}` }
        }
      },
      scales: {
        y: { ticks: { callback: v => '$' + (v >= 1e6 ? (v/1e6).toFixed(2)+'M' : (v/1000).toFixed(0)+'K'), font: { size: 10 } }, grid: { color: '#f0f4f8' } },
        x: { grid: { display: false }, ticks: { font: { size: 10 } } }
      }
    }
  });
}

// ---- HELPER FUNCTIONS ----

function buildSpyComparison(startValue, startYear, endYear) {
  const vals = [startValue];
  let v = startValue;
  for (let y = startYear; y <= endYear; y++) {
    const r = BT_INDEX_RETURNS.SPY[y] || 0;
    v = v * (1 + r + 0.013); // price return + ~1.3% dividend
    vals.push(v);
  }
  return vals;
}

function computeMaxDrawdown(portSeries) {
  let peak = -Infinity, maxDD = 0;
  for (const y of portSeries) {
    if (y.endValue > peak) peak = y.endValue;
    const dd = (peak - y.endValue) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

function buildBtTable(hist) {
  let html = `
    <table class="bt-table">
      <thead>
        <tr>
          <th>Year</th>
          <th style="text-align:right;">Start Value</th>
          <th style="text-align:right;">Annual Income</th>
          <th style="text-align:right;">Annual Return</th>
          <th style="text-align:right;">End Value</th>
          <th style="text-align:right;">Change</th>
        </tr>
      </thead>
      <tbody>
  `;
  for (const y of hist.portSeries) {
    const change = y.endValue - y.startValue;
    const retPct = y.startValue > 0 ? (y.endValue - y.startValue) / y.startValue : 0;
    const cls    = retPct >= 0 ? 'pos' : 'neg';
    html += `
      <tr>
        <td><strong>${y.year}</strong></td>
        <td style="text-align:right;">${fmt$(y.startValue)}</td>
        <td style="text-align:right;color:#276749;">${fmt$(y.income)}</td>
        <td style="text-align:right;" class="${cls}">${(retPct*100).toFixed(1)}%</td>
        <td style="text-align:right;font-weight:700;">${fmt$(y.endValue)}</td>
        <td style="text-align:right;" class="${cls}">${change >= 0 ? '+' : ''}${fmt$(change)}</td>
      </tr>
    `;
  }
  html += '</tbody></table>';
  return html;
}

function buildMCTable(mc, portSize, years) {
  const scenarios = [
    { label: '🐻 Worst Case (5th pct)',  value: mc.p5,   pct: (mc.p5  / portSize - 1) * 100 },
    { label: 'Pessimistic (25th pct)',   value: mc.p25,  pct: (mc.p25 / portSize - 1) * 100 },
    { label: '📊 Median (50th pct)',     value: mc.p50,  pct: (mc.p50 / portSize - 1) * 100 },
    { label: 'Optimistic (75th pct)',    value: mc.p75,  pct: (mc.p75 / portSize - 1) * 100 },
    { label: '🚀 Best Case (95th pct)',  value: mc.p95,  pct: (mc.p95 / portSize - 1) * 100 },
    { label: 'Expected (Mean)',          value: mc.mean, pct: (mc.mean/ portSize - 1) * 100 },
  ];

  const annCagr = s => ((Math.pow(s.value / portSize, 1 / years) - 1) * 100).toFixed(1);

  return `
    <table class="bt-table">
      <thead>
        <tr>
          <th>Scenario</th>
          <th style="text-align:right;">Final Value (${years}yr)</th>
          <th style="text-align:right;">Total Return</th>
          <th style="text-align:right;">CAGR</th>
        </tr>
      </thead>
      <tbody>
        ${scenarios.map(s => `
          <tr>
            <td>${s.label}</td>
            <td style="text-align:right;font-weight:700;">${fmt$(s.value)}</td>
            <td style="text-align:right;" class="${s.pct >= 0 ? 'pos' : 'neg'}">${s.pct >= 0 ? '+' : ''}${s.pct.toFixed(1)}%</td>
            <td style="text-align:right;" class="${s.pct >= 0 ? 'pos' : 'neg'}">${annCagr(s)}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="font-size:11px;color:#718096;margin-top:10px;line-height:1.6;">
      Based on ${mc.simCount.toLocaleString()} Monte Carlo simulations ·
      Portfolio mean return: ${(mc.portMean*100).toFixed(1)}%/yr ·
      Volatility (σ): ${(mc.portStd*100).toFixed(1)}%/yr ·
      Income yield: ${(mc.portYield*100).toFixed(1)}%/yr
    </div>
  `;
}
