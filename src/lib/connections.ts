import { Point } from './types';

// Who throws to whom. A pair's attempt is a throw that reached the receiver's
// hands or should have: completions, goals, and drops. Throwaways have no
// receiver in the source data, so they can't be attributed to a pair.
export interface Connection {
  thrower: string;
  receiver: string;
  attempts: number;
  completions: number;
  drops: number;
  goals: number;
  completionPct: number;
}

export function computeConnections(points: Point[]): Connection[] {
  const pairs = new Map<string, Connection>();

  for (const point of points) {
    for (const ev of point.events) {
      if (ev.eventType !== 'Offense') continue;
      if (ev.action !== 'Catch' && ev.action !== 'Goal' && ev.action !== 'Drop') continue;
      if (!ev.passer || !ev.receiver) continue; // unrecorded player

      const key = `${ev.passer}|${ev.receiver}`;
      let pair = pairs.get(key);
      if (!pair) {
        pair = {
          thrower: ev.passer,
          receiver: ev.receiver,
          attempts: 0,
          completions: 0,
          drops: 0,
          goals: 0,
          completionPct: 0,
        };
        pairs.set(key, pair);
      }

      pair.attempts++;
      if (ev.action === 'Drop') {
        pair.drops++;
      } else {
        pair.completions++;
        if (ev.action === 'Goal') pair.goals++;
      }
    }
  }

  const all = Array.from(pairs.values());
  for (const pair of all) {
    pair.completionPct = pair.attempts > 0 ? (pair.completions / pair.attempts) * 100 : 0;
  }
  return all.sort((a, b) => b.completions - a.completions);
}

export interface PlayerConnections {
  targets: Connection[]; // this player throwing
  feeders: Connection[]; // this player catching
  distinctTargets: number;
}

export function playerConnections(connections: Connection[], player: string): PlayerConnections {
  const targets = connections
    .filter((c) => c.thrower === player)
    .sort((a, b) => b.completions - a.completions);
  const feeders = connections
    .filter((c) => c.receiver === player)
    .sort((a, b) => b.completions - a.completions);
  return { targets, feeders, distinctTargets: targets.length };
}

// A thrower is charged for throwaways, stalls, and Callahans they threw.
// Drops are charged to the receiver, matching how the value model prices them.
export interface ThrowerAccuracy {
  player: string;
  completions: number;
  throwaways: number;
  stalls: number;
  callahansThrown: number;
  attempts: number;
  completionPct: number;
}

export function computeThrowerAccuracy(points: Point[]): Map<string, ThrowerAccuracy> {
  const byPlayer = new Map<string, ThrowerAccuracy>();

  const entry = (player: string) => {
    let acc = byPlayer.get(player);
    if (!acc) {
      acc = {
        player,
        completions: 0,
        throwaways: 0,
        stalls: 0,
        callahansThrown: 0,
        attempts: 0,
        completionPct: 0,
      };
      byPlayer.set(player, acc);
    }
    return acc;
  };

  for (const point of points) {
    for (const ev of point.events) {
      if (ev.eventType !== 'Offense' || !ev.passer) continue;
      if (ev.action === 'Catch' || ev.action === 'Goal') entry(ev.passer).completions++;
      else if (ev.action === 'Throwaway') entry(ev.passer).throwaways++;
      else if (ev.action === 'Stall') entry(ev.passer).stalls++;
      else if (ev.action === 'Callahan') entry(ev.passer).callahansThrown++;
    }
  }

  for (const acc of byPlayer.values()) {
    acc.attempts = acc.completions + acc.throwaways + acc.stalls + acc.callahansThrown;
    acc.completionPct = acc.attempts > 0 ? (acc.completions / acc.attempts) * 100 : 0;
  }
  return byPlayer;
}
