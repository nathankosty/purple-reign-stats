'use client';

import { MIN_THROWS_FOR_PCT, PlayerRank } from '@/lib/teamStats';

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
}

// Where a player placed on the ordinary counting stats, so the value score can
// be read against the numbers people already argue about. Throwing stats are
// ranked within a smaller pool, so those entries name their own pool size.
export function RankLine({ ranks }: { ranks: PlayerRank[] }) {
  if (ranks.length === 0) return null;
  const pool = ranks[0].pool;

  return (
    <div className="text-purple-400/50">
      Ranked among {pool} players:{' '}
      {ranks.map((r, i) => (
        <span key={r.stat}>
          {i > 0 && ' · '}
          <span className="text-purple-300">{r.stat}</span>{' '}
          {r.rank === null ? (
            <span>n/a (under {MIN_THROWS_FOR_PCT} throws)</span>
          ) : (
            <>
              <span className="text-purple-200 font-semibold">{ordinal(r.rank)}</span>
              {r.pool !== pool && <span> of {r.pool}</span>}
              <span> ({r.value})</span>
            </>
          )}
        </span>
      ))}
    </div>
  );
}
