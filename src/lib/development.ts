import { Game, PlayerPointScore, Point, RawEvent } from './types';

// A tournament where a player logged fewer points than this is shown but not
// rated: three points is not a trend.
export const MIN_POINTS = 5;

// "Default" is a lineup artifact from the stat keeper, not a person.
const IGNORED_PLAYERS = new Set(['Default']);

export type DevMetric = 'usage' | 'playingTime' | 'valuePerPoint';

export const METRICS: { key: DevMetric; label: string; help: string }[] = [
  {
    key: 'usage',
    label: 'Usage share',
    help: 'Share of the team’s touches while on the field. Fair across tournaments with very different paces.',
  },
  {
    key: 'playingTime',
    label: 'Playing time',
    help: 'Share of the team’s points played that tournament.',
  },
  {
    key: 'valuePerPoint',
    label: 'Value per point',
    help: 'The scoring model, averaged over points played.',
  },
];

export function formatMetric(metric: DevMetric, value: number): string {
  return metric === 'valuePerPoint' ? value.toFixed(1) : `${(value * 100).toFixed(0)}%`;
}

export interface TimelineEntry {
  tournament: string;
  short: string; // axis label without the year, which the season row carries
  season: string; // "Spring 2025", "Fall 2026"
}

export interface PlayerTournament {
  tournament: string;
  pointsPlayed: number;
  qualifies: boolean;
  usage: number;
  playingTime: number;
  valuePerPoint: number;
  throwsPerPoint: number;
  catchesPerPoint: number;
  // raw totals, kept so windows can be pooled instead of averaging averages
  touches: number;
  teamTouchesOnField: number;
  value: number;
}

export interface DevelopmentData {
  timeline: TimelineEntry[];
  players: Map<string, PlayerTournament[]>; // one entry per timeline slot, in order
  teamAverage: Record<DevMetric, (number | null)[]>;
}

function seasonOf(dateTime: string): string {
  const date = new Date(dateTime);
  return `${date.getMonth() < 6 ? 'Spring' : 'Fall'} ${date.getFullYear()}`;
}

function shortName(tournament: string): string {
  return tournament.replace(/\s*(19|20)\d\d$/, '').replace(/\s+Fall$/, '') || tournament;
}

const THROWS = new Set(['Catch', 'Goal', 'Throwaway', 'Drop', 'Stall', 'Callahan']);
const RECEIVED = new Set(['Catch', 'Goal', 'Drop']);

// Every offense event has a thrower, and catches, goals, and drops also have
// a receiver. Each is one touch, named or not, so the team total includes
// touches the stat keeper didn't attribute.
function touchSlots(ev: RawEvent): number {
  if (ev.eventType !== 'Offense' || !THROWS.has(ev.action)) return 0;
  return RECEIVED.has(ev.action) ? 2 : 1;
}

interface Tally {
  pointsPlayed: number;
  touches: number;
  teamTouchesOnField: number;
  throws: number;
  catches: number;
  value: number;
}

export function computeDevelopment(
  games: Game[],
  playerScores: Map<string, PlayerPointScore[]>
): DevelopmentData {
  // Tournaments in the order they were first played (games arrive sorted by date).
  const timeline: TimelineEntry[] = [];
  const pointsByTournament = new Map<string, Point[]>();
  for (const game of games) {
    if (!pointsByTournament.has(game.tournament)) {
      pointsByTournament.set(game.tournament, []);
      timeline.push({
        tournament: game.tournament,
        short: shortName(game.tournament),
        season: seasonOf(game.dateTime),
      });
    }
    pointsByTournament.get(game.tournament)!.push(...game.points);
  }

  const valueByPlayerTournament = new Map<string, number>();
  for (const [player, scores] of playerScores) {
    for (const ps of scores) {
      const key = `${player}|${ps.point.tournament}`;
      valueByPlayerTournament.set(key, (valueByPlayerTournament.get(key) || 0) + ps.score);
    }
  }

  const players = new Map<string, PlayerTournament[]>();
  const teamAverage: Record<DevMetric, (number | null)[]> = {
    usage: [],
    playingTime: [],
    valuePerPoint: [],
  };

  timeline.forEach((entry, index) => {
    const points = pointsByTournament.get(entry.tournament) || [];
    const tallies = new Map<string, Tally>();
    const tally = (player: string) => {
      let t = tallies.get(player);
      if (!t) {
        t = { pointsPlayed: 0, touches: 0, teamTouchesOnField: 0, throws: 0, catches: 0, value: 0 };
        tallies.set(player, t);
      }
      return t;
    };

    for (const point of points) {
      const onField = point.playersOnField.filter((p) => !IGNORED_PLAYERS.has(p));
      const slots = point.events.reduce((sum, ev) => sum + touchSlots(ev), 0);
      for (const player of onField) {
        const t = tally(player);
        t.pointsPlayed++;
        t.teamTouchesOnField += slots;
      }
      // Only count a player's touches in points they were recorded on the field,
      // so a share can never exceed the touches it is a share of.
      const present = new Set(onField);
      for (const ev of point.events) {
        if (ev.eventType !== 'Offense' || !THROWS.has(ev.action)) continue;
        if (ev.passer && present.has(ev.passer)) {
          tally(ev.passer).touches++;
          tally(ev.passer).throws++;
        }
        if (RECEIVED.has(ev.action) && ev.receiver && present.has(ev.receiver)) {
          tally(ev.receiver).touches++;
          if (ev.action !== 'Drop') tally(ev.receiver).catches++;
        }
      }
    }

    let usageTouches = 0;
    let usageSlots = 0;
    let shareSum = 0;
    let valueSum = 0;
    let pointSum = 0;
    let rated = 0;

    for (const [player, t] of tallies) {
      t.value = valueByPlayerTournament.get(`${player}|${entry.tournament}`) || 0;
      const qualifies = t.pointsPlayed >= MIN_POINTS;
      const row: PlayerTournament = {
        tournament: entry.tournament,
        pointsPlayed: t.pointsPlayed,
        qualifies,
        usage: t.teamTouchesOnField > 0 ? t.touches / t.teamTouchesOnField : 0,
        playingTime: points.length > 0 ? t.pointsPlayed / points.length : 0,
        valuePerPoint: t.pointsPlayed > 0 ? t.value / t.pointsPlayed : 0,
        throwsPerPoint: t.pointsPlayed > 0 ? t.throws / t.pointsPlayed : 0,
        catchesPerPoint: t.pointsPlayed > 0 ? t.catches / t.pointsPlayed : 0,
        touches: t.touches,
        teamTouchesOnField: t.teamTouchesOnField,
        value: t.value,
      };

      if (!players.has(player)) players.set(player, timeline.map((e) => emptyEntry(e.tournament)));
      players.get(player)![index] = row;

      if (qualifies) {
        usageTouches += t.touches;
        usageSlots += t.teamTouchesOnField;
        shareSum += row.playingTime;
        valueSum += t.value;
        pointSum += t.pointsPlayed;
        rated++;
      }
    }

    teamAverage.usage.push(usageSlots > 0 ? usageTouches / usageSlots : null);
    teamAverage.playingTime.push(rated > 0 ? shareSum / rated : null);
    teamAverage.valuePerPoint.push(pointSum > 0 ? valueSum / pointSum : null);
  });

  // Players who appeared in a tournament before it was added to the map still
  // need empty slots for it; fill any gaps left above.
  for (const rows of players.values()) {
    rows.forEach((row, i) => {
      if (!row) rows[i] = emptyEntry(timeline[i].tournament);
    });
  }

  return { timeline, players, teamAverage };
}

function emptyEntry(tournament: string): PlayerTournament {
  return {
    tournament,
    pointsPlayed: 0,
    qualifies: false,
    usage: 0,
    playingTime: 0,
    valuePerPoint: 0,
    throwsPerPoint: 0,
    catchesPerPoint: 0,
    touches: 0,
    teamTouchesOnField: 0,
    value: 0,
  };
}

export function metricValue(row: PlayerTournament, metric: DevMetric): number | null {
  return row.qualifies ? row[metric] : null;
}

// Pools a window of tournaments rather than averaging their averages, so a
// 40-point tournament outweighs a 6-point one.
function pooled(rows: PlayerTournament[], metric: DevMetric): number {
  if (metric === 'usage') {
    const slots = rows.reduce((s, r) => s + r.teamTouchesOnField, 0);
    return slots > 0 ? rows.reduce((s, r) => s + r.touches, 0) / slots : 0;
  }
  if (metric === 'valuePerPoint') {
    const pts = rows.reduce((s, r) => s + r.pointsPlayed, 0);
    return pts > 0 ? rows.reduce((s, r) => s + r.value, 0) / pts : 0;
  }
  return rows.reduce((s, r) => s + r.playingTime, 0) / rows.length;
}

export interface Improvement {
  player: string;
  from: number;
  to: number;
  change: number;
  early: string[];
  recent: string[];
}

// First few rated tournaments against the last few. The windows never overlap,
// and a player needs at least four rated tournaments to be compared at all.
export function mostImproved(
  data: DevelopmentData,
  metric: DevMetric,
  topN: number = 8
): Improvement[] {
  const results: Improvement[] = [];
  for (const [player, rows] of data.players) {
    const rated = rows.filter((r) => r.qualifies);
    if (rated.length < 4) continue;
    const size = Math.min(3, Math.floor(rated.length / 2));
    const early = rated.slice(0, size);
    const recent = rated.slice(-size);
    const from = pooled(early, metric);
    const to = pooled(recent, metric);
    results.push({
      player,
      from,
      to,
      change: to - from,
      early: early.map((r) => r.tournament),
      recent: recent.map((r) => r.tournament),
    });
  }
  return results.sort((a, b) => b.change - a.change).slice(0, topN);
}

// Rows for the team heatmap: players with enough rated tournaments to show a
// trajectory, ordered by when they first earned real minutes.
export function heatmapPlayers(data: DevelopmentData, minRated: number = 3): string[] {
  const rows: { player: string; first: number }[] = [];
  for (const [player, entries] of data.players) {
    const ratedIdx = entries.map((r, i) => (r.qualifies ? i : -1)).filter((i) => i >= 0);
    if (ratedIdx.length >= minRated) rows.push({ player, first: ratedIdx[0] });
  }
  return rows.sort((a, b) => a.first - b.first || a.player.localeCompare(b.player)).map((r) => r.player);
}
