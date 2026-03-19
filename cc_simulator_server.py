#!/usr/bin/env python3
"""
Covered Call ETF Simulator - Local API Server
Proxies Yahoo Finance data so the browser can query it without CORS issues.
Run this script, then open cc_simulator_live.html in your browser.
"""

import json
import os
import sys
import threading
import webbrowser
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

try:
    import yfinance as yf
except ImportError:
    print("Installing yfinance...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "yfinance", "--break-system-packages", "-q"])
    import yfinance as yf

PORT = int(os.environ.get('PORT', 7432))
CACHE = {}
CACHE_TTL = 300  # 5 min cache per ticker

def fetch_etf(ticker):
    ticker = ticker.upper().strip()
    now = datetime.now()

    # Return cache if fresh
    if ticker in CACHE:
        cached_at, data = CACHE[ticker]
        if (now - cached_at).seconds < CACHE_TTL:
            return data

    try:
        tk = yf.Ticker(ticker)
        info = tk.info

        # Need at least a name to be valid
        name = info.get('longName') or info.get('shortName') or ''
        if not name:
            return {"error": f"Ticker '{ticker}' not found"}

        hist = tk.history(period='1y', auto_adjust=False)
        if len(hist) == 0:
            return {"error": f"No price history for '{ticker}'"}

        divs = tk.dividends

        current = float(hist['Close'].iloc[-1])

        def first_close_on_or_after(date_str):
            sub = hist[hist.index >= date_str]
            return float(sub['Close'].iloc[0]) if len(sub) > 0 else current

        ytd_start   = first_close_on_or_after(f"{now.year}-01-01")
        three_m     = first_close_on_or_after((now - timedelta(days=91)).strftime('%Y-%m-%d'))
        six_m       = first_close_on_or_after((now - timedelta(days=182)).strftime('%Y-%m-%d'))
        one_y       = first_close_on_or_after((now - timedelta(days=365)).strftime('%Y-%m-%d'))

        divs_1y = divs[divs.index >= (now - timedelta(days=365)).strftime('%Y-%m-%d')]
        total_div_1y = float(divs_1y.sum()) if len(divs_1y) > 0 else 0
        num_divs = len(divs_1y)

        # Infer frequency using median interval between payments (handles newer ETFs
        # that haven't completed a full year but already pay monthly).
        # Use all available dividend history (not just 1y) for better interval estimate.
        all_divs = divs
        if len(all_divs) >= 2:
            dates = sorted(all_divs.index)
            intervals = [(dates[i+1] - dates[i]).days for i in range(len(dates)-1)]
            # Use median of last 6 intervals (or all if fewer) to ignore outliers
            recent_intervals = intervals[-6:] if len(intervals) >= 6 else intervals
            median_interval = sorted(recent_intervals)[len(recent_intervals) // 2]
            if   median_interval <= 14:  freq = "weekly"
            elif median_interval <= 45:  freq = "monthly"
            elif median_interval <= 120: freq = "quarterly"
            else:                        freq = "irregular"
        elif num_divs >= 1:
            # Only one dividend ever — guess from count in last year
            if   num_divs >= 40: freq = "weekly"
            elif num_divs >= 10: freq = "monthly"
            elif num_divs >= 3:  freq = "quarterly"
            else:                freq = "irregular"
        else:
            freq = "irregular"

        # Yield: prefer info field, fall back to trailing calc
        raw_yield = info.get('yield') or info.get('trailingAnnualDividendYield') or 0
        if not raw_yield and current > 0:
            raw_yield = total_div_1y / current

        nav = info.get('navPrice') or current

        recent_divs = [
            [str(d.date()), round(float(v), 4)]
            for d, v in divs_1y.items()
        ][-16:]

        # Compute price CAGR over full available history (for projections)
        years_all = (hist.index[-1] - hist.index[0]).days / 365.25
        price_cagr_all = 0.0
        if years_all > 0.5:
            price_cagr_all = (current / float(hist['Close'].iloc[0])) ** (1 / years_all) - 1

        # Forward-looking div yield = trailing 12m dividends / current price.
        trailing_div_yield = total_div_1y / current if current > 0 else 0

        # Detect category
        name_lower = name.lower()
        ticker_lower = ticker.lower()
        if any(x in name_lower for x in ['yieldmax','option income strategy']):
            category = "Single Stock" if any(x in name_lower for x in ['tsla','nvda','coin','msft','amzn','aapl','googl','meta','amd','dis']) else "Fund of Funds"
        elif 'nasdaq' in name_lower:  category = "Equity Index"
        elif 's&p' in name_lower or 'spy' in name_lower: category = "Equity Index"
        elif 'russell' in name_lower: category = "Equity Index"
        elif 'dow' in name_lower:     category = "Equity Index"
        elif 'gold' in name_lower:    category = "Commodity"
        elif 'neos' in name_lower:    category = "Equity Index"
        else:                         category = "Covered Call"

        data = {
            "ticker":         ticker,
            "name":           name,
            "price":          round(current, 4),
            "nav":            round(nav, 4),
            "yield_annual":   round(float(raw_yield), 6),
            "divFreq":        freq,
            "total_div_1y":   round(total_div_1y, 4),
            "one_y_start":    round(one_y, 4),
            "six_m_start":    round(six_m, 4),
            "three_m_start":  round(three_m, 4),
            "ytd_start":      round(ytd_start, 4),
            "recent_divs":    recent_divs,
            "category":       category,
            # Projection fields
            "price_cagr":       round(price_cagr_all, 6),
            "trailing_div_yield": round(trailing_div_yield, 6),
            "years_available":  round(years_all, 2),
            "fetched_at":     now.strftime('%Y-%m-%d %H:%M:%S'),
            "cached":         False,
        }

        CACHE[ticker] = (now, data)
        return data

    except Exception as e:
        return {"error": str(e)}


def search_etfs(query):
    """Search Yahoo Finance for ETF tickers matching query."""
    query = query.strip()
    if not query:
        return []
    try:
        results = yf.Search(query, max_results=12)
        quotes = results.quotes if hasattr(results, 'quotes') else []
        out = []
        for q in quotes:
            t = q.get('symbol','')
            qtype = q.get('quoteType','')
            name_upper = (q.get('longname','') or q.get('shortname','')).upper()
            if qtype in ('ETF','MUTUALFUND','EQUITY') or 'ETF' in name_upper or 'FUND' in name_upper or 'TRUST' in name_upper:
                out.append({
                    "ticker": t,
                    "name": q.get('longname') or q.get('shortname') or t,
                    "exchange": q.get('exchange',''),
                })
        return out[:10]
    except Exception as e:
        return []


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # silence default logs

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == '/health':
            self.send_json({"status": "ok", "port": PORT})

        elif parsed.path == '/etf':
            ticker = params.get('ticker', [''])[0].upper()
            if not ticker:
                self.send_json({"error": "Missing ?ticker= param"}, 400)
                return
            print(f"  → Fetching {ticker}...")
            data = fetch_etf(ticker)
            if 'cached' in data and not data['cached']:
                data['cached'] = False
            self.send_json(data)

        elif parsed.path == '/search':
            q = params.get('q', [''])[0]
            results = search_etfs(q)
            self.send_json(results)

        elif parsed.path == '/batch':
            raw = params.get('tickers', [''])[0]
            tickers = [t.strip().upper() for t in raw.split(',') if t.strip()]
            results = {}
            for t in tickers:
                print(f"  → Fetching {t}...")
                results[t] = fetch_etf(t)
            self.send_json(results)

        else:
            self.send_json({"error": "Unknown endpoint"}, 404)


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    html_file = os.path.join(script_dir, 'cc_simulator_live.html')

    # On Railway/cloud, bind to 0.0.0.0; locally bind to 127.0.0.1
    host = '0.0.0.0' if os.environ.get('RAILWAY_ENVIRONMENT') or os.environ.get('PORT') else '127.0.0.1'

    server = HTTPServer((host, PORT), Handler)
    print(f"\n{'='*55}")
    print(f"  📊 Covered Call ETF Simulator — Live Data Server")
    print(f"{'='*55}")
    print(f"  Server running at: http://{host}:{PORT}")
    if host == '127.0.0.1':
        print(f"  Open your simulator: {html_file}")
    print(f"  Press Ctrl+C to stop\n")

    # Auto-open browser only when running locally
    if host == '127.0.0.1':
        def open_browser():
            import time; time.sleep(1.2)
            webbrowser.open(f'file://{html_file}')
        threading.Thread(target=open_browser, daemon=True).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")


if __name__ == '__main__':
    main()
