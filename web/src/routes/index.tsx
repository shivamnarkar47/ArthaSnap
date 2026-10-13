import * as React from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { getQuotes, getDigest, getMovers, parseSymbols, type DigestResult } from '#/lib/digest'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '#/components/ui/card'

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

function Spark({ data, w = 160, h = 44 }: { data: number[]; w?: number; h?: number }) {
  if (data.length < 2) return null
  const min = Math.min(...data), max = Math.max(...data), rg = max - min || 1
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 4 - ((v - min) / rg) * (h - 8)).toFixed(1)}`).join(' ')
  const up = data[data.length - 1] >= data[0]
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={up ? '#2f6a4a' : '#b3372f'} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

function MoverRow({ symbol, price, chgPct, onPick }: { symbol: string; price: number; chgPct: number; onPick: (s: string) => void }) {
  const up = chgPct >= 0
  return (
    <button onClick={() => onPick(symbol)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-accent" title={`Digest ${symbol}`}>
      <span className="font-semibold">{symbol.replace(/\.NS$/, '')}</span>
      <span className="text-muted-foreground">₹{price?.toLocaleString('en-IN')}</span>
      <span className={up ? 'font-bold text-green-700' : 'font-bold text-red-700'}>
        {up ? '+' : ''}{chgPct?.toFixed(2)}%
      </span>
    </button>
  )
}

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

  return (
    <div className="page-wrap rise-in pb-16">
      {/* Hero */}
      <section className="island-shell rounded-2xl px-8 py-12 text-center md:py-16">
        <p className="island-kicker">SubQ Snap decisions · Groq briefs · NSE + BSE</p>
        <h1 className="display-title mx-auto mt-3 max-w-2xl text-4xl font-bold leading-tight md:text-5xl">
          Any stock, judged in seconds.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Type up to 5 NSE/BSE symbols. SubQ's decision model calls buy, watch or avoid with conviction —
          Groq briefs the latest news. No noise, just the verdict.
        </p>
        <form
          className="mx-auto mt-6 flex max-w-xl gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            go(input)
          }}
        >
          <Input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} placeholder="RELIANCE.NS,TCS.NS (max 5)" aria-label="Symbols" />
          <Button type="submit" size="lg">Digest</Button>
        </form>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
          {['RELIANCE.NS,TCS.NS,INFY.NS', 'HDFCBANK.NS,ICICIBANK.NS', 'TATAMOTORS.NS'].map((ex) => (
            <button key={ex} onClick={() => go(ex)} className="rounded-full border border-chip-line bg-chip-bg px-3 py-1 text-sea-ink-soft hover:bg-link-bg-hover">
              {ex}
            </button>
          ))}
        </div>
      </section>

      {/* Movers */}
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>▲ Top gainers</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {movers.gainers.map((m) => <MoverRow key={m.symbol} {...m} onPick={(s) => go(s)} />)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>▼ Top losers</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {movers.losers.map((m) => <MoverRow key={m.symbol} {...m} onPick={(s) => go(s)} />)}
          </CardContent>
        </Card>
      </section>

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
                  <span className="text-2xl">₹{q.snapshot.price?.toLocaleString('en-IN')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{q.snapshot.sector ?? '—'} · PE {q.snapshot.pe ?? '—'}</span>
                  <span className={q.snapshot.chgPct != null && q.snapshot.chgPct >= 0 ? 'text-green-700' : 'text-red-700'}>
                    {q.snapshot.chgPct != null ? `${q.snapshot.chgPct > 0 ? '+' : ''}${q.snapshot.chgPct}%` : '—'}
                  </span>
                </div>
                <Spark data={q.spark} />
                {d ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="rounded-full bg-secondary px-3 py-1 font-semibold">{d.decision.action ?? '—'}</span>
                    <span className="text-muted-foreground">conviction {d.decision.conviction ?? '—'} · buy p {d.decision.buy?.toFixed(2) ?? '—'}</span>
                  </div>
                ) : (
                  <p className="animate-pulse text-sm text-muted-foreground">{aiError ?? 'Judging…'}</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Brief</CardTitle></CardHeader>
        <CardContent>
          {digest ? (
            <div className="prose whitespace-pre-wrap text-sm">{digest.summary}</div>
          ) : (
            <p className="animate-pulse text-sm text-muted-foreground">{aiError ?? 'Summarizing news…'}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
