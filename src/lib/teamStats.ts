import { Game, PlayerPointScore, Point, RawEvent } from './types';

// Team counting stats. Opponent completions are not in the source data, so
// "passes" and "turnovers" are always ours and "forced" are the ones we caused.
export interface TeamTotals {
  pointsPlayed: number;
  scored: number;
  scoredAgainst: number;
  goalDiff: number;
  passes: number;
  turnovers: number;
  forcedTurnovers: number;
  turnoverMargin: number;
  oPoints: number;
  holds: number;
  dPoints: number;
  breaks: number;
}

export interface ValueLeader {
  player: string;
  totalValue: number;
  pointsPlayed: number;
  valuePerPoint: number;
}

export interface GameSummary {
  key: string;
  dateTime: string;
  tournament: string;
  opponent: string;
  ours: number;
  theirs: number;
  outcome: 'W' | 'L' | 'T';
  totals: TeamTotals;
  leaders: ValueLeader[];
  longestRunFor: number;
  longestRunAgainst: number;
}

export interface TournamentSummary {
  tournament: string;
  games: GameSummary[];
  wins: number;
  losses: number;
  ties: number;
  totals: TeamTotals;
  leaders: ValueLeader[];
  mvpRanks: PlayerRank[];
}

const isPass = (ev: RawEvent) =>
  ev.eventType === 'Offense' && (ev.action === 'Catch' || ev.action === 'Goal');

// A thrown Callahan is a turnover that hands over a point, so it counts here.
const isOurTurnover = (ev: RawEvent) =>
  ev.eventType === 'Offense' &&
  (ev.action === 'Throwaway' || ev.action === 'Drop' || ev.action === 'Stall' || ev.action === 'Callahan');

const isForcedTurnover = (ev: RawEvent) =>
  ev.eventType === 'Defense' &&
  (ev.action === 'Throwaway' || ev.action === 'D' || ev.action === 'Callahan');

export function emptyTotals(): TeamTotals {
  return {
    pointsPlayed: 0,
    scored: 0,
    scoredAgainst: 0,
    goalDiff: 0,
    passes: 0,
    turnovers: 0,
    forcedTurnovers: 0,
    turnoverMargin: 0,
    oPoints: 0,
    holds: 0,
    dPoints: 0,
    breaks: 0,
  };
}

function addPoint(totals: TeamTotals, point: Point): void {
  totals.pointsPlayed++;
  const scored = point.result === 'scored';
  if (scored) totals.scored++;
  else totals.scoredAgainst++;

  if (point.line === 'O') {
    totals.oPoints++;
    if (scored) totals.holds++;
  } else {
    totals.dPoints++;
    if (scored) totals.breaks++;
  }

  for (const ev of point.events) {
    if (isPass(ev)) totals.passes++;
    else if (isOurTurnover(ev)) totals.turnovers++;
    if (isForcedTurnover(ev)) totals.forcedTurnovers++;
  }

  totals.goalDiff = totals.scored - totals.scoredAgainst;
  totals.turnoverMargin = totals.forcedTurnovers - totals.turnovers;
}

export function totalsForPoints(points: Point[]): TeamTotals {
  const totals = emptyTotals();
  for (const point of points) addPoint(totals, point);
  return totals;
}

export function holdPct(totals: TeamTotals): number | null {
  return totals.oPoints > 0 ? (totals.holds / totals.oPoints) * 100 : null;
}

export function breakPct(totals: TeamTotals): number | null {
  return totals.dPoints > 0 ? (totals.breaks / totals.dPoints) * 100 : null;
}

// Total value decides the ranking; value per point is carried alongside so a
// big number from heavy playing time is visible rather than hidden.
export function valueLeaders(
  points: Point[],
  playerScores: Map<string, PlayerPointScore[]>,
  topN: number = 3
): ValueLeader[] {
  const ids = new Set(points.map((pt) => pt.id));
  const totals = new Map<string, { value: number; points: number }>();

  for (const [player, scores] of playerScores) {
    for (const ps of scores) {
      if (!ids.has(ps.point.id)) continue;
      const cur = totals.get(player) || { value: 0, points: 0 };
      cur.value += ps.score;
      cur.points++;
      totals.set(player, cur);
    }
  }

  return Array.from(totals.entries())
    .map(([player, t]) => ({
      player,
      totalValue: t.value,
      pointsPlayed: t.points,
      valuePerPoint: t.points > 0 ? t.value / t.points : 0,
    }))
    .sort(
      (a, b) =>
        b.totalValue - a.totalValue ||
        b.valuePerPoint - a.valuePerPoint ||
        a.player.localeCompare(b.player)
    )
    .slice(0, topN);
}

// Where a player sat among everyone who played the same tournament. Ranking is
// competition style, so two players tied for first are both first and the next
// is third.
export const MIN_THROWS_FOR_PCT = 10;

export interface PlayerRank {
  stat: string;
  value: string;
  rank: number | null;
  pool: number;
}

interface Tally {
  goals: number;
  assists: number;
  completions: number;
  ds: number;
  callahansCaught: number;
  throwaways: number;
  drops: number;
  attempts: number;
}

function tallyPlayers(points: Point[]): Map<string, Tally> {
  const tallies = new Map<string, Tally>();
  const entry = (player: string) => {
    let t = tallies.get(player);
    if (!t) {
      t = {
        goals: 0,
        assists: 0,
        completions: 0,
        ds: 0,
        callahansCaught: 0,
        throwaways: 0,
        drops: 0,
        attempts: 0,
      };
      tallies.set(player, t);
    }
    return t;
  };

  for (const point of points) {
    // Everyone who took the field is in the pool, even with an empty stat line.
    for (const player of point.playersOnField) entry(player);

    for (const ev of point.events) {
      if (ev.eventType === 'Offense') {
        if (ev.action === 'Catch' || ev.action === 'Goal') {
          if (ev.passer) {
            const t = entry(ev.passer);
            t.completions++;
            t.attempts++;
            if (ev.action === 'Goal') t.assists++;
          }
          if (ev.action === 'Goal' && ev.receiver) entry(ev.receiver).goals++;
        } else if (ev.action === 'Throwaway') {
          if (ev.passer) {
            const t = entry(ev.passer);
            t.throwaways++;
            t.attempts++;
          }
        } else if (ev.action === 'Stall' || ev.action === 'Callahan') {
          // Charged against completion rate, but UltiAnalytics leaves both out of
          // plus-minus, so they are tracked only as attempts here.
          if (ev.passer) entry(ev.passer).attempts++;
        } else if (ev.action === 'Drop') {
          if (ev.receiver) entry(ev.receiver).drops++;
        }
      } else if ((ev.action === 'D' || ev.action === 'Callahan') && ev.defender) {
        const t = entry(ev.defender);
        t.ds++;
        if (ev.action === 'Callahan') t.callahansCaught++;
      }
    }
  }
  return tallies;
}

// UltiAnalytics' plus-minus: goals + assists + Ds - throwaways - drops, where a
// caught Callahan counts twice because it is a block and a goal at once. It is
// already counted once as a D above, so the extra point is added here.
function plusMinus(t: Tally): number {
  return t.goals + t.assists + t.ds + t.callahansCaught - t.throwaways - t.drops;
}

export function rankPlayer(points: Point[], player: string): PlayerRank[] {
  const tallies = tallyPlayers(points);
  const mine = tallies.get(player);
  if (!mine) return [];
  const all = Array.from(tallies.values());

  const rankOf = (values: number[], value: number) => values.filter((v) => v > value).length + 1;
  const counting = (stat: string, pick: (t: Tally) => number, format?: (v: number) => string) => {
    const values = all.map(pick);
    const value = pick(mine);
    return { stat, value: format ? format(value) : `${value}`, rank: rankOf(values, value), pool: values.length };
  };

  const ranks: PlayerRank[] = [
    counting('goals', (t) => t.goals),
    counting('assists', (t) => t.assists),
    counting('completions', (t) => t.completions),
    counting('Ds', (t) => t.ds),
    counting('plus-minus', plusMinus, (v) => (v > 0 ? `+${v}` : `${v}`)),
  ];

  // Completion rate only means something once a player has thrown enough.
  const eligible = all.filter((t) => t.attempts >= MIN_THROWS_FOR_PCT);
  const pctOf = (t: Tally) => (t.attempts > 0 ? (t.completions / t.attempts) * 100 : 0);
  ranks.push({
    stat: 'completion',
    value: mine.attempts > 0 ? `${pctOf(mine).toFixed(0)}%` : '-',
    rank:
      mine.attempts >= MIN_THROWS_FOR_PCT
        ? rankOf(eligible.map(pctOf), pctOf(mine)) 
        : null,
    pool: eligible.length,
  });

  return ranks;
}

function longestRun(points: Point[], result: Point['result']): number {
  let best = 0;
  let current = 0;
  for (const point of points) {
    current = point.result === result ? current + 1 : 0;
    if (current > best) best = current;
  }
  return best;
}

export function summarizeGames(
  games: Game[],
  playerScores: Map<string, PlayerPointScore[]>
): GameSummary[] {
  return games.map((game) => {
    const { ours, theirs } = game.finalScore;
    return {
      key: `${game.dateTime}|${game.opponent}`,
      dateTime: game.dateTime,
      tournament: game.tournament,
      opponent: game.opponent,
      ours,
      theirs,
      outcome: ours > theirs ? 'W' : ours < theirs ? 'L' : 'T',
      totals: totalsForPoints(game.points),
      leaders: valueLeaders(game.points, playerScores, 3),
      longestRunFor: longestRun(game.points, 'scored'),
      longestRunAgainst: longestRun(game.points, 'scored_against'),
    };
  });
}

export function summarizeTournaments(
  games: Game[],
  playerScores: Map<string, PlayerPointScore[]>
): TournamentSummary[] {
  const byTournament = new Map<string, Game[]>();
  for (const game of games) {
    const list = byTournament.get(game.tournament) || [];
    list.push(game);
    byTournament.set(game.tournament, list);
  }

  const summaries: TournamentSummary[] = [];
  for (const [tournament, tournamentGames] of byTournament) {
    const points = tournamentGames.flatMap((g) => g.points);
    const gameSummaries = summarizeGames(tournamentGames, playerScores);
    const leaders = valueLeaders(points, playerScores, 3);
    summaries.push({
      tournament,
      games: gameSummaries,
      wins: gameSummaries.filter((g) => g.outcome === 'W').length,
      losses: gameSummaries.filter((g) => g.outcome === 'L').length,
      ties: gameSummaries.filter((g) => g.outcome === 'T').length,
      totals: totalsForPoints(points),
      leaders,
      mvpRanks: leaders[0] ? rankPlayer(points, leaders[0].player) : [],
    });
  }

  // Newest tournament first; games stay in the order they were played.
  return summaries.sort((a, b) => b.games[0].dateTime.localeCompare(a.games[0].dateTime));
}

// Lines that actually took the field together. Mid-point substitutions make a
// point's roster larger than seven, so only full, unchanged lines are grouped.
export interface LineupRecord {
  players: string[];
  pointsPlayed: number;
  scored: number;
  scoredAgainst: number;
  goalDiff: number;
  scoredPct: number;
}

export function computeBestLineups(
  points: Point[],
  minPoints: number = 5,
  topN: number = 8
): LineupRecord[] {
  const lineups = new Map<string, LineupRecord>();

  for (const point of points) {
    if (point.playersOnField.length !== 7) continue;
    const players = [...point.playersOnField].sort();
    const key = players.join('|');
    let record = lineups.get(key);
    if (!record) {
      record = { players, pointsPlayed: 0, scored: 0, scoredAgainst: 0, goalDiff: 0, scoredPct: 0 };
      lineups.set(key, record);
    }
    record.pointsPlayed++;
    if (point.result === 'scored') record.scored++;
    else record.scoredAgainst++;
  }

  return Array.from(lineups.values())
    .filter((r) => r.pointsPlayed >= minPoints)
    .map((r) => ({
      ...r,
      goalDiff: r.scored - r.scoredAgainst,
      scoredPct: (r.scored / r.pointsPlayed) * 100,
    }))
    .sort((a, b) => b.goalDiff - a.goalDiff || b.scoredPct - a.scoredPct)
    .slice(0, topN);
}
