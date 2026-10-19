import { Point, RawEvent } from './types';

// The pass before the assist. Credited only when the possession is unbroken:
// the event before the goal must be a completion, and its receiver must be the
// player who threw the goal. When the assist was the first pass of a
// possession there is no hockey assist to give.
export function hockeyAssister(events: RawEvent[], goalIndex: number): string | null {
  const goal = events[goalIndex];
  if (!goal || goal.eventType !== 'Offense' || goal.action !== 'Goal' || !goal.passer) return null;

  const previous = events[goalIndex - 1];
  if (!previous || previous.eventType !== 'Offense' || previous.action !== 'Catch') return null;
  if (!previous.passer || previous.receiver !== goal.passer) return null;

  return previous.passer;
}

export function hockeyAssistsInPoint(point: Point): string[] {
  const credited: string[] = [];
  for (let i = 0; i < point.events.length; i++) {
    const player = hockeyAssister(point.events, i);
    if (player) credited.push(player);
  }
  return credited;
}

export function countHockeyAssists(point: Point, player: string): number {
  return hockeyAssistsInPoint(point).filter((p) => p === player).length;
}

export function hockeyAssistLeaders(
  points: Point[],
  topN: number = 8
): { player: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const point of points) {
    for (const player of hockeyAssistsInPoint(point)) {
      counts.set(player, (counts.get(player) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([player, count]) => ({ player, count }))
    .sort((a, b) => b.count - a.count || a.player.localeCompare(b.player))
    .slice(0, topN);
}
