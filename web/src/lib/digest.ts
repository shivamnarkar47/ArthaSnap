// Server-only boundary: digest svc runs IN-PROCESS (no worker-to-worker fetch;
// the edge 1042s those). Client code imports only the fn handles below.
import { createServerFn } from '@tanstack/react-start'
import {
  snapshot, chart, digest, movers, suggest,
  parseSymbols as parse, RANGES, type SuggestRow,
} from '../../../digest/src/svc'

export { parseSymbols, RANGES, type SuggestRow } from '../../../digest/src/svc'
export type { Candle } from '../../../digest/src/svc'

export interface Quote {
  symbol: string
  snapshot: { price: number; chgPct: number | null; pe: number | null; vol: number; yHigh: number | null; yLow: number | null; sector: string | null }
  spark: Array<{ t: number; c: number }>
}

// Fast path (SSR in loader): quotes + sparklines, no AI calls.
export const getQuotes = createServerFn({ method: 'GET' })
  .validator((d: unknown) => parse(String(d)))
  .handler(async ({ data }): Promise<Quote[]> =>
    Promise.all(
      data.map(async (sym) => {
        const [snap, history] = await Promise.all([
          snapshot(sym),
          chart(sym).catch(() => ({ candles: [] as Array<{ c: number }> })),
        ])
        return { symbol: sym, snapshot: snap, spark: history.candles.map((c: any) => ({ t: c.t, c: c.c })).slice(-20) }
      }),
    ),
  )

export interface DigestResult {
  results: Array<{ symbol: string; decision: { buy: number | null; action: string | null; conviction: number | null }; news: Array<{ title: string; link: string }> }>
  summary: string
}

// Slow path (streams in client-side after SSR shell): 1 SubQ + 1 Groq call.
export const getDigest = createServerFn({ method: 'POST' })
  .validator((d: unknown) => parse(Array.isArray(d) ? d.join(',') : String(d)))
  .handler(async ({ data }): Promise<DigestResult> => digest(data as string[]))

export interface Movers {
  gainers: Array<{ symbol: string; price: number; chgPct: number }>
  losers: Array<{ symbol: string; price: number; chgPct: number }>
}

// Chart path: full OHLC candles for a range (5h intraday → max history).
export const getChart = createServerFn({ method: 'GET' })
  .validator((d: unknown) => {
    const o = (d ?? {}) as { symbol?: unknown; range?: unknown; interval?: unknown }
    const symbol = parse(String(o.symbol ?? ''))[0] as string
    const range = String(o.range ?? '1mo')
    if (!RANGES.includes(range)) throw new Error(`bad range: ${range}`)
    const interval = o.interval == null || o.interval === '' ? undefined : String(o.interval)
    return { symbol, range, interval }
  })
  .handler(async ({ data }) => chart(data.symbol, data.range, data.interval))

// Full single-stock analysis for the detail route: snapshot + technicals +
// SubQ decision + news + 3mo candles + AI summary.
export interface StockDetail {
  symbol: string
  snapshot: Quote['snapshot']
  feats: { sma20: number | null; rsi14: number | null; spark: number[] }
  decision: { buy: number | null; action: string | null; conviction: number | null }
  news: Array<{ title: string; link: string }>
  candles: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>
  summary: string
}

export const getStockDetail = createServerFn({ method: 'POST' })
  .validator((d: unknown) => {
    const syms = parse(String(d ?? ''))
    if (syms.length !== 1) throw new Error('one symbol required, e.g. RELIANCE.NS')
    return syms[0] as string
  })
  .handler(async ({ data }): Promise<StockDetail> => {
    const out = await digest([data], '3mo', '1d')
    const r = out.results[0]
    return {
      symbol: r.symbol,
      snapshot: r.snapshot,
      feats: r.feats,
      decision: r.decision,
      news: r.news,
      candles: r.candles,
      summary: out.summary,
    }
  })

// Fast path (SSR): day's top-10 gainers/losers.
export const getMovers = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Movers> => movers(),
)

// Fuzzy finder: bundled JSON first, Yahoo live merged. In-process, no fetch hop.
export const suggestStocks = createServerFn({ method: 'GET' })
  .validator((d: unknown) => String(d ?? '').slice(0, 30))
  .handler(async ({ data }): Promise<SuggestRow[]> => suggest(data))
