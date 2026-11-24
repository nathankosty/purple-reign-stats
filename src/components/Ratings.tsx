'use client';

import { useMemo, useState } from 'react';
import { useStats } from './StatsProvider';
import { RatingCard } from './RatingCard';
import { ABILITY_RATING, Archetype, ATTRIBUTES, computeRatings, HALF_LIFE_GAMES, MIN_RATED_POINTS } from '@/lib/ratings';

type ArchetypeFilter = 'All' | Archetype;

export function Ratings() {
  const { games, loading } = useStats();
  const [archetype, setArchetype] = useState<ArchetypeFilter>('All');
  const [showInactive, setShowInactive] = useState(false);

  const data = useMemo(() => computeRatings(games), [games]);
  const shown = data.players.filter(
    (p) => (archetype === 'All' || p.archetype === archetype) && (showInactive || p.active)
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-purple-300/60">Running the ratings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-purple-100 mb-1">Ratings</h2>
        <p className="text-sm text-purple-400/60 max-w-3xl">
          Graded against every performance in team history: 70 is typical, each 10 points is one
          standard deviation, and 90+ is rare. Updated after every game, with older games fading, so
          a game from one tournament ago counts half as much as this weekend&apos;s.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg overflow-hidden border border-purple-800/50">
          {(['All', 'Handler', 'Hybrid', 'Cutter'] as ArchetypeFilter[]).map((a) => (
            <button
              key={a}
              onClick={() => setArchetype(a)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                archetype === a ? 'bg-purple-600 text-white' : 'bg-[#1a0f2e] text-purple-400/60 hover:text-purple-300'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-purple-300 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-purple-700 bg-purple-900/30 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
          />
          Include players who haven&apos;t played recently
        </label>
        <span className="text-xs text-purple-400/50">{shown.length} players</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {shown.map((p) => (
          <RatingCard key={p.player} rating={p} />
        ))}
      </div>

      <div className="bg-[#1a0f2e]/60 border border-purple-800/30 rounded-xl p-4 text-xs text-purple-300/80 space-y-2 max-w-3xl">
        <p className="font-semibold text-purple-200">How the ratings work</p>
        <p>
          {ATTRIBUTES.map((a) => `${a.key} is ${a.describes}`).join('; ')}. Every rate is pulled
          toward the team average until there is enough playing time behind it, and a player needs{' '}
          {MIN_RATED_POINTS} points of recent playing time to be rated at all.
        </p>
        <p>
          Overall weights the attributes by archetype, which comes from how much of a player&apos;s
          touches are throws: handlers lean on accuracy, usage, and playmaking, cutters on scoring and
          hands, hybrids on a mix.
        </p>
        <p>
          Dev traits follow growth over a player&apos;s last 12 games: Superstar at +10 or more, Star at
          +4, Normal otherwise. X-Factor is reserved for a current overall of 90+, and Hidden means
          too few games to read a trajectory yet. An attribute of {ABILITY_RATING}+ earns its ability,
          and an X-Factor&apos;s best one becomes a zone ability. The half-life is {HALF_LIFE_GAMES} games.
        </p>
      </div>
    </div>
  );
}
