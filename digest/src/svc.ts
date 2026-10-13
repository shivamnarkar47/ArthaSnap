// svc.ts - all service logic: stocks, history, indicators, SubQ, news, Groq. No framework imports.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const SUBQ_URL = "https://api.subq.ai/v1/systemone";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "qwen/qwen3.8-27b"; // ponytail: gpt-oss-20b returns empty content ~1/3 calls; qwen 3/3 in testing

// ponytail: parses ../.env (repo root) for missing keys only, so app runs from any cwd. dotenv dep when this outgrows KEY=VAL lines.
declare const Bun: any;
let envLoaded = false;
export function loadEnv() {
  if (envLoaded || typeof Bun === "undefined") return; // workerd: vars/secrets come from process.env
  envLoaded = true;
  try {
    const raw = Bun.file(new URL("../../.env", import.meta.url));
    raw.text().then((t: string) => {
      for (const line of t.split("\n")) {
        const m = line.match(/^([A-Z_]+)=(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
    });
  } catch { /* env comes from shell */ }
}

export class HttpErr extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// ---- validation (trust boundary) ----
export const SYM_RE = /^[A-Z0-9.]{1,20}$/;
export const RANGES = ["5d", "1mo", "3mo", "6mo", "1y"];
export const INTERVALS = ["1d", "1wk"];
export const cleanSym = (s: string) => {
  const v = s.trim().toUpperCase();
  if (!SYM_RE.test(v)) throw new HttpErr(400, `bad symbol: ${s}`);
  return v;
};
export function parseSymbols(param: string | null): string[] {
  if (!param) throw new HttpErr(400, "symbols required, e.g. ?symbols=RELIANCE.NS,TCS.NS");
  const out = [...new Set(param.split(",").map(cleanSym))];
  if (out.length > 5) throw new HttpErr(400, "max 5 symbols");
  return out;
}
export const qkey = (sym: string) => sym.replace(/[^A-Z0-9]/g, "_");

// ---- cache ----
const cache = new Map<string, { exp: number; val: any }>();
export const cc = {
  get(k: string) { const e = cache.get(k); return e && e.exp > Date.now() ? e.val : undefined; },
  set(k: string, val: any, ttlSec: number) { cache.set(k, { exp: Date.now() + ttlSec * 1000, val }); },
  clear() { cache.clear(); },
};

async function get(url: string, timeoutMs = 15000) {
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new HttpErr(502, `upstream ${r.status} on ${url.split("?")[0]}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

// ---- history (Yahoo v8, no auth needed) ----
export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };
export async function chart(sym: string, range = "1mo", interval = "1d") {
  if (!RANGES.includes(range) || !INTERVALS.includes(interval)) throw new HttpErr(400, "bad range/interval");
  const key = `chart:${sym}:${range}:${interval}`;
  const hit = cc.get(key);
  if (hit) return hit;
  const r = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=${interval}`);
  const j = await r.json();
  const res = j?.chart?.result?.[0];
  if (!res) throw new HttpErr(502, `no chart for ${sym}`);
  const q = res.indicators.quote[0];
  const candles: Candle[] = res.timestamp.map((t: number, i: number) => ({
    t, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume[i],
  })).filter((c: Candle) => c.c != null).slice(-90);
  const out = { candles, meta: res.meta };
  cc.set(key, out, 1800);
  return out;
}

export const sma = (xs: number[], n: number) =>
  xs.length < n ? null : xs.slice(-n).reduce((a, b) => a + b, 0) / n;
export function rsi(closes: number[], n = 14): number | null {
  if (closes.length < n + 1) return null;
  let g = 0, l = 0;
  for (let i = closes.length - n; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) g += d; else l -= d;
  }
  if (l === 0) return 100;
  return +(100 - 100 / (1 + g / l)).toFixed(1);
}

// ---- Yahoo quotes direct (same fetch everywhere: local AND workerd. No worker-to-worker hop; edge 1042s it) ----
const raw = (f: any) => (f && typeof f === "object" ? (f.raw ?? null) : (f ?? null));
let crumbCache = { crumb: null as string | null, cookie: "", exp: 0 };
async function yahooAuthed(build: (crumb: string) => string, timeoutMs = 15000, retry = true): Promise<Response> {
  if (!crumbCache.crumb || Date.now() > crumbCache.exp) {
    const c0 = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(timeoutMs) });
    const cookie = (c0.headers.get("set-cookie") || "").split(";")[0];
    const c1 = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", { headers: { "User-Agent": UA, Cookie: cookie }, signal: AbortSignal.timeout(timeoutMs) });
    crumbCache = { crumb: (await c1.text()).trim(), cookie, exp: Date.now() + 50 * 60 * 1000 };
  }
  const r = await fetch(build(crumbCache.crumb!), { headers: { "User-Agent": UA, Cookie: crumbCache.cookie }, signal: AbortSignal.timeout(timeoutMs) });
  if (r.status === 401 && retry) { crumbCache.exp = 0; return yahooAuthed(build, timeoutMs, false); } // ponytail: single retry max — persistent 401s recursed into the 50-subrequest cap
  return r;
}
async function yahooDetail(ticker: string) {
  const r = await yahooAuthed((c) => `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=price,summaryDetail,defaultKeyStatistics,assetProfile&crumb=${encodeURIComponent(c)}`);
  if (!r.ok) return null;
  const res = (await r.json())?.quoteSummary?.result?.[0];
  if (!res || raw(res.price?.regularMarketPrice) == null) return null;
  const { price = {}, summaryDetail = {}, assetProfile = {} } = res;
  return {
    price: raw(price.regularMarketPrice),
    chgPct: raw(price.regularMarketChangePercent) != null ? +(raw(price.regularMarketChangePercent) * 100).toFixed(2) : null,
    pe: raw(summaryDetail.trailingPE), vol: raw(price.regularMarketVolume),
    yHigh: raw(summaryDetail.fiftyTwoWeekHigh), yLow: raw(summaryDetail.fiftyTwoWeekLow), sector: assetProfile.sector || null,
  };
}
async function yahooBatch(tickers: string[]) {
  const r = await yahooAuthed((c) => `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(tickers.join(","))}&crumb=${encodeURIComponent(c)}`, 20000);
  if (!r.ok) throw new HttpErr(502, `yahoo batch ${r.status}`);
  const out: Record<string, any> = {};
  for (const q of (await r.json())?.quoteResponse?.result || [])
    out[q.symbol] = { price: q.regularMarketPrice ?? null, chgPct: q.regularMarketChangePercent ?? null };
  return out;
}
// ponytail: hardcoded Nifty-heavy universe; live list when needed
const UNIVERSE = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS", "SBIN.NS", "BHARTIARTL.NS", "ITC.NS", "KOTAKBANK.NS", "LT.NS", "HINDUNILVR.NS", "AXISBANK.NS", "ASIANPAINT.NS", "MARUTI.NS", "SUNPHARMA.NS", "TATAMOTORS.NS", "TITAN.NS", "ULTRACEMCO.NS", "BAJFINANCE.NS", "NTPC.NS", "POWERGRID.NS", "ONGC.NS", "TATASTEEL.NS", "ADANIENT.NS", "ADANIPORTS.NS", "COALINDIA.NS", "HCLTECH.NS", "WIPRO.NS", "JSWSTEEL.NS", "HINDALCO.NS", "CIPLA.NS", "DRREDDY.NS", "EICHERMOT.NS", "GRASIM.NS", "TECHM.NS", "BPCL.NS", "BRITANNIA.NS", "NESTLEIND.NS"];
// @ts-ignore - bundled JSON universe, native in Bun + workerd + Vite
import UNIV from "./universe.json";
export interface SuggestRow { symbol: string; company: string; nse: string; bse: string }
// ponytail: subsequence fuzzy, no dep; live Yahoo search merges on top when query misses
export function suggestLocal(query: string, n = 8): SuggestRow[] {
  const q = query.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (q.length < 1) return (UNIV as SuggestRow[]).slice(0, n);
  const scored: Array<{ r: SuggestRow; s: number }> = [];
  for (const r of UNIV as SuggestRow[]) {
    const hay = (r.symbol + " " + r.company).toLowerCase().replace(/[^a-z0-9]/g, "");
    let s = -1;
    const idx = hay.indexOf(q);
    if (idx >= 0) s = idx;
    else {
      let j = 0;
      for (let i = 0; i < hay.length && j < q.length; i++) if (hay[i] === q[j]) j++;
      if (j === q.length) s = 50; // subsequence fallback, ranked below substring hits
    }
    if (s >= 0) scored.push({ r, s });
  }
  return scored.sort((a, b) => a.s - b.s).slice(0, n).map((x) => x.r);
}
export async function suggest(query: string): Promise<SuggestRow[]> {
  const local = suggestLocal(query);
  const q = query.trim();
  if (q.length < 2) return local;
  try {
    const r = await get(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10`, 8000);
    const live: SuggestRow[] = ((await r.json())?.quotes || [])
      .filter((x: any) => x.symbol && (x.symbol.endsWith(".NS") || x.symbol.endsWith(".BO")))
      .map((x: any) => {
        const sym = x.symbol.replace(/\.(NS|BO)$/, "");
        return { symbol: sym, company: x.longname || x.shortname || sym, nse: `${sym}.NS`, bse: `${sym}.BO` };
      })
      .filter((x: SuggestRow) => !local.some((l) => l.symbol === x.symbol))
      .slice(0, 4);
    return [...local, ...live].slice(0, 8);
  } catch {
    return local;
  }
}

// ---- snapshot ----
export async function snapshot(sym: string) {
  const key = `snap:${sym}`;
  const hit = cc.get(key);
  if (hit) return hit;
  const d = await yahooDetail(sym).catch(() => null);
  if (d) {
    const out = { src: "yahoo", ...d };
    cc.set(key, out, 60);
    return out;
  }
  const { candles, meta } = await chart(sym);
  const last = candles[candles.length - 1];
  const out = { src: "yahoo-fallback", price: meta.regularMarketPrice ?? last.c, chgPct: null, pe: null, vol: last.v, yHigh: null, yLow: null, sector: null };
  cc.set(key, out, 60);
  return out;
}

// ---- SubQ: 3 questions/symbol packed in ONE call (cap 15 = 5 symbols) ----
export function buildQuestions(syms: string[]) {
  const questions: Record<string, any> = {};
  for (const s of syms) {
    const k = qkey(s);
    questions[`buy_${k}`] = { type: "noul", instructions: `${s}: buy for 1-4 week hold?`, criteria: { true: "reasonable PE, momentum, volume support", false: "overvalued, weak or choppy" } };
    questions[`action_${k}`] = { type: "choice", instructions: `${s}: pick one`, criteria: { buy: "momentum + value align", watch: "wait for better entry", avoid: "expensive or weak" } };
    questions[`conviction_${k}`] = { type: "score", instructions: `${s}: conviction from avoid to strong buy`, criteria: ["avoid", "weak", "watch", "buy", "strong buy"] };
  }
  return questions;
}
export async function decide(states: Record<string, string>) {
  const syms = Object.keys(states);
  const key = `dec:${syms.join(",")}:${Object.values(states).join("|").length}`;
  const hit = cc.get(key);
  if (hit) return hit;
  const apiKey = process.env.SUBQ_API_KEY;
  if (!apiKey) throw new HttpErr(500, "SUBQ_API_KEY missing");
  const state = syms.map((s) => `${s} :: ${states[s]}`).join("\n");
  const r = await fetch(SUBQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "subq-snap-preview", state, questions: buildQuestions(syms) }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new HttpErr(502, `subq:${r.status} ${(await r.text()).slice(0, 200)}`);
  const out = (await r.json()).answers;
  cc.set(key, out, 300);
  return out;
}

// ---- news (Yahoo RSS, no key) + Groq summary ----
export async function headlines(sym: string, n = 5) {
  const key = `news:${sym}`;
  const hit = cc.get(key);
  if (hit) return hit.slice(0, n);
  const r = await get(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(sym)}&region=US&lang=en-US`);
  const xml = await r.text();
  const items = [...xml.matchAll(/<item>[\s\S]*?<title>(<!\[CDATA\[)?([\s\S]*?)(\]\]>)?<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/g)]
    .map((m) => ({ title: m[2].trim().slice(0, 200), link: m[4].trim() })).slice(0, 5);
  cc.set(key, items, 900);
  return items.slice(0, n);
}
export async function summarize(brief: string, retry = true): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new HttpErr(500, "GROQ_API_KEY missing");
  const r = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        { role: "system", content: "Terse equity assistant. 5 bullets max, then one line per symbol: verdict + biggest risk. No disclaimers." },
        { role: "user", content: brief.slice(0, 6000) },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new HttpErr(502, `groq:${r.status} ${(await r.text()).slice(0, 200)}`);
  const content = (await r.json()).choices[0].message.content?.trim();
  if (!content && retry) return summarize(brief.slice(0, 2500), false); // ponytail: one short retry, then accept empty
  return content || "";
}

// ---- movers: top-10 gainers/losers from pre-cached symbols, one batch call ----
export async function movers() {
  const hit = cc.get("movers");
  if (hit) return hit;
  const q = await yahooBatch(UNIVERSE);
  const rows = UNIVERSE.filter((t) => q[t]?.chgPct != null)
    .map((t) => ({ symbol: t, price: q[t].price, chgPct: +(+q[t].chgPct).toFixed(2) }))
    .sort((a: any, b: any) => b.chgPct - a.chgPct);
  const out = { gainers: rows.slice(0, 10), losers: rows.slice(-10).reverse() };
  cc.set("movers", out, 300); // ponytail: 5-min memo, per-user watchlists when asked
  return out;
}

// ---- digest: per-symbol parallel fetch, 1 SubQ + 1 Groq call total ----
export async function digest(syms: string[], range = "1mo", interval = "1d") {
  const per = await Promise.all(syms.map(async (sym) => {
    const [snap, ch, news] = await Promise.all([snapshot(sym), chart(sym, range, interval), headlines(sym, syms.length > 1 ? 3 : 5)]);
    const closes = ch.candles.map((c: { c: number }) => c.c);
    const feats = { sma20: sma(closes, 20), rsi14: rsi(closes), spark: closes.slice(-20) };
    return { sym, snap, feats, news, candles: syms.length > 1 ? [] : ch.candles };
  }));
  const states: Record<string, string> = {};
  for (const p of per) states[p.sym] = JSON.stringify({ snap: p.snap, feats: { sma20: p.feats.sma20, rsi14: p.feats.rsi14 }, news: p.news.map((h: any) => h.title) });
  const [answers, summary] = await Promise.all([
    decide(states),
    summarize(per.map((p) => `${p.sym} ${JSON.stringify(p.snap)} feats=${JSON.stringify({ sma20: p.feats.sma20, rsi14: p.feats.rsi14 })} news=${p.news.map((h: any) => h.title).join(" | ")}`).join("\n")),
  ]);
  return {
    results: per.map((p) => ({ symbol: p.sym, snapshot: p.snap, feats: p.feats, decision: { buy: answers[`buy_${qkey(p.sym)}`]?.noul ?? null, action: answers[`action_${qkey(p.sym)}`]?.choice ?? null, conviction: answers[`conviction_${qkey(p.sym)}`]?.score ?? null }, news: p.news, candles: p.candles })),
    summary,
  };
}
