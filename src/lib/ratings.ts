import { hockeyAssister } from './hockeyAssists';
import { Game, PlayerPointScore } from './types';

// "Default" is a lineup artifact from the stat keeper, not a person.
const IGNORED_PLAYERS = new Set(['Default']);

// Every game counts, but older games fade: a game from one tournament ago
// (about five games) counts half as much as this weekend's.
export const HALF_LIFE_GAMES = 5;
// A rating needs this many points of (decayed) playing time behind it.
export const MIN_RATED_POINTS = 20;
// Attributes are graded against every rated snapshot in team history:
// 70 is a typical performance and each 10 points is one standard deviation.
const SCALE_MEAN = 70;
const SCALE_SD = 10;
const FLOOR = 40;
const CEILING = 99;

// Overall uses its own, friendlier display scale over the same ranking: the
// team's historical average shows as 78, each standard deviation above adds 7,
// each below takes 5, and nobody shows lower than 70.
export const OVR_FLOOR = 70;
export const OVR_CENTER = 78;
const OVR_PER_SD_ABOVE = 7;
const OVR_PER_SD_BELOW = 5;
const overallFromZ = (z: number) =>
  Math.min(
    CEILING,
    Math.max(OVR_FLOOR, Math.round(OVR_CENTER + (z >= 0 ? OVR_PER_SD_ABOVE : OVR_PER_SD_BELOW) * z))
  );

export type Attr = 'ACC' | 'HND' | 'USG' | 'SCR' | 'PLY' | 'DEF';
export type Archetype = 'Handler' | 'Hybrid' | 'Cutter';
export type DevTrait = 'X-Factor' | 'Superstar' | 'Star' | 'Normal' | 'Hidden';

const TREND_GAMES = 12; // growth window for dev traits, about 2-3 tournaments
const ACTIVE_WINDOW_GAMES = 15; // team games; roughly the last three tournaments
const X_FACTOR_OVR = 90;
// A trait can be earned by level or by growth, so a player who has plateaued
// at a high level is still recognized, and so is one climbing fast from below.
const SUPERSTAR_OVR = 85;
const SUPERSTAR_GROWTH = 5;
const STAR_OVR = 78;
const STAR_GROWTH = 3;

// Players the captain names as X-Factors regardless of the numbers. Some of
// what makes a player great never shows up in the event log.
export const NAMED_X_FACTORS = new Set(['Jack']);

export const DEV_TRAITS: { trait: DevTrait; meaning: string }[] = [
  {
    trait: 'X-Factor',
    meaning: 'Elite: the team\u2019s top tier. Their best ability becomes a zone ability.',
  },
  {
    trait: 'Superstar',
    meaning: `An overall of ${SUPERSTAR_OVR}+, or rising fast: up ${SUPERSTAR_GROWTH}+ across their last ${TREND_GAMES} games.`,
  },
  {
    trait: 'Star',
    meaning: `An overall of ${STAR_OVR}+, or improving: up ${STAR_GROWTH}+ across their last ${TREND_GAMES} games.`,
  },
  { trait: 'Normal', meaning: 'Building toward Star.' },
  { trait: 'Hidden', meaning: `Too early to tell: fewer than ${TREND_GAMES} rated games so far.` },
];


export const ATTRIBUTES: { key: Attr; name: string; describes: string }[] = [
  { key: 'ACC', name: 'Accuracy', describes: 'completion rate' },
  { key: 'HND', name: 'Catching', describes: 'catch rate' },
  { key: 'USG', name: 'Usage', describes: 'share of the touches while on the field' },
  { key: 'SCR', name: 'Scoring', describes: 'goals per point' },
  { key: 'PLY', name: 'Playmaking', describes: 'assists and hockey assists per point' },
  { key: 'DEF', name: 'Defense', describes: 'Ds per point' },
];

// What an overall leans on at the two ends of the throwing spectrum: handlers
// are judged on moving the disc, cutters on finishing. Every player's weights
// are blended between the two by how much of their touches are throws, so
// there is no cliff where one point of throw share swings an overall.
const CUTTER_WEIGHTS: Record<Attr, number> = { ACC: 0.1, USG: 0.1, PLY: 0.1, HND: 0.2, SCR: 0.32, DEF: 0.18 };
const HANDLER_WEIGHTS: Record<Attr, number> = { ACC: 0.27, USG: 0.22, PLY: 0.24, HND: 0.05, SCR: 0.05, DEF: 0.17 };
// The same lines the archetype labels use.
const CUTTER_SHARE = 0.42;
const HANDLER_SHARE = 0.55;

function weightsFor(throwShare: number): Record<Attr, number> {
  const t = Math.min(1, Math.max(0, (throwShare - CUTTER_SHARE) / (HANDLER_SHARE - CUTTER_SHARE)));
  const blended = {} as Record<Attr, number>;
  for (const key of Object.keys(CUTTER_WEIGHTS) as Attr[]) {
    blended[key] = CUTTER_WEIGHTS[key] * (1 - t) + HANDLER_WEIGHTS[key] * t;
  }
  return blended;
}

const FIELDS = [
  'pts', 'comp', 'tas', 'catches', 'drops', 'goals', 'ast', 'hast', 'ds', 'touches', 'slots', 'throws',
  // used only by abilities
  'games', 'pulls', 'pullsIn', 'cals', 'oPts', 'oScored', 'dPts', 'dScored', 'clutchPts', 'clutchScored',
  'chains', 'impacts',
] as const;
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
  throwShare: number;
  rated: boolean;
  z: Record<Attr, number>;
  attrs: Record<Attr, number>;
  ovrRaw: number;
  ovr: number;
}

// ---------------------------------------------------------------------------
// Abilities: niches. The top three on the active roster in each earn it, and a
// player who earns none still gets their single best niche, so every regular
// has something on their card. Measured over the same recent, fading window
// as the overall.
// ---------------------------------------------------------------------------
export type AbilityGroup = 'Throwing' | 'Receiving' | 'Defense' | 'On the field' | 'Workload';

export interface AbilityDef {
  key: string;
  name: string;
  group: AbilityGroup;
  meaning: string;
  basis: string;
  metric: (s: Line, attrs: Record<Attr, number>) => number | null; // null = not enough to judge
}

const per = (n: number, d: number, min: number) => (d >= min ? n / d : null);

export const ABILITIES: AbilityDef[] = [
  { key: 'metronome', name: 'Metronome', group: 'Throwing', meaning: 'Rarely gives the disc away.',
    basis: 'completion rate (40+ throws)', metric: (s) => per(s.comp, s.comp + s.tas, 40) },
  { key: 'reset', name: 'Reset Machine', group: 'Throwing', meaning: 'Keeps the disc moving.',
    basis: 'completions per point', metric: (s) => per(s.comp, s.pts, 15) },
  { key: 'dime', name: 'Dime Merchant', group: 'Throwing', meaning: 'Throws the scores.',
    basis: 'assists per point', metric: (s) => per(s.ast, s.pts, 15) },
  { key: 'setup', name: 'Setup Man', group: 'Throwing', meaning: 'Throws the pass before the score.',
    basis: 'hockey assists per point', metric: (s) => per(s.hast, s.pts, 15) },
  { key: 'hub', name: 'Offensive Hub', group: 'Throwing', meaning: 'The offense runs through them.',
    basis: "share of the team's touches while on the field", metric: (s) => per(s.touches, s.slots, 100) },
  { key: 'glue', name: 'Glue Hands', group: 'Receiving', meaning: 'Catches everything.',
    basis: 'catch rate (30+ catchable discs)', metric: (s) => per(s.catches, s.catches + s.drops, 30) },
  { key: 'endzone', name: 'Endzone Magnet', group: 'Receiving', meaning: 'Finds the endzone.',
    basis: 'goals per point', metric: (s) => per(s.goals, s.pts, 15) },
  { key: 'chain', name: 'Chain Mover', group: 'Receiving', meaning: 'Keeps getting the disc as a point is built.',
    basis: '3+ touches in a scoring possession, per point', metric: (s) => per(s.chains, s.pts, 15) },
  { key: 'lockdown', name: 'Lockdown', group: 'Defense', meaning: 'Gets blocks.',
    basis: 'Ds per point', metric: (s) => per(s.ds, s.pts, 15) },
  { key: 'impact', name: 'Impact Player', group: 'Defense', meaning: 'Turns their own blocks into offense.',
    basis: 'a D followed by a touch on the possession it created, per point', metric: (s) => per(s.impacts, s.pts, 15) },
  { key: 'twoway', name: 'Two-Way Threat', group: 'Defense', meaning: 'Makes plays on both sides of the disc.',
    basis: 'goals, assists, and Ds minus turnovers, per point',
    metric: (s) => per(s.goals + s.ast + s.ds + s.cals - s.tas - s.drops, s.pts, 15) },
  { key: 'breaks', name: 'Break Maker', group: 'On the field', meaning: 'The team breaks more often with them out there.',
    basis: 'scoring rate on D-line points (10+ D points)', metric: (s) => per(s.dScored, s.dPts, 10) },
  { key: 'holds', name: 'Hold Steady', group: 'On the field', meaning: 'The O-line holds with them out there.',
    basis: 'scoring rate on O-line points (10+ O points)', metric: (s) => per(s.oScored, s.oPts, 10) },
  { key: 'clutch', name: 'Clutch Gene', group: 'On the field', meaning: 'Shows up when the game is tight.',
    basis: 'scoring rate on points within 3 with a team at 8+ (6+ such points)',
    metric: (s) => per(s.clutchScored, s.clutchPts, 6) },
  { key: 'swiss', name: 'Swiss Army Knife', group: 'On the field', meaning: 'Good at a bit of everything.',
    basis: 'the highest floor across all six attributes',
    metric: (_s, attrs) => Math.min(...ATTRIBUTES.map((a) => attrs[a.key])) },
  { key: 'pull', name: 'Hang Time', group: 'Workload', meaning: 'Puts the pull in play.',
    basis: 'pulls landed in bounds (5+ pulls)', metric: (s) => per(s.pullsIn, s.pulls, 5) },
  { key: 'iron', name: 'Iron Lung', group: 'Workload', meaning: 'Always on the field.',
    basis: 'points played per game', metric: (s) => per(s.pts, s.games, 3) },
];

export const CALLAHAN_CLUB = {
  name: 'Callahan Club',
  meaning: 'Caught a Callahan: a block in the endzone that is also a goal.',
  basis: 'any caught Callahan, ever',
};

export interface Ability {
  key: string;
  name: string;
  zone: boolean; // an X-Factor's signature ability
  rank: number | null; // place on the active roster, null for Callahan Club
  of: number;
  niche: boolean; // their best category, given because they earned no top-3 ability
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
  latestSums: Line;
  careerCallahans: number;
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
function gameLines(
  games: Game[],
  scoreIndex?: Map<string, PlayerPointScore['breakdown']>
): Map<string, { gameIndex: number; tournament: string; line: Line }[]> {
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

    game.points.forEach((point, pi) => {
      const onField = new Set(point.playersOnField.filter((p) => !IGNORED_PLAYERS.has(p)));
      // Score before this point, for the close-and-late (clutch) split.
      const before = pi === 0 ? { ours: 0, theirs: 0 } : {
        ours: game.points[pi - 1].ourScoreAfter,
        theirs: game.points[pi - 1].theirScoreAfter,
      };
      const clutch = Math.abs(before.ours - before.theirs) <= 3 && Math.max(before.ours, before.theirs) >= 8;
      const scored = point.result === 'scored';
      let slots = 0;
      for (const ev of point.events) {
        if (ev.eventType === 'Offense' && THROWS.has(ev.action)) slots += RECEIVED.has(ev.action) ? 2 : 1;
      }
      for (const player of onField) {
        const l = line(player);
        l.pts++;
        l.slots += slots;
        if (point.line === 'O') {
          l.oPts++;
          if (scored) l.oScored++;
        } else {
          l.dPts++;
          if (scored) l.dScored++;
        }
        if (clutch) {
          l.clutchPts++;
          if (scored) l.clutchScored++;
        }
        const breakdown = scoreIndex?.get(`${player}|${point.id}`);
        if (breakdown) {
          l.chains += breakdown.chainBonus;
          l.impacts += breakdown.impactBonus;
        }
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
          if (ev.action === 'Callahan') line(ev.defender).cals++;
        } else if (
          ev.eventType === 'Defense' &&
          (ev.action === 'Pull' || ev.action === 'PullOb') &&
          ev.defender &&
          !IGNORED_PLAYERS.has(ev.defender)
        ) {
          line(ev.defender).pulls++;
          if (ev.action === 'Pull') line(ev.defender).pullsIn++;
        }
      });
    });

    for (const [player, l] of lines) {
      if (l.pts === 0) continue;
      l.games = 1;
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
    const w = weightsFor(s.throwShare);
    s.ovrRaw = ATTRIBUTES.reduce((sum, { key }) => sum + w[key] * s.z[key], 0);
  }
  const { mean, sd } = meanSd(rated.map((s) => s.ovrRaw));
  for (const s of rated) s.ovr = overallFromZ((s.ovrRaw - mean) / sd);
}

export function computeRatings(
  games: Game[],
  playerScores?: Map<string, PlayerPointScore[]>
): RatingsData {
  const timeline: string[] = [];
  for (const game of games) if (!timeline.includes(game.tournament)) timeline.push(game.tournament);

  const scoreIndex = new Map<string, PlayerPointScore['breakdown']>();
  for (const [player, scores] of playerScores || []) {
    for (const ps of scores) scoreIndex.set(`${player}|${ps.point.id}`, ps.breakdown);
  }
  const lines = gameLines(games, scoreIndex);

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
  const throwShareOf = (s: Line) => s.throws / Math.max(1, s.throws + s.catches + s.drops);
  const archetypeOf = (s: Line): Archetype => {
    const share = throwShareOf(s);
    return share >= HANDLER_SHARE ? 'Handler' : share <= CUTTER_SHARE ? 'Cutter' : 'Hybrid';
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
          throwShare: throwShareOf(sums),
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

    const rising = (bar: number) => growth !== null && growth >= bar;
    const devTrait: DevTrait =
      NAMED_X_FACTORS.has(player) || latest.ovr >= X_FACTOR_OVR
        ? 'X-Factor'
        : latest.ovr >= SUPERSTAR_OVR || rising(SUPERSTAR_GROWTH)
          ? 'Superstar'
          : latest.ovr >= STAR_OVR || rising(STAR_GROWTH)
            ? 'Star'
            : growth === null
              ? 'Hidden'
              : 'Normal';

    const previous = [...snaps].reverse().find((s) => s.tournament !== latest.tournament);

    players.push({
      player,
      archetype: latest.archetype,
      ovr: latest.ovr,
      careerOvr: careerSnaps.length ? careerSnaps[careerSnaps.length - 1].ovr : null,
      attrs: latest.attrs,
      devTrait,
      growth,
      abilities: [],
      change: previous ? latest.ovr - previous.ovr : null,
      active: latest.gameIndex >= lastTeamGame - ACTIVE_WINDOW_GAMES,
      gamesPlayed: lines.get(player)?.length ?? 0,
      latestSums: latest.sums,
      careerCallahans: careerSnaps.length ? careerSnaps[careerSnaps.length - 1].sums.cals : 0,
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
  assignAbilities(players);

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

// Like Madden's ability slots: a player holds at most three, and each ability
// goes to at most three players. Slots are handed out best finish first, so a
// star keeps their strongest niches and a spot they can't fit passes to the
// next player in line. Anyone still without one gets their single best niche.
export const MAX_ABILITIES = 3;
const HOLDERS_PER_ABILITY = 3;

function assignAbilities(players: PlayerRating[]): void {
  const roster = players.filter((p) => p.active);
  const candidates: { player: PlayerRating; ability: Ability; standing: number; order: number }[] = [];

  ABILITIES.forEach((def, order) => {
    const values = new Map<string, number>();
    for (const p of roster) {
      const v = def.metric(p.latestSums, p.attrs);
      if (v !== null && Number.isFinite(v)) values.set(p.player, v);
    }
    const all = Array.from(values.values());
    if (all.length < 2) return;
    for (const p of roster) {
      const v = values.get(p.player);
      if (v === undefined) continue;
      const rank = all.filter((x) => x > v).length + 1; // ties share a place
      const standing = (all.length - rank) / (all.length - 1); // 1 = best on the roster
      candidates.push({
        player: p,
        ability: { key: def.key, name: def.name, zone: false, rank, of: all.length, niche: false },
        standing,
        order,
      });
    }
  });

  candidates.sort(
    (a, b) => a.ability.rank! - b.ability.rank! || b.standing - a.standing || a.order - b.order
  );

  const held = new Map<string, Ability[]>(roster.map((p) => [p.player, []]));
  const holders = new Map<string, number>();
  for (const c of candidates) {
    const mine = held.get(c.player.player)!;
    const taken = holders.get(c.ability.key) || 0;
    if (mine.length >= MAX_ABILITIES || taken >= HOLDERS_PER_ABILITY) continue;
    mine.push(c.ability);
    holders.set(c.ability.key, taken + 1);
  }

  for (const p of roster) {
    const earned = held.get(p.player)!;
    if (earned.length === 0) {
      const best = candidates
        .filter((c) => c.player === p)
        .sort((a, b) => b.standing - a.standing || a.order - b.order)[0];
      if (best) earned.push({ ...best.ability, niche: true });
    }
    if (p.careerCallahans > 0) {
      earned.push({ key: 'callahan', name: CALLAHAN_CLUB.name, zone: false, rank: null, of: 0, niche: false });
    }
    if (p.devTrait === 'X-Factor' && earned.length > 0) earned[0] = { ...earned[0], zone: true };
    p.abilities = earned;
  }
}
