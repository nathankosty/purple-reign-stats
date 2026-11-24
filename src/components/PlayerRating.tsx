'use client';

import { ChartCategory, LineChart } from './charts/LineChart';
import { RatingCard } from './RatingCard';
import { TimelineEntry } from '@/lib/development';
import { MIN_RATED_POINTS, OVR_FLOOR, PlayerRating as Rating } from '@/lib/ratings';

// Same validated pair as the development chart: purple for the player's
// current form, gray (de-emphasis) for the slower career line.
const CURRENT_COLOR = '#a855f7';
const CAREER_COLOR = '#898781';

export function PlayerRating({ rating, timeline }: { rating: Rating | undefined; timeline: TimelineEntry[] }) {
  if (!rating) {
    return (
      <div className="bg-[#1a0f2e]/80 border border-purple-800/30 rounded-xl p-4 mb-4 text-sm text-purple-400/60">
        Not rated yet. A rating needs {MIN_RATED_POINTS} points of recent playing time.
      </div>
    );
  }

  const categories: ChartCategory[] = timeline.map((e) => ({ label: e.short, full: e.tournament, group: e.season }));
  const at = (t: string) => rating.history.find((h) => h.tournament === t);
  const rated = rating.history.filter((h) => h.ovr !== null).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_1fr] gap-4 mb-4">
      <RatingCard rating={rating} compact />
      <div className="bg-[#1a0f2e]/80 border border-purple-800/30 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-purple-800/30">
          <h3 className="text-sm font-semibold text-purple-200">Rating History</h3>
          <p className="text-xs text-purple-400/50 mt-0.5">Overall at the end of each tournament.</p>
        </div>
        <div className="p-4">
          {rated < 2 ? (
            <p className="text-sm text-purple-400/60">Needs ratings from at least two tournaments.</p>
          ) : (
            <LineChart
              categories={categories}
              series={[
                { name: 'Current form', color: CURRENT_COLOR, values: categories.map((c) => at(c.full)?.ovr ?? null) },
                { name: 'Career', color: CAREER_COLOR, values: categories.map((c) => at(c.full)?.career ?? null) },
              ]}
              format={(v) => `${Math.round(v)}`}
              ariaLabel={`${rating.player} overall rating by tournament, current form and career`}
              domainMin={OVR_FLOOR}
            />
          )}
        </div>
      </div>
    </div>
  );
}
