'use client';

import { useStats } from './StatsProvider';
import { Filters } from '@/lib/types';

interface SidebarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export function Sidebar({ filters, onChange }: SidebarProps) {
  const { players, tournaments, games } = useStats();

  const filteredGames = games.filter(
    (g) => filters.tournaments.length === 0 || filters.tournaments.includes(g.tournament)
  );

  return (
    <aside className="w-full lg:w-72 shrink-0 bg-[#0d0717] border-r border-purple-900/30 p-5 space-y-6 overflow-y-auto">
      {/* Player selector */}
      <div>
        <label className="block text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2">
          Player
        </label>
        <select
          value={filters.player}
          onChange={(e) => onChange({ ...filters, player: e.target.value })}
          className="w-full bg-[#1a0f2e] border border-purple-800/50 rounded-lg px-3 py-2 text-sm text-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">Select a player...</option>
          {players.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* Tournament filter */}
      <div>
        <label className="block text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2">
          Tournament
        </label>
        <div className="space-y-1.5">
          {tournaments.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm text-purple-200 cursor-pointer hover:text-purple-100">
              <input
                type="checkbox"
                checked={filters.tournaments.includes(t)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...filters.tournaments, t]
                    : filters.tournaments.filter((x) => x !== t);
                  onChange({ ...filters, tournaments: next, game: '' });
                }}
                className="rounded border-purple-700 bg-purple-900/30 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
              />
              {t}
            </label>
          ))}
        </div>
      </div>

      {/* Game filter */}
      <div>
        <label className="block text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2">
          Game
        </label>
        <select
          value={filters.game}
          onChange={(e) => onChange({ ...filters, game: e.target.value })}
          className="w-full bg-[#1a0f2e] border border-purple-800/50 rounded-lg px-3 py-2 text-sm text-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">All games</option>
          {filteredGames.map((g) => {
            const key = `${g.dateTime}|${g.opponent}`;
            const date = new Date(g.dateTime).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });
            return (
              <option key={key} value={key}>
                vs {g.opponent} ({date}) — {g.finalScore.ours}-{g.finalScore.theirs}
              </option>
            );
          })}
        </select>
      </div>

      {/* Point result filter */}
      <div>
        <label className="block text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2">
          Point Result
        </label>
        <select
          value={filters.pointResult}
          onChange={(e) =>
            onChange({ ...filters, pointResult: e.target.value as Filters['pointResult'] })
          }
          className="w-full bg-[#1a0f2e] border border-purple-800/50 rounded-lg px-3 py-2 text-sm text-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All points</option>
          <option value="scored">Points we scored</option>
          <option value="scored_against">Points scored against us</option>
        </select>
      </div>

      {/* Min score threshold */}
      <div>
        <label className="block text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2">
          Min Score: {filters.minScore}
        </label>
        <input
          type="range"
          min={-5}
          max={20}
          step={0.5}
          value={filters.minScore}
          onChange={(e) => onChange({ ...filters, minScore: parseFloat(e.target.value) })}
          className="w-full accent-purple-500"
        />
      </div>

      {/* Top N */}
      <div>
        <label className="block text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2">
          Show Top
        </label>
        <select
          value={filters.topN}
          onChange={(e) => onChange({ ...filters, topN: parseInt(e.target.value) })}
          className="w-full bg-[#1a0f2e] border border-purple-800/50 rounded-lg px-3 py-2 text-sm text-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value={10}>Top 10</option>
          <option value={20}>Top 20</option>
          <option value={50}>Top 50</option>
          <option value={999}>All</option>
        </select>
      </div>
    </aside>
  );
}
