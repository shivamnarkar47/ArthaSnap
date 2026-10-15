"use client";
import { ChartFrame, type ChartFrameProps } from "#/components/ui/chart.tsx";
import { finiteValue, scaleValue } from "#/lib/cojeev/chart-geometry.ts";

export type CandlePoint = {
  label: string;
  o: number | null;
  h: number | null;
  l: number | null;
  c: number | null;
};

function candleDomain(data: CandlePoint[]): [number, number] {
  let low = Infinity,
    high = -Infinity;
  for (const point of data) {
    const h = finiteValue(point.h),
      l = finiteValue(point.l);
    if (h !== null) high = Math.max(high, h);
    if (l !== null) low = Math.min(low, l);
  }
  if (!Number.isFinite(low) || !Number.isFinite(high)) return [0, 1];
  if (low === high) {
    const pad = Math.abs(low) * 0.02 || 1;
    return [low - pad, high + pad];
  }
  const padding = (high - low) * 0.08;
  return [low - padding, high + padding];
}

const UP = "stroke-green-600 fill-green-600 dark:stroke-green-500 dark:fill-green-500";
const DOWN = "stroke-red-600 fill-red-600 dark:stroke-red-500 dark:fill-red-500";

export function CandleChart({
  data,
  caption = "Candlestick chart",
  ...props
}: Omit<ChartFrameProps, "children" | "legendMode" | "interaction" | "data" | "series"> & {
  data: CandlePoint[];
}) {
  return (
    <ChartFrame
      data={data}
      series={[{ key: "c", label: "Close" }]}
      caption={caption}
      interaction="x"
      {...props}
    >
      {(plot) => {
        const { data: points, left, right, top, bottom, active, id } = plot;
        const candles = points as CandlePoint[];
        const domain = candleDomain(candles);
        const y = (value: number) => scaleValue(value, domain, bottom, top);
        const n = candles.length;
        const x = (index: number) =>
          n === 1 ? (left + right) / 2 : left + (index / Math.max(1, n - 1)) * (right - left);
        const column = (right - left) / Math.max(1, n);
        const width = Math.max(2, Math.min(12, column * 0.55));
        const ticks = Array.from({ length: 5 }, (_, index) => domain[0] + ((domain[1] - domain[0]) * index) / 4);
        const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((right - left) / 65))));
        return (
          <>
            <defs>
              <clipPath id={`${id}-plot-clip`}>
                <rect x={left - 5} y={top - 5} width={right - left + 10} height={bottom - top + 10} />
              </clipPath>
            </defs>
            <g className="v-chart-grid" aria-hidden="true">
              {ticks.map((tick, index) => (
                <g key={index}>
                  <line x1={left} x2={right} y1={y(tick)} y2={y(tick)} />
                  <text x={left - 10} y={y(tick) + 4} textAnchor="end">
                    {tick.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
                  </text>
                </g>
              ))}
            </g>
            <g className="v-chart-axis" aria-hidden="true">
              {candles.map((point, index) =>
                index % labelEvery === 0 || index === n - 1 ? (
                  <text
                    key={index}
                    x={x(index)}
                    y={bottom + 26}
                    textAnchor={index === 0 ? "start" : index === n - 1 ? "end" : "middle"}
                  >
                    {point.label.length > 12 ? `${point.label.slice(0, 11)}…` : point.label}
                  </text>
                ) : null,
              )}
            </g>
            <g clipPath={`url(#${id}-plot-clip)`}>
              {active !== null && (
                <line
                  className="v-chart-crosshair"
                  x1={x(active)}
                  x2={x(active)}
                  y1={top}
                  y2={bottom}
                />
              )}
              {candles.map((point, index) => {
                const o = finiteValue(point.o),
                  h = finiteValue(point.h),
                  l = finiteValue(point.l),
                  c = finiteValue(point.c);
                if (o === null || h === null || l === null || c === null) return null;
                const up = c >= o;
                const cx = x(index);
                return (
                  <g
                    key={`${point.label}-${index}`}
                    className={up ? UP : DOWN}
                    opacity={active === null || active === index ? 1 : 0.45}
                    onPointerEnter={() => plot.inspect(index)}
                  >
                    <line x1={cx} x2={cx} y1={y(h)} y2={y(l)} strokeWidth={1.5} />
                    <rect
                      x={cx - width / 2}
                      y={Math.min(y(o), y(c))}
                      width={width}
                      height={Math.max(1.5, Math.abs(y(o) - y(c)))}
                      rx={1}
                    />
                  </g>
                );
              })}
            </g>
          </>
        );
      }}
    </ChartFrame>
  );
}
