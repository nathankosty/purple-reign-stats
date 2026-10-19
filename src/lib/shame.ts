import { computeConnections, computeThrowerAccuracy } from './connections';
import { plusMinusTable } from './teamStats';
import { Game, PlayerPointScore, Point, RawEvent } from './types';

// "Default" is a lineup artifact from the stat keeper, not a person.
const IGNORED_PLAYERS = new Set(['Default']);

const MIN_THROWS = 50;
const MIN_PAIR_ATTEMPTS = 15;
const MIN_CATCH_ATTEMPTS = 30;
const MIN_POINTS_FOR_PLUS_MINUS = 20;

export interface ShameEntry {
  name: string;
  value: string;
  context: string;
  detail?: string;
}

export interface ShameCategory {
  title: string;
  subtitle: string;
  entries: ShameEntry[];
}

function formatContext(point: { tournament: string; opponent: string; dateTime: string }): string {
  const date = new Date(point.dateTime).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return `vs ${point.opponent} · ${point.tournament} · ${date}`;
}

const named = (player: string | undefined): player is string =>
  !!player && !IGNORED_PLAYERS.has(player);

// Events in the order they were played: games by date, then points, then events.
function playedInOrder(games: Game[]): { ev: RawEvent; point: Point }[] {
  const ordered: { ev: RawEvent; point: Point }[] = [];
  for (const game of games) {
    for (const point of game.points) {
      for (const ev of point.events) ordered.push({ ev, point });
    }
  }
  return ordered;
}

interface Streak {
  player: string;
  length: number;
  point: Point;
}

// Longest run of failures among a player's own attempts. A success resets it.
function longestStreaks(
  games: Game[],
  playerOf: (ev: RawEvent) => string | undefined,
  isFailure: (ev: RawEvent) => boolean,
  isAttempt: (ev: RawEvent) => boolean,
  topN: number
): Streak[] {
  const best = new Map<string, Streak>();
  const current = new Map<string, number>();

  for (const { ev, point } of playedInOrder(games)) {
    if (!isAttempt(ev)) continue;
    const player = playerOf(ev);
    if (!named(player)) continue;

    if (!isFailure(ev)) {
      current.set(player, 0);
      continue;
    }

    const run = (current.get(player) || 0) + 1;
    current.set(player, run);
    const previous = best.get(player);
    if (!previous || run > previous.length) best.set(player, { player, length: run, point });
  }

  return Array.from(best.values())
    .filter((s) => s.length > 1)
    .sort((a, b) => b.length - a.length || a.player.localeCompare(b.player))
    .slice(0, topN);
}

const isThrow = (ev: RawEvent) =>
  ev.eventType === 'Offense' &&
  ['Catch', 'Goal', 'Throwaway', 'Stall', 'Callahan', 'Drop'].includes(ev.action);

const isThrownAway = (ev: RawEvent) =>
  ev.eventType === 'Offense' && ['Throwaway', 'Stall', 'Callahan'].includes(ev.action);

const isCatchAttempt = (ev: RawEvent) =>
  ev.eventType === 'Offense' && ['Catch', 'Goal', 'Drop'].includes(ev.action);

export function computeHallOfShame(
  points: Point[],
  games: Game[],
  playerScores: Map<string, PlayerPointScore[]>,
  topN: number = 5
): ShameCategory[] {
  const categories: ShameCategory[] = [];

  // --- one-off disasters ---------------------------------------------------
  const callahans: ShameEntry[] = [];
  const stalls: ShameEntry[] = [];
  const turnoversPerPoint: { point: Point; count: number }[] = [];
  const throwawaysInPoint: { player: string; point: Point; count: number }[] = [];

  for (const point of points) {
    let pointTurnovers = 0;
    const byPlayer = new Map<string, number>();

    for (const ev of point.events) {
      if (ev.eventType !== 'Offense') continue;
      if (['Throwaway', 'Drop', 'Stall', 'Callahan'].includes(ev.action)) pointTurnovers++;
      if (ev.action === 'Callahan' && named(ev.passer)) {
        callahans.push({ name: ev.passer, value: 'Callahan', context: formatContext(point) });
      }
      if (ev.action === 'Stall' && named(ev.passer)) {
        stalls.push({ name: ev.passer, value: 'Stalled', context: formatContext(point) });
      }
      if (ev.action === 'Throwaway' && named(ev.passer)) {
        byPlayer.set(ev.passer, (byPlayer.get(ev.passer) || 0) + 1);
      }
    }

    if (pointTurnovers > 0) turnoversPerPoint.push({ point, count: pointTurnovers });
    for (const [player, count] of byPlayer) throwawaysInPoint.push({ player, point, count });
  }

  categories.push({
    title: 'Thrown Callahans',
    subtitle: 'A throw caught in your own endzone. The worst play in the sport.',
    entries: callahans,
  });

  categories.push({
    title: 'Stalled Out',
    subtitle: 'Held the disc for ten seconds and never let go.',
    entries: stalls,
  });

  categories.push({
    title: 'The Point That Would Not End',
    subtitle: 'Team turnovers in a single point.',
    entries: turnoversPerPoint
      .sort((a, b) => b.count - a.count)
      .slice(0, topN)
      .map((r) => ({
        name: `${r.count} turnovers`,
        value: `${r.point.events.length} events`,
        context: formatContext(r.point),
        detail: `${r.point.result === 'scored' ? 'Somehow scored' : 'Scored against'} · ${r.point.elapsedSeconds}s`,
      })),
  });

  categories.push({
    title: 'Most Throwaways in a Point',
    subtitle: 'One player, one point, repeatedly.',
    entries: throwawaysInPoint
      .sort((a, b) => b.count - a.count)
      .slice(0, topN)
      .map((r) => ({ name: r.player, value: `${r.count}`, context: formatContext(r.point) })),
  });

  const worstPoints: PlayerPointScore[] = [];
  for (const [player, scores] of playerScores) {
    if (!named(player)) continue;
    worstPoints.push(...scores);
  }
  categories.push({
    title: 'Worst Points Ever Played',
    subtitle: 'The lowest value scores the model has ever handed out.',
    entries: worstPoints
      .sort((a, b) => a.score - b.score)
      .slice(0, topN)
      .map((ps) => ({
        name: ps.player,
        value: ps.score.toFixed(1),
        context: formatContext(ps.point),
        detail: [
          ps.breakdown.throwaways ? `${ps.breakdown.throwaways} TAs` : '',
          ps.breakdown.drops ? `${ps.breakdown.drops} drops` : '',
          ps.breakdown.stalls ? `${ps.breakdown.stalls} stalls` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      })),
  });

  categories.push({
    title: 'Worst Losses',
    subtitle: 'Games best left undiscussed.',
    entries: [...games]
      .sort(
        (a, b) =>
          a.finalScore.ours - a.finalScore.theirs - (b.finalScore.ours - b.finalScore.theirs)
      )
      .slice(0, topN)
      .map((g) => ({
        name: `vs ${g.opponent}`,
        value: `${g.finalScore.ours}-${g.finalScore.theirs}`,
        context: `${g.tournament} · ${new Date(g.dateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      })),
  });

  // --- streaks -------------------------------------------------------------
  categories.push({
    title: 'Most Turnovers in a Row',
    subtitle: 'Consecutive throws that never arrived. A completion resets it.',
    entries: longestStreaks(games, (ev) => ev.passer, isThrownAway, isThrow, topN).map((s) => ({
      name: s.player,
      value: `${s.length}`,
      context: formatContext(s.point),
      detail: 'streak ended here',
    })),
  });

  categories.push({
    title: 'Most Drops in a Row',
    subtitle: 'Consecutive catchable discs that hit the ground.',
    entries: longestStreaks(
      games,
      (ev) => ev.receiver,
      (ev) => ev.action === 'Drop',
      isCatchAttempt,
      topN
    ).map((s) => ({
      name: s.player,
      value: `${s.length}`,
      context: formatContext(s.point),
      detail: 'streak ended here',
    })),
  });

  // --- rates, where the ranking is earned ----------------------------------
  categories.push({
    title: 'Worst Completion Rate',
    subtitle: `Minimum ${MIN_THROWS} throws, so nobody wins this on four attempts.`,
    entries: Array.from(computeThrowerAccuracy(points).values())
      .filter((a) => a.attempts >= MIN_THROWS && named(a.player))
      .sort((a, b) => a.completionPct - b.completionPct)
      .slice(0, topN)
      .map((a) => ({
        name: a.player,
        value: `${a.completionPct.toFixed(1)}%`,
        context: `${a.completions} of ${a.attempts} throws`,
      })),
  });

  categories.push({
    title: 'Least Reliable Duo',
    subtitle: `Thrower to receiver, minimum ${MIN_PAIR_ATTEMPTS} attempts.`,
    entries: computeConnections(points)
      .filter((c) => c.attempts >= MIN_PAIR_ATTEMPTS && named(c.thrower) && named(c.receiver))
      .sort((a, b) => a.completionPct - b.completionPct)
      .slice(0, topN)
      .map((c) => ({
        name: `${c.thrower} to ${c.receiver}`,
        value: `${c.completionPct.toFixed(0)}%`,
        context: `${c.completions} of ${c.attempts} completed`,
      })),
  });

  const dropRates = new Map<string, { drops: number; attempts: number }>();
  for (const point of points) {
    for (const ev of point.events) {
      if (!isCatchAttempt(ev) || !named(ev.receiver)) continue;
      const row = dropRates.get(ev.receiver) || { drops: 0, attempts: 0 };
      row.attempts++;
      if (ev.action === 'Drop') row.drops++;
      dropRates.set(ev.receiver, row);
    }
  }
  categories.push({
    title: 'Worst Drop Rate',
    subtitle: `Drops per catchable disc, minimum ${MIN_CATCH_ATTEMPTS} attempts.`,
    entries: Array.from(dropRates.entries())
      .filter(([, r]) => r.attempts >= MIN_CATCH_ATTEMPTS)
      .map(([player, r]) => ({ player, rate: (r.drops / r.attempts) * 100, ...r }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, topN)
      .map((r) => ({
        name: r.player,
        value: `${r.rate.toFixed(1)}%`,
        context: `${r.drops} drops on ${r.attempts} attempts`,
      })),
  });

  categories.push({
    title: 'Worst Plus/Minus',
    subtitle: `Season total, minimum ${MIN_POINTS_FOR_PLUS_MINUS} points played.`,
    entries: plusMinusTable(points)
      .filter((r) => r.pointsPlayed >= MIN_POINTS_FOR_PLUS_MINUS && named(r.player))
      .sort((a, b) => a.plusMinus - b.plusMinus)
      .slice(0, topN)
      .map((r) => ({
        name: r.player,
        value: r.plusMinus > 0 ? `+${r.plusMinus}` : `${r.plusMinus}`,
        context: `${r.pointsPlayed} points played`,
      })),
  });

  return categories.filter((c) => c.entries.length > 0);
}
