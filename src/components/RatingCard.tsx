'use client';

import {
  Ability,
  ABILITIES,
  ATTRIBUTES,
  CALLAHAN_CLUB,
  DEV_TRAITS,
  DevTrait,
  PlayerRating,
  POSITIONS,
} from '@/lib/ratings';
import { ordinal } from './RankLine';

// X-Factor red, Superstar yellow, Star silver, Normal bronze. The label always
// travels with the color, so the tier never rests on color alone.
const TRAIT_STYLE: Record<DevTrait, string> = {
  'X-Factor': 'bg-red-500/15 text-red-200 border-red-400/60',
  Superstar: 'bg-yellow-400/15 text-yellow-200 border-yellow-300/60',
  Star: 'bg-slate-300/15 text-slate-100 border-slate-300/60',
  Normal: 'bg-[#b87333]/15 text-[#e3a46f] border-[#b87333]/60',
  Hidden: 'bg-transparent text-purple-400/70 border-purple-700/60',
};

export function DevTraitBadge({ trait, growth }: { trait: DevTrait; growth?: number | null }) {
  const meaning = DEV_TRAITS.find((d) => d.trait === trait)?.meaning ?? '';
  const trend =
    growth === null || growth === undefined
      ? ''
      : ` (${growth > 0 ? '+' : ''}${growth} over their last 12 games)`;
  return (
    <span
      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${TRAIT_STYLE[trait]}`}
      title={`${meaning}${trend}`}
    >
      {trait}
    </span>
  );
}

// What the ability means, and where this player stands on it.
function abilityTooltip(a: Ability): string {
  if (a.key === 'callahan') return CALLAHAN_CLUB.meaning;
  const def = ABILITIES.find((d) => d.key === a.key);
  if (!def || a.rank === null) return a.name;
  const standing = a.rank === 1 ? 'Best on the roster' : `${ordinal(a.rank)} of ${a.of} on the roster`;
  return `${def.meaning} ${a.niche ? `Their best niche: ${standing.toLowerCase()}` : standing}. Based on ${def.basis}.`;
}

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
          <div className="text-[10px] text-purple-400/60 uppercase tracking-wider mt-1">Overall</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-purple-100 truncate">{rating.player}</span>
            <Change value={rating.change} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="text-xs text-purple-300">{rating.archetype}</span>
            <DevTraitBadge trait={rating.devTrait} growth={rating.growth} />
          </div>
          <div className="text-[11px] mt-1" title="Overall at each position; the main overall is the best of the three">
            {POSITIONS.map((pos, i) => (
              <span key={pos}>
                {i > 0 && <span className="text-purple-500/50">{' · '}</span>}
                <span className={pos === rating.bestPosition ? 'text-purple-100 font-semibold' : 'text-purple-400/70'}>
                  {pos} {rating.positionOvr[pos]}
                </span>
              </span>
            ))}
          </div>
          <div className="text-[11px] text-purple-400/50 mt-0.5">
            Career {rating.careerOvr ?? '-'} {'·'} {rating.gamesPlayed} games
            {!rating.active && ' · inactive'}
          </div>
        </div>
      </div>

      <div className={`px-4 pb-3 grid ${compact ? 'grid-cols-2' : 'grid-cols-3'} gap-x-4 gap-y-2`}>
        {ATTRIBUTES.map(({ key, name, describes }) => {
          const value = rating.attrs[key];
          return (
            <div key={key} title={`${name}: ${describes}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] text-purple-300/80 font-medium truncate">{name}</span>
                <span className="text-sm font-semibold text-purple-100" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {value}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-purple-950/80 mt-0.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-500"
                  style={{ width: `${Math.max(4, ((value - 60) / 39) * 100)}%` }}
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
              key={a.key}
              title={abilityTooltip(a)}
              className={`text-[11px] px-2 py-0.5 rounded-md border cursor-help ${
                a.zone
                  ? 'border-red-400/60 bg-red-500/10 text-red-200 font-semibold'
                  : 'border-purple-700/60 bg-purple-900/30 text-purple-200'
              }`}
            >
              {a.zone ? `Zone: ${a.name}` : a.name}
              {a.rank === 1 && <span className="ml-1 text-[10px] text-purple-300/70">1st</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
