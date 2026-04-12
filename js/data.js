// CONFIG
// Hosted on GitHub Pages — no backend server.
// The app uses built-in ETF data (updated periodically).
// Sector lookups for unknown tickers are fetched live from Yahoo Finance
// directly in the browser (Portfolio Analyzer tab).
// ============================================================
const CLOUD_SERVER_URL = '';   // no backend

const API = 'http://127.0.0.1:7432'; // only used if running locally
let serverOnline = false;

// ============================================================
// BUILT-IN CACHE  (fallback when server is offline)
// All values from Yahoo Finance, March 2 2026
// ============================================================
const BUILTIN = {
  "JEPI":  { name:"JPMorgan Equity Premium Income ETF",            price:59.48, nav:59.88, yield_annual:0.0806, divFreq:"monthly",   total_div_1y:4.739,  one_y_start:54.30, six_m_start:54.79, three_m_start:56.41, ytd_start:56.98, recent_divs:[["2025-03-03",0.328],["2025-04-01",0.408],["2025-05-01",0.488],["2025-06-02",0.54],["2025-07-01",0.4],["2025-08-01",0.358],["2025-09-02",0.368],["2025-10-01",0.361],["2025-11-03",0.346],["2025-12-01",0.371],["2025-12-31",0.427],["2026-02-02",0.344]], category:"Equity Index" },
  "JEPQ":  { name:"JPMorgan Nasdaq Equity Premium Income ETF",     price:57.69, nav:58.03, yield_annual:0.1031, divFreq:"monthly",   total_div_1y:6.139,  one_y_start:49.09, six_m_start:52.93, three_m_start:57.46, ytd_start:57.63, recent_divs:[["2025-03-03",0.482],["2025-04-01",0.541],["2025-05-01",0.598],["2025-06-02",0.621],["2025-07-01",0.494],["2025-08-01",0.444],["2025-09-02",0.442],["2025-10-01",0.446],["2025-11-03",0.476],["2025-12-01",0.553],["2025-12-31",0.576],["2026-02-02",0.466]], category:"Equity Index" },
  "QYLD":  { name:"Global X NASDAQ 100 Covered Call ETF",          price:17.64, nav:17.59, yield_annual:0.1143, divFreq:"monthly",   total_div_1y:2.044,  one_y_start:15.58, six_m_start:15.69, three_m_start:16.98, ytd_start:17.33, recent_divs:[["2025-03-24",0.17],["2025-04-21",0.16],["2025-05-19",0.165],["2025-06-23",0.166],["2025-07-21",0.165],["2025-08-18",0.168],["2025-09-22",0.17],["2025-10-20",0.173],["2025-11-24",0.173],["2025-12-22",0.178],["2026-01-20",0.179],["2026-02-23",0.177]], category:"Equity Index" },
  "XYLD":  { name:"Global X S&P 500 Covered Call ETF",             price:40.78, nav:40.72, yield_annual:0.1046, divFreq:"monthly",   total_div_1y:4.308,  one_y_start:36.93, six_m_start:36.92, three_m_start:39.34, ytd_start:40.03, recent_divs:[["2025-03-24",0.401],["2025-04-21",0.377],["2025-05-19",0.389],["2025-06-23",0.387],["2025-07-21",0.313],["2025-08-18",0.316],["2025-09-22",0.302],["2025-10-20",0.397],["2025-11-24",0.4],["2025-12-22",0.325],["2026-01-20",0.36],["2026-02-23",0.341]], category:"Equity Index" },
  "RYLD":  { name:"Global X Russell 2000 Covered Call ETF",        price:15.74, nav:15.64, yield_annual:0.1181, divFreq:"monthly",   total_div_1y:1.822,  one_y_start:13.91, six_m_start:14.23, three_m_start:14.85, ytd_start:15.13, recent_divs:[["2025-03-24",0.154],["2025-04-21",0.143],["2025-05-19",0.148],["2025-06-23",0.149],["2025-07-21",0.15],["2025-08-18",0.151],["2025-09-22",0.152],["2025-10-20",0.153],["2025-11-24",0.152],["2025-12-22",0.155],["2026-01-20",0.157],["2026-02-23",0.158]], category:"Equity Index" },
  "DIVO":  { name:"Amplify CWP Enhanced Dividend Income ETF",      price:46.82, nav:46.63, yield_annual:0.0497, divFreq:"monthly",   total_div_1y:2.898,  one_y_start:38.91, six_m_start:41.77, three_m_start:43.85, ytd_start:44.34, recent_divs:[["2025-03-28",0.165],["2025-04-29",0.158],["2025-05-29",0.165],["2025-06-27",0.168],["2025-07-30",0.172],["2025-08-28",0.175],["2025-09-29",0.177],["2025-10-30",0.182],["2025-11-26",0.214],["2025-12-30",0.953],["2026-01-29",0.183],["2026-02-26",0.186]], category:"Equity Index" },
  "GPIQ":  { name:"Goldman Sachs Nasdaq-100 Premium Income ETF",   price:51.66, nav:51.95, yield_annual:0.0981, divFreq:"monthly",   total_div_1y:5.25,   one_y_start:42.60, six_m_start:48.09, three_m_start:52.14, ytd_start:51.85, recent_divs:[["2025-03-03",0.415],["2025-04-01",0.386],["2025-05-01",0.388],["2025-06-02",0.415],["2025-07-01",0.435],["2025-08-01",0.442],["2025-09-02",0.443],["2025-10-01",0.458],["2025-11-03",0.474],["2025-12-01",0.465],["2026-01-02",0.463],["2026-02-02",0.466]], category:"Equity Index" },
  "GPIX":  { name:"Goldman Sachs S&P 500 Premium Income ETF",      price:52.47, nav:52.70, yield_annual:0.0800, divFreq:"monthly",   total_div_1y:4.275,  one_y_start:44.76, six_m_start:48.95, three_m_start:51.70, ytd_start:52.16, recent_divs:[["2025-03-03",0.344],["2025-04-01",0.327],["2025-05-01",0.323],["2025-06-02",0.339],["2025-07-01",0.352],["2025-08-01",0.358],["2025-09-02",0.362],["2025-10-01",0.369],["2025-11-03",0.376],["2025-12-01",0.374],["2026-01-02",0.375],["2026-02-02",0.376]], category:"Equity Index" },
  "TSPY":  { name:"TappAlpha SPY Growth & Daily Income ETF",       price:25.18, nav:25.08, yield_annual:0.1367, divFreq:"monthly",   total_div_1y:3.503,  one_y_start:21.29, six_m_start:23.21, three_m_start:24.77, ytd_start:24.98, recent_divs:[["2025-03-05",0.291],["2025-04-02",0.271],["2025-05-07",0.283],["2025-06-03",0.282],["2025-07-01",0.286],["2025-08-05",0.292],["2025-09-02",0.292],["2025-10-07",0.3],["2025-11-04",0.303],["2025-12-02",0.301],["2026-01-06",0.302],["2026-02-03",0.3]], category:"Equity Index" },
  "SPYI":  { name:"Neos S&P 500 High Income ETF",                  price:52.20, nav:52.09, yield_annual:0.1180, divFreq:"monthly",   total_div_1y:6.169,  one_y_start:44.28, six_m_start:48.39, three_m_start:51.01, ytd_start:51.54, recent_divs:[["2025-03-26",0.506],["2025-04-23",0.462],["2025-05-21",0.506],["2025-06-25",0.505],["2025-07-23",0.511],["2025-08-20",0.518],["2025-09-24",0.527],["2025-10-22",0.527],["2025-11-26",0.522],["2025-12-24",0.532],["2026-01-21",0.531],["2026-02-18",0.522]], category:"Equity Index" },
  "QQQI":  { name:"NEOS NASDAQ-100 High Income ETF",               price:52.57, nav:52.43, yield_annual:0.1385, divFreq:"monthly",   total_div_1y:7.456,  one_y_start:43.70, six_m_start:49.14, three_m_start:52.71, ytd_start:52.50, recent_divs:[["2025-03-26",0.587],["2025-04-23",0.531],["2025-05-21",0.637],["2025-06-25",0.628],["2025-07-23",0.637],["2025-08-20",0.629],["2025-09-24",0.641],["2025-10-22",0.645],["2025-11-26",0.63],["2025-12-24",0.641],["2026-01-21",0.636],["2026-02-18",0.614]], category:"Equity Index" },
  "IWMI":  { name:"NEOS Russell 2000 High Income ETF",             price:50.38, nav:49.98, yield_annual:0.1368, divFreq:"monthly",   total_div_1y:6.86,   one_y_start:39.58, six_m_start:44.20, three_m_start:46.92, ytd_start:47.90, recent_divs:[["2025-03-26",0.569],["2025-04-23",0.498],["2025-05-21",0.553],["2025-06-25",0.557],["2025-07-23",0.562],["2025-08-20",0.562],["2025-09-24",0.587],["2025-10-22",0.59],["2025-11-26",0.573],["2025-12-24",0.599],["2026-01-21",0.608],["2026-02-18",0.602]], category:"Equity Index" },
  "DJIA":  { name:"Global X Dow 30 Covered Call ETF",              price:22.39, nav:22.31, yield_annual:0.0847, divFreq:"monthly",   total_div_1y:2.373,  one_y_start:20.40, six_m_start:20.37, three_m_start:21.58, ytd_start:21.82, recent_divs:[["2025-04-21",0.209],["2025-05-19",0.107],["2025-06-23",0.156],["2025-07-21",0.134],["2025-08-18",0.159],["2025-09-22",0.129],["2025-10-20",0.22],["2025-11-24",0.223],["2025-12-22",0.117],["2025-12-30",0.471],["2026-01-20",0.169],["2026-02-23",0.109]], category:"Equity Index" },
  "BALI":  { name:"iShares U.S. Large Cap Premium Income Active ETF", price:32.15, nav:32.21, yield_annual:0.0833, divFreq:"monthly", total_div_1y:2.704, one_y_start:27.48, six_m_start:29.91, three_m_start:31.28, ytd_start:31.50, recent_divs:[["2025-03-03",0.206],["2025-04-01",0.255],["2025-05-01",0.382],["2025-06-02",0.234],["2025-07-01",0.203],["2025-08-01",0.203],["2025-09-02",0.186],["2025-10-01",0.189],["2025-11-03",0.195],["2025-12-01",0.25],["2025-12-30",0.222],["2026-02-02",0.179]], category:"Equity Index" },
  "KLIP":  { name:"KraneShares KWEB Covered Call Strategy ETF",    price:27.42, nav:27.77, yield_annual:0.2510, divFreq:"monthly",   total_div_1y:7.708,  one_y_start:25.35, six_m_start:28.86, three_m_start:29.28, ytd_start:29.69, recent_divs:[["2025-03-28",0.683],["2025-04-29",0.622],["2025-05-29",0.636],["2025-06-27",0.644],["2025-07-30",0.653],["2025-08-28",0.66],["2025-09-29",0.669],["2025-10-30",0.668],["2025-11-26",0.635],["2025-12-30",0.619],["2026-01-29",0.635],["2026-02-26",0.584]], category:"Sector" },
  "GLDW":  { name:"Roundhill Gold WeeklyPay ETF",                  price:64.27, nav:63.79, yield_annual:0.0750, divFreq:"weekly",    total_div_1y:4.809,  one_y_start:47.11, six_m_start:47.11, three_m_start:49.52, ytd_start:50.95, recent_divs:[["2026-01-05",0.346],["2026-01-12",0.103],["2026-01-20",0.316],["2026-01-26",0.561],["2026-02-02",0.407],["2026-02-09",0.279],["2026-02-17",0.395],["2026-02-23",0.41]], category:"Commodity" },
  "TSLY":  { name:"YieldMax TSLA Option Income Strategy ETF",      price:32.40, nav:32.38, yield_annual:0.9160, divFreq:"weekly",    total_div_1y:30.7,   one_y_start:22.28, six_m_start:26.61, three_m_start:33.45, ytd_start:33.76, recent_divs:[["2026-01-02",0.366],["2026-01-08",0.318],["2026-01-15",0.35],["2026-01-22",0.287],["2026-01-29",0.324],["2026-02-05",0.33],["2026-02-12",0.331],["2026-02-19",0.321],["2026-02-26",0.315]], category:"Single Stock" },
  "NVDY":  { name:"YieldMax NVDA Option Income Strategy ETF",      price:13.69, nav:13.31, yield_annual:0.7498, divFreq:"weekly",    total_div_1y:9.748,  one_y_start:9.01,  six_m_start:12.55, three_m_start:13.22, ytd_start:13.82, recent_divs:[["2026-01-02",0.144],["2026-01-08",0.105],["2026-01-15",0.095],["2026-01-22",0.085],["2026-01-29",0.108],["2026-02-05",0.094],["2026-02-12",0.106],["2026-02-19",0.094],["2026-02-26",0.115]], category:"Single Stock" },
  "CONY":  { name:"YieldMax COIN Option Income Strategy ETF",      price:29.09, nav:28.15, yield_annual:2.1200, divFreq:"weekly",    total_div_1y:59.703, one_y_start:41.40, six_m_start:48.04, three_m_start:40.32, ytd_start:37.45, recent_divs:[["2026-01-02",0.434],["2026-01-08",0.409],["2026-01-15",0.397],["2026-01-22",0.222],["2026-01-29",0.309],["2026-02-05",0.284],["2026-02-12",0.256],["2026-02-19",0.299],["2026-02-26",0.318]], category:"Single Stock" },
  "MSFO":  { name:"YieldMax MSFT Option Income Strategy ETF",      price:12.68, nav:12.51, yield_annual:0.3780, divFreq:"weekly",    total_div_1y:5.086,  one_y_start:12.03, six_m_start:15.15, three_m_start:14.90, ytd_start:14.52, recent_divs:[["2026-01-02",0.062],["2026-01-08",0.053],["2026-01-15",0.059],["2026-01-22",0.058],["2026-01-29",0.064],["2026-02-05",0.057],["2026-02-12",0.069],["2026-02-19",0.074],["2026-02-26",0.077]], category:"Single Stock" },
  "AMZY":  { name:"YieldMax AMZN Option Income Strategy ETF",      price:11.31, nav:11.34, yield_annual:0.5270, divFreq:"weekly",    total_div_1y:6.726,  one_y_start:10.92, six_m_start:12.28, three_m_start:12.59, ytd_start:12.36, recent_divs:[["2026-01-02",0.065],["2026-01-08",0.066],["2026-01-15",0.096],["2026-01-22",0.061],["2026-01-29",0.065],["2026-02-05",0.075],["2026-02-12",0.078],["2026-02-19",0.088],["2026-02-26",0.093]], category:"Single Stock" },
  "YMAX":  { name:"YieldMax Universe Fund of Option Income ETFs",  price:8.62,  nav:8.63,  yield_annual:0.7950, divFreq:"weekly",    total_div_1y:7.08,   one_y_start:8.25,  six_m_start:9.66,  three_m_start:9.44,  ytd_start:9.39,  recent_divs:[["2026-01-07",0.088],["2026-01-14",0.082],["2026-01-21",0.082],["2026-01-28",0.083],["2026-02-04",0.082],["2026-02-11",0.074],["2026-02-18",0.078],["2026-02-25",0.072]], category:"Fund of Funds" },
  "YMAG":  { name:"YieldMax Magnificent 7 Fund of Option Income ETFs", price:12.86, nav:12.78, yield_annual:0.4930, divFreq:"weekly", total_div_1y:6.752, one_y_start:10.41, six_m_start:12.44, three_m_start:13.48, ytd_start:13.44, recent_divs:[["2026-01-07",0.05],["2026-01-14",0.063],["2026-01-21",0.086],["2026-01-28",0.075],["2026-02-04",0.083],["2026-02-11",0.115],["2026-02-18",0.108],["2026-02-25",0.09]], category:"Fund of Funds" },
  // Broad-market ETFs (common comparisons)
  "SPY":   { name:"SPDR S&P 500 ETF Trust",                           price:566.02, nav:566.02, yield_annual:0.0123, divFreq:"quarterly", total_div_1y:6.955, one_y_start:474.02, six_m_start:530.65, three_m_start:567.56, ytd_start:567.98, recent_divs:[["2025-03-21",1.596],["2025-06-20",1.861],["2025-09-19",1.850],["2025-12-19",1.648]], category:"Equity Index" },
  "QQQ":   { name:"Invesco QQQ Trust",                                price:484.23, nav:484.23, yield_annual:0.0059, divFreq:"quarterly", total_div_1y:2.850, one_y_start:432.35, six_m_start:463.17, three_m_start:506.53, ytd_start:506.29, recent_divs:[["2025-03-24",0.673],["2025-06-23",0.763],["2025-09-22",0.697],["2025-12-23",0.717]], category:"Equity Index" },
  "VOO":   { name:"Vanguard S&P 500 ETF",                             price:519.31, nav:519.31, yield_annual:0.0113, divFreq:"quarterly", total_div_1y:5.872, one_y_start:432.58, six_m_start:487.31, three_m_start:520.52, ytd_start:521.07, recent_divs:[["2025-03-27",1.328],["2025-06-26",1.730],["2025-09-25",1.632],["2025-12-27",1.182]], category:"Equity Index" },
  "VTI":   { name:"Vanguard Total Stock Market ETF",                  price:268.46, nav:268.46, yield_annual:0.0123, divFreq:"quarterly", total_div_1y:3.299, one_y_start:224.89, six_m_start:252.11, three_m_start:267.40, ytd_start:268.82, recent_divs:[["2025-03-27",0.715],["2025-06-26",0.944],["2025-09-25",0.890],["2025-12-27",0.750]], category:"Equity Index" },
  "IVV":   { name:"iShares Core S&P 500 ETF",                         price:568.77, nav:568.77, yield_annual:0.0117, divFreq:"quarterly", total_div_1y:6.646, one_y_start:475.64, six_m_start:533.00, three_m_start:569.50, ytd_start:570.00, recent_divs:[["2025-03-28",1.498],["2025-06-27",1.935],["2025-09-26",1.811],["2025-12-26",1.402]], category:"Equity Index" },
  "VGT":   { name:"Vanguard Information Technology ETF",              price:575.84, nav:575.84, yield_annual:0.0040, divFreq:"quarterly", total_div_1y:2.298, one_y_start:499.26, six_m_start:546.38, three_m_start:609.38, ytd_start:611.63, recent_divs:[["2025-03-27",0.476],["2025-06-26",0.603],["2025-09-25",0.665],["2025-12-27",0.554]], category:"Equity Index" },
  "VTV":   { name:"Vanguard Value ETF",                               price:163.28, nav:163.28, yield_annual:0.0215, divFreq:"quarterly", total_div_1y:3.510, one_y_start:147.14, six_m_start:151.33, three_m_start:157.91, ytd_start:161.18, recent_divs:[["2025-03-27",0.836],["2025-06-26",0.919],["2025-09-25",0.919],["2025-12-27",0.836]], category:"Equity Index" },
  "SCHG":  { name:"Schwab U.S. Large-Cap Growth ETF",                 price:95.48,  nav:95.48,  yield_annual:0.0039, divFreq:"quarterly", total_div_1y:0.372,  one_y_start:81.96,  six_m_start:88.32,  three_m_start:98.53,  ytd_start:98.45,  recent_divs:[["2025-03-24",0.083],["2025-06-23",0.099],["2025-09-22",0.097],["2025-12-22",0.093]], category:"Equity Index" },
  "VXUS":  { name:"Vanguard Total International Stock ETF",           price:64.95,  nav:64.95,  yield_annual:0.0290, divFreq:"semiannual",total_div_1y:1.883,  one_y_start:58.45,  six_m_start:58.06,  three_m_start:60.44,  ytd_start:60.61,  recent_divs:[["2025-03-26",0.749],["2025-06-25",1.134]], category:"Equity Index" },
  "AGG":   { name:"iShares Core U.S. Aggregate Bond ETF",             price:97.94,  nav:97.94,  yield_annual:0.0362, divFreq:"monthly",   total_div_1y:3.543,  one_y_start:96.02,  six_m_start:95.56,  three_m_start:97.24,  ytd_start:98.03,  recent_divs:[["2025-03-03",0.283],["2025-04-01",0.285],["2025-05-01",0.296],["2025-06-02",0.303],["2025-07-01",0.298],["2025-08-01",0.300],["2025-09-02",0.302],["2025-10-01",0.301],["2025-11-03",0.292],["2025-12-01",0.297],["2025-12-31",0.296],["2026-02-02",0.290]], category:"Equity Index" },
};

// ============================================================
// HISTORICAL PROJECTION DATA
// price_cagr + avg_div_yield derived from max available history
// (supplemented by underlying index 10yr data for young ETFs)
// basis_years: actual ETF history used; basis: data source
// ============================================================
// ============================================================
// PROJECTION DATA — CORRECTED MODEL
//
// total_cagr = net annualised total return (price + dividends)
//   - For ETFs with real history: price CAGR + avg annual dividend yield
//     from their actual trading history.
//   - For single-stock YieldMax: the raw div_yield (60–200%) is NOT additive
//     with price_cagr, because high payouts fund NAV erosion. We use the
//     net total return actually earned by investors over the ETF's history.
//   - div_yield here is the SUSTAINABLE income yield used for income projections
//     (i.e., what % of portfolio value is paid as cash each year).
//
// price_cagr: used for the "income not reinvested" scenario (portfolio value growth)
// div_yield:  used to report annual cash income on the price value
// total_cagr: used for the "dividends reinvested" scenario (DRIP compounding)
// ============================================================
const PROJ = {
  // Equity Index — well-established, real history or strong index basis
  "JEPI":  { price_cagr:0.085, div_yield:0.090, total_cagr:0.175, basis_years:5.8,  basis:"ETF 5.8yr history + SPY model" },
  "JEPQ":  { price_cagr:0.105, div_yield:0.115, total_cagr:0.220, basis_years:3.8,  basis:"ETF 3.8yr history + QQQ model" },
  "QYLD":  { price_cagr:0.091, div_yield:0.194, total_cagr:0.285, basis_years:10.0, basis:"10-year ETF history" },
  "XYLD":  { price_cagr:0.084, div_yield:0.135, total_cagr:0.219, basis_years:10.0, basis:"10-year ETF history" },
  "RYLD":  { price_cagr:0.048, div_yield:0.175, total_cagr:0.223, basis_years:6.9,  basis:"ETF 6.9yr history + IWM model" },
  "DIVO":  { price_cagr:0.129, div_yield:0.068, total_cagr:0.197, basis_years:9.2,  basis:"ETF 9.2yr history" },
  "GPIQ":  { price_cagr:0.105, div_yield:0.110, total_cagr:0.215, basis_years:2.4,  basis:"QQQ 10yr + ETF yield (2.4yr)" },
  "GPIX":  { price_cagr:0.090, div_yield:0.090, total_cagr:0.180, basis_years:2.4,  basis:"SPY 10yr + ETF yield (2.4yr)" },
  "TSPY":  { price_cagr:0.090, div_yield:0.130, total_cagr:0.220, basis_years:1.6,  basis:"SPY 10yr + ETF yield (1.6yr)" },
  "SPYI":  { price_cagr:0.090, div_yield:0.120, total_cagr:0.210, basis_years:3.5,  basis:"SPY 10yr + ETF yield (3.5yr)" },
  "QQQI":  { price_cagr:0.105, div_yield:0.140, total_cagr:0.245, basis_years:2.1,  basis:"QQQ 10yr + ETF yield (2.1yr)" },
  "IWMI":  { price_cagr:0.070, div_yield:0.140, total_cagr:0.210, basis_years:1.7,  basis:"IWM 10yr + ETF yield (1.7yr)" },
  "DJIA":  { price_cagr:0.077, div_yield:0.119, total_cagr:0.196, basis_years:4.0,  basis:"ETF 4yr history" },
  "BALI":  { price_cagr:0.090, div_yield:0.089, total_cagr:0.179, basis_years:2.4,  basis:"SPY 10yr + ETF yield (2.4yr)" },
  "KLIP":  { price_cagr:0.040, div_yield:0.250, total_cagr:0.290, basis_years:3.1,  basis:"ETF 3.1yr history — China CC" },
  // Commodity
  "GLDW":  { price_cagr:0.060, div_yield:0.080, total_cagr:0.140, basis_years:0.3,  basis:"GLD 10yr + WeeklyPay yield model" },
  // Single-stock YieldMax — speculative, short history, high NAV erosion
  // total_cagr = net investor return (NOT price_cagr + raw div_yield)
  // div_yield = sustainable income yield used for income reporting only
  "TSLY":  { price_cagr:-0.05, div_yield:0.350, total_cagr:0.180, basis_years:3.3,  basis:"ETF 3.3yr net return — speculative ⚠" },
  "NVDY":  { price_cagr: 0.02, div_yield:0.400, total_cagr:0.200, basis_years:2.8,  basis:"ETF 2.8yr net return (NVDA bull run) — speculative ⚠" },
  "CONY":  { price_cagr:-0.10, div_yield:0.300, total_cagr:0.120, basis_years:2.6,  basis:"ETF 2.6yr net return, high NAV decay — speculative ⚠" },
  "MSFO":  { price_cagr:-0.02, div_yield:0.200, total_cagr:0.150, basis_years:2.5,  basis:"ETF 2.5yr net return — speculative ⚠" },
  "AMZY":  { price_cagr: 0.05, div_yield:0.250, total_cagr:0.200, basis_years:2.6,  basis:"ETF 2.6yr net return — speculative ⚠" },
  // Fund of funds
  "YMAX":  { price_cagr:-0.10, div_yield:0.200, total_cagr:0.080, basis_years:2.1,  basis:"ETF 2.1yr history — fund of high-decay ETFs ⚠" },
  "YMAG":  { price_cagr: 0.03, div_yield:0.250, total_cagr:0.200, basis_years:2.1,  basis:"ETF 2.1yr history — Mag7 bull run, speculative ⚠" },
  // Broad-market ETFs — 10-year S&P 500 / index history
  "SPY":   { price_cagr:0.105, div_yield:0.013, total_cagr:0.118, basis_years:10.0, basis:"S&P 500 10-year avg (2015–2025)" },
  "IVV":   { price_cagr:0.105, div_yield:0.013, total_cagr:0.118, basis_years:10.0, basis:"S&P 500 10-year avg (2015–2025)" },
  "VOO":   { price_cagr:0.105, div_yield:0.013, total_cagr:0.118, basis_years:10.0, basis:"S&P 500 10-year avg (2015–2025)" },
  "VTI":   { price_cagr:0.103, div_yield:0.014, total_cagr:0.117, basis_years:10.0, basis:"Total market 10-year avg (2015–2025)" },
  "QQQ":   { price_cagr:0.178, div_yield:0.006, total_cagr:0.184, basis_years:10.0, basis:"Nasdaq-100 10-year avg (2015–2025)" },
  "VGT":   { price_cagr:0.195, div_yield:0.005, total_cagr:0.200, basis_years:10.0, basis:"Tech sector 10-year avg (2015–2025)" },
  "VTV":   { price_cagr:0.083, div_yield:0.022, total_cagr:0.105, basis_years:10.0, basis:"Value index 10-year avg (2015–2025)" },
  "SCHG":  { price_cagr:0.155, div_yield:0.005, total_cagr:0.160, basis_years:10.0, basis:"Large-cap growth 10-year avg (2015–2025)" },
  "VXUS":  { price_cagr:0.048, div_yield:0.030, total_cagr:0.078, basis_years:10.0, basis:"Intl equity 10-year avg (2015–2025)" },
  "AGG":   { price_cagr:0.008, div_yield:0.033, total_cagr:0.041, basis_years:10.0, basis:"US bond aggregate 10-year avg (2015–2025)" },
};

// For any unknown ticker fetched live: derive projection from its own CAGR data
// Cap values to prevent runaway compounding from short-history anomalies
function buildProjFromLive(d) {
  const yrs = d.years_available || 1;
  // Raw values from server
  let pc = d.price_cagr   || 0.05;
  let dy = d.trailing_div_yield || d.yield_annual || 0.08;
  // Dampen short-history CAGRs — 1yr return is not a reliable projection basis
  if (yrs < 1.5) {
    // Blend 50% toward 10% (long-run market avg) to avoid using a single bull/bear year
    pc = pc * 0.3 + 0.10 * 0.7;
    dy = Math.min(dy, 0.25);
  } else if (yrs < 3) {
    pc = pc * 0.6 + 0.09 * 0.4;
    dy = Math.min(dy, 0.25);
  }
  pc = Math.min(Math.max(pc, -0.20), 0.35);
  dy = Math.min(Math.max(dy, 0),     0.30);  // cap income yield at 30% for projection
  const total_cagr = Math.min(pc + dy, 0.45); // hard cap total at 45%
  return {
    price_cagr: pc, div_yield: dy, total_cagr,
    basis_years: yrs,
    basis: `ETF history (${yrs.toFixed(1)}yr)${yrs < 3 ? ' — limited history ⚠' : ''}`
  };
}

// Runtime ETF store — starts from BUILTIN, enriched by live fetches
let ETF_DATA = { ...BUILTIN };
// Track which tickers came live vs cached
let ETF_SOURCE = {}; // ticker -> 'live' | 'cache'

// ============================================================
// STATE
// ============================================================
let holdings = {};
let charts = {};
let searchDebounceTimer = null;
let _lastEtfResults = null;   // stored for DRIP re-render
let _lastPortfolioValue = 0;
// Per-scenario rate overrides (null = use computed default)
let _scenarioOverrides = { bear: { price: null, div: null }, base: { price: null, div: null }, bull: { price: null, div: null } };

// ============================================================
// SERVER HEALTH
// ============================================================
async function checkServer() {
  // No backend configured — running as a static GitHub Pages app.
  // Hide the server badge entirely; the static YAHOO FINANCE badge stays visible.
  if (!CLOUD_SERVER_URL) {
    serverOnline = false;
    const badge = document.getElementById('serverBadge');
    if (badge) badge.style.display = 'none';
    const notice = document.getElementById('serverNotice');
    if (notice) notice.style.display = 'none';
    return false;
  }
  try {
    const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(1500) });
    if (r.ok) {
      serverOnline = true;
      const badge = document.getElementById('serverBadge');
      badge.className = 'badge badge-live';
      badge.innerHTML = '<div class="live-dot"></div>SERVER LIVE';
      badge.style.display = 'flex';
      document.getElementById('serverNotice').style.display = 'none';
      return true;
    }
  } catch {}
  serverOnline = false;
  const badge = document.getElementById('serverBadge');
  badge.className = 'badge badge-cache';
  badge.innerHTML = '<div class="cache-dot"></div>OFFLINE MODE';
  badge.style.display = 'flex';
  return false;
}

// ============================================================
// LIVE DATA FETCH — direct Yahoo Finance via allorigins CORS proxy
// ============================================================

// Parse a Yahoo Finance quoteSummary response into our ETF_DATA shape
function _parseYahooData(ticker, d) {
  const result = d?.quoteSummary?.result?.[0];
  if (!result) return null;

  const price  = result.price || {};
  const sumDetail = result.summaryDetail || {};
  const calEvents = result.calendarEvents || {};
  const keyStats  = result.defaultKeyStatistics || {};

  const currentPrice = price.regularMarketPrice?.raw ?? 0;
  if (!currentPrice) return null;

  // Dividend yield and trailing 12-month dividends
  const yieldAnnual = sumDetail.dividendYield?.raw ?? (sumDetail.trailingAnnualDividendYield?.raw ?? 0);
  const divRate     = sumDetail.dividendRate?.raw  ?? (sumDetail.trailingAnnualDividendRate?.raw ?? 0);

  // NAV (for ETFs); fall back to price
  const nav = keyStats.fundInceptionDate ? currentPrice : (price.regularMarketPrice?.raw ?? currentPrice);

  // Assemble into the shape the simulator expects
  const out = {
    name:          price.longName || price.shortName || ticker,
    price:         currentPrice,
    nav:           nav,
    yield_annual:  yieldAnnual,
    total_div_1y:  divRate,
    divFreq:       ETF_DATA[ticker]?.divFreq ?? 'monthly',   // keep cached freq if available
    recent_divs:   ETF_DATA[ticker]?.recent_divs ?? [],
    one_y_start:   (price.fiftyTwoWeekLow?.raw  ?? currentPrice),
    six_m_start:   ETF_DATA[ticker]?.six_m_start   ?? currentPrice,
    three_m_start: ETF_DATA[ticker]?.three_m_start ?? currentPrice,
    ytd_start:     ETF_DATA[ticker]?.ytd_start     ?? currentPrice,
    category:      ETF_DATA[ticker]?.category      ?? '',
    _liveAt:       Date.now(),
  };
  return out;
}

async function fetchLive(ticker) {
  ticker = ticker.toUpperCase();
  try {
    const modules = 'price,summaryDetail,defaultKeyStatistics,calendarEvents';
    const yahooUrl = `https://query1.finance.yahoo.com/v11/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(yahooUrl)}`;

    const r = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const outer = await r.json();
    const d = JSON.parse(outer.contents || '{}');
    const parsed = _parseYahooData(ticker, d);
    if (!parsed) return null;

    ETF_DATA[ticker]   = { ...ETF_DATA[ticker], ...parsed }; // merge, keeping cached divs/freq
    ETF_SOURCE[ticker] = 'live';
    return ETF_DATA[ticker];
  } catch { return null; }
}

// Session-level fetch lock so we only hit Yahoo once per ticker per page load
const _liveFetchCache = {};

async function ensureData(ticker) {
  ticker = ticker.toUpperCase();
  if (ETF_SOURCE[ticker] === 'live') return ETF_DATA[ticker]; // already fresh

  // Try live fetch (once per session per ticker)
  if (!_liveFetchCache[ticker]) {
    _liveFetchCache[ticker] = fetchLive(ticker).then(live => {
      if (live) {
        // Update badge to show we have live data
        const badge = document.getElementById('serverBadge');
        if (badge) {
          badge.className = 'badge badge-live';
          badge.innerHTML = '<div class="live-dot"></div>YAHOO LIVE';
          badge.style.display = 'flex';
        }
      }
      return live;
    });
  }
  const live = await _liveFetchCache[ticker];
  if (live) return live;

  // Fall back to built-in cache
  const cached = ETF_DATA[ticker];
  if (cached && cached.price > 0) { ETF_SOURCE[ticker] = 'cache'; return cached; }
  return null;
}

// ============================================================
// SEARCH
// ============================================================
const QUICK_SUGGESTIONS = [
  { ticker:'JEPI', name:'JPMorgan Equity Premium Income ETF' },
  { ticker:'JEPQ', name:'JPMorgan Nasdaq Equity Premium Income ETF' },
  { ticker:'GPIX', name:'Goldman Sachs S&P 500 Premium Income ETF' },
  { ticker:'GPIQ', name:'Goldman Sachs Nasdaq-100 Premium Income ETF' },
  { ticker:'TSPY', name:'TappAlpha SPY Growth & Daily Income ETF' },
  { ticker:'SPYI', name:'Neos S&P 500 High Income ETF' },
  { ticker:'QQQI', name:'NEOS Nasdaq-100 High Income ETF' },
  { ticker:'QYLD', name:'Global X NASDAQ 100 Covered Call ETF' },
  { ticker:'XYLD', name:'Global X S&P 500 Covered Call ETF' },
  { ticker:'RYLD', name:'Global X Russell 2000 Covered Call ETF' },
  { ticker:'DJIA', name:'Global X Dow 30 Covered Call ETF' },
  { ticker:'IWMI', name:'NEOS Russell 2000 High Income ETF' },
  { ticker:'DIVO', name:'Amplify CWP Enhanced Dividend Income ETF' },
  { ticker:'BALI', name:'iShares U.S. Large Cap Premium Income Active ETF' },
  { ticker:'KLIP', name:'KraneShares KWEB Covered Call Strategy ETF' },
  { ticker:'GLDW', name:'Roundhill Gold WeeklyPay ETF' },
  { ticker:'SPY',  name:'SPDR S&P 500 ETF Trust' },
  { ticker:'QQQ',  name:'Invesco QQQ Trust' },
  { ticker:'VOO',  name:'Vanguard S&P 500 ETF' },
  { ticker:'VTI',  name:'Vanguard Total Stock Market ETF' },
  { ticker:'IVV',  name:'iShares Core S&P 500 ETF' },
  { ticker:'VGT',  name:'Vanguard Information Technology ETF' },
  { ticker:'VTV',  name:'Vanguard Value ETF' },
  { ticker:'SCHG', name:'Schwab U.S. Large-Cap Growth ETF' },
  { ticker:'VXUS', name:'Vanguard Total International Stock ETF' },
  { ticker:'AGG',  name:'iShares Core U.S. Aggregate Bond ETF' },
  { ticker:'TSLY', name:'YieldMax TSLA Option Income Strategy ETF' },
  { ticker:'NVDY', name:'YieldMax NVDA Option Income Strategy ETF' },
  { ticker:'CONY', name:'YieldMax COIN Option Income Strategy ETF' },
  { ticker:'MSFO', name:'YieldMax MSFT Option Income Strategy ETF' },
  { ticker:'AMZY', name:'YieldMax AMZN Option Income Strategy ETF' },
  { ticker:'YMAX', name:'YieldMax Universe Fund of Option Income ETFs' },
  { ticker:'YMAG', name:'YieldMax Magnificent 7 Fund of Option Income ETFs' },
];

document.getElementById('etfSearch').addEventListener('input', function() {
  clearTimeout(searchDebounceTimer);
  const q = this.value.trim();
  const dd = document.getElementById('searchDropdown');
  const spinner = document.getElementById('searchSpinner');

  if (!q) { dd.style.display='none'; return; }

  // Immediate local match — use live data from ETF_DATA if already fetched
  const localMatches = QUICK_SUGGESTIONS.filter(s =>
    s.ticker.toLowerCase().includes(q.toLowerCase()) ||
    s.name.toLowerCase().includes(q.toLowerCase())
  ).slice(0, 8);

  if (localMatches.length > 0) {
    renderDropdown(localMatches.map(s => ({
      ticker: s.ticker,
      name:   ETF_DATA[s.ticker]?.name || s.name,
      source: ETF_SOURCE[s.ticker] || 'cache',
      yield_annual: ETF_DATA[s.ticker]?.yield_annual
    })));
  }

  // Kick off a live fetch for any matched ticker not yet fetched
  // Store in _liveFetchCache to prevent duplicate fetches
  localMatches.forEach(s => {
    if (ETF_SOURCE[s.ticker] !== 'live' && !_liveFetchCache[s.ticker]) {
      _liveFetchCache[s.ticker] = fetchLive(s.ticker).then(result => {
        // Refresh dropdown if still showing same query
        if (document.getElementById('etfSearch').value.trim() === q) {
          renderDropdown(localMatches.map(s => ({
            ticker: s.ticker,
            name:   ETF_DATA[s.ticker]?.name || s.name,
            source: ETF_SOURCE[s.ticker] || 'cache',
            yield_annual: ETF_DATA[s.ticker]?.yield_annual
          })));
        }
        return result;
      });
    }
  });
});

function renderDropdown(items) {
  const dd = document.getElementById('searchDropdown');
  if (items.length === 0) {
    dd.innerHTML = '<div style="padding:12px 14px;color:#718096;font-size:13px;">No ETFs found. Try: JEPI, GPIX, TSPY, QYLD…</div>';
  } else {
    dd.innerHTML = items.map(item => {
      const added = holdings[item.ticker] ? ' ✓' : '';
      const yieldStr = item.yield_annual != null ? (item.yield_annual * 100).toFixed(1) + '% yield' : '';
      const srcTag = item.source === 'live'
        ? '<span class="sri-live-tag">LIVE</span>'
        : '<span class="sri-cache-tag">CACHED</span>';
      return `<div class="sri" onclick="addETF('${item.ticker}')">
        <div>
          <div class="sri-ticker">${item.ticker}${srcTag}${added ? ' <span style="color:#68d391;font-size:11px;">✓ added</span>' : ''}</div>
          <div class="sri-name">${item.name}</div>
          <div class="sri-meta">${item.source === 'live' ? 'Live from Yahoo Finance' : 'Cached data (Mar 2026)'}</div>
        </div>
        <div class="sri-yield">${yieldStr}</div>
      </div>`;
    }).join('');
  }
  dd.style.display = 'block';
}

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrapper')) {
    document.getElementById('searchDropdown').style.display = 'none';
  }
});

// ============================================================
// HOLDINGS
// ============================================================
async function addETF(ticker) {
  ticker = ticker.toUpperCase();
  document.getElementById('searchDropdown').style.display = 'none';
  document.getElementById('etfSearch').value = '';

  if (holdings[ticker]) return; // already added

  // Show loading placeholder
  holdings[ticker] = 0;
  renderHoldings(true);

  // Fetch data (live or cache)
  const data = await ensureData(ticker);
  if (!data) {
    delete holdings[ticker];
    alert(`Could not find data for "${ticker}". Check the ticker symbol and try again.`);
    renderHoldings();
    return;
  }

  // Auto-distribute evenly
  const tickers = Object.keys(holdings);
  const count = tickers.length;
  const even = Math.round(100 / count);
  tickers.forEach((t, i) => {
    holdings[t] = i === tickers.length - 1 ? 100 - even * (count - 1) : even;
  });

  renderHoldings();
}

function removeETF(ticker) {
  delete holdings[ticker];
  renderHoldings();
  if (Object.keys(holdings).length === 0) {
    document.getElementById('resultsPanel').style.display = 'none';
    document.getElementById('emptyState').style.display = 'flex';
  }
}

function renderHoldings(loading = false) {
  const list = document.getElementById('holdingsList');
  const tickers = Object.keys(holdings);
  document.getElementById('holdingCount').textContent = `(${tickers.length} ETF${tickers.length!==1?'s':''})`;

  if (tickers.length === 0) {
    list.innerHTML = '<div class="no-holdings">Search and add ETFs above</div>';
    document.getElementById('allocSummary').style.display = 'none';
    return;
  }

  list.innerHTML = tickers.map(t => {
    const d = ETF_DATA[t];
    const pct = holdings[t];
    const dollars = d ? fmt$(getPortfolioSize() * pct / 100) : '…';
    const priceStr = d ? `${fmt$(d.price)}/share · ${(d.yield_annual*100).toFixed(1)}% yield` : 'Loading…';
    const srcClass = ETF_SOURCE[t] === 'live' ? 'src-live' : 'src-cache';
    const srcLabel = ETF_SOURCE[t] === 'live' ? 'LIVE' : 'CACHED';
    const nameStr = d ? d.name.substring(0,42)+(d.name.length>42?'…':'') : t;

    return `<div class="holding-card" id="hc-${t}">
      <div class="holding-header">
        <div>
          <div class="holding-ticker">${t}<span class="holding-source ${srcClass}">${srcLabel}</span></div>
          <div class="holding-name">${nameStr}</div>
        </div>
        <button class="holding-remove" onclick="removeETF('${t}')">✕</button>
      </div>
      <div class="alloc-row">
        <input type="range" class="alloc-slider" min="0" max="100" value="${pct}"
          oninput="updateAlloc('${t}',this.value)" />
        <input type="number" class="alloc-input" min="0" max="100" value="${pct}"
          onchange="updateAlloc('${t}',this.value)" />
        <span style="font-size:11px;color:#718096;">%</span>
      </div>
      <div class="holding-price">${dollars} · ${priceStr}</div>
    </div>`;
  }).join('');

  document.getElementById('allocSummary').style.display = 'block';
  updateAllocBar();
}

function updateAlloc(ticker, val) {
  val = Math.max(0, Math.min(100, parseInt(val) || 0));
  holdings[ticker] = val;
  const card = document.getElementById('hc-' + ticker);
  if (card) {
    card.querySelector('.alloc-slider').value = val;
    card.querySelector('.alloc-input').value = val;
    const d = ETF_DATA[ticker];
    const dollars = d ? fmt$(getPortfolioSize() * val / 100) : '…';
    const priceStr = d ? `${fmt$(d.price)}/share · ${(d.yield_annual*100).toFixed(1)}% yield` : '…';
    card.querySelector('.holding-price').textContent = `${dollars} · ${priceStr}`;
  }
  updateAllocBar();
}

function updateAllocBar() {
  const total = Object.values(holdings).reduce((a,b)=>a+b,0);
  const fill = document.getElementById('allocBarFill');
  const text = document.getElementById('totalAllocText');
  const hint = document.getElementById('allocHint');
  fill.style.width = Math.min(total, 100) + '%';
  text.textContent = total + '%';
  if (total < 100)      { fill.style.background='#d69e2e'; text.style.color='#f6e05e'; hint.textContent=`⚠ ${100-total}% unallocated`; }
  else if (total > 100) { fill.style.background='#e53e3e'; text.style.color='#fc8181'; hint.textContent=`⚠ Over by ${total-100}%`; }
  else                  { fill.style.background='#38a169'; text.style.color='#68d391'; hint.textContent='✓ Fully allocated'; }
}

// ============================================================
// PORTFOLIO CALCULATION
// ============================================================
