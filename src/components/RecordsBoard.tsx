'use client';

import { useMemo, useState } from 'react';
import { useStats } from './StatsProvider';
import { computeAllRecords, computeMVPPointRecords, RecordCategory } from '@/lib/records';

type RoleFilter = 'all' | 'handler' | 'cutter';

function RecordTable({ category }: { category: RecordCategory }) {
  const isTime = category.title.includes('seconds');

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
              i === 0 ? 'bg-purple-500/10' : ''
            }`}
          >
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
            <span className="text-lg font-bold text-purple-100 w-14 text-right shrink-0">
              {isTime ? formatTime(rec.value) : rec.value}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-purple-100 truncate">
                {rec.player}
              </div>
              <div className="text-xs text-purple-400/60 truncate">
                {rec.context}
              </div>
              {rec.detail && (
                <div className="text-xs text-purple-400/40 truncate">{rec.detail}</div>
              )}
            </div>
          </div>
        ))}
        {category.records.length === 0 && (
          <div className="px-4 py-3 text-sm text-purple-400/50">No records found</div>
        )}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RecordsBoard() {
  const { points, games, players, tournaments, playerScores, playerRoles, loading } = useStats();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  const filteredPlayers = useMemo(() => {
    if (roleFilter === 'all') return players;
    return players.filter((p) => {
      const role = playerRoles[p];
      if (roleFilter === 'handler') return role === 'handler';
      if (roleFilter === 'cutter') return role === 'cutter' || !role; // unassigned = cutter by default
      return true;
    });
  }, [players, playerRoles, roleFilter]);

  const categories = useMemo(() => {
    if (points.length === 0) return [];
    const cats = computeAllRecords(points, games, filteredPlayers, tournaments);
    const mvp = computeMVPPointRecords(playerScores, 5, filteredPlayers);
    return [mvp, ...cats];
  }, [points, games, filteredPlayers, tournaments, playerScores]);

  const handlerCount = Object.values(playerRoles).filter((r) => r === 'handler').length;
  const cutterCount = players.length - handlerCount;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-purple-300/60">Loading records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-purple-100 mb-1">All-Time Records</h2>
          <p className="text-sm text-purple-400/60">
            The best individual performances across all tournaments
          </p>
        </div>

        {/* Role filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-purple-400/60 uppercase tracking-wider">Position:</span>
          <div className="flex rounded-lg overflow-hidden border border-purple-800/50">
            {(['all', 'handler', 'cutter'] as RoleFilter[]).map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  roleFilter === role
                    ? 'bg-purple-600 text-white'
                    : 'bg-[#1a0f2e] text-purple-400/60 hover:text-purple-300'
                }`}
              >
                {role === 'all' ? `All (${players.length})` : role === 'handler' ? `Handlers (${handlerCount})` : `Cutters (${cutterCount})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {roleFilter !== 'all' && filteredPlayers.length === 0 && (
        <div className="text-center py-12 text-purple-400/60">
          <p>No players assigned as {roleFilter}s yet.</p>
          <p className="text-xs mt-1">Use the Manage Roles tab to assign player positions.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {categories.map((cat, i) => (
          <RecordTable key={i} category={cat} />
        ))}
      </div>
    </div>
  );
}
