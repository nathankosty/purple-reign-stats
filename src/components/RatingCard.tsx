'use client';

import { ATTRIBUTES, DevTrait, PlayerRating } from '@/lib/ratings';

const TRAIT_STYLE: Record<DevTrait, string> = {
  'X-Factor': 'bg-amber-400/15 text-amber-200 border-amber-300/50',
  Superstar: 'bg-purple-500/25 text-purple-100 border-purple-300/60',
  Star: 'bg-sky-500/15 text-sky-200 border-sky-300/40',
  Normal: 'bg-slate-500/15 text-slate-300 border-slate-400/30',
  Hidden: 'bg-transparent text-purple-400/70 border-purple-700/60',
};

function Change({ value }: { value: number | null }) {
  if (value === null || value === 0) {
    return <span className="text-xs text-purple-400/50">{value === 0 ? 'no change' : 'new'}</span>;
  }
  const up = value > 0;
  return (
    <span className={`text-xs font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
      {up ? '▲' : '▼'} {Math.abs(value)}
    </span>
  );
}

export function RatingCard({ rating, compact = false }: { rating: PlayerRating; compact?: boolean }) {
  return (
    <div className="bg-[#1a0f2e]/80 border border-purple-800/30 rounded-xl overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-start gap-4">
        <div className="text-center shrink-0">
          <div className="text-4xl font-bold text-purple-50 leading-none">{rating.ovr}</div>
          <div className="text-[10px] text-purple-400/60 uppercase tracking-wider mt-1">OVR</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-purple-100 truncate">{rating.player}</span>
            <Change value={rating.change} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="text-xs text-purple-300">{rating.archetype}</span>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${TRAIT_STYLE[rating.devTrait]}`}
              title={
                rating.devTrait === 'Hidden'
                  ? 'Too early to read a trajectory'
                  : `${rating.growth! > 0 ? '+' : ''}${rating.growth} over their last 12 games`
              }
            >
              {rating.devTrait}
            </span>
          </div>
          <div className="text-[11px] text-purple-400/50 mt-1">
            Career {rating.careerOvr ?? '-'} {'·'} {rating.gamesPlayed} games
            {!rating.active && ' · inactive'}
          </div>
        </div>
      </div>

      <div className={`px-4 pb-3 grid ${compact ? 'grid-cols-2' : 'grid-cols-3'} gap-x-4 gap-y-2`}>
        {ATTRIBUTES.map(({ key, name }) => {
          const value = rating.attrs[key];
          return (
            <div key={key} title={name}>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-purple-400/70 font-medium">{key}</span>
                <span className="text-sm font-semibold text-purple-100" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {value}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-purple-950/80 mt-0.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-500"
                  style={{ width: `${Math.max(4, ((value - 40) / 59) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {rating.abilities.length > 0 && (
        <div className="px-4 pb-4 flex flex-wrap gap-1.5">
          {rating.abilities.map((a) => (
            <span
              key={a.attr}
              className={`text-[11px] px-2 py-0.5 rounded-md border ${
                a.zone
                  ? 'border-amber-300/50 bg-amber-400/10 text-amber-200 font-semibold'
                  : 'border-purple-700/60 bg-purple-900/30 text-purple-200'
              }`}
            >
              {a.zone ? `Zone: ${a.name}` : a.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
