// Server-only boundary: digest svc runs IN-PROCESS (no worker-to-worker fetch;
// the edge 1042s those). Client code imports only the fn handles below.
import { createServerFn } from '@tanstack/react-start'
import {
  snapshot, chart, digest, movers,
  parseSymbols as parse,
} from '../../../digest/src/svc'

export { parseSymbols } from '../../../digest/src/svc'

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

// Fast path (SSR): day's top-10 gainers/losers.
export const getMovers = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Movers> => movers(),
)
