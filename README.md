# ETFs Portfolio Simulator v1.2

A free, browser-based tool for modeling covered call ETF portfolios — dividend income, NAV erosion, 15-year projections, tax impact, and portfolio comparison.

**Live site:** https://etfsimulator.netlify.app/

---

## What it does

The simulator has three tabs:

**📊 Simulator** — Build a portfolio from any ETF ticker. Shows YTD/3M/6M/1Y price returns, annual dividend income, NAV erosion analysis, 15-year Bear/Base/Bull projections, and a DRIP slider to model dividend reinvestment.

**⚖️ Compare Portfolios** — Build two separate portfolios side by side and compare yield, income, 1-year returns, and 10-year projected value head to head.

**🧾 Tax Impact** — Estimates after-tax dividend income based on your filing status, income bracket, state tax rate, and account type (Taxable / IRA / Roth). Uses per-ETF tax treatment knowledge (e.g. SPYI uses Section 1256 contracts; JEPI uses ELNs taxed as ordinary income).

---

## Project structure

Everything lives in a single `index.html` file (~2,500 lines). It contains three sections:

| Section | What's in it |
|---|---|
| `<head>` | Meta tags, SEO, AdSense placeholder, Chart.js + html2canvas imports |
| `<style>` | All CSS styling |
| HTML body | Tab navigation, Simulator layout, Compare layout, Tax layout |
| `<script>` | All JavaScript — data, logic, rendering, helpers |

### Key JavaScript sections inside `<script>`

| Block | Description |
|---|---|
| `CONFIG` | Railway server URL for live Yahoo Finance data |
| `BUILTIN` | Cached ETF data (prices, yields, dividends) as of March 2026 |
| `PROJ` | Historical projection data (price CAGR, div yield, total CAGR per ETF) |
| `ETF_TAX_PROFILE` | Per-ETF tax treatment knowledge base (ordinary / qualified / Section 1256 / mixed) |
| Server health | Checks if the Railway backend is online; falls back to cached data |
| Search | Live search against Railway + local QUICK_SUGGESTIONS list |
| Holdings | Add/remove ETFs, allocation sliders |
| `calculatePortfolio()` | Main Simulator calculation |
| `renderResults()` | Builds the full results HTML |
| `renderProjectionHTML()` | 15-year Bear/Base/Bull projection with DRIP slider |
| `renderCharts()` | Chart.js charts (allocation, yield, return, projection) |
| Compare tab | `initCompareSearch()`, `addCompETF()`, `runComparison()` |
| Tax tab | `ETF_TAX_PROFILE`, `calculateTaxImpact()`, `updateTaxBracket()` |
| `saveSnapshot()` | Exports results panel as PNG via html2canvas |

---

## Data sources

- **Live data:** Yahoo Finance via a Python backend (`cc_simulator_server.py`) hosted on Railway
- **Offline fallback:** Built-in cached data as of March 2, 2026 (stored in `BUILTIN` object)
- **Projections:** Based on each ETF's actual price CAGR + average annual dividend yield over its available history. ETFs with less than 3 years of history use their underlying index's 10-year CAGR adjusted for covered call premium drag

---

## Files

```
index.html              — The entire app (HTML + CSS + JS)
cc_simulator_server.py  — Python backend for live Yahoo Finance data
Procfile                — Railway deployment config
requirements.txt        — Python dependencies for the server
README.md               — This file
```

---

## Deployment

**Frontend:** Deployed on Netlify from the `v1.2` branch of this GitHub repo. Netlify auto-deploys on every push to that branch.

**Backend:** Python server deployed on Railway. Provides `/etf`, `/search`, and `/health` endpoints. The frontend calls Railway for live data; if the server is offline it falls back to cached data automatically.

To deploy changes:
```bash
git add index.html
git commit -m "Description of change"
git push origin v1.2
```
Netlify deploys within ~1 minute of the push.

---

## Branches

| Branch | Purpose |
|---|---|
| `main` | Original v1.0 — kept intact at https://etf-simulator.netlify.app/ |
| `v1.2` | Current version — Tax Impact, Compare, Snapshot, smart tax profiles |

---

## Future enhancements (ideas)

- Split code into separate files (`js/data.js`, `js/simulator.js`, etc.) when file exceeds ~4,000 lines
- Add more ETFs to the BUILTIN cache
- Inflation-adjusted projections
- Mobile-responsive layout improvements
- User accounts / saved portfolios

---

## Disclaimer

This tool is for educational purposes only. I am not a financial advisor. Tax laws vary by state/country. Past performance does not guarantee future results. Always consult a qualified financial or tax professional before making investment decisions.
