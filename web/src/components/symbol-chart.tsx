"use client";
import * as React from "react";
import { getChart, type Candle } from "#/lib/digest.ts";
import { LineChart } from "#/components/ui/line-chart.tsx";
import { CandleChart } from "#/components/ui/candle-chart.tsx";
import { Button } from "#/components/ui/button.tsx";

type ChartRange = "1D" | "1W" | "1M";
type ChartKind = "line" | "candle";
const RANGE_Q = { "1D": "1d", "1W": "5d", "1M": "1mo" } as const;
const RANGE_CAPTION = { "1D": "today", "1W": "last 5 days", "1M": "last 20 closes" } as const;

const short = (s: string) => s.replace(/\.NS$/, "");
const dayLabel = (t: number) =>
  new Date(t * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const timeLabel = (t: number) =>
  new Date(t * 1000).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

const inrTick = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 1 })}`;

function downsample(candles: Candle[], max = 60): Candle[] {
  if (candles.length <= max) return candles;
  const size = Math.ceil(candles.length / max);
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i += size) {
    const group = candles.slice(i, i + size);
    const last = group[group.length - 1];
    out.push({
      t: group[0].t,
      o: group[0].o,
      h: Math.max(...group.map((c) => c.h)),
      l: Math.min(...group.map((c) => c.l)),
      c: last.c,
      v: group.reduce((sum, c) => sum + (c.v ?? 0), 0),
    });
  }
  return out;
}

export function SymbolChart({
  symbol,
  initial,
}: {
  symbol: string;
  initial: Array<{ t: number; c: number }>;
}) {
  const [kind, setKind] = React.useState<ChartKind>("line");
  const [range, setRange] = React.useState<ChartRange>("1M");
  const [ohlc, setOhlc] = React.useState<Record<string, Candle[]>>({});
  const [failed, setFailed] = React.useState<Record<string, boolean>>({});
  const [fetching, setFetching] = React.useState(false);

  React.useEffect(() => {
    setOhlc({});
    setFailed({});
  }, [symbol]);

  const needFetch = !(range === "1M" && kind === "line");
  React.useEffect(() => {
    if (!needFetch || ohlc[range] || failed[range]) return;
    let live = true;
    setFetching(true);
    getChart({ data: { symbol, range: RANGE_Q[range] } }).then(
      (r) => {
        if (!live) return;
        setOhlc((m) => ({ ...m, [range]: downsample(r.candles) }));
        setFetching(false);
      },
      () => {
        if (!live) return;
        setFailed((m) => ({ ...m, [range]: true }));
        setFetching(false);
      },
    );
    return () => {
      live = false;
    };
  }, [symbol, range, kind, needFetch, ohlc, failed]);

  const label = range === "1D" ? timeLabel : dayLabel;
  const candles = ohlc[range];
  const showLoading = needFetch && !candles && !failed[range];

  const summary = React.useMemo(() => {
    if (candles?.length) {
      const h = Math.max(...candles.map((c) => c.h));
      const l = Math.min(...candles.map((c) => c.l));
      return `H ${inrTick(h)} · L ${inrTick(l)}`;
    }
    const last = initial[initial.length - 1];
    return last ? `Last ${inrTick(last.c)}` : null;
  }, [candles, initial]);

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1" role="group" aria-label="Chart range">
          {(Object.keys(RANGE_Q) as ChartRange[]).map((r) => (
            <Button
              key={r}
              type="button"
              size="sm"
              variant={range === r ? "default" : "outline"}
              onClick={() => setRange(r)}
              aria-pressed={range === r}
            >
              {r}
            </Button>
          ))}
        </div>
        <div className="flex gap-1" role="group" aria-label="Chart type">
          <Button
            type="button"
            size="sm"
            variant={kind === "line" ? "default" : "outline"}
            onClick={() => setKind("line")}
            aria-pressed={kind === "line"}
          >
            Line
          </Button>
          <Button
            type="button"
            size="sm"
            variant={kind === "candle" ? "default" : "outline"}
            onClick={() => setKind("candle")}
            aria-pressed={kind === "candle"}
          >
            Candles
          </Button>
        </div>
      </div>
      <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground" aria-live="polite">
        <span className="truncate tabular-nums">{summary}</span>
        {fetching && <span className="shrink-0">updating…</span>}
      </div>
      {showLoading ? (
        <div className="h-[300px] animate-pulse rounded-xl bg-muted" role="status" aria-label="Loading chart" />
      ) : failed[range] ? (
        <p className="text-sm text-muted-foreground">Chart unavailable for {range}.</p>
      ) : kind === "line" && range === "1M" ? (
        <LineChart
          variant="smooth"
          appearance="analysis"
          data={initial.map((p) => ({ label: dayLabel(p.t), price: Number(p.c.toFixed(1)) }))}
          series={[{ key: "price", label: short(symbol), color: "blue" }]}
          caption={`${short(symbol)} · ${RANGE_CAPTION[range]}`}
          description=""
        />
      ) : kind === "line" ? (
        <LineChart
          variant="smooth"
          appearance="analysis"
          data={(candles ?? []).map((p) => ({ label: label(p.t), price: Number(p.c.toFixed(1)) }))}
          series={[{ key: "price", label: short(symbol), color: "blue" }]}
          caption={`${short(symbol)} · ${RANGE_CAPTION[range]}`}
          description=""
        />
      ) : (
        <CandleChart
          appearance="analysis"
          data={(candles ?? []).map((p) => ({ label: label(p.t), o: p.o, h: p.h, l: p.l, c: p.c }))}
          caption={`${short(symbol)} · ${RANGE_CAPTION[range]}`}
          description=""
          valueFormatter={inrTick}
        />
      )}
    </div>
  );
}
