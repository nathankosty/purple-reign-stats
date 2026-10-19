'use client';

import { useMemo } from 'react';
import { useStats } from './StatsProvider';
import { computeHallOfShame } from '@/lib/shame';

export function HallOfShame() {
  const { points, games, playerScores, loading } = useStats();

  const categories = useMemo(
    () => computeHallOfShame(points, games, playerScores),
    [points, games, playerScores]
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-purple-300/60">Gathering the evidence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-purple-100 mb-1">Purple Reign Hall of Shame</h2>
        <p className="text-sm text-purple-400/60">
          Every stat nobody asks to lead. Rate lists carry minimums, so nobody tops one off three
          attempts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {categories.map((category) => (
          <div
            key={category.title}
            className="bg-[#1a0f2e]/80 border border-purple-800/30 rounded-xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-purple-800/30">
              <h3 className="text-sm font-semibold text-purple-200">{category.title}</h3>
              <p className="text-xs text-purple-400/50 mt-0.5">{category.subtitle}</p>
            </div>
            <div className="divide-y divide-purple-800/20">
              {category.entries.map((entry, i) => (
                <div key={`${entry.name}-${i}`} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="text-xs font-bold w-6 text-center shrink-0 text-purple-500/50">
                    #{i + 1}
                  </span>
                  <span className="text-base font-bold text-rose-300 w-24 text-right shrink-0">
                    {entry.value}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-purple-100 truncate">{entry.name}</div>
                    <div className="text-xs text-purple-400/60 truncate">{entry.context}</div>
                    {entry.detail && (
                      <div className="text-xs text-purple-400/40 truncate">{entry.detail}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
