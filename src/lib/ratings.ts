import { hockeyAssister } from './hockeyAssists';
import { Game } from './types';

// "Default" is a lineup artifact from the stat keeper, not a person.
const IGNORED_PLAYERS = new Set(['Default']);

// Every game counts, but older games fade: a game from one tournament ago
// (about five games) counts half as much as this weekend's.
export const HALF_LIFE_GAMES = 5;
// A rating needs this many points of (decayed) playing time behind it.
export const MIN_RATED_POINTS = 20;
// Ratings are graded against every rated snapshot in team history:
// 70 is a typical performance and each 10 points is one standard deviation.
const SCALE_MEAN = 70;
const SCALE_SD = 10;
const FLOOR = 40;
const CEILING = 99;

export type Attr = 'ACC' | 'HND' | 'USG' | 'SCR' | 'PLY' | 'DEF';
export type Archetype = 'Handler' | 'Hybrid' | 'Cutter';
export type DevTrait = 'X-Factor' | 'Superstar' | 'Star' | 'Normal' | 'Hidden';

const TREND_GAMES = 12; // growth window for dev traits, about 2-3 tournaments
const ACTIVE_WINDOW_GAMES = 15; // team games; roughly the last three tournaments
const X_FACTOR_OVR = 90;
const SUPERSTAR_GROWTH = 10;
const STAR_GROWTH = 4;
export const ABILITY_RATING = 90;

// Players the captain names as X-Factors regardless of the numbers. Some of
// what makes a player great never shows up in the event log.
export const NAMED_X_FACTORS = new Set(['Jack']);

export const DEV_TRAITS: { trait: DevTrait; meaning: string }[] = [
  {
    trait: 'X-Factor',
    meaning: `Elite. A current overall of ${X_FACTOR_OVR}+, or named by the captain. Their best ability becomes a zone ability.`,
  },
  { trait: 'Superstar', meaning: `Rising fast: up ${SUPERSTAR_GROWTH}+ overall across their last ${TREND_GAMES} games.` },
  { trait: 'Star', meaning: `Improving: up ${STAR_GROWTH} to ${SUPERSTAR_GROWTH - 1} across their last ${TREND_GAMES} games.` },
  { trait: 'Normal', meaning: `Holding steady or dipping: under +${STAR_GROWTH} across their last ${TREND_GAMES} games.` },
  { trait: 'Hidden', meaning: `Too early to tell: fewer than ${TREND_GAMES} rated games so far.` },
];


export const ATTRIBUTES: { key: Attr; name: string; ability: string; describes: string }[] = [
  { key: 'ACC', name: 'Accuracy', ability: 'Metronome', describes: 'completion rate' },
  { key: 'HND', name: 'Catching', ability: 'Glue Hands', describes: 'catch rate' },
  { key: 'USG', name: 'Usage', ability: 'Offensive Hub', describes: 'share of the touches while on the field' },
  { key: 'SCR', name: 'Scoring', ability: 'Endzone Magnet', describes: 'goals per point' },
  { key: 'PLY', name: 'Playmaking', ability: 'Dime Merchant', describes: 'assists and hockey assists per point' },
  { key: 'DEF', name: 'Defense', ability: 'Lockdown', describes: 'Ds per point' },
];

// What each archetype's overall leans on. Handlers are judged on moving the
// disc, cutters on finishing, hybrids on a bit of both.
const WEIGHTS: Record<Archetype, Record<Attr, number>> = {
  Handler: { ACC: 0.25, USG: 0.3, PLY: 0.2, HND: 0.05, SCR: 0.05, DEF: 0.15 },
  Hybrid: { ACC: 0.2, USG: 0.25, PLY: 0.15, HND: 0.1, SCR: 0.15, DEF: 0.15 },
  Cutter: { ACC: 0.1, USG: 0.15, PLY: 0.1, HND: 0.2, SCR: 0.3, DEF: 0.15 },
};

const FIELDS = ['pts', 'comp', 'tas', 'catches', 'drops', 'goals', 'ast', 'hast', 'ds', 'touches', 'slots', 'throws'] as const;
type Line = Record<(typeof FIELDS)[number], number>;
const emptyLine = (): Line => Object.fromEntries(FIELDS.map((f) => [f, 0])) as Line;

const THROWS = new Set(['Catch', 'Goal', 'Throwaway', 'Drop', 'Stall', 'Callahan']);
const RECEIVED = new Set(['Catch', 'Goal', 'Drop']);

interface Snapshot {
  player: string;
  gameIndex: number;
  tournament: string;
  sums: Line;
  attrRaw: Record<Attr, number>;
  archetype: Archetype;
  rated: boolean;
  z: Record<Attr, number>;
  attrs: Record<Attr, number>;
  ovrRaw: number;
  ovr: number;
}

export interface Ability {
  attr: Attr;
  name: string;
  zone: boolean; // an X-Factor's signature ability
}

export interface PlayerRating {
  player: string;
  archetype: Archetype;
  ovr: number;
  careerOvr: number | null;
  attrs: Record<Attr, number>;
  devTrait: DevTrait;
  growth: number | null;
  abilities: Ability[];
  change: number | null; // since the end of their previous tournament
  active: boolean;
  gamesPlayed: number;
  history: { tournament: string; ovr: number | null; career: number | null }[];
}

export interface RatingsData {
  timeline: string[];
  players: PlayerRating[];
  teamHistory: (number | null)[]; // points-weighted team overall at the end of each tournament
}

const clampRating = (z: number) =>
  Math.min(CEILING, Math.max(FLOOR, Math.round(SCALE_MEAN + SCALE_SD * z)));

function meanSd(values: number[]): { mean: number; sd: number } {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, values.length - 1);
  return { mean, sd: Math.sqrt(variance) || 1 };
}

// Per player, per game counting stats, in the order games were played.
function gameLines(games: Game[]): Map<string, { gameIndex: number; tournament: string; line: Line }[]> {
  const byPlayer = new Map<string, { gameIndex: number; tournament: string; line: Line }[]>();

  games.forEach((game, gameIndex) => {
    const lines = new Map<string, Line>();
    const line = (player: string) => {
      let l = lines.get(player);
      if (!l) {
        l = emptyLine();
        lines.set(player, l);
      }
      return l;
    };

    for (const point of game.points) {
      const onField = new Set(point.playersOnField.filter((p) => !IGNORED_PLAYERS.has(p)));
      let slots = 0;
      for (const ev of point.events) {
        if (ev.eventType === 'Offense' && THROWS.has(ev.action)) slots += RECEIVED.has(ev.action) ? 2 : 1;
      }
      for (const player of onField) {
        line(player).pts++;
        line(player).slots += slots;
      }

      point.events.forEach((ev, i) => {
        if (ev.eventType === 'Offense' && THROWS.has(ev.action)) {
          if (ev.passer && onField.has(ev.passer)) {
            const l = line(ev.passer);
            l.touches++;
            l.throws++;
            if (ev.action === 'Catch' || ev.action === 'Goal') l.comp++;
            if (ev.action === 'Throwaway' || ev.action === 'Stall' || ev.action === 'Callahan') l.tas++;
            if (ev.action === 'Goal') l.ast++;
          }
          if (RECEIVED.has(ev.action) && ev.receiver && onField.has(ev.receiver)) {
            const l = line(ev.receiver);
            l.touches++;
            if (ev.action === 'Drop') l.drops++;
            else l.catches++;
            if (ev.action === 'Goal') l.goals++;
          }
          const setup = hockeyAssister(point.events, i);
          if (setup && !IGNORED_PLAYERS.has(setup)) line(setup).hast++;
        } else if (
          ev.eventType === 'Defense' &&
          (ev.action === 'D' || ev.action === 'Callahan') &&
          ev.defender &&
          !IGNORED_PLAYERS.has(ev.defender)
        ) {
          line(ev.defender).ds++;
        }
      });
    }

    for (const [player, l] of lines) {
      if (l.pts === 0) continue;
      if (!byPlayer.has(player)) byPlayer.set(player, []);
      byPlayer.get(player)!.push({ gameIndex, tournament: game.tournament, line: l });
    }
  });
  return byPlayer;
}

function rateSnapshots(snapshots: Snapshot[]): void {
  const rated = snapshots.filter((s) => s.rated);
  if (rated.length < 2) return;

  for (const { key } of ATTRIBUTES) {
    const { mean, sd } = meanSd(rated.map((s) => s.attrRaw[key]));
    for (const s of rated) {
      s.z[key] = (s.attrRaw[key] - mean) / sd;
      s.attrs[key] = clampRating(s.z[key]);
    }
  }
  for (const s of rated) {
    const w = WEIGHTS[s.archetype];
    s.ovrRaw = ATTRIBUTES.reduce((sum, { key }) => sum + w[key] * s.z[key], 0);
  }
  const { mean, sd } = meanSd(rated.map((s) => s.ovrRaw));
  for (const s of rated) s.ovr = clampRating((s.ovrRaw - mean) / sd);
}

export function computeRatings(games: Game[]): RatingsData {
  const timeline: string[] = [];
  for (const game of games) if (!timeline.includes(game.tournament)) timeline.push(game.tournament);

  const lines = gameLines(games);

  // Team-wide rates every attribute is shrunk toward, so a player's first few
  // games can't post a fluke rating.
  const team = emptyLine();
  for (const entries of lines.values()) {
    for (const { line } of entries) for (const f of FIELDS) team[f] += line[f];
  }
  const base = {
    acc: team.comp / (team.comp + team.tas),
    hnd: team.catches / (team.catches + team.drops),
    usg: team.touches / team.slots,
    scr: team.goals / team.pts,
    ply: (team.ast + 0.5 * team.hast) / team.pts,
    def: team.ds / team.pts,
  };
  const attrRaw = (s: Line): Record<Attr, number> => ({
    ACC: (s.comp + 30 * base.acc) / (s.comp + s.tas + 30),
    HND: (s.catches + 30 * base.hnd) / (s.catches + s.drops + 30),
    USG: (s.touches + 100 * base.usg) / (s.slots + 100),
    SCR: (s.goals + 20 * base.scr) / (s.pts + 20),
    PLY: (s.ast + 0.5 * s.hast + 20 * base.ply) / (s.pts + 20),
    DEF: (s.ds + 20 * base.def) / (s.pts + 20),
  });
  const archetypeOf = (s: Line): Archetype => {
    const share = s.throws / Math.max(1, s.throws + s.catches + s.drops);
    return share >= 0.55 ? 'Handler' : share <= 0.42 ? 'Cutter' : 'Hybrid';
  };

  const decay = 2 ** (-1 / HALF_LIFE_GAMES);
  const current: Snapshot[] = [];
  const career: Snapshot[] = [];

  for (const [player, entries] of lines) {
    let decayed = emptyLine();
    const total = emptyLine();
    for (const { gameIndex, tournament, line } of entries) {
      const next = emptyLine();
      for (const f of FIELDS) {
        next[f] = decayed[f] * decay + line[f];
        total[f] += line[f];
      }
      decayed = next;
      for (const [list, sums] of [
        [current, { ...decayed }],
        [career, { ...total }],
      ] as const) {
        list.push({
          player,
          gameIndex,
          tournament,
          sums,
          attrRaw: attrRaw(sums),
          archetype: archetypeOf(sums),
          rated: sums.pts >= MIN_RATED_POINTS,
          z: {} as Record<Attr, number>,
          attrs: {} as Record<Attr, number>,
          ovrRaw: 0,
          ovr: 0,
        });
      }
    }
  }

  rateSnapshots(current);
  rateSnapshots(career);

  const lastTeamGame = games.length - 1;
  const byPlayer = (list: Snapshot[]) => {
    const map = new Map<string, Snapshot[]>();
    for (const s of list) {
      if (!s.rated) continue;
      if (!map.has(s.player)) map.set(s.player, []);
      map.get(s.player)!.push(s);
    }
    return map;
  };
  const currentByPlayer = byPlayer(current);
  const careerByPlayer = byPlayer(career);

  const players: PlayerRating[] = [];
  for (const [player, snaps] of currentByPlayer) {
    const latest = snaps[snaps.length - 1];
    const careerSnaps = careerByPlayer.get(player) || [];
    const growth = snaps.length > TREND_GAMES ? latest.ovr - snaps[snaps.length - 1 - TREND_GAMES].ovr : null;

    const devTrait: DevTrait = NAMED_X_FACTORS.has(player)
      ? 'X-Factor'
      : growth === null
        ? 'Hidden'
        : latest.ovr >= X_FACTOR_OVR
          ? 'X-Factor'
          : growth >= SUPERSTAR_GROWTH
            ? 'Superstar'
            : growth >= STAR_GROWTH
              ? 'Star'
              : 'Normal';

    const abilities: Ability[] = ATTRIBUTES.filter(({ key }) => latest.attrs[key] >= ABILITY_RATING)
      .sort((a, b) => latest.attrs[b.key] - latest.attrs[a.key])
      .map(({ key, ability }, i) => ({ attr: key, name: ability, zone: devTrait === 'X-Factor' && i === 0 }));

    const previous = [...snaps].reverse().find((s) => s.tournament !== latest.tournament);

    players.push({
      player,
      archetype: latest.archetype,
      ovr: latest.ovr,
      careerOvr: careerSnaps.length ? careerSnaps[careerSnaps.length - 1].ovr : null,
      attrs: latest.attrs,
      devTrait,
      growth,
      abilities,
      change: previous ? latest.ovr - previous.ovr : null,
      active: latest.gameIndex >= lastTeamGame - ACTIVE_WINDOW_GAMES,
      gamesPlayed: lines.get(player)?.length ?? 0,
      history: timeline.map((tournament) => {
        const lastIn = (list: Snapshot[]) => [...list].reverse().find((s) => s.tournament === tournament);
        return {
          tournament,
          ovr: lastIn(snaps)?.ovr ?? null,
          career: lastIn(careerSnaps)?.ovr ?? null,
        };
      }),
    });
  }

  players.sort((a, b) => b.ovr - a.ovr || a.player.localeCompare(b.player));

  // Like a Madden team rating, regulars count more than cameos: each player's
  // overall at the end of a tournament is weighted by the points they played in it.
  const teamHistory = timeline.map((tournament, ti) => {
    let weighted = 0;
    let points = 0;
    for (const rating of players) {
      const ovr = rating.history[ti].ovr;
      if (ovr === null) continue;
      const played = (lines.get(rating.player) || [])
        .filter((g) => g.tournament === tournament)
        .reduce((sum, g) => sum + g.line.pts, 0);
      weighted += ovr * played;
      points += played;
    }
    return points > 0 ? weighted / points : null;
  });

  return { timeline, players, teamHistory };
}
