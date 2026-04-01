// ============================================================
// v1.2 — TAX TREATMENT KNOWLEDGE BASE
// Sources: fund prospectuses, annual reports, IRS Section 1256 rules
// ============================================================
const ETF_TAX_PROFILE = {
  // ── NEOS ETFs: SPX/NDX index options = Section 1256 (60% LTCG / 40% STCG)
  // Section 1256 blended federal rate = 60% × LTCG rate + 40% × ordinary rate
  "SPYI":  { treatment:'sec1256', label:'Section 1256 (60% LT / 40% ST)', note:'SPYI uses SPX index options (Section 1256 contracts). 60% taxed at long-term capital gains rate, 40% at short-term (ordinary) rate. Potentially more tax-efficient than pure ordinary income ETFs.' },
  "QQQI":  { treatment:'sec1256', label:'Section 1256 (60% LT / 40% ST)', note:'QQQI uses NDX index options (Section 1256 contracts). Same 60/40 blended tax treatment as SPYI.' },
  "IWMI":  { treatment:'sec1256', label:'Section 1256 (60% LT / 40% ST)', note:'IWMI uses RUT index options (Section 1256 contracts). 60/40 blended rate applies.' },

  // ── JPMorgan JEPI / JEPQ: ELN (Equity-Linked Notes) income = ordinary income
  "JEPI":  { treatment:'ordinary', label:'Ordinary Income', note:'JEPI generates income primarily through Equity-Linked Notes (ELNs). ELN income is classified as ordinary income, not qualified dividends. Taxed at your full marginal rate.' },
  "JEPQ":  { treatment:'ordinary', label:'Ordinary Income', note:'JEPQ uses ELNs on Nasdaq stocks. Like JEPI, ELN income is ordinary income taxed at your marginal rate.' },

  // ── Goldman Sachs GPIX / GPIQ: similar ELN/options structure
  "GPIX":  { treatment:'ordinary', label:'Ordinary Income (mostly)', note:'GPIX distributions are primarily from options premiums and ELNs, classified as ordinary income. Some portion may be qualified dividends from underlying equity holdings.' },
  "GPIQ":  { treatment:'ordinary', label:'Ordinary Income (mostly)', note:'GPIQ distributions are primarily options premiums/ELN income, treated as ordinary income.' },

  // ── Global X QYLD/XYLD/RYLD/DJIA: covered calls on index ETFs = ordinary income
  "QYLD":  { treatment:'ordinary', label:'Ordinary Income', note:'QYLD sells covered calls on QQQ. Option premiums are short-term capital gains treated as ordinary income. May include some return of capital (ROC) which is not currently taxable but reduces cost basis.' },
  "XYLD":  { treatment:'mixed',    label:'Ordinary Income + possible ROC', note:'XYLD sells covered calls on SPY. Option premiums = ordinary income. Historically has included some return of capital (ROC) portions which are tax-deferred.' },
  "RYLD":  { treatment:'mixed',    label:'Ordinary Income + possible ROC', note:'RYLD sells covered calls on IWM. Similar to XYLD — mostly ordinary income with potential ROC component.' },
  "DJIA":  { treatment:'ordinary', label:'Ordinary Income', note:'DJIA sells covered calls on the Dow 30. Option premiums classified as ordinary income.' },

  // ── YieldMax ETFs: single-stock options = ordinary income / short-term cap gains
  "TSLY":  { treatment:'ordinary', label:'Ordinary Income / Short-term Cap Gains', note:'TSLY uses options on TSLA. Distributions are from short-term option premiums, taxed as ordinary income. High NAV erosion means a portion may be return of capital (ROC).' },
  "NVDY":  { treatment:'ordinary', label:'Ordinary Income / Short-term Cap Gains', note:'NVDY uses options on NVDA. Like all YieldMax funds, distributions are ordinary income. Significant ROC possible given high stated yields.' },
  "CONY":  { treatment:'ordinary', label:'Ordinary Income / Short-term Cap Gains', note:'CONY uses options on COIN. Distributions are ordinary income. Very high stated yield makes large ROC component likely.' },
  "MSFO":  { treatment:'ordinary', label:'Ordinary Income / Short-term Cap Gains', note:'MSFO uses options on MSFT. Ordinary income treatment.' },
  "AMZY":  { treatment:'ordinary', label:'Ordinary Income / Short-term Cap Gains', note:'AMZY uses options on AMZN. Ordinary income treatment.' },
  "YMAX":  { treatment:'ordinary', label:'Ordinary Income / Short-term Cap Gains', note:'YMAX is a fund of YieldMax ETFs. Distributions inherit the ordinary income character of the underlying funds.' },
  "YMAG":  { treatment:'ordinary', label:'Ordinary Income / Short-term Cap Gains', note:'YMAG holds Mag7 YieldMax ETFs. Ordinary income character.' },

  // ── TappAlpha TSPY: daily income ETF using SPY options
  "TSPY":  { treatment:'sec1256', label:'Section 1256 (60% LT / 40% ST)', note:'TSPY uses SPX index options (Section 1256 contracts). 60/40 blended rate — potentially more tax-efficient than single-stock covered call ETFs.' },

  // ── Amplify DIVO: actively managed, writes covered calls + holds dividend stocks
  "DIVO":  { treatment:'qualified', label:'Qualified Dividends (mostly)', note:'DIVO holds high-quality dividend stocks and writes selective covered calls. Most distributions qualify as qualified dividends taxed at preferential long-term capital gains rates. Premium income portion is ordinary income.' },

  // ── KLIP: covered calls on KWEB (China internet ETF)
  "KLIP":  { treatment:'ordinary', label:'Ordinary Income', note:'KLIP writes covered calls on KWEB. Option premiums are ordinary income. Note: foreign tax credits may apply to underlying Chinese equity dividends.' },

  // ── GLDW: covered calls on gold — Section 1256 may apply for index options
  "GLDW":  { treatment:'ordinary', label:'Ordinary Income (gold ETF rules)', note:'GLDW is a gold-backed covered call ETF. Gold ETF distributions are typically taxed as collectibles (28% max rate for long-term) or ordinary income. Consult a tax advisor.' },

  // ── iShares BALI
  "BALI":  { treatment:'ordinary', label:'Ordinary Income (mostly)', note:'BALI uses options overlays on large-cap equities. Option premium income is ordinary income; underlying equity dividends may be partially qualified.' },

  // ── Broad market ETFs — qualified dividends
  "SPY":   { treatment:'qualified', label:'Qualified Dividends', note:'SPY holds S&P 500 stocks. Dividends are predominantly qualified dividends taxed at preferential long-term capital gains rates (0%, 15%, or 20%).' },
  "QQQ":   { treatment:'qualified', label:'Qualified Dividends', note:'QQQ holds Nasdaq-100 stocks. Dividends are mostly qualified.' },
  "VOO":   { treatment:'qualified', label:'Qualified Dividends', note:'VOO holds S&P 500 stocks. Dividends are predominantly qualified.' },
  "VTI":   { treatment:'qualified', label:'Qualified Dividends', note:'VTI holds the total US market. Dividends are mostly qualified.' },
  "IVV":   { treatment:'qualified', label:'Qualified Dividends', note:'IVV holds S&P 500 stocks. Dividends are predominantly qualified.' },
  "VGT":   { treatment:'qualified', label:'Qualified Dividends', note:'VGT holds tech stocks. Dividends are mostly qualified (tech companies often pay low dividends).' },
  "VTV":   { treatment:'qualified', label:'Qualified Dividends', note:'VTV holds value stocks which tend to pay higher qualified dividends.' },
  "SCHG":  { treatment:'qualified', label:'Qualified Dividends', note:'SCHG holds large-cap growth stocks. Any dividends are mostly qualified.' },
  "SCHD":  { treatment:'qualified', label:'Qualified Dividends', note:'SCHD focuses on dividend-quality stocks. Distributions are predominantly qualified dividends — one of the most tax-efficient dividend ETFs.' },
  "VXUS":  { treatment:'mixed',     label:'Foreign + Qualified Dividends', note:'VXUS holds international stocks. Dividends may be qualified or non-qualified depending on country. Foreign tax credits may apply.' },
  "AGG":   { treatment:'ordinary',  label:'Ordinary Income (bond interest)', note:'AGG holds US bonds. Interest income is ordinary income, not eligible for qualified dividend treatment.' },
};

// Get tax profile for a ticker (with smart fallback by category)
function getEtfTaxProfile(ticker, category) {
  if (ETF_TAX_PROFILE[ticker]) return ETF_TAX_PROFILE[ticker];
  // Smart fallback by category
  if (category === 'Single Stock') return { treatment:'ordinary', label:'Ordinary Income', note:'Single-stock option ETFs typically generate ordinary income from short-term option premiums.' };
  if (category === 'Fund of Funds') return { treatment:'ordinary', label:'Ordinary Income', note:'Fund of funds ETFs inherit the ordinary income character of their underlying covered call ETFs.' };
  if (category === 'Commodity') return { treatment:'ordinary', label:'Ordinary/Collectible Income', note:'Commodity ETF distributions may be treated as ordinary income or collectibles gains. Consult a tax advisor.' };
  if (category === 'Equity Index') return { treatment:'ordinary', label:'Ordinary Income (likely)', note:'Covered call ETFs on equity indexes typically generate ordinary income from option premiums. Some may use Section 1256 contracts — check the fund prospectus.' };
  return { treatment:'ordinary', label:'Ordinary Income (assumed)', note:'Tax treatment unknown — assumed ordinary income. Check the fund prospectus for accurate classification.' };
}

// ============================================================
// v1.2 — TAX IMPACT ESTIMATOR
// ============================================================
// 2025 Federal Tax Brackets (ordinary income)
const TAX_BRACKETS = {
  single: [
    [11600,  0.10], [47150, 0.12], [100525, 0.22],
    [191950, 0.24], [243725, 0.32], [609350, 0.35], [Infinity, 0.37]
  ],
  married: [
    [23200, 0.10], [94300, 0.12], [201050, 0.22],
    [383900, 0.24], [487450, 0.32], [731200, 0.35], [Infinity, 0.37]
  ],
  hoh: [
    [16550, 0.10], [63100, 0.12], [100500, 0.22],
    [191950, 0.24], [243700, 0.32], [609350, 0.35], [Infinity, 0.37]
  ]
};

// Qualified dividend rates (2025)
const QDIV_BRACKETS = {
  single:  [[47025, 0], [518900, 0.15], [Infinity, 0.20]],
  married: [[94050, 0], [583750, 0.15], [Infinity, 0.20]],
  hoh:     [[63000, 0], [551350, 0.15], [Infinity, 0.20]]
};

function getMarginalRate(income, filing) {
  const brackets = TAX_BRACKETS[filing];
  let prev = 0;
  for (const [limit, rate] of brackets) {
    if (income <= limit) return rate;
    prev = limit;
  }
  return 0.37;
}

function getQDivRate(income, filing) {
  const brackets = QDIV_BRACKETS[filing];
  for (const [limit, rate] of brackets) {
    if (income <= limit) return rate;
  }
  return 0.20;
}

function formatTaxIncome() {
  const input = document.getElementById('taxIncome');
  const n = parseFloat(input.value.replace(/[$,]/g,'')) || 0;
  input.value = '$' + n.toLocaleString('en-US');
  updateTaxBracket();
}

function updateTaxBracket() {
  const filing = document.getElementById('taxFilingStatus').value;
  const income = parseFloat(document.getElementById('taxIncome').value.replace(/[$,]/g,'')) || 0;
  const stateRate = parseFloat(document.getElementById('taxStateRate').value);
  const accountType = document.getElementById('taxAccountType').value;
  const displayEl = document.getElementById('taxBracketDisplay');
  const rateEl = document.getElementById('taxEffectiveRate');
  const detailEl = document.getElementById('taxBracketDetail');

  if (accountType === 'roth') {
    rateEl.textContent = '0%';
    detailEl.textContent = 'Roth IRA — dividends grow and distribute tax-free';
    displayEl.style.background = '#f0fff4';
    return;
  }
  if (accountType === 'ira') {
    const marginal = getMarginalRate(income, filing);
    rateEl.textContent = ((marginal + stateRate) * 100).toFixed(1) + '%';
    detailEl.textContent = `Traditional IRA: taxed as ordinary income at withdrawal — ${(marginal*100).toFixed(0)}% federal + ${(stateRate*100).toFixed(0)}% state`;
    displayEl.style.background = '#fffbeb';
    return;
  }
  // Taxable: covered call ETF distributions are typically ordinary income (not qualified)
  const marginal = getMarginalRate(income, filing);
  const effective = marginal + stateRate;
  rateEl.textContent = (effective * 100).toFixed(1) + '%';
  detailEl.textContent = `${(marginal*100).toFixed(0)}% federal ordinary + ${(stateRate*100).toFixed(0)}% state · CC ETF distributions are typically ordinary income`;
  displayEl.style.background = '#ebf8ff';
}

function calculateTaxImpact() {
  if (!_lastEtfResults || _lastEtfResults.length === 0) {
    document.getElementById('taxResultsArea').innerHTML = `
      <div style="background:#fff5f5;border:1px solid #fed7d7;border-radius:12px;padding:24px;text-align:center;color:#c53030;">
        ⚠️ No portfolio data found. Please go to the <strong>Simulator</strong> tab, add ETFs, and click <strong>Calculate Portfolio Performance</strong> first.
      </div>`;
    return;
  }

  const filing = document.getElementById('taxFilingStatus').value;
  const income = parseFloat(document.getElementById('taxIncome').value.replace(/[$,]/g,'')) || 0;
  const stateRate = parseFloat(document.getElementById('taxStateRate').value);
  const accountType = document.getElementById('taxAccountType').value;

  const marginalFed = getMarginalRate(income, filing);
  const stateR = stateRate;

  const ltcgRate = getQDivRate(income, filing);
  const sec1256Rate = 0.60 * ltcgRate + 0.40 * marginalFed; // Section 1256: 60% LTCG + 40% ordinary

  let totalGross = 0, totalTax = 0, totalAfter = 0;
  const rows = _lastEtfResults.map(r => {
    const grossAnnual = r.annualDivIncome;
    const profile = getEtfTaxProfile(r.ticker, r.data?.category);
    let taxRate = 0;
    let divTypeEmoji = '📄';
    let divTypeLabel = 'Ordinary';

    if (accountType === 'roth') {
      taxRate = 0;
      divTypeEmoji = '🌱'; divTypeLabel = 'Tax-Free';
    } else if (accountType === 'ira') {
      taxRate = marginalFed + stateR;
      divTypeEmoji = '⏳'; divTypeLabel = 'Deferred';
    } else {
      switch(profile.treatment) {
        case 'qualified':
          taxRate = ltcgRate + stateR;
          divTypeEmoji = '⭐'; divTypeLabel = 'Qualified Div';
          break;
        case 'sec1256':
          taxRate = sec1256Rate + stateR;
          divTypeEmoji = '📊'; divTypeLabel = '1256 (60/40)';
          break;
        case 'mixed':
          taxRate = (0.5 * ltcgRate + 0.5 * marginalFed) + stateR;
          divTypeEmoji = '🔀'; divTypeLabel = 'Mixed';
          break;
        default:
          taxRate = marginalFed + stateR;
          divTypeEmoji = '📄'; divTypeLabel = 'Ordinary';
      }
    }

    const taxOwed = grossAnnual * taxRate;
    const afterTax = grossAnnual - taxOwed;
    totalGross += grossAnnual;
    totalTax += taxOwed;
    totalAfter += afterTax;

    const tooltipNote = (profile.note || '').replace(/"/g, '&quot;');

    return `<tr>
      <td>
        <span class="tkbadge">${r.ticker}</span>
        <span class="fname" style="font-size:10px;color:#718096;">${profile.label}</span>
      </td>
      <td title="${tooltipNote}" style="cursor:help;">
        ${divTypeEmoji} ${divTypeLabel} <span style="font-size:10px;color:#a0aec0;">ⓘ</span>
      </td>
      <td class="pos">${fmt$(grossAnnual)}</td>
      <td>${(taxRate*100).toFixed(1)}%</td>
      <td class="tax-owed">${fmt$(taxOwed)}</td>
      <td class="tax-after">${fmt$(afterTax)}</td>
      <td class="tax-after">${fmt$(afterTax/12)}</td>
    </tr>`;
  }).join('');

  const taxRateSummary = totalGross > 0 ? (totalTax / totalGross) : 0;
  const accountLabel = accountType === 'roth' ? 'Roth IRA' : accountType === 'ira' ? 'Traditional IRA' : 'Taxable Account';

  document.getElementById('taxResultsArea').innerHTML = `
    <div class="tax-card">
      <div class="tax-card-header">💰 After-Tax Income Summary — ${accountLabel}</div>
      <div class="tax-card-body">
        <div class="tax-summary-grid">
          <div class="tax-summary-item">
            <div class="tax-summary-value">${fmt$(totalGross)}</div>
            <div class="tax-summary-label">Gross Annual Income</div>
          </div>
          <div class="tax-summary-item">
            <div class="tax-summary-value tax-owed">${fmt$(totalTax)}</div>
            <div class="tax-summary-label">Est. Tax Owed</div>
          </div>
          <div class="tax-summary-item">
            <div class="tax-summary-value tax-after">${fmt$(totalAfter)}</div>
            <div class="tax-summary-label">After-Tax Income</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
          <div class="tax-summary-item">
            <div class="tax-summary-value">${(taxRateSummary*100).toFixed(1)}%</div>
            <div class="tax-summary-label">Effective Tax Rate</div>
          </div>
          <div class="tax-summary-item">
            <div class="tax-summary-value tax-after">${fmt$(totalAfter/12)}</div>
            <div class="tax-summary-label">After-Tax Monthly</div>
          </div>
          <div class="tax-summary-item">
            <div class="tax-summary-value tax-after">${fmt$(totalAfter/365)}</div>
            <div class="tax-summary-label">After-Tax Daily</div>
          </div>
          <div class="tax-summary-item">
            <div class="tax-summary-value">${fmt$(totalGross - totalAfter)}</div>
            <div class="tax-summary-label">Taxes Per Year</div>
          </div>
        </div>
      </div>
    </div>

    <div class="tax-card">
      <div class="tax-card-header">📋 Per-ETF Tax Breakdown</div>
      <div class="tax-card-body" style="padding:0;">
        <table class="tax-table">
          <thead><tr>
            <th>ETF</th><th>Div Type</th><th>Gross Income</th><th>Tax Rate</th><th>Tax Owed</th><th>After-Tax</th><th>After-Tax/Mo</th>
          </tr></thead>
          <tbody>
            ${rows}
            <tr>
              <td><strong>TOTAL</strong></td>
              <td>—</td>
              <td class="pos">${fmt$(totalGross)}</td>
              <td>${(taxRateSummary*100).toFixed(1)}%</td>
              <td class="tax-owed">${fmt$(totalTax)}</td>
              <td class="tax-after">${fmt$(totalAfter)}</td>
              <td class="tax-after">${fmt$(totalAfter/12)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div style="background:#f7fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;font-size:11px;color:#4a5568;line-height:1.8;">
      <strong style="color:#2d3748;">Tax Treatment Legend:</strong><br>
      <span style="margin-right:12px;">⭐ <strong>Qualified Div</strong> — 0%, 15%, or 20% (lower rate)</span>
      <span style="margin-right:12px;">📊 <strong>1256 (60/40)</strong> — SPYI/QQQI/IWMI/TSPY use SPX/NDX index options: 60% taxed at LTCG rate + 40% at ordinary rate</span>
      <span style="margin-right:12px;">🔀 <strong>Mixed</strong> — blend of qualified + ordinary (e.g. XYLD, RYLD)</span>
      <span>📄 <strong>Ordinary</strong> — taxed at full marginal rate (JEPI, JEPQ, QYLD, YieldMax, etc.)</span><br>
      <div style="margin-top:6px;color:#718096;">
        ⓘ Hover over the "Div Type" column for per-ETF explanation &nbsp;·&nbsp;
        ROC (return of capital) portions are not currently taxable but reduce your cost basis &nbsp;·&nbsp;
        This tool uses <strong>${(marginalFed*100).toFixed(0)}%</strong> federal marginal rate for ordinary income and <strong>${(ltcgRate*100).toFixed(0)}%</strong> for long-term gains &nbsp;·&nbsp;
        <strong>Not tax advice — consult a tax professional.</strong>
      </div>
    </div>
  `;
}

// Initialize tax bracket display on load
updateTaxBracket();
