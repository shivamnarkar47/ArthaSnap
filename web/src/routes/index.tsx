import * as React from 'react'
import Markdown from 'react-markdown'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { getQuotes, getDigest, getMovers, parseSymbols, type DigestResult } from '#/lib/digest'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '#/components/ui/card'
import { LineChart } from '#/components/ui/line-chart'
import { BarChart } from '#/components/ui/bar-chart'

const DEFAULTS = 'RELIANCE.NS'

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
const short = (s: string) => s.replace(/\.NS$/, '')
const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 1 })}`

function Kicker({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <p className="island-kicker">
      {n} · {children}
    </p>
  )
}

function Verdict({ action }: { action: string | null }) {
  const tone =
    action === 'buy'
      ? 'bg-green-600/10 text-green-700 dark:text-green-300 ring-green-600/30'
      : action === 'avoid'
        ? 'bg-red-600/10 text-red-700 dark:text-red-300 ring-red-600/30'
        : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/30'
  return <span className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${tone}`}>{action ?? '—'}</span>
}

function Skeleton({ label }: { label: string }) {
  return (
    <div className="animate-pulse space-y-2" role="status" aria-label={label}>
      <div className="h-3 w-2/3 rounded bg-muted" />
      <div className="h-3 w-1/2 rounded bg-muted" />
    </div>
  )
}

function Md({ text }: { text: string }) {
  return (
    <div className="text-sm leading-6">
      <Markdown
        components={{
          h1: (p) => <h3 className="mb-2 text-base font-bold" {...p} />,
          h2: (p) => <h4 className="mb-1 mt-4 text-sm font-bold uppercase tracking-wide text-muted-foreground" {...p} />,
          h3: (p) => <h4 className="mb-1 mt-3 text-sm font-bold" {...p} />,
          p: (p) => <p className="mb-2" {...p} />,
          ul: (p) => <ul className="mb-3 ml-4 list-disc space-y-1" {...p} />,
          ol: (p) => <ol className="mb-3 ml-4 list-decimal space-y-1" {...p} />,
          li: (p) => <li className="pl-1" {...p} />,
          strong: (p) => <strong className="font-semibold text-foreground" {...p} />,
          a: (p) => <a className="underline underline-offset-2" target="_blank" rel="noreferrer" {...p} />,
          hr: () => <hr className="my-3 border-border" />,
        }}
      >
        {text}
      </Markdown>
    </div>
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

  React.useEffect(() => {
    setDigest(null)
    setAiError(null)
    getDigest({ data: symbols.split(',') }).then(setDigest, (e) => setAiError(e.message || 'AI digest failed'))
  }, [symbols])

  const verdict = (sym: string) => digest?.results.find((r) => r.symbol === sym)
  const top = movers.gainers[0]
  const board = [...movers.gainers, ...movers.losers].map((m) => ({
    label: short(m.symbol),
    change: +m.chgPct.toFixed(2),
  }))

  return (
    <div className="page-wrap rise-in pb-20">
      {/* 01 — calm intro */}
      <section className="border-b border-border pb-8 pt-10">
        <Kicker n="01">NSE · BSE — QUIET RESEARCH</Kicker>
        <h1 className="display-title mt-3 max-w-xl text-3xl font-semibold leading-snug md:text-4xl">
          A calmer way to read stocks.
        </h1>
        <p className="mt-2 max-w-md text-[15px] text-muted-foreground">
          Five symbols at most. One judgment each — buy, watch or avoid — with the news in plain words.
        </p>
        <form
          id="digest"
          className="mt-6 flex max-w-lg scroll-mt-6 gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            go(input)
          }}
        >
          <Input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} placeholder="RELIANCE.NS, TCS.NS…" aria-label="Symbols" className="bg-card" />
          <Button type="submit">Ask</Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
          {['RELIANCE.NS,TCS.NS,INFY.NS', 'HDFCBANK.NS,ICICIBANK.NS', 'TATAMOTORS.NS'].map((ex) => (
            <button key={ex} onClick={() => go(ex)} className="rounded-full border border-border bg-card px-3 py-1 text-muted-foreground hover:text-foreground">
              {ex}
            </button>
          ))}
        </div>
        <div className="mt-6 flex max-w-lg gap-6 text-sm">
          {[
            { v: top ? `+${top.chgPct.toFixed(2)}%` : '—', l: top ? `${short(top.symbol)} today` : 'today' },
            { v: String(movers.gainers.length + movers.losers.length), l: 'tracked' },
            { v: '3', l: 'judgments / stock' },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-base font-semibold tabular-nums">{s.v}</div>
              <div className="text-xs text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 02 — digest */}
      <section className="mt-10">
        <Kicker n="02">DIGEST · {symbols}</Kicker>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {quotes.map((q) => {
            const d = verdict(q.symbol)
            return (
              <Card key={q.symbol}>
                <CardHeader>
                  <CardTitle className="flex items-baseline justify-between gap-3">
                    <span className="truncate">{short(q.symbol)}</span>
                    <span className="text-2xl font-bold tabular-nums">{q.snapshot.price != null ? inr(q.snapshot.price) : '—'}</span>
                  </CardTitle>
                  <div className="flex items-center justify-between pt-1 text-sm text-muted-foreground">
                    <span className="truncate">{q.snapshot.sector ?? '—'} · PE {q.snapshot.pe != null ? Number(q.snapshot.pe).toFixed(1) : '—'}</span>
                    <span className={`font-semibold tabular-nums ${q.snapshot.chgPct != null && q.snapshot.chgPct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {q.snapshot.chgPct != null ? `${q.snapshot.chgPct > 0 ? '+' : ''}${Number(q.snapshot.chgPct).toFixed(2)}%` : '—'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <LineChart
                    variant="smooth"
                    appearance="analysis"
                    data={q.spark.map((p) => ({ label: dayLabel(p.t), price: Number(p.c.toFixed(1)) }))}
                    series={[{ key: 'price', label: short(q.symbol), color: 'blue' }]}
                    caption={`${short(q.symbol)} · last 20 closes`}
                    description=""
                  />
                  {d ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Verdict action={d.decision.action} />
                      <span className="text-muted-foreground tabular-nums">
                        conviction {d.decision.conviction ?? '—'} · buy p {d.decision.buy?.toFixed(2) ?? '—'}
                      </span>
                    </div>
                  ) : (
                    <Skeleton label={aiError ?? 'Judging'} />
                  )}
                  {d && d.news.length > 0 && (
                    <ul className="space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
                      {d.news.slice(0, 3).map((n) => (
                        <li key={n.link} className="truncate">
                          <a href={n.link} target="_blank" rel="noreferrer" className="hover:underline">{n.title}</a>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* 03 — brief */}
      <section className="mt-6">
        <Kicker n="03">AI BRIEF</Kicker>
        <Card className="mt-3">
          <CardContent className="pt-6">
            {digest ? <Md text={digest.summary} /> : <Skeleton label={aiError ?? 'Summarizing'} />}
          </CardContent>
        </Card>
      </section>

      {/* 04 — day board */}
      <section className="mt-10">
        <Kicker n="04">DAY BOARD · NSE</Kicker>
        <Card className="mt-3">
          <CardContent className="pt-6">
            <BarChart
              variant="horizontal"
              appearance="ledger"
              data={board}
              series={[{ key: 'change', label: 'Day change %', color: 'olive' }]}
              summary={{
                label: top ? `Top gainer ${short(top.symbol)}` : 'Top gainer',
                value: top ? `+${top.chgPct.toFixed(2)}%` : '—',
                detail: `${board.length} symbols, one batch quote.`,
              }}
              caption="Day movers · gains vs losses"
              description="Horizontal bars with exact values beside the plot."
            />
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
              {[...movers.gainers.slice(0, 3), ...movers.losers.slice(0, 2)].map((m) => (
                <Button key={m.symbol} variant="outline" size="sm" onClick={() => go(m.symbol)}>
                  Digest {short(m.symbol)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
