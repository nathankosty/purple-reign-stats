import { Point, PlayerPointScore, ScoreBreakdown, ScoringWeights, RawEvent } from './types';

export const DEFAULT_WEIGHTS: ScoringWeights = {
  completion: 1,
  catch: 0.5,
  goal: 5,
  assist: 3,
  defensiveBlock: 4,
  callahan: 10,
  throwaway: -3,
  drop: -2,
  stall: -3,
  pull: 0.5,
  pullOb: -1,
  chainBonus: 2,
  impactSequenceBonus: 3,
};

function getScoringPossessionTouches(events: RawEvent[], player: string): number {
  // Walk backward from the end to find the final scoring possession.
  // The scoring possession is the consecutive run of Offense events ending with the Goal,
  // unbroken by any turnover (Defense event that isn't the result of your team's action).
  let touches = 0;
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (ev.eventType === 'Offense') {
      if (ev.passer === player) touches++;
      if (ev.receiver === player) touches++;
      // Deduplicate: if someone catches and then throws, passer on next = receiver on this
      // We're counting discrete event involvements, which is fine for the bonus check.
    } else {
      // Hit a Defense event going backward — if it's not the opponent turning it over
      // (which gives us the disc back), stop.
      // Actually, a Defense Throwaway by opponent gives us the disc — that's the start of possession.
      if (ev.action === 'Throwaway' || ev.action === 'D' || ev.action === 'Callahan') {
        break;
      }
      break;
    }
  }
  return touches;
}

function checkImpactSequence(events: RawEvent[], player: string): number {
  let bonus = 0;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if ((ev.action === 'D' || ev.action === 'Callahan') && ev.defender === player) {
      // Check if player was involved in the offensive possession that follows this D
      for (let j = i + 1; j < events.length; j++) {
        const next = events[j];
        if (next.eventType === 'Offense') {
          if (next.passer === player || next.receiver === player) {
            bonus++;
            break;
          }
        }
        // If we hit another turnover before the player touches it, no bonus
        if (
          next.eventType === 'Offense' &&
          (next.action === 'Throwaway' || next.action === 'Drop' || next.action === 'Stall')
        ) {
          break;
        }
        if (next.eventType === 'Defense' && next.action === 'Goal') {
          break; // opponent scored
        }
      }
    }
  }
  return bonus;
}

export function scorePlayerInPoint(
  player: string,
  point: Point,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): PlayerPointScore {
  const breakdown: ScoreBreakdown = {
    completions: 0,
    catches: 0,
    goals: 0,
    assists: 0,
    ds: 0,
    throwaways: 0,
    drops: 0,
    pulls: 0,
    callahans: 0,
    stalls: 0,
    touches: 0,
    chainBonus: 0,
    impactBonus: 0,
  };

  let score = 0;
  const highlights: string[] = [];

  for (const ev of point.events) {
    // Offensive actions
    if (ev.eventType === 'Offense') {
      switch (ev.action) {
        case 'Catch':
          if (ev.passer === player) {
            breakdown.completions++;
            score += weights.completion;
          }
          if (ev.receiver === player) {
            breakdown.catches++;
            score += weights.catch;
          }
          break;
        case 'Goal':
          if (ev.passer === player) {
            breakdown.assists++;
            score += weights.assist;
          }
          if (ev.receiver === player) {
            breakdown.goals++;
            score += weights.goal;
          }
          break;
        case 'Throwaway':
          if (ev.passer === player) {
            breakdown.throwaways++;
            score += weights.throwaway;
          }
          break;
        case 'Drop':
          if (ev.receiver === player) {
            breakdown.drops++;
            score += weights.drop;
          }
          break;
        case 'Stall':
          if (ev.passer === player) {
            breakdown.stalls++;
            score += weights.stall;
          }
          break;
      }
    }

    // Defensive actions
    if (ev.eventType === 'Defense') {
      switch (ev.action) {
        case 'D':
          if (ev.defender === player) {
            breakdown.ds++;
            score += weights.defensiveBlock;
          }
          break;
        case 'Callahan':
          if (ev.defender === player) {
            breakdown.callahans++;
            score += weights.callahan;
          }
          break;
        case 'Pull':
          if (ev.defender === player) {
            breakdown.pulls++;
            score += weights.pull;
          }
          break;
        case 'PullOb':
          if (ev.defender === player) {
            breakdown.pulls++;
            score += weights.pullOb;
          }
          break;
      }
    }
  }

  breakdown.touches = breakdown.completions + breakdown.catches + breakdown.goals + breakdown.assists;

  // Chain bonus
  if (point.result === 'scored') {
    const possessionTouches = getScoringPossessionTouches(point.events, player);
    if (possessionTouches >= 3) {
      breakdown.chainBonus = 1;
      score += weights.chainBonus;
    }
  }

  // Impact sequence bonus
  const impactCount = checkImpactSequence(point.events, player);
  if (impactCount > 0) {
    breakdown.impactBonus = impactCount;
    score += impactCount * weights.impactSequenceBonus;
  }

  // Generate highlights
  if (breakdown.callahans > 0) highlights.push('CALLAHAN');
  if (breakdown.ds > 0 && breakdown.goals > 0) highlights.push('D + Goal');
  else if (breakdown.ds > 0 && breakdown.assists > 0) highlights.push('D + Assist');
  else if (breakdown.goals > 0 && breakdown.assists > 0) highlights.push('Goal + Assist');
  if (breakdown.goals > 0 && !highlights.some((h) => h.includes('Goal'))) highlights.push('Goal');
  if (breakdown.assists > 0 && !highlights.some((h) => h.includes('Assist')))
    highlights.push('Assist');
  if (breakdown.ds > 0 && !highlights.some((h) => h.includes('D')))
    highlights.push(breakdown.ds > 1 ? `${breakdown.ds} Ds` : 'D');
  if (breakdown.impactBonus > 0) highlights.push('D → Score');
  if (breakdown.touches >= 5) highlights.push(`${breakdown.touches} touches`);
  if (breakdown.chainBonus > 0 && !highlights.some((h) => h.includes('touches')))
    highlights.push('Scoring chain');

  return { player, point, score, breakdown, highlights };
}

export function computeAllPlayerScores(
  points: Point[],
  weights: ScoringWeights = DEFAULT_WEIGHTS
): Map<string, PlayerPointScore[]> {
  const playerScores = new Map<string, PlayerPointScore[]>();

  for (const point of points) {
    for (const player of point.playersOnField) {
      const result = scorePlayerInPoint(player, point, weights);
      if (!playerScores.has(player)) {
        playerScores.set(player, []);
      }
      playerScores.get(player)!.push(result);
    }
  }

  // Sort each player's scores descending
  for (const [, scores] of playerScores) {
    scores.sort((a, b) => b.score - a.score);
  }

  return playerScores;
}
