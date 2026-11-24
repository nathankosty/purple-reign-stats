'use client';

import { useMemo, useState } from 'react';
import { useStats } from './StatsProvider';
import {
  computeDevelopment,
  DevMetric,
  formatMetric,
  heatmapPlayers,
  METRICS,
  MIN_POINTS,
  mostImproved,
} from '@/lib/development';

// One hue, dark to light: low values recede into the dark surface. Lightness
// was checked to rise at every step, and cell text flips to near-black on the
// two lightest steps where white drops below 4.5:1.
const RAMP = ['#3b0764', '#581c87', '#6b21a8', '#7e22ce', '#9333ea', '#a855f7', '#c084fc'];
const inkOn = (step: number) => (step >= 5 ? '#0b0b0b' : '#ffffff');

function formatChange(metric: DevMetric, change: number): string {
  const sign = change > 0 ? '+' : '';
  return metric === 'valuePerPoint'
    ? `${sign}${change.toFixed(1)}`
    : `${sign}${(change * 100).toFixed(0)} pts`;
}

export function Development() {
  const { games, playerScores, loading } = useStats();
  const [metric, setMetric] = useState<DevMetric>('usage');

  const data = useMemo(() => computeDevelopment(games, playerScores), [games, playerScores]);
  const rows = useMemo(() => heatmapPlayers(data), [data]);
  const improved = useMemo(() => mostImproved(data, metric), [data, metric]);

  const scale = useMemo(() => {
    const values = rows.flatMap((p) =>
      (data.players.get(p) || []).filter((r) => r.qualifies).map((r) => r[metric])
    );
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [data, rows, metric]);

  const stepFor = (value: number) =>
    Math.round(((value - scale.min) / (scale.max - scale.min || 1)) * (RAMP.length - 1));

  const seasons = useMemo(() => {
    const groups: { name: string; span: number }[] = [];
    for (const entry of data.timeline) {
      const last = groups[groups.length - 1];
      if (last && last.name === entry.season) last.span++;
      else groups.push({ name: entry.season, span: 1 });
    }
    return groups;
  }, [data]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-purple-300/60">Loading development...</p>
        </div>
      </div>
    );
  }

  const info = METRICS.find((m) => m.key === metric)!;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-purple-100 mb-1">Development</h2>
        <p className="text-sm text-purple-400/60">
          How involved each player has been across their time with the team
        </p>
      </div>

      <div>
        <div className="flex rounded-lg overflow-hidden border border-purple-800/50 w-fit">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                metric === m.key
                  ? 'bg-purple-600 text-white'
                  : 'bg-[#1a0f2e] text-purple-400/60 hover:text-purple-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-purple-400/60 mt-1.5">{info.help}</p>
      </div>

      <div className="bg-[#1a0f2e]/80 border border-purple-800/30 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-purple-800/30">
          <h3 className="text-sm font-semibold text-purple-200">Team Heatmap</h3>
          <p className="text-xs text-purple-400/50 mt-0.5">
            Players with three or more rated tournaments, in the order they first earned real
            minutes. A dot means they played but under {MIN_POINTS} points.
          </p>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="text-xs border-separate" style={{ borderSpacing: 2 }}>
            <thead>
              <tr>
                <th className="sticky left-0 bg-[#1a0f2e]" />
                {seasons.map((s) => (
                  <th key={s.name} colSpan={s.span} className="text-purple-400/60 font-medium pb-1">
                    {s.name}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 bg-[#1a0f2e] text-left text-purple-400/60 font-medium pr-3">
                  Player
                </th>
                {data.timeline.map((e) => (
                  <th
                    key={e.tournament}
                    title={e.tournament}
                    className="text-purple-300/80 font-medium px-1 pb-1 min-w-[52px] max-w-[64px] leading-tight"
                  >
                    {e.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
              {rows.map((player) => (
                <tr key={player}>
                  <td className="sticky left-0 bg-[#1a0f2e] text-purple-100 font-medium pr-3 whitespace-nowrap">
                    {player}
                  </td>
                  {(data.players.get(player) || []).map((r, i) => {
                    const tournament = data.timeline[i].tournament;
                    if (!r.qualifies) {
                      return (
                        <td
                          key={tournament}
                          className="text-center text-purple-500/50 rounded"
                          title={
                            r.pointsPlayed > 0
                              ? `${player} at ${tournament}: ${r.pointsPlayed} points, too few to rate`
                              : `${player} did not play ${tournament}`
                          }
                        >
                          {r.pointsPlayed > 0 ? '·' : ''}
                        </td>
                      );
                    }
                    const step = stepFor(r[metric]);
                    return (
                      <td
                        key={tournament}
                        tabIndex={0}
                        className="text-center rounded px-1.5 py-1.5 font-semibold hover:ring-1 hover:ring-purple-200 focus:ring-1 focus:ring-purple-200 outline-none"
                        style={{ background: RAMP[step], color: inkOn(step) }}
                        title={`${player} at ${tournament}: ${formatMetric(metric, r[metric])} over ${r.pointsPlayed} points`}
                      >
                        {formatMetric(metric, r[metric])}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center gap-2 mt-3 text-xs text-purple-400/60">
            <span>Low {formatMetric(metric, scale.min)}</span>
            <div className="flex gap-0.5">
              {RAMP.map((color) => (
                <span key={color} className="inline-block w-5 h-2.5 rounded-sm" style={{ background: color }} />
              ))}
            </div>
            <span>High {formatMetric(metric, scale.max)}</span>
          </div>
        </div>
      </div>

      <div className="bg-[#1a0f2e]/80 border border-purple-800/30 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-purple-800/30">
          <h3 className="text-sm font-semibold text-purple-200">Most Improved</h3>
          <p className="text-xs text-purple-400/50 mt-0.5">
            First three rated tournaments against the last three, pooled by points played. Needs
            four or more rated tournaments.
          </p>
        </div>
        <div className="divide-y divide-purple-800/20">
          {improved.map((r, i) => (
            <div key={r.player} className="px-4 py-2.5 flex items-center gap-3">
              <span className="text-xs font-bold w-6 text-center shrink-0 text-purple-500/50">#{i + 1}</span>
              <span className="text-base font-bold text-purple-100 w-20 text-right shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatChange(metric, r.change)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-purple-100">
                  {r.player}{' '}
                  <span className="text-purple-300/80 font-normal">
                    {formatMetric(metric, r.from)} to {formatMetric(metric, r.to)}
                  </span>
                </div>
                <div className="text-xs text-purple-400/50 truncate">
                  {r.early.join(', ')} vs {r.recent.join(', ')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
