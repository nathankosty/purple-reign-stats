import Papa from 'papaparse';
import { RawEvent, Point, Game, Action, EventType, Line } from './types';

const VALID_ACTIONS = new Set<string>([
  'Catch', 'Throwaway', 'Goal', 'D', 'Pull', 'PullOb', 'Drop', 'Callahan', 'Stall',
]);

interface CsvRow {
  'Date/Time': string;
  'Tournamemnt': string; // misspelled in source
  'Opponent': string;
  'Point Elapsed Seconds': string;
  'Line': string;
  'Our Score - End of Point': string;
  'Their Score - End of Point': string;
  'Event Type': string;
  'Action': string;
  'Passer': string;
  'Receiver': string;
  'Defender': string;
  'Hang Time (secs)': string;
  'Elapsed Time (secs)': string;
  [key: string]: string;
}

function extractPlayersOnField(row: CsvRow): string[] {
  const players: string[] = [];
  for (let i = 0; i <= 27; i++) {
    const val = row[`Player ${i}`];
    if (val && val.trim() && val.trim() !== 'Anonymous') {
      players.push(val.trim());
    }
  }
  return players;
}

function parseRow(row: CsvRow): RawEvent | null {
  const action = row['Action']?.trim();
  if (!action || !VALID_ACTIONS.has(action)) return null;

  const eventType = row['Event Type']?.trim();
  if (eventType !== 'Offense' && eventType !== 'Defense') return null;

  const passer = row['Passer']?.trim() || '';
  const receiver = row['Receiver']?.trim() || '';
  const defender = row['Defender']?.trim() || '';

  return {
    dateTime: row['Date/Time']?.trim() || '',
    tournament: row['Tournamemnt']?.trim() || '',
    opponent: row['Opponent']?.trim() || '',
    pointElapsedSeconds: parseInt(row['Point Elapsed Seconds']) || 0,
    line: (row['Line']?.trim() || 'O') as Line,
    ourScore: parseInt(row['Our Score - End of Point']) || 0,
    theirScore: parseInt(row['Their Score - End of Point']) || 0,
    eventType: eventType as EventType,
    action: action as Action,
    passer: passer === 'Anonymous' ? '' : passer,
    receiver: receiver === 'Anonymous' ? '' : receiver,
    defender: defender === 'Anonymous' ? '' : defender,
    hangTime: row['Hang Time (secs)'] ? parseFloat(row['Hang Time (secs)']) : null,
    playersOnField: extractPlayersOnField(row),
    elapsedTime: parseInt(row['Elapsed Time (secs)']) || 0,
  };
}

function makePointId(dateTime: string, opponent: string, ourScore: number, theirScore: number, elapsed: number): string {
  return `${dateTime}|${opponent}|${ourScore}-${theirScore}|${elapsed}`;
}

export function parseCSV(csvText: string): { points: Point[]; games: Game[]; players: string[] } {
  const result = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const events: RawEvent[] = [];
  for (const row of result.data) {
    const ev = parseRow(row);
    if (ev) events.push(ev);
  }

  // Group events into points
  const pointGroups = new Map<string, RawEvent[]>();
  for (const ev of events) {
    const key = makePointId(ev.dateTime, ev.opponent, ev.ourScore, ev.theirScore, ev.pointElapsedSeconds);
    if (!pointGroups.has(key)) pointGroups.set(key, []);
    pointGroups.get(key)!.push(ev);
  }

  const allPlayers = new Set<string>();
  const points: Point[] = [];

  for (const [id, evs] of pointGroups) {
    if (evs.length === 0) continue;

    const first = evs[0];
    const lastEvent = evs[evs.length - 1];
    const result: 'scored' | 'scored_against' =
      lastEvent.action === 'Goal' && lastEvent.eventType === 'Offense'
        ? 'scored'
        : lastEvent.action === 'Callahan' && lastEvent.eventType === 'Defense'
        ? 'scored'
        : 'scored_against';

    // Collect all players on field for this point
    const playersSet = new Set<string>();
    for (const ev of evs) {
      for (const p of ev.playersOnField) {
        playersSet.add(p);
        allPlayers.add(p);
      }
      // Also add players from event fields
      if (ev.passer && ev.passer !== 'Anonymous') {
        allPlayers.add(ev.passer);
      }
      if (ev.receiver && ev.receiver !== 'Anonymous') {
        allPlayers.add(ev.receiver);
      }
      if (ev.defender && ev.defender !== 'Anonymous') {
        allPlayers.add(ev.defender);
      }
    }

    points.push({
      id,
      tournament: first.tournament,
      opponent: first.opponent,
      dateTime: first.dateTime,
      line: first.line,
      ourScoreAfter: first.ourScore,
      theirScoreAfter: first.theirScore,
      elapsedSeconds: first.pointElapsedSeconds,
      events: evs,
      playersOnField: Array.from(playersSet).sort(),
      result,
    });
  }

  // Group points into games
  const gameGroups = new Map<string, Point[]>();
  for (const pt of points) {
    const key = `${pt.dateTime}|${pt.opponent}`;
    if (!gameGroups.has(key)) gameGroups.set(key, []);
    gameGroups.get(key)!.push(pt);
  }

  const games: Game[] = [];
  for (const [, pts] of gameGroups) {
    if (pts.length === 0) continue;
    const first = pts[0];
    // Final score = max scores seen
    let maxOurs = 0;
    let maxTheirs = 0;
    for (const pt of pts) {
      maxOurs = Math.max(maxOurs, pt.ourScoreAfter);
      maxTheirs = Math.max(maxTheirs, pt.theirScoreAfter);
    }
    games.push({
      dateTime: first.dateTime,
      tournament: first.tournament,
      opponent: first.opponent,
      points: pts,
      finalScore: { ours: maxOurs, theirs: maxTheirs },
    });
  }

  // Sort games by dateTime
  games.sort((a, b) => a.dateTime.localeCompare(b.dateTime));

  const players = Array.from(allPlayers).sort();

  return { points, games, players };
}
