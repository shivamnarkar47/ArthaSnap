import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { getQuotes, getDigest, getMovers, parseSymbols, type DigestResult } from '#/lib/digest'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '#/components/ui/card'
import { AuxinCanal } from '#/components/ui/auxin-canal'
import { CathodeStackGlow } from '#/components/ui/cathode-stack-glow'
import { ChartLineDither } from '#/components/ui/chart-line-dither'
import { EvalDeltaTable } from '#/components/ui/eval-regression-shear'
import { CarryDigit } from '#/components/ui/counter-carry-ripple'
import { BombeDrumHalt } from '#/components/ui/bombe-drum-halt'

const DEFAULTS = 'RELIANCE.NS'

// Validated search params: unknown input in, clean `symbols` string out.
function validSearch(search: Record<string, unknown>): { symbols: string } {
  try {
    return { symbols: parseSymbols(String(search.symbols ?? DEFAULTS)).join(',') }
  } catch {
    return { symbols: DEFAULTS }
  }
}

export const Route = createFileRoute('/')({
  validateSearch: validSearch,
  loaderDeps: ({ search }) => ({ symbols: search.symbols }),
  loader: async ({ deps }) => ({
    quotes: await getQuotes({ data: deps.symbols }),
    movers: await getMovers(),
  }),
  component: Home,
})

const dayLabel = (t: number) => new Date(t * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

function Home() {
  const { symbols } = Route.useSearch()
  const { quotes, movers } = Route.useLoaderData()
  const navigate = useNavigate()
  const [input, setInput] = React.useState(symbols)
  const [digest, setDigest] = React.useState<DigestResult | null>(null)
  const [aiError, setAiError] = React.useState<string | null>(null)

  const go = (s: string) => {
    try {
      navigate({ to: '/', search: { symbols: parseSymbols(s).join(',') } })
    } catch {
      setInput(symbols)
    }
  }

  // Streams in after the SSR shell: slow AI path stays out of the loader.
  React.useEffect(() => {
    setDigest(null)
    setAiError(null)
    getDigest({ data: symbols.split(',') }).then(setDigest, (e) => setAiError(e.message || 'AI digest failed'))
  }, [symbols])

  const verdict = (sym: string) => digest?.results.find((r) => r.symbol === sym)
  const top = movers.gainers[0]
  const board = [...movers.gainers, ...movers.losers].map((m) => ({
    id: m.symbol.replace(/\.NS$/, ''),
    baseline: 0.5,
    candidate: 0.5 + Math.max(-0.5, Math.min(0.5, m.chgPct / 20)),
  }))

  return (
    <div className="rise-in pb-16">
      <AuxinCanal
        eyebrow="SUBQ SNAP · GROQ BRIEFS · NSE + BSE"
        headlineLines={['Any stock,', 'judged in seconds.']}
        subcopy="Type up to 5 NSE/BSE symbols. SubQ's decision model calls buy, watch or avoid with conviction — Groq briefs the latest news. No noise, just the verdict."
        primaryCta={{ label: 'Digest a stock', href: '#digest' }}
        secondaryCta={{ label: 'Day movers', href: '#movers' }}
        stats={[
          { value: top ? `+${top.chgPct.toFixed(2)}%` : '—', label: top ? `top gainer ${top.symbol.replace(/\.NS$/, '')}` : 'top gainer' },
          { value: String(movers.gainers.length + movers.losers.length), label: 'symbols on the board' },
          { value: 'buy · watch · avoid', label: 'snap verdicts' },
        ]}
      />

      <div className="page-wrap">
        <form
          id="digest"
          className="island-shell mt-6 flex scroll-mt-6 gap-2 rounded-xl p-3"
          onSubmit={(e) => {
            e.preventDefault()
            go(input)
          }}
        >
          <Input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} placeholder="RELIANCE.NS,TCS.NS (max 5)" aria-label="Symbols" />
          <Button type="submit" size="lg">Digest</Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {['RELIANCE.NS,TCS.NS,INFY.NS', 'HDFCBANK.NS,ICICIBANK.NS', 'TATAMOTORS.NS'].map((ex) => (
            <button key={ex} onClick={() => go(ex)} className="rounded-full border border-chip-line bg-chip-bg px-3 py-1 text-sea-ink-soft hover:bg-link-bg-hover">
              {ex}
            </button>
          ))}
        </div>

        {/* Digest */}
        <h2 className="display-title mt-10 text-2xl font-bold">Digest · {symbols}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {quotes.map((q) => {
            const d = verdict(q.symbol)
            return (
              <Card key={q.symbol} className="feature-card">
                <CardHeader>
                  <CardTitle className="flex items-baseline justify-between">
                    <span>{q.symbol}</span>
                    <CarryDigit value={q.snapshot.price ?? 0} decimals={1} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{q.snapshot.sector ?? '—'} · PE {q.snapshot.pe ?? '—'}</span>
                    <span className={q.snapshot.chgPct != null && q.snapshot.chgPct >= 0 ? 'text-green-700' : 'text-red-700'}>
                      {q.snapshot.chgPct != null ? `${q.snapshot.chgPct > 0 ? '+' : ''}${q.snapshot.chgPct}%` : '—'}
                    </span>
                  </div>
                  <ChartLineDither
                    title={q.symbol}
                    data={q.spark.map((p) => ({ label: dayLabel(p.t), value: p.c }))}
                  />
                  {d ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full bg-secondary px-3 py-1 font-semibold">{d.decision.action ?? '—'}</span>
                      <span className="text-muted-foreground">conviction {d.decision.conviction ?? '—'} · buy p {d.decision.buy?.toFixed(2) ?? '—'}</span>
                    </div>
                  ) : (
                    <BombeDrumHalt label={aiError ?? 'Judging'} />
                  )}
                  {d && d.news.length > 0 && (
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {d.news.slice(0, 3).map((n) => (
                        <li key={n.link} className="truncate">
                          <a href={n.link} target="_blank" rel="noreferrer">{n.title}</a>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {quotes.length === 1 && quotes[0].snapshot.price != null && (
          <Card className="mt-4">
            <CardContent className="flex flex-wrap items-center gap-6 pt-6">
              <CathodeStackGlow value={quotes[0].snapshot.price.toLocaleString('en-IN', { minimumFractionDigits: 1 })} />
              <div className="text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">{quotes[0].symbol} · last price, nixie readout</p>
                <p>Ghost digits + conditioning sweep are the hardware telling you it's alive.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mt-4">
          <CardHeader><CardTitle>Brief</CardTitle></CardHeader>
          <CardContent>
            {digest ? (
              <div className="prose whitespace-pre-wrap text-sm">{digest.summary}</div>
            ) : (
              <BombeDrumHalt label={aiError ?? 'Summarizing'} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Movers */}
      <div className="page-wrap">
        <h2 id="movers" className="display-title mt-10 scroll-mt-6 text-2xl font-bold">Day board</h2>
        <Card className="mt-4">
          <CardContent className="pt-6">
            <EvalDeltaTable
              cases={board}
              label="Day momentum vs flat, sorted"
              tieEps={0.002}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {[...movers.gainers.slice(0, 3), ...movers.losers.slice(0, 2)].map((m) => (
                <button key={m.symbol} onClick={() => go(m.symbol)} className="rounded-full border border-chip-line bg-chip-bg px-3 py-1 text-sm text-sea-ink-soft hover:bg-link-bg-hover">
                  Digest {m.symbol.replace(/\.NS$/, '')}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
