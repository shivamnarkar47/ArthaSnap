import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { getStockDetail, type StockDetail } from '#/lib/digest'
import { Button } from '#/components/ui/button'
import { Md } from '#/components/md'
import { Card, CardContent } from '#/components/ui/card'
import { SymbolChart } from '#/components/symbol-chart'

export const Route = createFileRoute('/stock/$symbol')({
  head: ({ params }) => ({
    meta: [{ title: `${String(params.symbol).replace(/\.NS$/, '')} · ArthaSnap` }],
  }),
  component: StockPage,
})

const short = (s: string) => s.replace(/\.NS$/, '')
const inr = (n: number | null) =>
  n == null ? '—' : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 1 })}`

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="island-kicker min-w-0 break-words [overflow-wrap:anywhere]">{children}</p>
  )
}

function Skeleton({ label }: { label: string }) {
  return (
    <div className="animate-pulse space-y-2" role="status" aria-label={label}>
      <div className="h-3 w-2/3 rounded bg-muted" />
      <div className="h-3 w-1/2 rounded bg-muted" />
    </div>
  )
}

function Verdict({ action }: { action: string | null }) {
  const tone =
    action === 'buy'
      ? 'bg-green-600/10 text-green-700 dark:text-green-300 ring-green-600/30'
      : action === 'avoid'
        ? 'bg-red-600/10 text-red-700 dark:text-red-300 ring-red-600/30'
        : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/30'
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${tone}`}>
      {action ?? '—'}
    </span>
  )
}

/** Plain-words read of the exact inputs fed to the SubQ decision model. */
function patternOf(d: StockDetail): { title: string; bullets: string[] } {
  const price = d.snapshot.price
  const sma = d.feats.sma20
  const rsi = d.feats.rsi14
  const above = sma != null && price != null ? ((price - sma) / sma) * 100 : null

  const trend =
    above == null
      ? 'No trend read'
      : above > 3
        ? 'Strong uptrend'
        : above > 0
          ? 'Mild uptrend'
          : above < -3
            ? 'Sharp downtrend'
            : 'Mild downtrend'
  const regime =
    rsi == null
      ? 'no RSI read'
      : rsi >= 70
        ? `RSI ${rsi} — overbought, chase carefully`
        : rsi >= 55
          ? `RSI ${rsi} — healthy momentum`
          : rsi >= 45
            ? `RSI ${rsi} — neutral`
            : rsi >= 30
              ? `RSI ${rsi} — weak`
              : `RSI ${rsi} — oversold, possible bounce`

  const bullets: string[] = []
  bullets.push(
    above == null
      ? `Price ${inr(price)} · 20-day average unavailable`
      : `Price ${inr(price)} · ${above >= 0 ? '+' : ''}${above.toFixed(1)}% vs 20-day avg ${inr(sma)}`,
  )
  bullets.push(`Momentum: ${regime}`)
  bullets.push(
    `Valuation: ${d.snapshot.sector ?? '—'} · PE ${d.snapshot.pe != null ? Number(d.snapshot.pe).toFixed(1) : '—'}`,
  )
  if (d.snapshot.yLow != null && d.snapshot.yHigh != null && price != null && d.snapshot.yHigh > d.snapshot.yLow) {
    const pos = ((price - d.snapshot.yLow) / (d.snapshot.yHigh - d.snapshot.yLow)) * 100
    bullets.push(`52-week band: ${inr(d.snapshot.yLow)} – ${inr(d.snapshot.yHigh)} · sitting ${pos.toFixed(0)}% up the range`)
  }
  bullets.push(`Model read ${d.news.length} fresh headline${d.news.length === 1 ? '' : 's'} alongside price action`)

  return { title: `${trend} · ${regime}`, bullets }
}

function StockPage() {
  const { symbol } = Route.useParams()
  const [detail, setDetail] = React.useState<StockDetail | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setDetail(null)
    setError(null)
    getStockDetail({ data: symbol }).then(setDetail, (e) =>
      setError(e.message || 'Could not load this stock'),
    )
  }, [symbol])

  const pattern = detail ? patternOf(detail) : null
  const chg = detail?.snapshot.chgPct
  const up = chg != null && chg >= 0

  return (
    <div className="page-wrap rise-in min-w-0 pb-20">
      <div className="border-b border-border pb-6 pt-10">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/" search={{ symbols: '' }}>
            ← All stocks
          </Link>
        </Button>
        <Kicker>
          {detail ? `ANALYSIS · ${short(detail.symbol)}` : `ANALYSIS · ${short(symbol)}`}
        </Kicker>
        {detail ? (
          <div className="mt-3 flex min-w-0 flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="display-title truncate text-3xl font-semibold md:text-4xl">
                {short(detail.symbol)}
              </h1>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {detail.snapshot.sector ?? '—'} · PE{' '}
                {detail.snapshot.pe != null ? Number(detail.snapshot.pe).toFixed(1) : '—'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold tabular-nums">
                {detail.snapshot.price != null ? inr(detail.snapshot.price) : '—'}
              </div>
              <div
                className={`text-sm font-semibold tabular-nums ${up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
              >
                {chg != null ? `${chg > 0 ? '+' : ''}${Number(chg).toFixed(2)}%` : '—'}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3">{error ?? <Skeleton label="Loading stock" />}</div>
        )}
      </div>

      {error && (
        <Card className="mt-6 min-w-0 overflow-hidden">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      )}

      {detail && (
        <>
          <section className="mt-6 min-w-0">
            <Kicker>PRICE · FULL WIDTH</Kicker>
            <Card className="mt-3 min-w-0 overflow-hidden">
              <CardContent className="pt-6">
                <SymbolChart
                  symbol={detail.symbol}
                  initial={detail.candles.slice(-20).map((c) => ({ t: c.t, c: c.c }))}
                />
              </CardContent>
            </Card>
          </section>

          <div className="mt-6 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
            <section className="min-w-0">
              <Kicker>PATTERN · WHAT THE MODEL SEES</Kicker>
              <Card className="mt-3 min-w-0 overflow-hidden">
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Verdict action={detail.decision.action} />
                    <span className="text-sm tabular-nums text-muted-foreground">
                      conviction {detail.decision.conviction ?? '—'}
                    </span>
                  </div>
                  <p className="mt-3 text-base font-semibold leading-snug">{pattern?.title}</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {pattern?.bullets.map((b) => (
                      <li key={b} className="break-words [overflow-wrap:anywhere]">
                        · {b}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>

            <section className="min-w-0">
              <Kicker>AI BRIEF</Kicker>
              <Card className="mt-3 min-w-0 overflow-hidden">
                <CardContent className="pt-6">
                  <Md text={detail.summary} />
                </CardContent>
              </Card>
            </section>
          </div>

          {detail.news.length > 0 && (
            <section className="mt-6 min-w-0">
              <Kicker>SIGNAL · FRESH HEADLINES</Kicker>
              <Card className="mt-3 min-w-0 overflow-hidden">
                <CardContent className="space-y-1.5 pt-6 text-sm text-muted-foreground">
                  {detail.news.map((n) => (
                    <p key={n.link} className="min-w-0">
                      <a
                        href={n.link}
                        target="_blank"
                        rel="noreferrer"
                        className="block break-words leading-snug hover:underline"
                      >
                        {n.title}
                      </a>
                    </p>
                  ))}
                </CardContent>
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  )
}
