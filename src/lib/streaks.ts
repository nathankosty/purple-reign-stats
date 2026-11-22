import { Game, Point, RawEvent } from './types';

// "Default" is a lineup artifact from the stat keeper, not a person.
const IGNORED_PLAYERS = new Set(['Default']);

// Events in the order they were played: games by date, then points, then events.
export function playedInOrder(games: Game[]): { ev: RawEvent; point: Point }[] {
  const ordered: { ev: RawEvent; point: Point }[] = [];
  for (const game of games) {
    for (const point of game.points) {
      for (const ev of point.events) ordered.push({ ev, point });
    }
  }
  return ordered;
}

export interface Streak {
  player: string;
  length: number;
  from: Point;
  to: Point;
  active: boolean; // unbroken and reaching the most recent tournament
}

// An unbroken run only counts as still going if it reaches the latest
// tournament. A player who stopped playing keeps an unbroken run forever,
// but it isn't going anywhere.
function closeOut(finished: Streak[], running: Iterable<Streak>, games: Game[]): Streak[] {
  const latest = games[games.length - 1]?.tournament;
  const open = Array.from(running, (run) => ({ ...run, active: run.to.tournament === latest }));
  return [...finished, ...open];
}

// Every unbroken run of successes per player, across the whole season.
// Events that are neither a success nor a break leave the run untouched.
function eventStreaks(
  games: Game[],
  playerOf: (ev: RawEvent) => string,
  isSuccess: (ev: RawEvent) => boolean,
  isBreak: (ev: RawEvent) => boolean
): Streak[] {
  const finished: Streak[] = [];
  const running = new Map<string, Streak>();

  for (const { ev, point } of playedInOrder(games)) {
    const player = playerOf(ev);
    if (!player || IGNORED_PLAYERS.has(player)) continue;

    if (isSuccess(ev)) {
      const run = running.get(player);
      if (run) {
        run.length++;
        run.to = point;
      } else {
        running.set(player, { player, length: 1, from: point, to: point, active: true });
      }
    } else if (isBreak(ev)) {
      const run = running.get(player);
      if (run) {
        finished.push({ ...run, active: false });
        running.delete(player);
      }
    }
  }
  return closeOut(finished, running.values(), games);
}

const isCompletion = (ev: RawEvent) =>
  ev.eventType === 'Offense' && (ev.action === 'Catch' || ev.action === 'Goal');

// A drop is skipped: it is not the thrower's turnover, but not a completion either.
export function completionStreaks(games: Game[]): Streak[] {
  return eventStreaks(
    games,
    (ev) => (ev.eventType === 'Offense' ? ev.passer : ''),
    isCompletion,
    (ev) =>
      ev.eventType === 'Offense' &&
      (ev.action === 'Throwaway' || ev.action === 'Stall' || ev.action === 'Callahan')
  );
}

export function catchingStreaks(games: Game[]): Streak[] {
  return eventStreaks(
    games,
    (ev) => (ev.eventType === 'Offense' ? ev.receiver : ''),
    isCompletion,
    (ev) => ev.eventType === 'Offense' && ev.action === 'Drop'
  );
}

export type GameStreakKind = 'goal' | 'assist' | 'goal-or-assist';

// Consecutive games with at least one goal, assist, or either. Only games the
// player actually played count, so missing a game neither extends nor breaks it.
export function gameStreaks(games: Game[], kind: GameStreakKind): Streak[] {
  const finished: Streak[] = [];
  const running = new Map<string, Streak>();

  for (const game of games) {
    const anchor = game.points[0];
    if (!anchor) continue;

    const played = new Set<string>();
    const scorers = new Set<string>();
    const assisters = new Set<string>();
    for (const point of game.points) {
      for (const player of point.playersOnField) played.add(player);
      for (const ev of point.events) {
        for (const named of [ev.passer, ev.receiver, ev.defender]) if (named) played.add(named);
        if (ev.eventType === 'Offense' && ev.action === 'Goal') {
          if (ev.receiver) scorers.add(ev.receiver);
          if (ev.passer) assisters.add(ev.passer);
        }
      }
    }

    for (const player of played) {
      if (IGNORED_PLAYERS.has(player)) continue;
      const hit =
        kind === 'goal'
          ? scorers.has(player)
          : kind === 'assist'
            ? assisters.has(player)
            : scorers.has(player) || assisters.has(player);

      const run = running.get(player);
      if (hit) {
        if (run) {
          run.length++;
          run.to = anchor;
        } else {
          running.set(player, { player, length: 1, from: anchor, to: anchor, active: true });
        }
      } else if (run) {
        finished.push({ ...run, active: false });
        running.delete(player);
      }
    }
  }
  return closeOut(finished, running.values(), games);
}

const byLength = (a: Streak, b: Streak) =>
  b.length - a.length || Number(b.active) - Number(a.active) || a.player.localeCompare(b.player);

// One entry per player, so a single player can't fill the whole board.
export function bestPerPlayer(streaks: Streak[], allowed: Set<string> | null, topN: number): Streak[] {
  const best = new Map<string, Streak>();
  for (const s of streaks) {
    if (allowed && !allowed.has(s.player)) continue;
    const current = best.get(s.player);
    if (!current || byLength(s, current) < 0) best.set(s.player, s);
  }
  return Array.from(best.values()).sort(byLength).slice(0, topN);
}

export function longestFor(streaks: Streak[], player: string, topN: number): Streak[] {
  return streaks.filter((s) => s.player === player).sort(byLength).slice(0, topN);
}
