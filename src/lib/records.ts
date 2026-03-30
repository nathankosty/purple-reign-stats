import { Point, Game, RawEvent, PlayerPointScore } from './types';

export interface Record {
  label: string;
  value: number;
  player: string;
  context: string; // e.g. "vs Mankato · Meltdown 2026 · Mar 21"
  detail?: string; // extra info like players on field
}

function formatContext(tournament: string, opponent: string, dateTime: string): string {
  try {
    const d = new Date(dateTime);
    const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `vs ${opponent} · ${tournament} · ${date}`;
  } catch {
    return `vs ${opponent} · ${tournament}`;
  }
}

function countPlayerActionsInPoint(
  point: Point,
  player: string,
  matchFn: (ev: RawEvent, player: string) => boolean
): number {
  return point.events.filter((ev) => matchFn(ev, player)).length;
}

function countPlayerActionsInGame(
  game: Game,
  player: string,
  matchFn: (ev: RawEvent, player: string) => boolean
): number {
  let total = 0;
  for (const pt of game.points) {
    if (!pt.playersOnField.includes(player)) continue;
    total += pt.events.filter((ev) => matchFn(ev, player)).length;
  }
  return total;
}

function countPlayerActionsInTournament(
  games: Game[],
  tournament: string,
  player: string,
  matchFn: (ev: RawEvent, player: string) => boolean
): number {
  let total = 0;
  for (const game of games) {
    if (game.tournament !== tournament) continue;
    total += countPlayerActionsInGame(game, player, matchFn);
  }
  return total;
}

// Match functions
const isCompletion = (ev: RawEvent, p: string) =>
  ev.eventType === 'Offense' && ev.action === 'Catch' && ev.passer === p;

const isCatch = (ev: RawEvent, p: string) =>
  ev.eventType === 'Offense' && ev.action === 'Catch' && ev.receiver === p;

const isD = (ev: RawEvent, p: string) =>
  ev.eventType === 'Defense' && (ev.action === 'D' || ev.action === 'Callahan') && ev.defender === p;

const isGoal = (ev: RawEvent, p: string) =>
  ev.eventType === 'Offense' && ev.action === 'Goal' && ev.receiver === p;

const isAssist = (ev: RawEvent, p: string) =>
  ev.eventType === 'Offense' && ev.action === 'Goal' && ev.passer === p;

function findTopNPointRecords(
  points: Point[],
  players: string[],
  matchFn: (ev: RawEvent, player: string) => boolean,
  n: number
): Record[] {
  const allowed = new Set(players);
  const results: { player: string; point: Point; count: number }[] = [];

  for (const point of points) {
    for (const player of point.playersOnField) {
      if (!allowed.has(player)) continue;
      const count = countPlayerActionsInPoint(point, player, matchFn);
      if (count > 0) {
        results.push({ player, point, count });
      }
    }
  }

  results.sort((a, b) => b.count - a.count);

  return results.slice(0, n).map((r) => ({
    label: '',
    value: r.count,
    player: r.player,
    context: formatContext(r.point.tournament, r.point.opponent, r.point.dateTime),
  }));
}

function findTopNGameRecords(
  games: Game[],
  players: string[],
  matchFn: (ev: RawEvent, player: string) => boolean,
  n: number
): Record[] {
  const allowed = new Set(players);
  const results: { player: string; game: Game; count: number }[] = [];

  for (const game of games) {
    // Find all players in this game
    const gamePlayers = new Set<string>();
    for (const pt of game.points) {
      for (const p of pt.playersOnField) {
        if (allowed.has(p)) gamePlayers.add(p);
      }
    }

    for (const player of gamePlayers) {
      const count = countPlayerActionsInGame(game, player, matchFn);
      if (count > 0) {
        results.push({ player, game, count });
      }
    }
  }

  results.sort((a, b) => b.count - a.count);

  return results.slice(0, n).map((r) => ({
    label: '',
    value: r.count,
    player: r.player,
    context: formatContext(r.game.tournament, r.game.opponent, r.game.dateTime),
  }));
}

function findTopNTournamentRecords(
  games: Game[],
  tournaments: string[],
  players: string[],
  matchFn: (ev: RawEvent, player: string) => boolean,
  n: number
): Record[] {
  const results: { player: string; tournament: string; count: number }[] = [];

  const allowed = new Set(players);
  for (const tournament of tournaments) {
    // Find all players in this tournament
    const tournamentPlayers = new Set<string>();
    for (const game of games) {
      if (game.tournament !== tournament) continue;
      for (const pt of game.points) {
        for (const p of pt.playersOnField) {
          if (allowed.has(p)) tournamentPlayers.add(p);
        }
      }
    }

    for (const player of tournamentPlayers) {
      const count = countPlayerActionsInTournament(games, tournament, player, matchFn);
      if (count > 0) {
        results.push({ player, tournament, count });
      }
    }
  }

  results.sort((a, b) => b.count - a.count);

  return results.slice(0, n).map((r) => ({
    label: '',
    value: r.count,
    player: r.player,
    context: r.tournament,
  }));
}

export interface RecordCategory {
  title: string;
  icon: string;
  records: Record[];
}

export function computeAllRecords(
  points: Point[],
  games: Game[],
  players: string[],
  tournaments: string[],
  topN: number = 5
): RecordCategory[] {
  const categories: RecordCategory[] = [];

  // Most completions (throws) in a point
  categories.push({
    title: 'Most Throws in a Point',
    icon: '\ud83d\udcab',
    records: findTopNPointRecords(points, players, isCompletion, topN),
  });

  // Most completions in a game
  categories.push({
    title: 'Most Throws in a Game',
    icon: '\ud83d\udcab',
    records: findTopNGameRecords(games, players, isCompletion, topN),
  });

  // Most catches in a point
  categories.push({
    title: 'Most Catches in a Point',
    icon: '\ud83e\udd32',
    records: findTopNPointRecords(points, players, isCatch, topN),
  });

  // Most catches in a game
  categories.push({
    title: 'Most Catches in a Game',
    icon: '\ud83e\udd32',
    records: findTopNGameRecords(games, players, isCatch, topN),
  });

  // Most Ds in a point
  categories.push({
    title: 'Most Ds in a Point',
    icon: '\ud83d\udee1\ufe0f',
    records: findTopNPointRecords(points, players, isD, topN),
  });

  // Most Ds in a game
  categories.push({
    title: 'Most Ds in a Game',
    icon: '\ud83d\udee1\ufe0f',
    records: findTopNGameRecords(games, players, isD, topN),
  });

  // Most goals in a game
  categories.push({
    title: 'Most Goals in a Game',
    icon: '\u2b50',
    records: findTopNGameRecords(games, players, isGoal, topN),
  });

  // Most goals in a tournament
  categories.push({
    title: 'Most Goals in a Tournament',
    icon: '\u2b50',
    records: findTopNTournamentRecords(games, tournaments, players, isGoal, topN),
  });

  // Most assists in a game
  categories.push({
    title: 'Most Assists in a Game',
    icon: '\ud83c\udfaf',
    records: findTopNGameRecords(games, players, isAssist, topN),
  });

  // Most assists in a tournament
  categories.push({
    title: 'Most Assists in a Tournament',
    icon: '\ud83c\udfaf',
    records: findTopNTournamentRecords(games, tournaments, players, isAssist, topN),
  });

  // Longest points
  const longestPoints = [...points]
    .sort((a, b) => b.elapsedSeconds - a.elapsedSeconds)
    .slice(0, topN)
    .map((pt) => ({
      label: '',
      value: pt.elapsedSeconds,
      player: pt.playersOnField.join(', '),
      context: formatContext(pt.tournament, pt.opponent, pt.dateTime),
      detail: `${pt.result === 'scored' ? 'Scored' : 'Scored against'} · ${pt.line === 'O' ? 'O-line' : 'D-line'} · ${pt.events.length} events`,
    }));

  categories.push({
    title: 'Longest Points (seconds)',
    icon: '\u23f1\ufe0f',
    records: longestPoints,
  });

  // Highest value point scores (all-time)
  // We need to compute this from playerScores, but we can do it from points directly
  // We'll import scoring here — but to avoid circular deps, let's compute inline
  // Actually, let's accept playerScores as a param

  return categories;
}

// Player-specific records
export function computePlayerRecords(
  player: string,
  points: Point[],
  games: Game[],
  tournaments: string[],
  playerScores: Map<string, PlayerPointScore[]>,
  topN: number = 5
): RecordCategory[] {
  const categories: RecordCategory[] = [];

  // Filter to points/games this player was in
  const playerPoints = points.filter((pt) => pt.playersOnField.includes(player));

  // Helper: find top N for this player in points
  function playerPointRecords(
    matchFn: (ev: RawEvent, player: string) => boolean
  ): Record[] {
    const results: { point: Point; count: number }[] = [];
    for (const point of playerPoints) {
      const count = countPlayerActionsInPoint(point, player, matchFn);
      if (count > 0) results.push({ point, count });
    }
    results.sort((a, b) => b.count - a.count);
    return results.slice(0, topN).map((r) => ({
      label: '',
      value: r.count,
      player,
      context: formatContext(r.point.tournament, r.point.opponent, r.point.dateTime),
    }));
  }

  // Helper: find top N for this player in games
  function playerGameRecords(
    matchFn: (ev: RawEvent, player: string) => boolean
  ): Record[] {
    const results: { game: Game; count: number }[] = [];
    for (const game of games) {
      const count = countPlayerActionsInGame(game, player, matchFn);
      if (count > 0) results.push({ game, count });
    }
    results.sort((a, b) => b.count - a.count);
    return results.slice(0, topN).map((r) => ({
      label: '',
      value: r.count,
      player,
      context: formatContext(r.game.tournament, r.game.opponent, r.game.dateTime),
    }));
  }

  // Helper: find top N for this player in tournaments
  function playerTournamentRecords(
    matchFn: (ev: RawEvent, player: string) => boolean
  ): Record[] {
    const results: { tournament: string; count: number }[] = [];
    for (const tournament of tournaments) {
      const count = countPlayerActionsInTournament(games, tournament, player, matchFn);
      if (count > 0) results.push({ tournament, count });
    }
    results.sort((a, b) => b.count - a.count);
    return results.slice(0, topN).map((r) => ({
      label: '',
      value: r.count,
      player,
      context: r.tournament,
    }));
  }

  // Best point value scores
  const scores = playerScores.get(player) || [];
  categories.push({
    title: 'Best Point Value Scores',
    icon: '\ud83c\udfc6',
    records: scores.slice(0, topN).map((ps) => ({
      label: '',
      value: parseFloat(ps.score.toFixed(1)),
      player,
      context: formatContext(ps.point.tournament, ps.point.opponent, ps.point.dateTime),
      detail: ps.highlights.join(' · '),
    })),
  });

  // Throws
  categories.push({ title: 'Most Throws in a Point', icon: '\ud83d\udcab', records: playerPointRecords(isCompletion) });
  categories.push({ title: 'Most Throws in a Game', icon: '\ud83d\udcab', records: playerGameRecords(isCompletion) });
  categories.push({ title: 'Most Throws in a Tournament', icon: '\ud83d\udcab', records: playerTournamentRecords(isCompletion) });

  // Catches
  categories.push({ title: 'Most Catches in a Point', icon: '\ud83e\udd32', records: playerPointRecords(isCatch) });
  categories.push({ title: 'Most Catches in a Game', icon: '\ud83e\udd32', records: playerGameRecords(isCatch) });
  categories.push({ title: 'Most Catches in a Tournament', icon: '\ud83e\udd32', records: playerTournamentRecords(isCatch) });

  // Ds
  categories.push({ title: 'Most Ds in a Point', icon: '\ud83d\udee1\ufe0f', records: playerPointRecords(isD) });
  categories.push({ title: 'Most Ds in a Game', icon: '\ud83d\udee1\ufe0f', records: playerGameRecords(isD) });
  categories.push({ title: 'Most Ds in a Tournament', icon: '\ud83d\udee1\ufe0f', records: playerTournamentRecords(isD) });

  // Goals
  categories.push({ title: 'Most Goals in a Point', icon: '\u2b50', records: playerPointRecords(isGoal) });
  categories.push({ title: 'Most Goals in a Game', icon: '\u2b50', records: playerGameRecords(isGoal) });
  categories.push({ title: 'Most Goals in a Tournament', icon: '\u2b50', records: playerTournamentRecords(isGoal) });

  // Assists
  categories.push({ title: 'Most Assists in a Point', icon: '\ud83c\udfaf', records: playerPointRecords(isAssist) });
  categories.push({ title: 'Most Assists in a Game', icon: '\ud83c\udfaf', records: playerGameRecords(isAssist) });
  categories.push({ title: 'Most Assists in a Tournament', icon: '\ud83c\udfaf', records: playerTournamentRecords(isAssist) });

  // Longest points this player was on
  const longestPlayerPoints = [...playerPoints]
    .sort((a, b) => b.elapsedSeconds - a.elapsedSeconds)
    .slice(0, topN)
    .map((pt) => ({
      label: '',
      value: pt.elapsedSeconds,
      player,
      context: formatContext(pt.tournament, pt.opponent, pt.dateTime),
      detail: `${pt.result === 'scored' ? 'Scored' : 'Scored against'} · ${pt.line === 'O' ? 'O-line' : 'D-line'} · ${pt.events.length} events`,
    }));
  categories.push({ title: 'Longest Points (seconds)', icon: '\u23f1\ufe0f', records: longestPlayerPoints });

  // Career totals as a single-entry category
  let totalThrows = 0, totalCatches = 0, totalDs = 0, totalGoals = 0, totalAssists = 0, totalPoints = 0;
  for (const pt of playerPoints) {
    totalPoints++;
    for (const ev of pt.events) {
      if (isCompletion(ev, player)) totalThrows++;
      if (isCatch(ev, player)) totalCatches++;
      if (isD(ev, player)) totalDs++;
      if (isGoal(ev, player)) totalGoals++;
      if (isAssist(ev, player)) totalAssists++;
    }
  }
  categories.unshift({
    title: 'Career Totals',
    icon: '\ud83d\udcca',
    records: [
      { label: '', value: totalPoints, player: 'Points Played', context: '' },
      { label: '', value: totalThrows, player: 'Total Throws', context: '' },
      { label: '', value: totalCatches, player: 'Total Catches', context: '' },
      { label: '', value: totalGoals, player: 'Total Goals', context: '' },
      { label: '', value: totalAssists, player: 'Total Assists', context: '' },
      { label: '', value: totalDs, player: 'Total Ds', context: '' },
    ],
  });

  return categories;
}

export function computeMVPPointRecords(
  playerScores: Map<string, PlayerPointScore[]>,
  topN: number = 5,
  filterPlayers?: string[]
): RecordCategory {
  const allowed = filterPlayers ? new Set(filterPlayers) : null;
  const allScores: PlayerPointScore[] = [];
  for (const [player, scores] of playerScores) {
    if (allowed && !allowed.has(player)) continue;
    allScores.push(...scores);
  }
  allScores.sort((a, b) => b.score - a.score);

  return {
    title: 'Highest Point Value Scores (All-Time)',
    icon: '\ud83c\udfc6',
    records: allScores.slice(0, topN).map((ps) => ({
      label: '',
      value: parseFloat(ps.score.toFixed(1)),
      player: ps.player,
      context: formatContext(ps.point.tournament, ps.point.opponent, ps.point.dateTime),
      detail: ps.highlights.join(' · '),
    })),
  };
}
