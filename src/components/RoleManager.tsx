'use client';

import { useMemo } from 'react';
import { useStats, PlayerRole } from './StatsProvider';

function detectHandlers(
  players: string[],
  points: import('@/lib/types').Point[],
  minPoints: number = 20
): string[] {
  // Count throws and catches per player across all points
  const stats = new Map<string, { throws: number; catches: number; pointsPlayed: number }>();

  for (const point of points) {
    const seen = new Set<string>();
    for (const ev of point.events) {
      // Count throws (passer on Catch or Goal, offense)
      if (ev.eventType === 'Offense' && (ev.action === 'Catch' || ev.action === 'Goal') && ev.passer) {
        const s = stats.get(ev.passer) || { throws: 0, catches: 0, pointsPlayed: 0 };
        s.throws++;
        stats.set(ev.passer, s);
      }
      // Count catches (receiver on Catch or Goal, offense)
      if (ev.eventType === 'Offense' && (ev.action === 'Catch' || ev.action === 'Goal') && ev.receiver) {
        const s = stats.get(ev.receiver) || { throws: 0, catches: 0, pointsPlayed: 0 };
        s.catches++;
        stats.set(ev.receiver, s);
      }
    }
    // Count points played
    for (const p of point.playersOnField) {
      if (!seen.has(p)) {
        seen.add(p);
        const s = stats.get(p) || { throws: 0, catches: 0, pointsPlayed: 0 };
        s.pointsPlayed++;
        stats.set(p, s);
      }
    }
  }

  // Handlers throw more than they catch. Compute throw ratio = throws / (throws + catches).
  // Filter to players with enough playing time to be meaningful.
  const candidates: { player: string; ratio: number; throws: number }[] = [];
  for (const player of players) {
    const s = stats.get(player);
    if (!s || s.pointsPlayed < minPoints) continue;
    const total = s.throws + s.catches;
    if (total === 0) continue;
    const ratio = s.throws / total;
    candidates.push({ player, ratio, throws: s.throws });
  }

  // Sort by throw ratio descending. Players with ratio > 0.52 (throw more than catch) are handlers.
  candidates.sort((a, b) => b.ratio - a.ratio);

  // Take players with throw ratio > 0.52 — they touch the disc as a thrower more than as a receiver
  return candidates.filter((c) => c.ratio > 0.52).map((c) => c.player);
}

export function RoleManager() {
  const { players, points, playerRoles, setPlayerRole, loading } = useStats();

  const suggestedHandlers = useMemo(() => detectHandlers(players, points), [players, points]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  const handlers = players.filter((p) => playerRoles[p] === 'handler');
  const cutters = players.filter((p) => playerRoles[p] !== 'handler');

  function autoDetect() {
    // Clear all existing roles first
    for (const p of players) {
      if (playerRoles[p]) setPlayerRole(p, null);
    }
    // Set detected handlers
    for (const p of suggestedHandlers) {
      setPlayerRole(p, 'handler');
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-purple-100 mb-1">Manage Roles</h2>
        <p className="text-sm text-purple-400/60">
          Assign players as handlers or cutters. This filters the Team Records board so cutters can compare against other cutters.
          Roles are saved in your browser.
        </p>
        <button
          onClick={autoDetect}
          className="mt-3 px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Auto-Detect Handlers ({suggestedHandlers.length} found)
        </button>
        {suggestedHandlers.length > 0 && (
          <p className="text-xs text-purple-400/40 mt-1">
            Based on throw-to-catch ratio — players who throw more than they receive are flagged as handlers.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        {/* Handlers */}
        <div className="bg-[#1a0f2e]/80 border border-blue-800/30 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-blue-800/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <h3 className="text-sm font-semibold text-blue-200">Handlers</h3>
            </div>
            <span className="text-xs text-blue-400/50">{handlers.length} players</span>
          </div>
          <div className="divide-y divide-purple-800/20">
            {handlers.length === 0 && (
              <div className="px-4 py-3 text-sm text-purple-400/40">No handlers assigned</div>
            )}
            {handlers.map((p) => (
              <div key={p} className="px-4 py-2 flex items-center justify-between">
                <span className="text-sm text-purple-100">{p}</span>
                <button
                  onClick={() => setPlayerRole(p, null)}
                  className="text-xs text-purple-400/50 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Cutters */}
        <div className="bg-[#1a0f2e]/80 border border-green-800/30 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-green-800/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <h3 className="text-sm font-semibold text-green-200">Cutters</h3>
            </div>
            <span className="text-xs text-green-400/50">{cutters.length} players</span>
          </div>
          <div className="divide-y divide-purple-800/20">
            {cutters.map((p) => (
              <div key={p} className="px-4 py-2 flex items-center justify-between">
                <span className="text-sm text-purple-100">{p}</span>
                <button
                  onClick={() => setPlayerRole(p, 'handler')}
                  className="text-xs text-blue-400/70 hover:text-blue-300 transition-colors"
                >
                  Move to Handlers
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick assign section */}
      <div className="mt-8 max-w-4xl">
        <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wider mb-3">Quick Assign</h3>
        <div className="flex flex-wrap gap-2">
          {players.map((p) => {
            const role: PlayerRole | undefined = playerRoles[p];
            const isHandler = role === 'handler';
            return (
              <button
                key={p}
                onClick={() => setPlayerRole(p, isHandler ? null : 'handler')}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  isHandler
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-200 hover:bg-blue-500/30'
                    : 'bg-[#1a0f2e] border-purple-800/30 text-purple-300/70 hover:border-purple-600/50'
                }`}
              >
                {p} {isHandler ? '(H)' : ''}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-purple-400/40 mt-2">Click a name to toggle handler. Untagged players are treated as cutters.</p>
      </div>
    </div>
  );
}
