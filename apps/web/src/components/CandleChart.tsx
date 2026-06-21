import { useMemo } from "react";
import { buildCandles, type Candle } from "../lib/mock.js";

export interface CandleChartProps {
  count?: number;
  /** stroke/fill for rising candles. defaults to the theme up token. */
  up?: string;
  /** stroke/fill for falling candles. defaults to the theme down token. */
  down?: string;
  grid?: string;
  axis?: string;
  /** optional moving-average line color */
  maColor?: string;
  /** render the volume histogram band */
  showVolume?: boolean;
  className?: string;
}

const W = 800;
const H = 320;
const PAD_R = 56;
const VOL_H = 56;

function movingAverage(candles: Candle[], period: number): (number | null)[] {
  return candles.map((_, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].c;
    return sum / period;
  });
}

export function CandleChart({
  count = 64,
  up = "var(--color-up)",
  down = "var(--color-down)",
  grid = "rgba(255,255,255,0.04)",
  axis = "rgba(123,130,140,0.9)",
  maColor = "var(--color-brand)",
  showVolume = true,
  className,
}: CandleChartProps) {
  const candles = useMemo(() => buildCandles(count), [count]);

  const { min, max, maxVol } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    let mv = 0;
    for (const c of candles) {
      lo = Math.min(lo, c.l);
      hi = Math.max(hi, c.h);
      mv = Math.max(mv, c.v);
    }
    const pad = (hi - lo) * 0.08;
    return { min: lo - pad, max: hi + pad, maxVol: mv };
  }, [candles]);

  const plotH = showVolume ? H - VOL_H : H;
  const plotW = W - PAD_R;
  const x = (i: number) => (i / candles.length) * plotW;
  const y = (price: number) => plotH - ((price - min) / (max - min)) * plotH;
  const candleW = (plotW / candles.length) * 0.62;

  const ma = useMemo(() => movingAverage(candles, 9), [candles]);
  const maPath = maColor
    ? ma
        .map((v, i) =>
          v == null
            ? null
            : `${i === 0 ? "M" : "L"} ${x(i) + candleW / 2} ${y(v)}`,
        )
        .filter(Boolean)
        .join(" ")
        .replace(/^L/, "M")
    : "";

  const gridLines = 5;
  const lastClose = candles[candles.length - 1].c;
  const lastUp = candles[candles.length - 1].c >= candles[candles.length - 2].c;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: "100%", height: "100%", display: "block" }}
      role="img"
      aria-label="Price chart"
    >
      {Array.from({ length: gridLines }).map((_, i) => {
        const gy = (i / (gridLines - 1)) * plotH;
        const price = max - (i / (gridLines - 1)) * (max - min);
        return (
          <g key={i}>
            <line
              x1={0}
              y1={gy}
              x2={plotW}
              y2={gy}
              stroke={grid}
              strokeWidth={1}
            />
            <text
              x={W - 6}
              y={gy + 3}
              fill={axis}
              fontSize={9}
              textAnchor="end"
              fontFamily="var(--font-mono)"
            >
              {price.toFixed(10)}
            </text>
          </g>
        );
      })}

      {showVolume &&
        candles.map((c, i) => {
          const vh = (c.v / maxVol) * (VOL_H - 8);
          const up0 = c.c >= c.o;
          return (
            <rect
              key={`v${i}`}
              x={x(i) + (candleW * 0.62) / 2}
              y={H - vh}
              width={candleW}
              height={vh}
              fill={up0 ? up : down}
              opacity={0.28}
            />
          );
        })}

      {candles.map((c, i) => {
        const up0 = c.c >= c.o;
        const color = up0 ? up : down;
        const cx = x(i) + candleW / 2;
        const bodyTop = y(Math.max(c.o, c.c));
        const bodyBottom = y(Math.min(c.o, c.c));
        return (
          <g key={i}>
            <line
              x1={cx}
              y1={y(c.h)}
              x2={cx}
              y2={y(c.l)}
              stroke={color}
              strokeWidth={1}
            />
            <rect
              x={x(i)}
              y={bodyTop}
              width={candleW}
              height={Math.max(1, bodyBottom - bodyTop)}
              fill={color}
            />
          </g>
        );
      })}

      {maColor && maPath && (
        <path
          d={maPath}
          fill="none"
          stroke={maColor}
          strokeWidth={1.5}
          opacity={0.9}
        />
      )}

      <line
        x1={0}
        y1={y(lastClose)}
        x2={plotW}
        y2={y(lastClose)}
        stroke={lastUp ? up : down}
        strokeWidth={1}
        strokeDasharray="3 3"
        opacity={0.7}
      />
    </svg>
  );
}
