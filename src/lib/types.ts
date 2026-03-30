export type Action =
  | 'Catch'
  | 'Throwaway'
  | 'Goal'
  | 'D'
  | 'Pull'
  | 'PullOb'
  | 'Drop'
  | 'Callahan'
  | 'Stall';

export type EventType = 'Offense' | 'Defense';
export type Line = 'O' | 'D';

export interface RawEvent {
  dateTime: string;
  tournament: string;
  opponent: string;
  pointElapsedSeconds: number;
  line: Line;
  ourScore: number;
  theirScore: number;
  eventType: EventType;
  action: Action;
  passer: string;
  receiver: string;
  defender: string;
  hangTime: number | null;
  playersOnField: string[];
  elapsedTime: number;
}

export interface Point {
  id: string;
  tournament: string;
  opponent: string;
  dateTime: string;
  line: Line;
  ourScoreAfter: number;
  theirScoreAfter: number;
  elapsedSeconds: number;
  events: RawEvent[];
  playersOnField: string[];
  result: 'scored' | 'scored_against';
}

export interface Game {
  dateTime: string;
  tournament: string;
  opponent: string;
  points: Point[];
  finalScore: { ours: number; theirs: number };
}

export interface ScoreBreakdown {
  completions: number;
  catches: number;
  goals: number;
  assists: number;
  ds: number;
  throwaways: number;
  drops: number;
  pulls: number;
  callahans: number;
  stalls: number;
  touches: number;
  chainBonus: number;
  impactBonus: number;
}

export interface PlayerPointScore {
  player: string;
  point: Point;
  score: number;
  breakdown: ScoreBreakdown;
  highlights: string[];
}

export interface ScoringWeights {
  completion: number;
  catch: number;
  goal: number;
  assist: number;
  defensiveBlock: number;
  callahan: number;
  throwaway: number;
  drop: number;
  stall: number;
  pull: number;
  pullOb: number;
  chainBonus: number;
  impactSequenceBonus: number;
}

export interface Filters {
  player: string;
  tournaments: string[];
  game: string; // "dateTime|opponent" or empty for all
  minScore: number;
  topN: number;
  pointResult: 'all' | 'scored' | 'scored_against';
}

export interface StatsData {
  games: Game[];
  points: Point[];
  players: string[];
  tournaments: string[];
  playerScores: Map<string, PlayerPointScore[]>;
}
