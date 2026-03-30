'use client';

import { useMemo, useState } from 'react';
import { useStats } from './StatsProvider';
import { computePlayerRecords, RecordCategory } from '@/lib/records';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function RecordTable({ category }: { category: RecordCategory }) {
  const isTime = category.title.includes('seconds');
  const isCareer = category.title === 'Career Totals';

  return (
    <div className="bg-[#1a0f2e]/80 border border-purple-800/30 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-purple-800/30 flex items-center gap-2">
        <span className="text-lg">{category.icon}</span>
        <h3 className="text-sm font-semibold text-purple-200">{category.title}</h3>
      </div>
      <div className="divide-y divide-purple-800/20">
        {category.records.map((rec, i) => (
          <div
            key={i}
            className={`px-4 py-2.5 flex items-center gap-3 ${
              !isCareer && i === 0 ? 'bg-purple-500/10' : ''
            }`}
          >
            {/* Rank or medal */}
            {!isCareer && (
              <span
                className={`text-xs font-bold w-6 text-center shrink-0 ${
                  i === 0
                    ? 'text-yellow-400'
                    : i === 1
                    ? 'text-gray-300'
                    : i === 2
                    ? 'text-amber-600'
                    : 'text-purple-500/50'
                }`}
              >
                {i === 0 ? '\ud83e\udd47' : i === 1 ? '\ud83e\udd48' : i === 2 ? '\ud83e\udd49' : `#${i + 1}`}
              </span>
            )}

            {/* Value */}
            <span className="text-lg font-bold text-purple-100 w-14 text-right shrink-0">
              {isTime ? formatTime(rec.value) : rec.value}
            </span>

            {/* Context */}
            <div className="flex-1 min-w-0">
              {isCareer ? (
                <div className="text-sm font-medium text-purple-200">{rec.player}</div>
              ) : (
                <>
                  <div className="text-sm text-purple-300 truncate">{rec.context}</div>
                  {rec.detail && (
                    <div className="text-xs text-purple-400/40 truncate">{rec.detail}</div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        {category.records.length === 0 && (
          <div className="px-4 py-3 text-sm text-purple-400/50">No records</div>
        )}
      </div>
    </div>
  );
}

export function PlayerRecords() {
  const { points, games, players, tournaments, playerScores, loading } = useStats();
  const [selectedPlayer, setSelectedPlayer] = useState('');

  const categories = useMemo(() => {
    if (!selectedPlayer || points.length === 0) return [];
    return computePlayerRecords(selectedPlayer, points, games, tournaments, playerScores);
  }, [selectedPlayer, points, games, tournaments, playerScores]);

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

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-purple-100 mb-3">Player Records</h2>
        <div className="flex items-center gap-4">
          <select
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value)}
            className="bg-[#1a0f2e] border border-purple-800/50 rounded-lg px-4 py-2.5 text-sm text-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500 min-w-[200px]"
          >
            <option value="">Select a player...</option>
            {players.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {selectedPlayer && (
            <p className="text-sm text-purple-400/60">
              Personal bests for {selectedPlayer}
            </p>
          )}
        </div>
      </div>

      {!selectedPlayer && (
        <div className="flex items-center justify-center mt-20">
          <div className="text-center max-w-md">
            <img
              src="/logo.svg"
              alt="Purple Reign"
              className="w-24 h-24 mx-auto mb-4 opacity-40 drop-shadow-[0_0_12px_rgba(168,85,247,0.3)]"
            />
            <h3 className="text-xl font-semibold text-purple-200 mb-2">Select a Player</h3>
            <p className="text-purple-400/60 text-sm">
              Choose a player to see their individual record board.
            </p>
          </div>
        </div>
      )}

      {selectedPlayer && categories.length > 0 && (
        <>
          {/* Career totals - full width */}
          {categories.filter((c) => c.title === 'Career Totals').map((cat, i) => (
            <div key={i} className="mb-4">
              <RecordTable category={cat} />
            </div>
          ))}

          {/* All other records - 2 column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {categories
              .filter((c) => c.title !== 'Career Totals')
              .map((cat, i) => (
                <RecordTable key={i} category={cat} />
              ))}
          </div>
        </>
      )}
    </div>
  );
}
