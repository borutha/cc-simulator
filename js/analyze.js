// ============================================================
// v1.2 — PORTFOLIO ANALYZER TAB
//
// Features:
//   1. Load CSV (same Fidelity format as Rebalancing)
//   2. Manual ticker add + value entry
//   3. Sector concentration chart + overlap flags
//   4. ETF top-holdings overlap matrix
//   5. AI analysis summary (live market sentiment via backend)
//   6. 1yr / 5yr growth predictions (Monte Carlo engine)
// ============================================================

// ---- STATE ----
let anPositions = [];   // { symbol, desc, value, pct, isManual }
let anMode      = null; // 'csv' | 'manual' | null
let anRaw       = null;
let anFilter    = 'ALL';
let anSectorChart    = null;
let anOverlapChart   = null;
let anGrowthChart1yr = null;
let anGrowthChart5yr = null;

// ---- SECTOR DATA ----
// Approximate sector weights for known ETFs (top-3 sectors by weight)
const AN_SECTORS = {
  // CC ETFs — S&P 500 based
  JEPI:  { Technology:20, Financials:15, Healthcare:13, Industrials:10, ConsumerDisc:9, Energy:7, Utilities:6, Materials:5, ConsumerStaple:8, RealEstate:4, Communication:3 },
  JEPQ:  { Technology:48, Communication:16, ConsumerDisc:12, Financials:7, Healthcare:5, Industrials:4, ConsumerStaple:2, Energy:2, Materials:2, RealEstate:1, Utilities:1 },
  XYLD:  { Technology:29, Healthcare:13, Financials:13, ConsumerDisc:11, Communication:9, Industrials:8, ConsumerStaple:7, Energy:4, Materials:3, Utilities:2, RealEstate:2 },
  QYLD:  { Technology:49, Communication:16, ConsumerDisc:12, Financials:7, Healthcare:5, Industrials:4, ConsumerStaple:2, Energy:2, Materials:1, RealEstate:1, Utilities:1 },
  RYLD:  { Financials:17, Industrials:16, Healthcare:13, Technology:12, ConsumerDisc:11, Energy:7, Materials:5, ConsumerStaple:5, Utilities:5, RealEstate:5, Communication:4 },
  DIVO:  { Technology:22, Financials:18, Healthcare:14, Industrials:12, ConsumerStaple:10, Energy:9, Materials:5, Utilities:4, ConsumerDisc:4, Communication:2, RealEstate:0 },
  SPYI:  { Technology:29, Healthcare:13, Financials:13, ConsumerDisc:11, Communication:9, Industrials:8, ConsumerStaple:7, Energy:4, Materials:3, Utilities:2, RealEstate:2 },
  QQQI:  { Technology:49, Communication:16, ConsumerDisc:12, Financials:7, Healthcare:5, Industrials:4, ConsumerStaple:2, Energy:2, Materials:1, RealEstate:1, Utilities:1 },
  GPIQ:  { Technology:48, Communication:16, ConsumerDisc:12, Financials:7, Healthcare:5, Industrials:4, ConsumerStaple:2, Energy:2, Materials:2, RealEstate:1, Utilities:1 },
  GPIX:  { Technology:29, Healthcare:13, Financials:13, ConsumerDisc:11, Communication:9, Industrials:8, ConsumerStaple:7, Energy:4, Materials:3, Utilities:2, RealEstate:2 },
  KLIP:  { Technology:29, Healthcare:13, Financials:13, ConsumerDisc:11, Communication:9, Industrials:8, ConsumerStaple:7, Energy:4, Materials:3, Utilities:2, RealEstate:2 },
  // Broad market
  SPY:   { Technology:29, Healthcare:13, Financials:13, ConsumerDisc:11, Communication:9, Industrials:8, ConsumerStaple:7, Energy:4, Materials:3, Utilities:2, RealEstate:2 },
  VOO:   { Technology:29, Healthcare:13, Financials:13, ConsumerDisc:11, Communication:9, Industrials:8, ConsumerStaple:7, Energy:4, Materials:3, Utilities:2, RealEstate:2 },
  IVV:   { Technology:29, Healthcare:13, Financials:13, ConsumerDisc:11, Communication:9, Industrials:8, ConsumerStaple:7, Energy:4, Materials:3, Utilities:2, RealEstate:2 },
  VTI:   { Technology:27, Healthcare:13, Financials:13, ConsumerDisc:11, Industrials:10, Communication:9, ConsumerStaple:6, Energy:4, Materials:3, Utilities:2, RealEstate:2 },
  QQQ:   { Technology:49, Communication:16, ConsumerDisc:12, Financials:7, Healthcare:5, Industrials:4, ConsumerStaple:2, Energy:2, Materials:1, RealEstate:1, Utilities:1 },
  VGT:   { Technology:95, Communication:3, ConsumerDisc:2, Financials:0, Healthcare:0, Industrials:0, ConsumerStaple:0, Energy:0, Materials:0, Utilities:0, RealEstate:0 },
  SCHD:  { Financials:18, Industrials:17, ConsumerStaple:14, Healthcare:13, Energy:10, Technology:9, Materials:5, ConsumerDisc:5, Utilities:5, Communication:3, RealEstate:1 },
  SCHG:  { Technology:48, Communication:14, ConsumerDisc:12, Financials:6, Healthcare:6, Industrials:6, ConsumerStaple:3, Energy:1, Materials:2, Utilities:1, RealEstate:1 },
  VTV:   { Financials:21, Healthcare:20, Industrials:13, ConsumerStaple:12, Energy:10, Technology:8, Utilities:6, Materials:4, ConsumerDisc:4, Communication:2, RealEstate:0 },
  VXUS:  { Financials:20, Industrials:14, Technology:12, ConsumerDisc:11, Healthcare:10, Materials:7, ConsumerStaple:7, Communication:7, Energy:5, Utilities:4, RealEstate:3 },
  IWM:   { Financials:17, Industrials:16, Healthcare:14, Technology:12, ConsumerDisc:11, Energy:7, Materials:5, ConsumerStaple:5, Utilities:5, RealEstate:5, Communication:3 },
  AGG:   { Bonds:100, Technology:0, Financials:0, Healthcare:0, Industrials:0, ConsumerDisc:0, ConsumerStaple:0, Energy:0, Materials:0, Utilities:0, Communication:0, RealEstate:0 },
  GLD:   { Commodities:100, Technology:0, Financials:0, Healthcare:0, Industrials:0, ConsumerDisc:0, ConsumerStaple:0, Energy:0, Materials:0, Utilities:0, Communication:0, RealEstate:0 },
  GLDW:  { Commodities:100, Technology:0, Financials:0, Healthcare:0, Industrials:0, ConsumerDisc:0, ConsumerStaple:0, Energy:0, Materials:0, Utilities:0, Communication:0, RealEstate:0 },
  // YieldMax / single-stock
  TSLY:  { Technology:50, ConsumerDisc:50, Financials:0, Healthcare:0, Industrials:0, Communication:0, ConsumerStaple:0, Energy:0, Materials:0, Utilities:0, RealEstate:0 },
  NVDY:  { Technology:100, Financials:0, Healthcare:0, Industrials:0, ConsumerDisc:0, Communication:0, ConsumerStaple:0, Energy:0, Materials:0, Utilities:0, RealEstate:0 },
  CONY:  { Technology:60, Communication:40, Financials:0, Healthcare:0, Industrials:0, ConsumerDisc:0, ConsumerStaple:0, Energy:0, Materials:0, Utilities:0, RealEstate:0 },
  MSFO:  { Technology:100, Financials:0, Healthcare:0, Industrials:0, ConsumerDisc:0, Communication:0, ConsumerStaple:0, Energy:0, Materials:0, Utilities:0, RealEstate:0 },
  AMZY:  { ConsumerDisc:55, Technology:45, Financials:0, Healthcare:0, Industrials:0, Communication:0, ConsumerStaple:0, Energy:0, Materials:0, Utilities:0, RealEstate:0 },
  YMAX:  { Technology:40, Communication:20, ConsumerDisc:15, Financials:10, Healthcare:5, Industrials:5, ConsumerStaple:3, Energy:2, Materials:0, Utilities:0, RealEstate:0 },
  YMAG:  { Technology:50, Communication:25, ConsumerDisc:15, Financials:5, Healthcare:3, Industrials:2, ConsumerStaple:0, Energy:0, Materials:0, Utilities:0, RealEstate:0 },
  // Vanguard international / real estate
  VWO:   { Financials:22, Technology:18, ConsumerDisc:13, ConsumerStaple:8, Materials:7, Industrials:7, Energy:6, Communication:6, Healthcare:5, Utilities:4, RealEstate:4 },
  VNQ:   { RealEstate:100 },
  VNQI:  { RealEstate:100 },
  VSS:   { Financials:18, Industrials:16, Technology:12, ConsumerDisc:11, Healthcare:10, Materials:9, ConsumerStaple:7, Energy:5, Utilities:5, RealEstate:4, Communication:3 },
  // Schwab broad market
  SCHA:  { Financials:17, Industrials:16, Healthcare:14, Technology:12, ConsumerDisc:11, Energy:7, Materials:5, ConsumerStaple:5, Utilities:5, RealEstate:5, Communication:3 },
  SCHB:  { Technology:27, Healthcare:13, Financials:13, ConsumerDisc:11, Industrials:10, Communication:9, ConsumerStaple:6, Energy:4, Materials:3, Utilities:2, RealEstate:2 },
  SCHX:  { Technology:29, Healthcare:13, Financials:13, ConsumerDisc:11, Communication:9, Industrials:8, ConsumerStaple:7, Energy:4, Materials:3, Utilities:2, RealEstate:2 },
  SCHF:  { Financials:20, Industrials:15, Technology:11, ConsumerDisc:11, Healthcare:11, Materials:7, ConsumerStaple:7, Communication:7, Energy:5, Utilities:4, RealEstate:3 },
  SCHC:  { Industrials:20, Financials:18, Technology:12, ConsumerDisc:12, Healthcare:10, Materials:8, ConsumerStaple:6, Energy:5, Utilities:5, RealEstate:4, Communication:0 },
  SCHM:  { Financials:16, Industrials:15, Technology:14, Healthcare:13, ConsumerDisc:12, Energy:7, Materials:6, ConsumerStaple:5, Utilities:5, RealEstate:5, Communication:2 },
  SCHI:  { Bonds:100 },
  SCHZ:  { Bonds:100 },
  // Vanguard bond / fixed income
  VGIT:  { Bonds:100 },
  VGLT:  { Bonds:100 },
  VGSH:  { Bonds:100 },
  BND:   { Bonds:100 },
  BNDX:  { Bonds:100 },
  BSV:   { Bonds:100 },
  BIV:   { Bonds:100 },
  BLV:   { Bonds:100 },
  // iShares bond / fixed income
  TLT:   { Bonds:100 },
  IEF:   { Bonds:100 },
  SHY:   { Bonds:100 },
  TIP:   { Bonds:100 },
  GOVT:  { Bonds:100 },
  LQD:   { Bonds:100 },
  HYG:   { Bonds:100 },
  MUB:   { Bonds:100 },
  // Commodities / alternatives
  SLV:   { Commodities:100 },
  IAU:   { Commodities:100 },
  // More Vanguard equity
  VB:    { Financials:17, Industrials:16, Healthcare:14, Technology:12, ConsumerDisc:11, Energy:7, Materials:5, ConsumerStaple:5, Utilities:5, RealEstate:5, Communication:3 },
  VO:    { Financials:16, Industrials:15, Technology:14, Healthcare:13, ConsumerDisc:12, Energy:7, Materials:6, ConsumerStaple:5, Utilities:5, RealEstate:5, Communication:2 },
  VV:    { Technology:29, Healthcare:13, Financials:13, ConsumerDisc:11, Communication:9, Industrials:8, ConsumerStaple:7, Energy:4, Materials:3, Utilities:2, RealEstate:2 },
  VUG:   { Technology:48, Communication:14, ConsumerDisc:12, Financials:6, Healthcare:6, Industrials:6, ConsumerStaple:3, Energy:1, Materials:2, Utilities:1, RealEstate:1 },
  VIG:   { Technology:20, Financials:18, Healthcare:16, Industrials:15, ConsumerStaple:13, ConsumerDisc:8, Energy:4, Materials:3, Utilities:2, Communication:1, RealEstate:0 },
  VYM:   { Financials:22, Healthcare:14, Industrials:13, ConsumerStaple:12, Energy:11, Technology:9, Utilities:7, ConsumerDisc:5, Materials:4, Communication:3, RealEstate:0 },
  // iShares equity
  IWB:   { Technology:29, Healthcare:13, Financials:13, ConsumerDisc:11, Communication:9, Industrials:8, ConsumerStaple:7, Energy:4, Materials:3, Utilities:2, RealEstate:2 },
  IWF:   { Technology:46, Communication:15, ConsumerDisc:13, Healthcare:7, Financials:6, Industrials:6, ConsumerStaple:3, Energy:1, Materials:2, Utilities:1, RealEstate:0 },
  IWD:   { Financials:22, Healthcare:18, Industrials:12, ConsumerStaple:11, Energy:10, Technology:9, Utilities:7, Materials:4, ConsumerDisc:4, Communication:3, RealEstate:0 },
  IJR:   { Financials:17, Industrials:16, Healthcare:14, Technology:12, ConsumerDisc:11, Energy:7, Materials:5, ConsumerStaple:5, Utilities:5, RealEstate:5, Communication:3 },
  IJH:   { Financials:16, Industrials:15, Technology:14, Healthcare:13, ConsumerDisc:12, Energy:7, Materials:6, ConsumerStaple:5, Utilities:5, RealEstate:5, Communication:2 },
  // SPDR sector ETFs
  XLK:   { Technology:95, Communication:5 },
  XLF:   { Financials:100 },
  XLV:   { Healthcare:100 },
  XLI:   { Industrials:100 },
  XLE:   { Energy:100 },
  XLP:   { ConsumerStaple:100 },
  XLY:   { ConsumerDisc:100 },
  XLU:   { Utilities:100 },
  XLB:   { Materials:100 },
  XLRE:  { RealEstate:100 },
  XLC:   { Communication:100 },
  // Dividend / income
  DVY:   { Utilities:25, Financials:20, Energy:15, ConsumerStaple:12, RealEstate:10, Healthcare:8, Technology:5, Industrials:3, Materials:2, ConsumerDisc:0, Communication:0 },
  HDV:   { Energy:22, Healthcare:18, ConsumerStaple:17, Utilities:12, Financials:10, Technology:8, Communication:7, Industrials:4, Materials:2, ConsumerDisc:0, RealEstate:0 },
  NOBL:  { ConsumerStaple:22, Industrials:20, Financials:14, Materials:12, Healthcare:11, ConsumerDisc:8, Technology:6, Energy:4, Utilities:2, Communication:1, RealEstate:0 },
};

// Top-5 holdings for overlap analysis
const AN_TOP_HOLDINGS = {
  JEPI:  ['MSFT','AMZN','META','NVDA','AAPL'],
  JEPQ:  ['MSFT','NVDA','AAPL','AMZN','META'],
  XYLD:  ['MSFT','AAPL','NVDA','AMZN','GOOGL'],
  QYLD:  ['MSFT','NVDA','AAPL','AMZN','META'],
  RYLD:  ['FOUR','CSWI','SPSC','MGEE','IIPR'],
  DIVO:  ['AVGO','UNH','V','JPM','AMGN'],
  SPYI:  ['MSFT','AAPL','NVDA','AMZN','GOOGL'],
  QQQI:  ['MSFT','NVDA','AAPL','AMZN','META'],
  GPIQ:  ['MSFT','NVDA','AAPL','AMZN','META'],
  GPIX:  ['MSFT','AAPL','NVDA','AMZN','GOOGL'],
  KLIP:  ['MSFT','AAPL','NVDA','AMZN','GOOGL'],
  SPY:   ['MSFT','AAPL','NVDA','AMZN','GOOGL'],
  VOO:   ['MSFT','AAPL','NVDA','AMZN','GOOGL'],
  IVV:   ['MSFT','AAPL','NVDA','AMZN','GOOGL'],
  VTI:   ['MSFT','AAPL','NVDA','AMZN','GOOGL'],
  QQQ:   ['MSFT','NVDA','AAPL','AMZN','META'],
  VGT:   ['MSFT','AAPL','NVDA','AVGO','AMD'],
  SCHD:  ['BLK','AbbVie','CVX','AVGO','MO'],
  SCHG:  ['MSFT','NVDA','AAPL','AMZN','META'],
  VTV:   ['BRK.B','JPM','UNH','XOM','JNJ'],
  VXUS:  ['NOVO','SAP','TM','NVS','ASML'],
  IWM:   ['FOUR','CSWI','SPSC','MGEE','IIPR'],
  TSLY:  ['TSLA','TSLA','TSLA','TSLA','TSLA'],
  NVDY:  ['NVDA','NVDA','NVDA','NVDA','NVDA'],
  MSFO:  ['MSFT','MSFT','MSFT','MSFT','MSFT'],
  AMZY:  ['AMZN','AMZN','AMZN','AMZN','AMZN'],
  CONY:  ['COIN','COIN','COIN','COIN','COIN'],
  YMAX:  ['TSLA','NVDA','AAPL','AMZN','META'],
  YMAG:  ['MSFT','NVDA','AAPL','META','AMZN'],
  // Schwab equity
  SCHA:  ['FOUR','CSWI','SPSC','MGEE','IIPR'],
  SCHB:  ['MSFT','AAPL','NVDA','AMZN','GOOGL'],
  SCHX:  ['MSFT','AAPL','NVDA','AMZN','GOOGL'],
  SCHF:  ['NOVO','SAP','TM','NVS','ASML'],
  SCHC:  ['FOUR','CSWI','SPSC','TKO','MGEE'],
  SCHM:  ['CSWI','SPSC','MGEE','TKO','FOUR'],
  // Vanguard equity
  VB:    ['FOUR','CSWI','SPSC','MGEE','IIPR'],
  VO:    ['CSWI','SPSC','MGEE','TKO','FOUR'],
  VV:    ['MSFT','AAPL','NVDA','AMZN','GOOGL'],
  VUG:   ['MSFT','NVDA','AAPL','AMZN','META'],
  VIG:   ['MSFT','AAPL','JPM','UNH','AVGO'],
  VYM:   ['JPM','XOM','JNJ','PG','CVX'],
  // iShares equity
  IWB:   ['MSFT','AAPL','NVDA','AMZN','GOOGL'],
  IWF:   ['MSFT','NVDA','AAPL','AMZN','META'],
  IWD:   ['BRK.B','JPM','UNH','XOM','JNJ'],
  IJR:   ['FOUR','CSWI','SPSC','MGEE','IIPR'],
  IJH:   ['CSWI','SPSC','MGEE','TKO','FOUR'],
  // Dividend
  DVY:   ['VZ','MO','XOM','CVX','T'],
  HDV:   ['XOM','CVX','JNJ','PG','VZ'],
  NOBL:  ['PG','KO','JNJ','MMM','T'],
};

// Individual stock sector lookup (single dominant sector per ticker)
// Covers S&P 500 large-caps + common holdings in Schwab portfolios
const AN_STOCK_SECTORS = {
  // Technology
  AAPL:'Technology', MSFT:'Technology', NVDA:'Technology', AVGO:'Technology',
  AMD:'Technology',  INTC:'Technology', ORCL:'Technology', CRM:'Technology',
  ADBE:'Technology', CSCO:'Technology', QCOM:'Technology', TXN:'Technology',
  IBM:'Technology',  ACN:'Technology',  NOW:'Technology',  INTU:'Technology',
  AMAT:'Technology', LRCX:'Technology', KLAC:'Technology', MU:'Technology',
  PANW:'Technology', CDNS:'Technology', SNPS:'Technology', FTNT:'Technology',
  HPQ:'Technology',  DELL:'Technology', STX:'Technology',  WDC:'Technology',
  // Communication
  GOOGL:'Communication', GOOG:'Communication', META:'Communication',
  NFLX:'Communication',  DIS:'Communication',  CMCSA:'Communication',
  T:'Communication',     VZ:'Communication',   TMUS:'Communication',
  CHTR:'Communication',  WBD:'Communication',  PARA:'Communication',
  // Consumer Discretionary
  AMZN:'ConsumerDisc', TSLA:'ConsumerDisc', HD:'ConsumerDisc',
  MCD:'ConsumerDisc',  NKE:'ConsumerDisc',  SBUX:'ConsumerDisc',
  LOW:'ConsumerDisc',  TJX:'ConsumerDisc',  BKNG:'ConsumerDisc',
  EBAY:'ConsumerDisc', F:'ConsumerDisc',    GM:'ConsumerDisc',
  ROST:'ConsumerDisc', ORLY:'ConsumerDisc', AZO:'ConsumerDisc',
  YUM:'ConsumerDisc',  CMG:'ConsumerDisc',  DHI:'ConsumerDisc',
  LEN:'ConsumerDisc',  PHM:'ConsumerDisc',  APTV:'ConsumerDisc',
  // Consumer Staples
  WMT:'ConsumerStaple', COST:'ConsumerStaple', PG:'ConsumerStaple',
  KO:'ConsumerStaple',  PEP:'ConsumerStaple',  PM:'ConsumerStaple',
  MO:'ConsumerStaple',  MDLZ:'ConsumerStaple', CL:'ConsumerStaple',
  KMB:'ConsumerStaple', GIS:'ConsumerStaple',  K:'ConsumerStaple',
  HSY:'ConsumerStaple', EL:'ConsumerStaple',   SYY:'ConsumerStaple',
  CAG:'ConsumerStaple', CPB:'ConsumerStaple',  TSN:'ConsumerStaple',
  // Financials
  BRK:'Financials',   'BRK.B':'Financials', 'BRK.A':'Financials',
  JPM:'Financials',   BAC:'Financials',   WFC:'Financials',
  GS:'Financials',    MS:'Financials',    C:'Financials',
  AXP:'Financials',   BLK:'Financials',   SCHW:'Financials',
  USB:'Financials',   PNC:'Financials',   TFC:'Financials',
  COF:'Financials',   DFS:'Financials',   SYF:'Financials',
  ICE:'Financials',   CME:'Financials',   MCO:'Financials',
  SPGI:'Financials',  AON:'Financials',   MMC:'Financials',
  AIG:'Financials',   MET:'Financials',   PRU:'Financials',
  AFL:'Financials',   ALL:'Financials',   PGR:'Financials',
  // Healthcare
  UNH:'Healthcare',  JNJ:'Healthcare',  LLY:'Healthcare',
  ABBV:'Healthcare', MRK:'Healthcare',  ABT:'Healthcare',
  TMO:'Healthcare',  DHR:'Healthcare',  BMY:'Healthcare',
  AMGN:'Healthcare', GILD:'Healthcare', CVS:'Healthcare',
  MDT:'Healthcare',  SYK:'Healthcare',  BSX:'Healthcare',
  ISRG:'Healthcare', REGN:'Healthcare', VRTX:'Healthcare',
  BIIB:'Healthcare', ILMN:'Healthcare', IQV:'Healthcare',
  ZBH:'Healthcare',  BAX:'Healthcare',  BDX:'Healthcare',
  IOVA:'Healthcare', MRNA:'Healthcare', PFE:'Healthcare',
  // Industrials
  GE:'Industrials',  HON:'Industrials', UPS:'Industrials',
  CAT:'Industrials', DE:'Industrials',  MMM:'Industrials',
  BA:'Industrials',  RTX:'Industrials', LMT:'Industrials',
  NOC:'Industrials', GD:'Industrials',  FDX:'Industrials',
  EMR:'Industrials', ETN:'Industrials', PH:'Industrials',
  ROK:'Industrials', AME:'Industrials', CTAS:'Industrials',
  WM:'Industrials',  RSG:'Industrials', DAL:'Industrials',
  UAL:'Industrials', AAL:'Industrials', CSX:'Industrials',
  NSC:'Industrials', UNP:'Industrials',
  // Energy
  XOM:'Energy',  CVX:'Energy',  COP:'Energy',
  EOG:'Energy',  SLB:'Energy',  MPC:'Energy',
  PSX:'Energy',  VLO:'Energy',  PXD:'Energy',
  HAL:'Energy',  BKR:'Energy',  DVN:'Energy',
  FANG:'Energy', OXY:'Energy',  HES:'Energy',
  WMB:'Energy',  KMI:'Energy',  OKE:'Energy',
  // Materials
  LIN:'Materials',  APD:'Materials',  SHW:'Materials',
  ECL:'Materials',  FCX:'Materials',  NEM:'Materials',
  NUE:'Materials',  VMC:'Materials',  MLM:'Materials',
  DD:'Materials',   DOW:'Materials',  LYB:'Materials',
  PPG:'Materials',  ALB:'Materials',  CF:'Materials',
  // Utilities
  NEE:'Utilities',  DUK:'Utilities',  SO:'Utilities',
  D:'Utilities',    AEP:'Utilities',  EXC:'Utilities',
  SRE:'Utilities',  PEG:'Utilities',  XEL:'Utilities',
  WEC:'Utilities',  ES:'Utilities',   AWK:'Utilities',
  WTRG:'Utilities', ETR:'Utilities',  FE:'Utilities',
  PCG:'Utilities',  EIX:'Utilities',  PPL:'Utilities',
  // Real Estate
  AMT:'RealEstate',  PLD:'RealEstate', CCI:'RealEstate',
  EQIX:'RealEstate', PSA:'RealEstate', WELL:'RealEstate',
  DLR:'RealEstate',  SPG:'RealEstate', O:'RealEstate',
  VICI:'RealEstate', AVB:'RealEstate', EQR:'RealEstate',
};

// For overlap analysis: individual stocks "hold" only themselves
// This lets us detect when a stock you own directly is also inside an ETF
function _anGetHoldings(symbol) {
  if (AN_TOP_HOLDINGS[symbol]) return AN_TOP_HOLDINGS[symbol];
  // Stock: its holding is itself — catches overlap with ETFs that contain it
  if (AN_STOCK_SECTORS[symbol]) return [symbol];
  if (AN_LIVE_SECTORS[symbol]) return [symbol]; // live-fetched stock
  return [];
}

// ---- LIVE SECTOR LOOKUP ----
// Cache for symbols fetched from Yahoo Finance (persists for the session)
const AN_LIVE_SECTORS = {};   // symbol → sector string  (after fetch)
const AN_FETCH_PENDING = {};  // symbol → true  (in-flight, avoid duplicate requests)

// Map Yahoo Finance sector/category strings to our internal names
function _anMapYahooSector(raw) {
  if (!raw) return null;
  const r = raw.toLowerCase();
  if (r.includes('technology') || r.includes('tech'))        return 'Technology';
  if (r.includes('communication') || r.includes('telecom'))  return 'Communication';
  if (r.includes('consumer discret') || r.includes('cyclical')) return 'ConsumerDisc';
  if (r.includes('consumer staple') || r.includes('defensive')) return 'ConsumerStaple';
  if (r.includes('financial'))                               return 'Financials';
  if (r.includes('health'))                                  return 'Healthcare';
  if (r.includes('industrial'))                              return 'Industrials';
  if (r.includes('energy'))                                  return 'Energy';
  if (r.includes('material'))                                return 'Materials';
  if (r.includes('utilit'))                                  return 'Utilities';
  if (r.includes('real estate') || r.includes('realty'))     return 'RealEstate';
  if (r.includes('bond') || r.includes('fixed income') || r.includes('government') || r.includes('treasury')) return 'Bonds';
  if (r.includes('commodit') || r.includes('gold') || r.includes('silver') || r.includes('metal')) return 'Commodities';
  return null;
}

// Fetch sector for an unknown symbol.
// Yahoo Finance blocks direct browser requests (CORS), so we route through
// allorigins.win (free CORS proxy) → falls back to financialmodelingprep.com.
async function _anFetchSector(symbol) {
  if (AN_FETCH_PENDING[symbol]) return;
  AN_FETCH_PENDING[symbol] = true;
  try {
    // --- Attempt 1: Yahoo Finance via allorigins CORS proxy ---
    const yahooUrl = `https://query1.finance.yahoo.com/v11/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile,fundProfile,quoteType`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(yahooUrl)}`;
    try {
      const r = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        const outer = await r.json();
        const d = JSON.parse(outer.contents || '{}');
        const result = d?.quoteSummary?.result?.[0];
        const sector   = result?.assetProfile?.sector;
        const category = result?.fundProfile?.categoryName;
        const mapped   = _anMapYahooSector(sector || category);
        if (mapped) {
          AN_LIVE_SECTORS[symbol] = mapped;
          renderAnalyzerTable();
          return;
        }
      }
    } catch(e) { /* fall through */ }

    // --- Attempt 2: Financial Modeling Prep (free, no key, CORS-open) ---
    try {
      const fmpUrl = `https://financialmodelingprep.com/api/v3/profile/${encodeURIComponent(symbol)}?apikey=demo`;
      const r2 = await fetch(fmpUrl, { signal: AbortSignal.timeout(8000) });
      if (r2.ok) {
        const data = await r2.json();
        const profile = Array.isArray(data) ? data[0] : data;
        const mapped = _anMapYahooSector(profile?.sector || profile?.industry || '');
        if (mapped) {
          AN_LIVE_SECTORS[symbol] = mapped;
          renderAnalyzerTable();
          return;
        }
      }
    } catch(e) { /* fall through */ }

    // Both failed — mark so we don't retry
    AN_LIVE_SECTORS[symbol] = null;
    renderAnalyzerTable();
  } finally {
    delete AN_FETCH_PENDING[symbol];
  }
}

// Get single sector string for a symbol (stock or ETF)
// Returns sector immediately from local data, OR kicks off async fetch and returns '⏳'
function _anGetSector(symbol) {
  if (AN_STOCK_SECTORS[symbol]) return AN_STOCK_SECTORS[symbol];
  const sectors = AN_SECTORS[symbol];
  if (sectors) return Object.entries(sectors).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  // Check live cache
  if (symbol in AN_LIVE_SECTORS) return AN_LIVE_SECTORS[symbol] || '—';
  // Not known locally and not yet fetched — kick off background fetch
  _anFetchSector(symbol);
  return '⏳';
}

const AN_SECTOR_COLORS = {
  Technology:     '#4299e1',
  Communication:  '#9f7aea',
  ConsumerDisc:   '#ed8936',
  Financials:     '#48bb78',
  Healthcare:     '#fc8181',
  Industrials:    '#667eea',
  ConsumerStaple: '#38b2ac',
  Energy:         '#f6ad55',
  Materials:      '#68d391',
  Utilities:      '#b794f4',
  RealEstate:     '#fbd38d',
  Bonds:          '#a0aec0',
  Commodities:    '#d69e2e',
};

// ---- HELPERS ----

function anGetTotal() {
  return anPositions.reduce((s, p) => s + (p.value || 0), 0);
}

function anFmt$(n) {
  const abs = Math.abs(Math.round(n));
  const s = '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n < 0 ? '-' + s : s;
}

// ---- MODE SELECTION ----

function anSetMode(mode) {
  anMode      = mode;
  anPositions = [];
  anRaw       = null;
  anFilter    = 'ALL';

  document.getElementById('anModeCSV').classList.toggle('active', mode === 'csv');
  document.getElementById('anModeManual').classList.toggle('active', mode === 'manual');
  document.getElementById('anCSVSection').style.display    = mode === 'csv'    ? 'block' : 'none';
  document.getElementById('anManualSection').style.display = mode === 'manual' ? 'block' : 'none';
  document.getElementById('anFilterRow').style.display     = 'none';
  document.getElementById('anContent').style.display       = 'none';
  document.getElementById('anResults').style.display       = 'none';
}

// ---- CSV LOADING (same parser as rebalance) ----

async function handleAnFile(e) {
  const file  = e.target.files[0];
  if (!file) return;
  const errEl = document.getElementById('anUploadError');
  errEl.style.display = 'none';
  try {
    const result = await parseHoldingsFile(file);
    anRaw = result;
    populateAnAccountFilter(result.accounts);
    document.getElementById('anFilterRow').style.display = 'flex';
    anPositions = _anMergePositions(result.rawPositions, 'ALL');
    document.getElementById('anContent').style.display = 'block';
    renderAnalyzerTable();
  } catch(err) {
    errEl.textContent = '⚠️ Could not parse file: ' + err.message + '. Use a Fidelity CSV or Schwab XLSX export.';
    errEl.style.display = 'block';
  }
}

function populateAnAccountFilter(accounts) {
  const sel = document.getElementById('anAccountFilter');
  sel.innerHTML = '<option value="ALL">All Accounts</option>';
  accounts.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a; opt.textContent = a;
    sel.appendChild(opt);
  });
}

function applyAnAccountFilter() {
  if (!anRaw) return;
  anFilter    = document.getElementById('anAccountFilter').value;
  anPositions = _anMergePositions(anRaw.rawPositions, anFilter);
  renderAnalyzerTable();
}

function _anMergePositions(rawPositions, filter) {
  const map = {};
  rawPositions
    .filter(p => filter === 'ALL' || p.acct === filter)
    .forEach(p => {
      if (!map[p.symbol]) map[p.symbol] = { symbol: p.symbol, desc: p.desc, value: 0, qty: 0, isManual: false };
      map[p.symbol].value += p.value;
      map[p.symbol].qty   += p.qty;
    });
  return Object.values(map).sort((a, b) => b.value - a.value);
}

// ---- MANUAL SEARCH (reuses existing ETF search infra) ----

function initAnSearch() {
  const input = document.getElementById('anSearchInput');
  const dd    = document.getElementById('anSearchDropdown');
  if (!input) return;
  let timer = null;

  input.addEventListener('input', function() {
    clearTimeout(timer);
    const q = this.value.trim().toUpperCase();
    if (!q) { dd.style.display = 'none'; return; }
    timer = setTimeout(() => _renderAnDropdown(null, q), 200);
    // also try live search
    if (serverOnline && q.length >= 2) {
      fetch(`${API}/search?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(4000) })
        .then(r => r.json())
        .then(results => _renderAnDropdown(results, q))
        .catch(() => {});
    } else {
      const local = Object.keys(ETF_DATA)
        .filter(k => k.startsWith(q) || (ETF_DATA[k].name || '').toUpperCase().includes(q))
        .slice(0, 10)
        .map(k => ({ ticker: k, name: ETF_DATA[k].name || k, source: 'cache' }));
      _renderAnDropdown(local, q);
    }
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { dd.style.display = 'none'; input.value = ''; }
  });
  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dd.contains(e.target)) dd.style.display = 'none';
  });
}

function _renderAnDropdown(items, q) {
  const dd = document.getElementById('anSearchDropdown');
  if (!items || !items.length) {
    const local = Object.keys(ETF_DATA)
      .filter(k => k.startsWith(q) || (ETF_DATA[k].name || '').toUpperCase().includes(q))
      .slice(0, 10)
      .map(k => ({ ticker: k, name: ETF_DATA[k].name || k, source: 'cache' }));
    items = local;
  }
  if (!items.length) { dd.style.display = 'none'; return; }
  dd.innerHTML = items.map(it => {
    const srcTag = serverOnline
      ? `<span class="src-live">LIVE</span>`
      : `<span class="src-cache">CACHE</span>`;
    const yld = ETF_DATA[it.ticker]?.yield_annual
      ? ` · ${(ETF_DATA[it.ticker].yield_annual * 100).toFixed(1)}% yield` : '';
    return `<div class="search-item" onclick="anManualAdd('${it.ticker}','${(it.name||it.ticker).replace(/'/g,'\\\'').replace(/"/g,'')}')">
      <span class="tkbadge">${it.ticker}</span>
      <span style="font-size:12px;">${it.name||it.ticker}${yld}</span>
      ${srcTag}
    </div>`;
  }).join('');
  dd.style.display = 'block';
}

function anManualAdd(ticker, name) {
  document.getElementById('anSearchDropdown').style.display = 'none';
  document.getElementById('anSearchInput').value = '';
  if (anPositions.find(p => p.symbol === ticker)) {
    const inp = document.getElementById('anVal_' + ticker);
    if (inp) inp.focus();
    return;
  }
  anPositions.push({ symbol: ticker, desc: name, value: 0, isManual: true });
  document.getElementById('anContent').style.display = 'block';
  renderAnalyzerTable();
  setTimeout(() => { const v = document.getElementById('anVal_' + ticker); if (v) v.focus(); }, 50);
}

function anAddTicker() {
  const input = document.getElementById('anAddTicker');
  const sym   = (input.value || '').trim().toUpperCase();
  if (!sym) return;
  if (anPositions.find(p => p.symbol === sym)) { input.value = ''; return; }
  anPositions.push({ symbol: sym, desc: sym, value: 0, isManual: true });
  input.value = '';
  document.getElementById('anContent').style.display = 'block';
  renderAnalyzerTable();
  setTimeout(() => { const v = document.getElementById('anVal_' + sym); if (v) v.focus(); }, 50);
}

function setAnValue(sym, val) {
  const pos = anPositions.find(p => p.symbol === sym);
  if (pos) pos.value = parseFloat(val) || 0;
  _recalcAnPct();
}

function setAnPct(sym, val) {
  const pct = parseFloat(val) || 0;
  const pos = anPositions.find(p => p.symbol === sym);
  if (pos) pos.userPct = pct;
}

function deleteAnPosition(sym) {
  anPositions = anPositions.filter(p => p.symbol !== sym);
  renderAnalyzerTable();
}

function _recalcAnPct() {
  const total = anGetTotal();
  anPositions.forEach(p => {
    p.pct = total > 0 ? (p.value / total) * 100 : 0;
  });
}

// ---- RENDER TABLE ----

function renderAnalyzerTable() {
  _recalcAnPct();
  const total     = anGetTotal();
  const container = document.getElementById('anTable');
  if (!container) return;

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
      <div>
        <span style="font-size:13px;color:#4a5568;">Total Portfolio Value: </span>
        <strong style="font-size:16px;color:#2b6cb0;">${anFmt$(total)}</strong>
        <span style="font-size:12px;color:#718096;margin-left:10px;">${anPositions.length} positions</span>
      </div>
    </div>
    <div style="overflow-x:auto;">
    <table class="reb-table">
      <thead>
        <tr>
          <th></th>
          <th>Symbol</th>
          <th>Description</th>
          <th style="text-align:right;">Value ($)</th>
          <th style="text-align:right;">Weight (%)</th>
          <th style="text-align:center;">Primary Sector</th>
          <th style="text-align:center;">Overlap Risk</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const pos of anPositions) {
    const sectorName  = _anGetSector(pos.symbol) || '—';
    const sectorColor = AN_SECTOR_COLORS[sectorName] || '#a0aec0';
    const overlapCount = _countOverlap(pos.symbol);
    const overlapBadge = overlapCount > 0
      ? `<span style="background:#fed7d7;color:#c53030;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:600;">⚠ ${overlapCount} overlap${overlapCount>1?'s':''}</span>`
      : `<span style="background:#c6f6d5;color:#276749;border-radius:8px;padding:2px 8px;font-size:11px;">✓ Unique</span>`;

    const valueCell = pos.isManual
      ? `<td style="text-align:right;">
           <input type="text" inputmode="numeric" id="anVal_${pos.symbol}"
             value="${pos.value > 0 ? Math.round(pos.value) : ''}" placeholder="e.g. 25000"
             oninput="setAnValue('${pos.symbol}', this.value.replace(/[^0-9.]/g,''))"
             style="width:110px;text-align:right;border:1px solid #90cdf4;border-radius:6px;padding:4px 8px;font-size:12px;background:#ebf8ff;" />
         </td>`
      : `<td style="text-align:right;">${anFmt$(pos.value)}</td>`;

    html += `
      <tr>
        <td style="text-align:center;">
          <button class="reb-del-btn" onclick="deleteAnPosition('${pos.symbol}')" title="Remove position">✕</button>
        </td>
        <td><strong>${pos.symbol}</strong></td>
        <td style="font-size:12px;color:#4a5568;">${pos.desc || pos.symbol}</td>
        ${valueCell}
        <td style="text-align:right;">${pos.pct ? pos.pct.toFixed(1) + '%' : '—'}</td>
        <td style="text-align:center;">
          <span style="background:${sectorColor}22;color:${sectorColor};border:1px solid ${sectorColor}44;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:600;">${sectorName}</span>
        </td>
        <td style="text-align:center;">${overlapBadge}</td>
        <td></td>
      </tr>
    `;
  }

  html += `</tbody></table></div>`;
  container.innerHTML = html;

  // Show analyze button if we have positions with values
  const hasValues = anPositions.some(p => p.value > 0);
  document.getElementById('anAnalyzeBtn').style.display = hasValues ? 'flex' : 'none';
}

function _countOverlap(sym) {
  const holdings = _anGetHoldings(sym);
  if (!holdings.length) return 0;
  const isStock = !!AN_STOCK_SECTORS[sym]; // single stock: threshold = 1
  let count = 0;
  for (const other of anPositions) {
    if (other.symbol === sym) continue;
    const otherHoldings = _anGetHoldings(other.symbol);
    const shared = holdings.filter(h => otherHoldings.includes(h));
    // Stock-in-ETF: 1 match is enough (you own both directly + via ETF)
    // ETF-ETF: require 2+ shared top holdings
    if (shared.length >= (isStock ? 1 : 2)) count++;
  }
  return count;
}

// ---- RUN ANALYSIS ----

async function runAnalysis() {
  const total = anGetTotal();
  const positioned = anPositions.filter(p => p.value > 0);
  if (!positioned.length || total <= 0) {
    alert('Add at least one position with a value to run analysis.');
    return;
  }

  const btn = document.getElementById('anAnalyzeBtn');
  btn.textContent = '⏳ Analyzing…';
  btn.disabled = true;
  document.getElementById('anResults').style.display = 'none';

  _recalcAnPct();

  try {
    // 1. Sector analysis
    renderAnSectorChart(positioned, total);

    // 2. Holdings overlap matrix
    renderAnOverlapMatrix(positioned);

    // 3. Growth predictions (Monte Carlo)
    renderAnGrowth(positioned, total);

    // 4. AI summary (live market sentiment)
    await renderAnAISummary(positioned, total);

    document.getElementById('anResults').style.display = 'block';
    document.getElementById('anResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch(e) {
    console.error('Analysis error', e);
  }

  btn.textContent = '🔍 Analyze Portfolio';
  btn.disabled = false;
}

// ---- SECTOR CHART ----

function renderAnSectorChart(positions, total) {
  // Build weighted sector exposure across portfolio
  const sectorTotals = {};
  let unknownPct = 0;

  for (const pos of positions) {
    const w = pos.value / total; // position weight
    const sectors = AN_SECTORS[pos.symbol];
    if (!sectors) {
      unknownPct += w * 100;
      continue;
    }
    const sectorSum = Object.values(sectors).reduce((a, b) => a + b, 0);
    for (const [sec, pct] of Object.entries(sectors)) {
      if (pct <= 0) continue;
      sectorTotals[sec] = (sectorTotals[sec] || 0) + (pct / sectorSum) * w * 100;
    }
  }
  if (unknownPct > 0) sectorTotals['Other'] = unknownPct;

  const sorted = Object.entries(sectorTotals)
    .filter(([, v]) => v >= 0.5)
    .sort((a, b) => b[1] - a[1]);

  const labels = sorted.map(([k]) => k);
  const data   = sorted.map(([, v]) => parseFloat(v.toFixed(1)));
  const colors = labels.map(l => AN_SECTOR_COLORS[l] || '#a0aec0');

  // Concentration warnings
  const warnings = sorted.filter(([, v]) => v >= 40).map(([k, v]) => `⚠️ <strong>${k}</strong> concentration: ${v.toFixed(0)}%`);

  const warnEl = document.getElementById('anSectorWarnings');
  if (warnings.length) {
    warnEl.innerHTML = warnings.join(' &nbsp;·&nbsp; ');
    warnEl.style.display = 'block';
  } else {
    warnEl.style.display = 'none';
  }

  const canvas = document.getElementById('anSectorChart');
  if (anSectorChart) anSectorChart.destroy();
  anSectorChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 1 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 14 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw}%`
          }
        }
      }
    }
  });
}

// ---- HOLDINGS OVERLAP MATRIX ----

function renderAnOverlapMatrix(positions) {
  const container = document.getElementById('anOverlapMatrix');
  const tickers   = positions.map(p => p.symbol);

  if (tickers.length < 2) {
    container.innerHTML = '<p style="color:#718096;font-size:13px;">Add at least 2 positions to see overlap analysis.</p>';
    return;
  }

  // Build pairwise overlap table
  let html = `
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #e2e8f0;">Position Pair</th>
          <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #e2e8f0;">Shared Top Holdings</th>
          <th style="text-align:center;padding:6px 8px;border-bottom:2px solid #e2e8f0;">Overlap Score</th>
          <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #e2e8f0;">Assessment</th>
        </tr>
      </thead>
      <tbody>
  `;

  let hasAnyOverlap = false;

  for (let i = 0; i < tickers.length; i++) {
    for (let j = i + 1; j < tickers.length; j++) {
      const a = tickers[i], b = tickers[j];
      const aH = _anGetHoldings(a);
      const bH = _anGetHoldings(b);
      if (!aH.length && !bH.length) continue;

      const shared   = [...new Set(aH.filter(h => bH.includes(h)))];
      const isStockA = !!AN_STOCK_SECTORS[a];
      const isStockB = !!AN_STOCK_SECTORS[b];
      // For stock ↔ ETF: any match is meaningful (1/1 = 100%)
      // For ETF ↔ ETF: score out of 5 top holdings
      const denom  = (isStockA || isStockB) ? 1 : 5;
      const score  = Math.min(100, Math.round((shared.length / denom) * 100));

      // Only show Medium or High overlap pairs
      if (score < 20) continue;

      hasAnyOverlap = true;
      let level, color, bg;
      if (score >= 60)      { level = '🔴 High';   color = '#c53030'; bg = '#fff5f5'; }
      else                  { level = '🟡 Medium'; color = '#744210'; bg = '#fffff0'; }

      const pairLabel = (isStockA ? '🏢 ' : '') + a + ' ↔ ' + (isStockB ? '🏢 ' : '') + b;
      const sharedStr = shared.length ? shared.join(', ') : 'None';
      const note = (isStockA && bH.includes(a)) ? ` · You own ${a} directly + via ${b}` :
                   (isStockB && aH.includes(b)) ? ` · You own ${b} directly + via ${a}` : '';

      html += `
        <tr style="background:${bg};">
          <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${pairLabel}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;color:#4a5568;">${sharedStr}${note ? `<span style="color:#744210;font-style:italic;font-size:11px;"> ${note}</span>` : ''}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;text-align:center;">
            <div style="background:#e2e8f0;border-radius:4px;height:8px;width:80px;display:inline-block;vertical-align:middle;margin-right:6px;">
              <div style="background:${color};width:${score}%;height:100%;border-radius:4px;"></div>
            </div>
            ${score}%
          </td>
          <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;color:${color};font-weight:600;">${level}</td>
        </tr>
      `;
    }
  }

  if (!hasAnyOverlap) {
    html += `<tr><td colspan="4" style="padding:16px;color:#276749;text-align:center;font-weight:600;">✅ No medium or high overlap detected — your positions look well-diversified.</td></tr>`;
  }

  html += `</tbody></table>`;

  // Holdings reference — ETFs show top-5, stocks show sector
  const etfTickers   = tickers.filter(t => AN_TOP_HOLDINGS[t]);
  const stockTickers = tickers.filter(t => AN_STOCK_SECTORS[t]);
  html += `<div style="margin-top:16px;font-size:12px;color:#718096;">
    <strong style="color:#2d3748;">Holdings reference:</strong>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
    ${etfTickers.map(t =>
      `<div style="background:#f7fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px;">
        <strong>${t}</strong> (ETF): ${AN_TOP_HOLDINGS[t].slice(0,5).join(', ')}
       </div>`
    ).join('')}
    ${stockTickers.map(t =>
      `<div style="background:#f7fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px;">
        🏢 <strong>${t}</strong>: ${AN_STOCK_SECTORS[t]}
       </div>`
    ).join('')}
    </div>
  </div>`;

  container.innerHTML = html;
}

// ---- GROWTH PREDICTIONS (Monte Carlo) ----

function renderAnGrowth(positions, total) {
  // Build holdings map (ticker -> %)
  const holdingsMap = {};
  positions.forEach(p => { holdingsMap[p.symbol] = p.pct || 0; });

  // 1-year forecast
  const mc1 = runMonteCarlo(holdingsMap, total, 1, false, 1000);
  _renderAnGrowthCard('anGrowth1yr', mc1, total, 1);

  // 5-year forecast
  const mc5 = runMonteCarlo(holdingsMap, total, 5, false, 1000);
  _renderAnGrowthCard('anGrowth5yr', mc5, total, 5);

  // Fan charts
  _renderAnFanChart('anGrowthChart1yr', mc1, 1);
  _renderAnFanChart('anGrowthChart5yr', mc5, 5);
}

function _renderAnGrowthCard(containerId, mc, portSize, years) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const scenarios = [
    { label: '🐻 Bear',   value: mc.p5,   color: '#fc8181' },
    { label: '📊 Base',   value: mc.p50,  color: '#4299e1' },
    { label: '🚀 Bull',   value: mc.p95,  color: '#48bb78' },
  ];

  el.innerHTML = scenarios.map(s => {
    const chg   = ((s.value - portSize) / portSize * 100);
    const sign  = chg >= 0 ? '+' : '';
    return `
      <div class="an-scenario-card" style="border-left:4px solid ${s.color};">
        <div style="font-size:13px;font-weight:700;color:#2d3748;">${s.label}</div>
        <div style="font-size:20px;font-weight:800;color:${s.color};margin:4px 0;">${anFmt$(s.value)}</div>
        <div style="font-size:12px;color:#718096;">${sign}${chg.toFixed(1)}% vs today</div>
      </div>
    `;
  }).join('');
}

function _renderAnFanChart(canvasId, mc, years) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const existing = canvasId === 'anGrowthChart1yr' ? anGrowthChart1yr : anGrowthChart5yr;
  if (existing) existing.destroy();

  const labels  = Array.from({ length: years + 1 }, (_, i) => `Y${i}`);
  const { paths } = mc.fanData;

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Bear (5th)',   data: paths.p5,   borderColor:'#fc8181', borderWidth:1.5, pointRadius:0, fill:false, borderDash:[4,3], tension:0.4 },
        { label: '25th pct',     data: paths.p25,  borderColor:'#f6ad55', borderWidth:1,   pointRadius:0, fill:false, tension:0.4 },
        { label: 'Median',       data: paths.p50,  borderColor:'#4299e1', borderWidth:2.5, pointRadius:3, pointBackgroundColor:'#4299e1', fill:false, tension:0.4 },
        { label: '75th pct',     data: paths.p75,  borderColor:'#68d391', borderWidth:1,   pointRadius:0, fill:false, tension:0.4 },
        { label: 'Bull (95th)', data: paths.p95,  borderColor:'#48bb78', borderWidth:1.5, pointRadius:0, fill:false, borderDash:[4,3], tension:0.4 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { font: { size: 10 }, usePointStyle: true, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${anFmt$(ctx.raw)}` } }
      },
      scales: {
        y: { ticks: { callback: v => '$' + (v >= 1e6 ? (v/1e6).toFixed(1)+'M' : (v/1000).toFixed(0)+'K'), font: { size: 10 } }, grid: { color: '#f0f4f8' } },
        x: { grid: { display: false }, ticks: { font: { size: 10 } } }
      }
    }
  });

  if (canvasId === 'anGrowthChart1yr') anGrowthChart1yr = chart;
  else anGrowthChart5yr = chart;
}

// ---- AI ANALYSIS (live market sentiment via web search) ----

async function renderAnAISummary(positions, total) {
  const el = document.getElementById('anAISummary');
  el.innerHTML = `<div style="text-align:center;padding:20px;color:#718096;">
    <div style="font-size:20px;margin-bottom:8px;">🤖</div>
    Fetching live market intelligence…
  </div>`;

  // Build portfolio description for the prompt
  const topPositions = positions
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map(p => `${p.symbol} (${p.pct ? p.pct.toFixed(1) : '?'}%)`);

  const portDesc = topPositions.join(', ');

  // Compute weighted yield from BT_ETF_CONFIG
  let weightedYield = 0;
  positions.forEach(p => {
    const cfg = BT_ETF_CONFIG[p.symbol];
    if (cfg) weightedYield += cfg.yield_avg * (p.pct / 100);
  });

  // Sector concentrations for the prompt
  const sectorData = _computeSectorTotals(positions, total);
  const topSectors = Object.entries(sectorData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, v]) => `${k} (${v.toFixed(0)}%)`)
    .join(', ');

  // Use backend AI endpoint if available, otherwise fall back to static analysis
  if (serverOnline) {
    try {
      const payload = {
        portfolio: topPositions,
        portDesc,
        weightedYield: weightedYield * 100,
        topSectors,
        totalValue: total
      };

      const r = await fetch(`${API}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
      });

      if (r.ok) {
        const data = await r.json();
        el.innerHTML = _formatAISummary(data.summary || data.analysis || data, portDesc, weightedYield, topSectors);
        return;
      }
    } catch(e) {
      // fall through to static analysis
    }
  }

  // Static analysis fallback (always works)
  el.innerHTML = _buildStaticAnalysis(positions, total, portDesc, weightedYield, topSectors);
}

function _computeSectorTotals(positions, total) {
  const sectorTotals = {};
  for (const pos of positions) {
    const w = pos.value / total;
    // Individual stocks (local or live-fetched): assign 100% to their single sector
    const stockSec = AN_STOCK_SECTORS[pos.symbol] || AN_LIVE_SECTORS[pos.symbol];
    if (stockSec && stockSec !== '—') {
      sectorTotals[stockSec] = (sectorTotals[stockSec] || 0) + w * 100;
      continue;
    }
    const sectors = AN_SECTORS[pos.symbol];
    if (!sectors) continue;
    const sectorSum = Object.values(sectors).reduce((a, b) => a + b, 0);
    for (const [sec, pct] of Object.entries(sectors)) {
      if (pct <= 0) continue;
      sectorTotals[sec] = (sectorTotals[sec] || 0) + (pct / sectorSum) * w * 100;
    }
  }
  return sectorTotals;
}

function _formatAISummary(text, portDesc, weightedYield, topSectors) {
  return `
    <div class="an-ai-card">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span style="font-size:18px;">🤖</span>
        <strong style="font-size:14px;color:#2d3748;">AI Portfolio Analysis</strong>
        <span style="font-size:11px;background:#ebf8ff;color:#2b6cb0;border-radius:6px;padding:2px 8px;margin-left:auto;">Live Market Context</span>
      </div>
      <div style="font-size:13px;line-height:1.8;color:#2d3748;white-space:pre-wrap;">${typeof text === 'string' ? text : JSON.stringify(text, null, 2)}</div>
    </div>
  `;
}

function _buildStaticAnalysis(positions, total, portDesc, weightedYield, topSectors) {
  const yieldPct  = (weightedYield * 100).toFixed(1);
  const annIncome = anFmt$(total * weightedYield);
  const count     = positions.length;

  // Diversification score (0-100)
  const sectorData = _computeSectorTotals(positions, total);
  const sectors = Object.values(sectorData).filter(v => v > 2).length;
  const maxSec  = Math.max(...Object.values(sectorData), 0);
  const divScore = Math.min(100, Math.round(sectors * 12 - (maxSec > 50 ? 20 : 0)));

  // Overlap count
  let overlapPairs = 0;
  for (let i = 0; i < positions.length; i++) {
    for (let j = i+1; j < positions.length; j++) {
      const aH = _anGetHoldings(positions[i].symbol);
      const bH = _anGetHoldings(positions[j].symbol);
      const isStockA = !!AN_STOCK_SECTORS[positions[i].symbol];
      const isStockB = !!AN_STOCK_SECTORS[positions[j].symbol];
      const thresh = (isStockA || isStockB) ? 1 : 2;
      if (aH.filter(h => bH.includes(h)).length >= thresh) overlapPairs++;
    }
  }

  // Income assessment
  const incomeGrade = weightedYield >= 0.10 ? '🟢 High Income' : weightedYield >= 0.05 ? '🟡 Moderate Income' : '🔴 Low Income';

  // Risk flags
  const flags = [];
  if (maxSec >= 50) flags.push(`Heavy ${Object.entries(sectorData).find(([,v])=>v===maxSec)?.[0]} concentration (${maxSec.toFixed(0)}%)`);
  if (overlapPairs >= 3) flags.push(`${overlapPairs} position pairs share top holdings — consider consolidating`);
  if (weightedYield > 0.15) flags.push('Ultra-high yield (>15%) — NAV erosion risk in some positions');

  const strengths = [];
  if (divScore >= 60) strengths.push('Well diversified across sectors');
  if (count >= 5) strengths.push(`${count} positions provide good spread`);
  if (overlapPairs === 0) strengths.push('No significant holdings overlap detected');
  if (weightedYield >= 0.07 && weightedYield < 0.15) strengths.push(`Solid ${yieldPct}% blended yield`);

  return `
    <div class="an-ai-card">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <span style="font-size:18px;">🤖</span>
        <strong style="font-size:14px;color:#2d3748;">Portfolio Analysis</strong>
        <span style="font-size:11px;background:#e9d8fd;color:#553c9a;border-radius:6px;padding:2px 8px;margin-left:auto;">Composition-Based</span>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px;">
        <div style="background:#f7fafc;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#2b6cb0;">${yieldPct}%</div>
          <div style="font-size:11px;color:#718096;margin-top:2px;">Blended Yield</div>
        </div>
        <div style="background:#f7fafc;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#276749;">${annIncome}</div>
          <div style="font-size:11px;color:#718096;margin-top:2px;">Est. Annual Income</div>
        </div>
        <div style="background:#f7fafc;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:${divScore>=60?'#276749':divScore>=40?'#744210':'#c53030'};">${divScore}/100</div>
          <div style="font-size:11px;color:#718096;margin-top:2px;">Diversification Score</div>
        </div>
        <div style="background:#f7fafc;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:${overlapPairs===0?'#276749':overlapPairs<=2?'#744210':'#c53030'};">${overlapPairs}</div>
          <div style="font-size:11px;color:#718096;margin-top:2px;">Overlap Pairs</div>
        </div>
      </div>

      <div style="font-size:13px;color:#2d3748;line-height:1.8;">
        <p>Your portfolio of <strong>${count} positions</strong> (${portDesc}) has a blended yield of <strong>${yieldPct}%</strong>, generating an estimated <strong>${annIncome}/year</strong> on ${anFmt$(total)} invested. Top sector exposures: <em>${topSectors || 'N/A'}</em>.</p>

        ${strengths.length ? `<p><strong style="color:#276749;">✅ Strengths:</strong><br>${strengths.map(s=>'• '+s).join('<br>')}</p>` : ''}
        ${flags.length ? `<p><strong style="color:#c05621;">⚠️ Watch:</strong><br>${flags.map(f=>'• '+f).join('<br>')}</p>` : ''}

        <p style="font-size:11px;color:#a0aec0;margin-top:12px;border-top:1px solid #e2e8f0;padding-top:8px;">
          ℹ️ Analysis based on portfolio composition and modelled data. Not financial advice.
          ${!serverOnline ? 'Live market context unavailable — server offline.' : ''}
        </p>
      </div>
    </div>
  `;
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  initAnSearch();
});
