'use client';

import { useMemo, useState } from 'react';
import { useStats } from './StatsProvider';
import { DevTraitBadge, RatingCard } from './RatingCard';
import { LineChart } from './charts/LineChart';
import { computeDevelopment } from '@/lib/development';
import {
  AbilityGroup,
  ABILITIES,
  Archetype,
  ATTRIBUTES,
  computeRatings,
  CALLAHAN_CLUB,
  DEV_TRAITS,
  HALF_LIFE_GAMES,
  MIN_RATED_POINTS,
  OVR_CENTER,
  OVR_FLOOR,
} from '@/lib/ratings';

type ArchetypeFilter = 'All' | Archetype;

export function Ratings() {
  const { games, playerScores, loading } = useStats();
  const [archetype, setArchetype] = useState<ArchetypeFilter>('All');
  const [showInactive, setShowInactive] = useState(false);
  const [compare, setCompare] = useState('');

  const data = useMemo(() => computeRatings(games, playerScores), [games, playerScores]);
  // Season labels and short tournament names come from the development timeline.
  const timeline = useMemo(() => computeDevelopment(games, playerScores).timeline, [games, playerScores]);
  const compared = data.players.find((p) => p.player === compare);
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
          Graded against every performance in team history. A typical performance is a {OVR_CENTER}, nobody
          rates below {OVR_FLOOR}, and 90+ is rare. Updated after every game, with older games fading,
          so a game from one tournament ago counts half as much as this weekend&apos;s.
        </p>
      </div>

      <div className="bg-[#1a0f2e]/80 border border-purple-800/30 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-purple-800/30 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <h3 className="text-sm font-semibold text-purple-200">Team Overall</h3>
            <p className="text-xs text-purple-400/50 mt-0.5">
              Every rated player&apos;s overall at the end of each tournament, weighted by the points they
              played in it, so regulars count more than cameos.
            </p>
          </div>
          <select
            value={compare}
            onChange={(e) => setCompare(e.target.value)}
            className="bg-[#1a0f2e] border border-purple-800/50 rounded-lg px-3 py-1.5 text-xs text-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Compare a player...</option>
            {data.players.map((p) => (
              <option key={p.player} value={p.player}>
                {p.player}
              </option>
            ))}
          </select>
        </div>
        <div className="p-4">
          <LineChart
            categories={timeline.map((e) => ({ label: e.short, full: e.tournament, group: e.season }))}
            series={
              compared
                ? [
                    { name: compared.player, color: '#a855f7', values: compared.history.map((h) => h.ovr) },
                    { name: 'Team overall', color: '#898781', values: data.teamHistory },
                  ]
                : [{ name: 'Team overall', color: '#a855f7', values: data.teamHistory }]
            }
            format={(v) => `${Math.round(v)}`}
            ariaLabel={
              compared
                ? `Team overall by tournament against ${compared.player}`
                : 'Team overall by tournament'
            }
            domainMin={OVR_FLOOR}
          />
        </div>
      </div>

      <div className="bg-[#1a0f2e]/60 border border-purple-800/30 rounded-xl p-4">
        <p className="text-xs font-semibold text-purple-200 uppercase tracking-wider mb-2">Dev traits</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          {DEV_TRAITS.map(({ trait, meaning }) => (
            <div key={trait} className="flex items-start gap-2 text-xs">
              <span className="shrink-0 w-[86px]">
                <DevTraitBadge trait={trait} />
              </span>
              <span className="text-purple-300/80 leading-relaxed">{meaning}</span>
            </div>
          ))}
        </div>
      </div>

      <details className="bg-[#1a0f2e]/60 border border-purple-800/30 rounded-xl p-4 group">
        <summary className="text-xs font-semibold text-purple-200 uppercase tracking-wider cursor-pointer select-none">
          Abilities <span className="normal-case font-normal tracking-normal text-purple-400/60">
            ({ABILITIES.length + 1}) what each one means
          </span>
        </summary>
        <p className="text-xs text-purple-300/80 mt-2 max-w-3xl">
          Abilities are niches, judged on the same recent form as the overall. Each one goes to up to
          three players on the active roster and each player holds up to three, handed out best finish
          first, so stars keep their strongest and the rest of the spots spread across the team. Anyone
          left without one gets their single best category, so every regular has something
          they&apos;re known for. An X-Factor&apos;s best ability becomes a zone ability. Hover an ability
          on a card to see where that player ranks.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-3 mt-3">
          {(['Throwing', 'Receiving', 'Defense', 'On the field', 'Workload'] as AbilityGroup[]).map((group) => (
            <div key={group}>
              <p className="text-[11px] text-purple-400/60 uppercase tracking-wider mb-1">{group}</p>
              <ul className="space-y-1.5">
                {ABILITIES.filter((a) => a.group === group).map((a) => (
                  <li key={a.key} className="text-xs">
                    <span className="font-semibold text-purple-100">{a.name}</span>{' '}
                    <span className="text-purple-300/80">{a.meaning}</span>{' '}
                    <span className="text-purple-400/50">Based on {a.basis}.</span>
                  </li>
                ))}
                {group === 'Defense' && (
                  <li className="text-xs">
                    <span className="font-semibold text-purple-100">{CALLAHAN_CLUB.name}</span>{' '}
                    <span className="text-purple-300/80">{CALLAHAN_CLUB.meaning}</span>{' '}
                    <span className="text-purple-400/50">Earned by {CALLAHAN_CLUB.basis}.</span>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </details>

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
          {ATTRIBUTES.map((a) => `${a.name} is ${a.describes}`).join('; ')}. Every rate is pulled
          toward the team average until there is enough playing time behind it, and a player needs{' '}
          {MIN_RATED_POINTS} points of recent playing time to be rated at all.
        </p>
        <p>
          Overall blends two sets of weights by how much of a player&apos;s touches are throws: a pure
          handler leans on accuracy, playmaking, and usage, a pure cutter on scoring, catching, and
          defense, and everyone in between gets a mix in proportion.
        </p>
        <p>Older games fade with a half-life of {HALF_LIFE_GAMES} games.</p>
      </div>
    </div>
  );
}
