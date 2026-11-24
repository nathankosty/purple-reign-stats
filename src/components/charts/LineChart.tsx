'use client';

import { useMemo, useState } from 'react';

export interface ChartCategory {
  label: string; // short axis label
  full: string; // full name for the tooltip and table
  group: string; // season band the category belongs to
}

export interface ChartSeries {
  name: string;
  color: string;
  values: (number | null)[];
  sizes?: (number | null)[]; // optional weight per point, drawn as marker size
}

interface LineChartProps {
  categories: ChartCategory[];
  series: ChartSeries[];
  format: (value: number) => string;
  ariaLabel: string;
  sizeLabel?: string; // what `sizes` means, for the tooltip and table
}

// Drawn in a fixed coordinate space and scaled to the container.
const W = 720;
const H = 300;
const M = { top: 30, right: 96, bottom: 62, left: 48 };
const SURFACE = '#1a0f2e';
const GRID = 'rgba(216, 180, 254, 0.10)';
const AXIS = 'rgba(216, 180, 254, 0.28)';
const INK_MUTED = '#a89cc8';
const INK_SECONDARY = '#d6ccef';

function niceTicks(min: number, max: number, count = 4): number[] {
  if (max <= min) max = min + 1;
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / magnitude;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * magnitude;
  const ticks: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + step / 2; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
}

export function LineChart({ categories, series, format, ariaLabel, sizeLabel }: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const layout = useMemo(() => {
    const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
    const ticks = niceTicks(Math.min(0, ...all), Math.max(...all, 0.0001));
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const plotW = W - M.left - M.right;
    const plotH = H - M.top - M.bottom;
    const step = plotW / categories.length;
    const x = (i: number) => M.left + step * (i + 0.5);
    const y = (v: number) => M.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
    const maxSize = Math.max(1, ...series.flatMap((s) => (s.sizes || []).filter((v): v is number => v !== null)));
    const radius = (size: number | null | undefined) =>
      size ? 4 + 3 * Math.sqrt(size / maxSize) : 4;

    // Season bands: contiguous runs of the same group.
    const groups: { name: string; start: number; end: number }[] = [];
    categories.forEach((c, i) => {
      const last = groups[groups.length - 1];
      if (last && last.name === c.group) last.end = i;
      else groups.push({ name: c.group, start: i, end: i });
    });

    // Direct labels at each series' last point, unless two would collide.
    const ends = series.map((s) => {
      let i = s.values.length - 1;
      while (i >= 0 && s.values[i] === null) i--;
      return i >= 0 ? { i, y: y(s.values[i]!) } : null;
    });
    const placed = ends.filter((e): e is { i: number; y: number } => e !== null);
    const collide = placed.some((a, ai) => placed.some((b, bi) => ai < bi && Math.abs(a.y - b.y) < 14));

    return { ticks, x, y, step, plotH, radius, groups, ends, directLabels: !collide };
  }, [categories, series]);

  const { ticks, x, y, step, plotH, radius, groups, ends, directLabels } = layout;

  const segments = (values: (number | null)[]) => {
    const paths: string[] = [];
    let current = '';
    values.forEach((v, i) => {
      if (v === null) {
        if (current) paths.push(current);
        current = '';
        return;
      }
      current += `${current ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    });
    if (current) paths.push(current);
    return paths;
  };

  const tooltipSide = hover !== null && hover > categories.length / 2 ? 'right' : 'left';

  return (
    <div>
      {series.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs text-purple-300">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 rounded" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={ariaLabel}>
          {/* season bands */}
          {groups.map((g, gi) => (
            <g key={g.name}>
              {gi > 0 && (
                <line
                  x1={M.left + step * g.start}
                  x2={M.left + step * g.start}
                  y1={M.top - 18}
                  y2={M.top + plotH}
                  stroke={AXIS}
                  strokeWidth={1}
                />
              )}
              <text
                x={M.left + step * ((g.start + g.end + 1) / 2)}
                y={M.top - 12}
                textAnchor="middle"
                fontSize={11}
                fill={INK_MUTED}
              >
                {g.name}
              </text>
            </g>
          ))}

          {/* grid and y axis */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? AXIS : GRID} strokeWidth={1} />
              <text x={M.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={INK_MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {format(t)}
              </text>
            </g>
          ))}

          {/* x labels */}
          {categories.map((c, i) => (
            <text
              key={c.full}
              x={x(i)}
              y={H - M.bottom + 14}
              textAnchor="end"
              fontSize={11}
              fill={hover === i ? INK_SECONDARY : INK_MUTED}
              transform={`rotate(-30 ${x(i)} ${H - M.bottom + 14})`}
            >
              {c.label}
            </text>
          ))}

          {/* crosshair */}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + plotH} stroke={AXIS} strokeWidth={1} />
          )}

          {/* lines, then markers on top */}
          {series.map((s) =>
            segments(s.values).map((d, k) => (
              <path key={`${s.name}-${k}`} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))
          )}
          {series.map((s) =>
            s.values.map((v, i) =>
              v === null ? null : (
                <circle
                  key={`${s.name}-dot-${i}`}
                  cx={x(i)}
                  cy={y(v)}
                  r={radius(s.sizes?.[i])}
                  fill={s.color}
                  stroke={SURFACE}
                  strokeWidth={2}
                />
              )
            )
          )}

          {/* direct end labels: text in ink, identity from the line key beside it */}
          {directLabels &&
            series.map((s, si) => {
              const end = ends[si];
              if (!end) return null;
              const lx = W - M.right + 10;
              return (
                <g key={`${s.name}-label`}>
                  {end.i < categories.length - 1 && (
                    <line x1={x(end.i) + 6} x2={lx - 2} y1={end.y} y2={end.y} stroke={GRID} strokeWidth={1} />
                  )}
                  <line x1={lx} x2={lx + 10} y1={end.y} y2={end.y} stroke={s.color} strokeWidth={2} strokeLinecap="round" />
                  <text x={lx + 14} y={end.y + 4} fontSize={11} fill={INK_SECONDARY}>
                    {s.name.length > 12 ? `${s.name.slice(0, 11)}…` : s.name}
                  </text>
                </g>
              );
            })}

          {/* hit columns: the whole column answers, not just the 2px line */}
          {categories.map((c, i) => (
            <rect
              key={`hit-${c.full}`}
              x={M.left + step * i}
              y={M.top}
              width={step}
              height={plotH}
              fill="transparent"
              tabIndex={0}
              aria-label={`${c.full}: ${series
                .map((s) => `${s.name} ${s.values[i] === null ? 'no rating' : format(s.values[i]!)}`)
                .join(', ')}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          ))}
        </svg>

        {hover !== null && (
          <div
            className="absolute top-2 pointer-events-none bg-[#0d0717]/95 border border-purple-800/50 rounded-lg px-3 py-2 text-xs shadow-lg min-w-[150px]"
            style={
              tooltipSide === 'left'
                ? { left: `${(x(hover) / W) * 100 + 2}%` }
                : { right: `${100 - (x(hover) / W) * 100 + 2}%` }
            }
          >
            <div className="text-purple-100 font-medium">{categories[hover].full}</div>
            <div className="text-purple-400/60 mb-1">{categories[hover].group}</div>
            {series.map((s) => (
              <div key={s.name} className="flex items-center gap-2">
                <span className="inline-block w-3 h-0.5 rounded" style={{ background: s.color }} />
                <span className="text-purple-100 font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {s.values[hover] === null ? '-' : format(s.values[hover]!)}
                </span>
                <span className="text-purple-300/70">{s.name}</span>
              </div>
            ))}
            {sizeLabel && series[0].sizes?.[hover] != null && (
              <div className="text-purple-400/60 mt-1">
                {series[0].sizes![hover]} {sizeLabel}
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => setShowTable((v) => !v)}
        className="mt-1 text-xs text-purple-400/60 hover:text-purple-300 transition-colors"
      >
        {showTable ? 'Hide table' : 'Show as table'}
      </button>
      {showTable && (
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr className="text-purple-400/60 text-left">
                <th className="py-1 pr-3 font-medium">Tournament</th>
                <th className="py-1 pr-3 font-medium">Season</th>
                {series.map((s) => (
                  <th key={s.name} className="py-1 pr-3 font-medium text-right">{s.name}</th>
                ))}
                {sizeLabel && <th className="py-1 font-medium text-right capitalize">{sizeLabel}</th>}
              </tr>
            </thead>
            <tbody className="text-purple-200">
              {categories.map((c, i) => (
                <tr key={c.full} className="border-t border-purple-800/20">
                  <td className="py-1 pr-3">{c.full}</td>
                  <td className="py-1 pr-3 text-purple-400/60">{c.group}</td>
                  {series.map((s) => (
                    <td key={s.name} className="py-1 pr-3 text-right">
                      {s.values[i] === null ? '-' : format(s.values[i]!)}
                    </td>
                  ))}
                  {sizeLabel && (
                    <td className="py-1 text-right">{series[0].sizes?.[i] ?? 0}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
