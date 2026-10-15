import * as React from 'react'
import Markdown from 'react-markdown'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { getQuotes, getDigest, getMovers, parseSymbols, type DigestResult } from '#/lib/digest'
import { Button } from '#/components/ui/button'
import { StockSearch } from '#/components/stock-search'
import { Card, CardHeader, CardTitle, CardContent } from '#/components/ui/card'
import { SymbolChart } from '#/components/symbol-chart'

function validSearch(search: Record<string, unknown>): { symbols: string } {
  const raw = String(search.symbols ?? '').trim()
  if (!raw) return { symbols: '' }
  try {
    return { symbols: parseSymbols(raw).join(',') }
  } catch {
    return { symbols: '' }
  }
}

export const Route = createFileRoute('/')({
  validateSearch: validSearch,
  loaderDeps: ({ search }) => ({ symbols: search.symbols }),
  loader: async ({ deps }) => ({
    quotes: deps.symbols ? await getQuotes({ data: deps.symbols }) : [],
    movers: await getMovers(),
  }),
  component: Home,
})

const short = (s: string) => s.replace(/\.NS$/, '')
const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 1 })}`

function Kicker({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <p className="island-kicker min-w-0 break-words [overflow-wrap:anywhere]">
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

function Skeleton({ label }: { label: string }) {  return (
    <div className="animate-pulse space-y-2" role="status" aria-label={label}>
      <div className="h-3 w-2/3 rounded bg-muted" />
      <div className="h-3 w-1/2 rounded bg-muted" />
    </div>
  )
}

function Md({ text }: { text: string }) {
  return (
    <div className="min-w-0 break-words text-sm leading-6 [overflow-wrap:anywhere]">
      <Markdown
        components={{
          h1: (p) => <h3 className="mb-2 text-base font-bold" {...p} />,
          h2: (p) => <h4 className="mb-1 mt-4 text-sm font-bold uppercase tracking-wide text-muted-foreground" {...p} />,
          h3: (p) => <h4 className="mb-1 mt-3 text-sm font-bold" {...p} />,
          p: (p) => <p className="mb-2 break-words [overflow-wrap:anywhere]" {...p} />,
          ul: (p) => <ul className="mb-3 ml-4 list-disc space-y-1" {...p} />,
          ol: (p) => <ol className="mb-3 ml-4 list-decimal space-y-1" {...p} />,
          li: (p) => <li className="pl-1 break-words [overflow-wrap:anywhere]" {...p} />,
          strong: (p) => <strong className="font-semibold text-foreground" {...p} />,
          a: (p) => <a className="underline underline-offset-2 [overflow-wrap:anywhere]" target="_blank" rel="noreferrer" {...p} />,
          hr: () => <hr className="my-3 border-border" />,
        }}
      >
        {text}
      </Markdown>
    </div>
  )
}

function BoardTable({
  rows,
  onPick,
}: {
  rows: Array<{ symbol: string; price: number; chgPct: number }>
  onPick: (s: string) => void
}) {
  const [key, setKey] = React.useState<'chgPct' | 'price' | 'symbol'>('chgPct')
  const [dir, setDir] = React.useState<1 | -1>(-1)
  const max = Math.max(...rows.map((r) => Math.abs(r.chgPct)), 0.01)
  const sorted = [...rows].sort((a, b) =>
    key === 'symbol' ? dir * a.symbol.localeCompare(b.symbol) : dir * (a[key] - b[key]),
  )
  const Head = ({ k, label, right }: { k: typeof key; label: string; right?: boolean }) => (
    <button
      onClick={() => (key === k ? setDir((d) => (d === 1 ? -1 : 1)) : (setKey(k), setDir(k === 'symbol' ? 1 : -1)))}
      className={`font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground ${right ? 'text-right' : 'text-left'}`}
    >
      {label} {key === k ? (dir === 1 ? '▲' : '▼') : ''}
    </button>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-mono text-[13px] tabular-nums">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-2 pr-3 font-medium"><Head k="symbol" label="Symbol" /></th>
            <th className="py-2 pr-3 text-right font-medium"><Head k="price" label="Last" right /></th>
            <th className="py-2 pr-3 text-right font-medium"><Head k="chgPct" label="Chg%" right /></th>
            <th className="hidden py-2 font-medium sm:table-cell"><span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Momentum</span></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const up = r.chgPct >= 0
            return (
              <tr key={r.symbol} onClick={() => onPick(r.symbol)} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-accent">
                <td className="py-2 pr-3 font-semibold">{short(r.symbol)}</td>
                <td className="py-2 pr-3 text-right">{r.price?.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                <td className={`py-2 pr-3 text-right font-semibold ${up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {up ? '▲' : '▼'} {up ? '+' : ''}{r.chgPct.toFixed(2)}
                </td>
                <td className="hidden py-2 sm:table-cell">
                  <span className="block h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                    <span
                      className={`block h-full rounded-full ${up ? 'bg-green-600 dark:bg-green-500' : 'bg-red-600 dark:bg-red-500'}`}
                      style={{ width: `${Math.max(4, (Math.abs(r.chgPct) / max) * 100)}%`, marginLeft: up ? 0 : 'auto' }}
                    />
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Home() {
  const { symbols } = Route.useSearch()
  const { quotes, movers } = Route.useLoaderData()
  const navigate = useNavigate()
  const [digest, setDigest] = React.useState<DigestResult | null>(null)
  const [aiError, setAiError] = React.useState<string | null>(null)

  const go = (syms: string[]) => {
    try {
      navigate({ to: '/', search: { symbols: parseSymbols(syms.join(',')).join(',') } })
    } catch {
      /* invalid, stay */
    }
  }
  const goRaw = (s: string) => {
    try {
      navigate({ to: '/', search: { symbols: parseSymbols(s).join(',') } })
    } catch {
      /* invalid, stay */
    }
  }

  React.useEffect(() => {
    setDigest(null)
    setAiError(null)
    if (!symbols) return
    getDigest({ data: symbols.split(',') }).then(setDigest, (e) => setAiError(e.message || 'AI digest failed'))
  }, [symbols])

  const hasSyms = symbols.length > 0

  const verdict = (sym: string) => digest?.results.find((r) => r.symbol === sym)
  const top = movers.gainers[0]
  const board = [...movers.gainers, ...movers.losers]

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
        <div id="digest" className="mt-6 max-w-lg scroll-mt-6">
          <StockSearch initial={hasSyms ? symbols.split(',') : []} onGo={go} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
          {['RELIANCE.NS,TCS.NS,INFY.NS', 'HDFCBANK.NS,ICICIBANK.NS', 'TATAMOTORS.NS'].map((ex) => (
            <button key={ex} onClick={() => goRaw(ex)} className="rounded-full border border-border bg-card px-3 py-1 text-muted-foreground hover:text-foreground">
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

      {/* 02 — digest, only when symbols picked */}
      {hasSyms && (
      <section className="mt-10 min-w-0">
        <Kicker n="02">DIGEST · {symbols.split(',').join(', ')}</Kicker>
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
          {quotes.map((q) => {
            const d = verdict(q.symbol)
            return (
              <Card key={q.symbol} className="min-w-0 overflow-hidden">
                <CardHeader className="min-w-0 flex-col items-stretch gap-1">
                  <CardTitle className="flex min-w-0 items-baseline justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate">{short(q.symbol)}</span>
                    <span className="shrink-0 text-2xl font-bold tabular-nums">{q.snapshot.price != null ? inr(q.snapshot.price) : '—'}</span>
                  </CardTitle>
                  <div className="flex min-w-0 flex-col gap-0.5 pt-1 text-sm text-muted-foreground">
                    <span className="block truncate">{q.snapshot.sector ?? '—'} · PE {q.snapshot.pe != null ? Number(q.snapshot.pe).toFixed(1) : '—'}</span>
                    <span className={`font-semibold tabular-nums ${q.snapshot.chgPct != null && q.snapshot.chgPct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {q.snapshot.chgPct != null ? `${q.snapshot.chgPct > 0 ? '+' : ''}${Number(q.snapshot.chgPct).toFixed(2)}%` : '—'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <SymbolChart symbol={q.symbol} initial={q.spark} />
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
                    <ul className="min-w-0 space-y-1.5 border-t border-border pt-3 text-sm text-muted-foreground">
                      {d.news.slice(0, 3).map((n) => (
                        <li key={n.link} className="min-w-0">
                          <a href={n.link} target="_blank" rel="noreferrer" className="block break-words leading-snug line-clamp-2 hover:underline">{n.title}</a>
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
      )}

      {/* 03 — brief */}
      {hasSyms && (
      <section className="mt-6 min-w-0">
        <Kicker n="03">AI BRIEF</Kicker>
        <Card className="mt-3 min-w-0 overflow-hidden">
          <CardContent className="pt-6">
            {digest ? <Md text={digest.summary} /> : <Skeleton label={aiError ?? 'Summarizing'} />}
          </CardContent>
        </Card>
      </section>
      )}

      {/* 04 — day board */}
      <section className="mt-10">
        <Kicker n={hasSyms ? '04' : '02'}>DAY BOARD · NSE</Kicker>
        <Card className="mt-3">
          <CardContent className="pt-6">
            <BoardTable rows={board} onPick={goRaw} />
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
              {[...movers.gainers.slice(0, 3), ...movers.losers.slice(0, 2)].map((m) => (
                <Button key={m.symbol} variant="outline" size="sm" onClick={() => goRaw(m.symbol)}>
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
