import * as React from 'react'
import { suggestStocks, parseSymbols, type SuggestRow } from '#/lib/digest'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'

export function StockSearch({ initial, onGo }: { initial: string[]; onGo: (syms: string[]) => void }) {
  const [picks, setPicks] = React.useState<string[]>(initial)
  const [text, setText] = React.useState('')
  const [results, setResults] = React.useState<SuggestRow[]>([])
  const [open, setOpen] = React.useState(false)
  const [hi, setHi] = React.useState(0)
  const box = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => setPicks(initial), [initial.join(',')])

  React.useEffect(() => {
    if (!text.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    const t = setTimeout(() => {
      suggestStocks({ data: text }).then(
        (r) => {
          setResults(r)
          setOpen(true)
          setHi(0)
        },
        () => {},
      )
    }, 150)
    return () => clearTimeout(t)
  }, [text])

  React.useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  const add = (ticker: string) => {
    const t = ticker.trim().toUpperCase()
    if (!t || picks.includes(t) || picks.length >= 5) return
    try {
      parseSymbols([...picks, t].join(','))
      setPicks([...picks, t])
    } catch {
      /* invalid symbol, ignore */
    }
    setText('')
    setOpen(false)
  }
  const flip = (s: string) =>
    setPicks(picks.map((p) => (p === s ? (s.endsWith('.BO') ? s.replace(/\.BO$/, '.NS') : s.replace(/\.NS$/, '.BO')) : p)))

  const submit = () => {
    let syms = [...picks]
    const t = text.trim()
    if (t) {
      try {
        for (const s of parseSymbols(t)) if (!syms.includes(s)) syms.push(s)
      } catch {
        // typed text isn't raw tickers — take the highlighted suggestion instead
        if (open && results[hi] && !syms.includes(results[hi].nse)) syms.push(results[hi].nse)
      }
    }
    syms = syms.slice(0, 5)
    if (syms.length) onGo(syms)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {picks.map((p) => (
          <span key={p} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-sm">
            <span className="font-semibold">{p}</span>
            <button type="button" onClick={() => flip(p)} className="rounded-full bg-secondary px-2 text-xs font-semibold" title="Switch NSE/BSE">
              {p.endsWith('.BO') ? 'BSE' : 'NSE'}
            </button>
            <button type="button" onClick={() => setPicks(picks.filter((x) => x !== p))} aria-label={`Remove ${p}`} className="text-muted-foreground hover:text-foreground">
              ×
            </button>
          </span>
        ))}
      </div>
      <div ref={box} className="relative mt-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Input
            value={text}
            onChange={(e) => setText(e.target.value.toUpperCase())}
            onFocus={() => results.length && setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && open) {
                e.preventDefault()
                setHi((h) => Math.min(h + 1, results.length - 1))
              } else if (e.key === 'ArrowUp' && open) {
                e.preventDefault()
                setHi((h) => Math.max(h - 1, 0))
              } else if (e.key === 'Escape') setOpen(false)
            }}
            placeholder={picks.length >= 5 ? 'Max 5 — remove one to add' : 'Type company — RELIANCE, HDFC, INFY…'}
            aria-label="Find Indian stocks"
            enterKeyHint="search"
            disabled={picks.length >= 5 && !text}
          />
          <Button type="submit" disabled={!picks.length && !text.trim()}>
            Ask
          </Button>
        </form>
        {open && results.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-popover shadow-lg" role="listbox">
            {results.map((r, i) => (
              <li key={r.symbol}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === hi}
                  onMouseEnter={() => setHi(i)}
                  onClick={() => add(r.nse)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${i === hi ? 'bg-accent' : ''}`}
                >
                  <span>
                    <span className="font-semibold">{r.symbol}</span>
                    <span className="ml-2 text-muted-foreground">{r.company}</span>
                  </span>
                  <span className="flex gap-1">
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation()
                        add(r.nse)
                      }}
                      className="rounded bg-secondary px-2 py-0.5 text-xs font-semibold"
                    >
                      NSE
                    </span>
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation()
                        add(r.bse)
                      }}
                      className="rounded bg-secondary px-2 py-0.5 text-xs font-semibold"
                    >
                      BSE
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
