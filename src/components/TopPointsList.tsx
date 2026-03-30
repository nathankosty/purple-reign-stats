'use client';

import { useStats } from './StatsProvider';
import { PointCard } from './PointCard';
import { Filters, PlayerPointScore } from '@/lib/types';

interface TopPointsListProps {
  filters: Filters;
}

export function TopPointsList({ filters }: TopPointsListProps) {
  const { playerScores, loading } = useStats();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-purple-300/60">Loading stats...</p>
        </div>
      </div>
    );
  }

  if (!filters.player) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <img
            src="/logo.svg"
            alt="Purple Reign"
            className="w-24 h-24 mx-auto mb-4 opacity-40 drop-shadow-[0_0_12px_rgba(168,85,247,0.3)]"
          />
          <h2 className="text-xl font-semibold text-purple-200 mb-2">Select a Player</h2>
          <p className="text-purple-400/60 text-sm">
            Choose a player from the sidebar to see their most valuable points.
          </p>
        </div>
      </div>
    );
  }

  const allScores = playerScores.get(filters.player) || [];

  // Apply filters
  let filtered: PlayerPointScore[] = allScores.filter((ps) => {
    if (filters.tournaments.length > 0 && !filters.tournaments.includes(ps.point.tournament)) {
      return false;
    }
    if (filters.game) {
      const gameKey = `${ps.point.dateTime}|${ps.point.opponent}`;
      if (gameKey !== filters.game) return false;
    }
    if (filters.pointResult !== 'all' && ps.point.result !== filters.pointResult) {
      return false;
    }
    if (ps.score < filters.minScore) return false;
    return true;
  });

  // Already sorted by score descending from computeAllPlayerScores
  filtered = filtered.slice(0, filters.topN);

  if (filtered.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-purple-300/60">No points found matching your filters.</p>
        </div>
      </div>
    );
  }

  // Summary stats
  const totalPoints = allScores.length;
  const avgScore = allScores.length > 0
    ? allScores.reduce((sum, s) => sum + s.score, 0) / allScores.length
    : 0;
  const bestScore = allScores.length > 0 ? allScores[0].score : 0;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Player summary */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-purple-100 mb-3">{filters.player}</h2>
        <div className="flex gap-4 flex-wrap">
          <div className="bg-[#1a0f2e]/60 rounded-lg px-4 py-2 border border-purple-800/20">
            <div className="text-xs text-purple-400/60">Total Points</div>
            <div className="text-lg font-semibold text-purple-200">{totalPoints}</div>
          </div>
          <div className="bg-[#1a0f2e]/60 rounded-lg px-4 py-2 border border-purple-800/20">
            <div className="text-xs text-purple-400/60">Best Score</div>
            <div className="text-lg font-semibold text-purple-200">{bestScore.toFixed(1)}</div>
          </div>
          <div className="bg-[#1a0f2e]/60 rounded-lg px-4 py-2 border border-purple-800/20">
            <div className="text-xs text-purple-400/60">Avg Score</div>
            <div className="text-lg font-semibold text-purple-200">{avgScore.toFixed(1)}</div>
          </div>
          <div className="bg-[#1a0f2e]/60 rounded-lg px-4 py-2 border border-purple-800/20">
            <div className="text-xs text-purple-400/60">Showing</div>
            <div className="text-lg font-semibold text-purple-200">{filtered.length}</div>
          </div>
        </div>
      </div>

      {/* Point cards */}
      <div className="space-y-3">
        {filtered.map((ps, i) => (
          <PointCard key={ps.point.id} data={ps} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}
