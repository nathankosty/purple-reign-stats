'use client';

import { useMemo, useState } from 'react';
import { useStats } from './StatsProvider';
import { computeConnections, computeThrowerAccuracy } from '@/lib/connections';
import {
  breakPct,
  computeBestLineups,
  holdPct,
  summarizeTournaments,
  totalsForPoints,
  TeamTotals,
  ValueLeader,
} from '@/lib/teamStats';

const MIN_THROWS_FOR_ACCURACY = 50;

function pct(value: number | null): string {
  return value === null ? '-' : `${value.toFixed(0)}%`;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function diffColor(value: number): string {
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-purple-200';
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1a0f2e]/80 border border-purple-800/30 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-purple-800/30">
        <h3 className="text-sm font-semibold text-purple-200">{title}</h3>
        {subtitle && <p className="text-xs text-purple-400/50 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-[#1a0f2e]/80 border border-purple-800/30 rounded-xl px-4 py-3">
      <div className="text-xs text-purple-400/60 uppercase tracking-wider">{label}</div>
      <div className={`text-xl font-bold ${tone || 'text-purple-100'}`}>{value}</div>
    </div>
  );
}

function MvpLine({ leader, label }: { leader: ValueLeader | undefined; label: string }) {
  if (!leader) return <span className="text-purple-400/50">{label}: none</span>;
  return (
    <span>
      <span className="text-purple-400/60">{label}: </span>
      <span className="font-semibold text-purple-100">{leader.player}</span>
      <span className="text-purple-300"> {leader.totalValue.toFixed(1)}</span>
      <span className="text-purple-400/50">
        {' '}
        ({leader.valuePerPoint.toFixed(1)}/pt over {leader.pointsPlayed} pts)
      </span>
    </span>
  );
}

function TotalsRow({ totals }: { totals: TeamTotals }) {
  const cells: [string, string, string?][] = [
    ['Hold', pct(holdPct(totals)), 'text-purple-100'],
    ['Break', pct(breakPct(totals)), 'text-purple-100'],
    ['Passes', `${totals.passes}`],
    ['Turnovers', `${totals.turnovers}`],
    ['Forced', `${totals.forcedTurnovers}`],
    ['Margin', signed(totals.turnoverMargin), diffColor(totals.turnoverMargin)],
  ];
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 px-4 py-3">
      {cells.map(([label, value, tone]) => (
        <div key={label}>
          <div className="text-[10px] text-purple-400/50 uppercase tracking-wider">{label}</div>
          <div className={`text-sm font-semibold ${tone || 'text-purple-200'}`}>{value}</div>
        </div>
      ))}
    </div>
  );
}

export function TeamStats() {
  const { games, points, playerScores, loading } = useStats();
  const [openTournament, setOpenTournament] = useState<string | null>(null);

  const season = useMemo(() => totalsForPoints(points), [points]);
  const tournaments = useMemo(
    () => summarizeTournaments(games, playerScores),
    [games, playerScores]
  );
  const connections = useMemo(() => computeConnections(points), [points]);
  const accuracy = useMemo(() => {
    return Array.from(computeThrowerAccuracy(points).values())
      .filter((a) => a.attempts >= MIN_THROWS_FOR_ACCURACY)
      .sort((a, b) => b.completionPct - a.completionPct)
      .slice(0, 8);
  }, [points]);
  const lineups = useMemo(() => computeBestLineups(points), [points]);
  const topGoalPairs = useMemo(
    () => [...connections].sort((a, b) => b.goals - a.goals).slice(0, 8),
    [connections]
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-purple-300/60">Loading team stats...</p>
        </div>
      </div>
    );
  }

  const wins = tournaments.reduce((n, t) => n + t.wins, 0);
  const losses = tournaments.reduce((n, t) => n + t.losses, 0);
  const ties = tournaments.reduce((n, t) => n + t.ties, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-purple-100 mb-1">Tournaments</h2>
        <p className="text-sm text-purple-400/60">
          Team totals by tournament and game, with the most valuable player of each
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Record" value={`${wins}-${losses}${ties ? `-${ties}` : ''}`} />
        <Tile
          label="Goal Diff"
          value={signed(season.goalDiff)}
          tone={diffColor(season.goalDiff)}
        />
        <Tile label="Hold" value={pct(holdPct(season))} />
        <Tile label="Break" value={pct(breakPct(season))} />
        <Tile label="Passes" value={`${season.passes}`} />
        <Tile label="Turnovers" value={`${season.turnovers}`} />
        <Tile label="Forced" value={`${season.forcedTurnovers}`} />
        <Tile
          label="Turnover Margin"
          value={signed(season.turnoverMargin)}
          tone={diffColor(season.turnoverMargin)}
        />
      </div>

      <div className="space-y-3">
        {tournaments.map((t) => {
          const open = openTournament === t.tournament;
          return (
            <div
              key={t.tournament}
              className="bg-[#1a0f2e]/80 border border-purple-800/30 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenTournament(open ? null : t.tournament)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-purple-500/5 transition-colors"
              >
                <h3 className="text-sm font-semibold text-purple-100">{t.tournament}</h3>
                <span className="text-xs text-purple-300">
                  {t.wins}-{t.losses}
                  {t.ties ? `-${t.ties}` : ''}
                </span>
                <span className={`text-xs font-semibold ${diffColor(t.totals.goalDiff)}`}>
                  {signed(t.totals.goalDiff)}
                </span>
                <span className="text-xs text-purple-400/50">
                  {t.totals.scored}-{t.totals.scoredAgainst} on {t.totals.pointsPlayed} points
                </span>
                <span className="ml-auto text-xs text-purple-400/50">
                  {open ? 'hide games' : `${t.games.length} games`}
                </span>
              </button>

              <TotalsRow totals={t.totals} />

              <div className="px-4 pb-3 text-xs space-y-0.5">
                <div>
                  <MvpLine leader={t.leaders[0]} label="Tournament MVP" />
                </div>
                {t.leaders.length > 1 && (
                  <div className="text-purple-400/50">
                    Next: {t.leaders.slice(1).map((l) => `${l.player} ${l.totalValue.toFixed(1)}`).join(' · ')}
                  </div>
                )}
              </div>

              {open && (
                <div className="border-t border-purple-800/30 divide-y divide-purple-800/20">
                  {t.games.map((g) => (
                    <div key={g.key} className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span
                        className={`w-5 font-bold ${
                          g.outcome === 'W' ? 'text-emerald-400' : g.outcome === 'L' ? 'text-red-400' : 'text-purple-300'
                        }`}
                      >
                        {g.outcome}
                      </span>
                      <span className="text-purple-100 font-medium w-40 truncate">vs {g.opponent}</span>
                      <span className="text-purple-200 w-12">
                        {g.ours}-{g.theirs}
                      </span>
                      <span className="text-purple-400/60 w-28">
                        hold {pct(holdPct(g.totals))} · break {pct(breakPct(g.totals))}
                      </span>
                      <span className={`w-16 ${diffColor(g.totals.turnoverMargin)}`}>
                        TO {signed(g.totals.turnoverMargin)}
                      </span>
                      <span className="text-purple-400/50 w-20">run {g.longestRunFor}</span>
                      <span className="flex-1 min-w-[200px]">
                        <MvpLine leader={g.leaders[0]} label="MVP" />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Top Connections" subtitle="Most completions between a thrower and receiver">
          <div className="divide-y divide-purple-800/20">
            {connections.slice(0, 8).map((c) => (
              <div key={`${c.thrower}|${c.receiver}`} className="px-4 py-2 flex items-center gap-3 text-sm">
                <span className="flex-1 text-purple-100 truncate">
                  {c.thrower} <span className="text-purple-400/50">to</span> {c.receiver}
                </span>
                <span className="text-purple-200 font-semibold w-10 text-right">{c.completions}</span>
                <span className="text-purple-400/60 w-16 text-right">
            {c.goals} {c.goals === 1 ? 'goal' : 'goals'}
          </span>
                <span className="text-purple-400/60 w-12 text-right">{c.completionPct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Most Goals as a Pair" subtitle="Assist to goal, same two players">
          <div className="divide-y divide-purple-800/20">
            {topGoalPairs.map((c) => (
              <div key={`${c.thrower}|${c.receiver}`} className="px-4 py-2 flex items-center gap-3 text-sm">
                <span className="flex-1 text-purple-100 truncate">
                  {c.thrower} <span className="text-purple-400/50">to</span> {c.receiver}
                </span>
                <span className="text-purple-200 font-semibold w-10 text-right">{c.goals}</span>
                <span className="text-purple-400/60 w-20 text-right">{c.completions} throws</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Most Accurate Throwers"
          subtitle={`Completions over throwaways, stalls, and thrown Callahans (min ${MIN_THROWS_FOR_ACCURACY} throws)`}
        >
          <div className="divide-y divide-purple-800/20">
            {accuracy.map((a) => (
              <div key={a.player} className="px-4 py-2 flex items-center gap-3 text-sm">
                <span className="flex-1 text-purple-100 truncate">{a.player}</span>
                <span className="text-purple-200 font-semibold w-14 text-right">
                  {a.completionPct.toFixed(1)}%
                </span>
                <span className="text-purple-400/60 w-28 text-right">
                  {a.completions}/{a.attempts}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Best Lines" subtitle="Unchanged lines of seven, at least 5 points together">
          <div className="divide-y divide-purple-800/20">
            {lineups.length === 0 && (
              <div className="px-4 py-3 text-sm text-purple-400/50">
                No line played 5 full points together
              </div>
            )}
            {lineups.map((l) => (
              <div key={l.players.join('|')} className="px-4 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className={`font-semibold w-8 ${diffColor(l.goalDiff)}`}>
                    {signed(l.goalDiff)}
                  </span>
                  <span className="text-purple-200">
                    {l.scored}-{l.scoredAgainst}
                  </span>
                  <span className="text-purple-400/50 text-xs">
                    {l.pointsPlayed} points · {l.scoredPct.toFixed(0)}% scored
                  </span>
                </div>
                <div className="text-xs text-purple-300/70 mt-0.5">{l.players.join(', ')}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
