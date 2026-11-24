'use client';

import { useState } from 'react';
import { ChartCategory, LineChart } from './charts/LineChart';
import {
  DevelopmentData,
  DevMetric,
  formatMetric,
  METRICS,
  metricValue,
  MIN_POINTS,
} from '@/lib/development';

// Validated against the card surface: the player's purple and the team gray
// clear the CVD and contrast checks, and both lines are direct-labeled because
// the pair sits in the tritan warning band. The gray is de-emphasis on purpose.
const PLAYER_COLOR = '#a855f7';
const TEAM_COLOR = '#898781';
const THROWS_COLOR = '#3987e5';
const CATCHES_COLOR = '#d95926';

export function PlayerDevelopment({ player, data }: { player: string; data: DevelopmentData }) {
  const [metric, setMetric] = useState<DevMetric>('usage');
  const rows = data.players.get(player);
  const rated = rows?.filter((r) => r.qualifies).length ?? 0;

  const shell = (children: React.ReactNode) => (
    <div className="bg-[#1a0f2e]/80 border border-purple-800/30 rounded-xl overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-purple-800/30">
        <h3 className="text-sm font-semibold text-purple-200">Development</h3>
        <p className="text-xs text-purple-400/50 mt-0.5">
          Tournaments with fewer than {MIN_POINTS} points are left off. Dot size is points played.
        </p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );

  if (!rows || rated < 2) {
    return shell(
      <p className="text-sm text-purple-400/60">
        {player} needs at least two tournaments with {MIN_POINTS}+ points before there is a trend to show.
      </p>
    );
  }

  const categories: ChartCategory[] = data.timeline.map((e) => ({
    label: e.short,
    full: e.tournament,
    group: e.season,
  }));
  const sizes = rows.map((r) => (r.qualifies ? r.pointsPlayed : null));
  const info = METRICS.find((m) => m.key === metric)!;

  return shell(
    <>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <div className="flex rounded-lg overflow-hidden border border-purple-800/50">
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
      </div>
      <p className="text-xs text-purple-400/60 mb-3">{info.help}</p>

      <LineChart
        categories={categories}
        series={[
          { name: player, color: PLAYER_COLOR, values: rows.map((r) => metricValue(r, metric)), sizes },
          { name: 'Team average', color: TEAM_COLOR, values: data.teamAverage[metric] },
        ]}
        format={(v) => formatMetric(metric, v)}
        ariaLabel={`${player} ${info.label.toLowerCase()} by tournament, against the team average`}
        sizeLabel="points played"
      />

      <div className="border-t border-purple-800/30 mt-4 pt-4">
        <h4 className="text-xs font-semibold text-purple-200 uppercase tracking-wider">Role</h4>
        <p className="text-xs text-purple-400/60 mb-3">
          Throws and catches per point. Throws overtaking catches is a cutter turning into a handler.
        </p>
        <LineChart
          categories={categories}
          series={[
            {
              name: 'Throws / pt',
              color: THROWS_COLOR,
              values: rows.map((r) => (r.qualifies ? r.throwsPerPoint : null)),
              sizes,
            },
            {
              name: 'Catches / pt',
              color: CATCHES_COLOR,
              values: rows.map((r) => (r.qualifies ? r.catchesPerPoint : null)),
            },
          ]}
          format={(v) => v.toFixed(1)}
          ariaLabel={`${player} throws and catches per point by tournament`}
          sizeLabel="points played"
        />
      </div>
    </>
  );
}
