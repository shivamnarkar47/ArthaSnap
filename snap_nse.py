# snap_nse.py - stdlib only. Local Indian API (snapshot) + SubQ judge
import json, urllib.request, urllib.parse, os, csv, datetime
BASE = "http://127.0.0.1:8787"  # local: cd indian-api && npx wrangler dev --port 8787
SUBQ = "https://api.subq.ai/v1/systemone"

def get_stock(sym):
    q = urllib.parse.urlencode({"symbol": sym, "res": "num"})
    with urllib.request.urlopen(f"{BASE}/stock?{q}", timeout=15) as r:
        d = json.load(r)["data"]
    return {k: d[k] for k in ("last_price","percent_change","pe_ratio","volume","year_high","year_low","sector") if k in d}

def judge(stock):
    state = f"NSE snapshot: {json.dumps(stock)}"
    qs = {"buy": {"type": "noul", "instructions": "Buy for 1-4 week hold?", "criteria": {"true": "reasonable PE, near high, volume up", "false": "overvalued, weak momentum"}},
          "action": {"type": "choice", "instructions": "Pick one", "criteria": {"buy": "momentum + value", "watch": "wait", "avoid": "expensive/weak"}},
          "conviction": {"type": "score", "instructions": "Conviction", "criteria": {"0": "avoid", "4": "strong buy"}}}
    req = urllib.request.Request(SUBQ, data=json.dumps({"model": "subq-snap-preview", "state": state, "questions": qs}).encode(),
        headers={"Authorization": f"Bearer {os.environ['SUBQ_API_KEY']}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)["answers"]

if __name__ == "__main__":
    s = get_stock("RELIANCE.NS"); a = judge(s)
    with open("picks.csv","a",newline="") as f:  # ponytail: csv log, sqlite when >1k rows/need queries
        csv.writer(f).writerow([datetime.date.today(), "RELIANCE.NS", s["last_price"], round(a["buy"]["noul"],2), a["action"]["choice"], round(a["conviction"]["score"],2)])
    print("logged", s["last_price"], a["action"]["choice"])
