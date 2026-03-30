'use client';

import { useState } from 'react';
import { PlayerPointScore } from '@/lib/types';
import { EventTimeline } from './EventTimeline';

interface PointCardProps {
  data: PlayerPointScore;
  rank: number;
}

function formatDate(dateTime: string): string {
  try {
    const d = new Date(dateTime);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateTime;
  }
}

function getScoreColor(score: number): string {
  if (score >= 12) return 'from-yellow-400 to-amber-500';
  if (score >= 8) return 'from-purple-400 to-purple-500';
  if (score >= 4) return 'from-purple-500 to-purple-600';
  return 'from-purple-600 to-purple-700';
}

export function PointCard({ data, rank }: PointCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { point, score, breakdown, highlights } = data;

  const statItems = [
    { label: 'Throws', value: breakdown.completions, show: breakdown.completions > 0 },
    { label: 'Catches', value: breakdown.catches, show: breakdown.catches > 0 },
    { label: 'Goals', value: breakdown.goals, show: breakdown.goals > 0 },
    { label: 'Assists', value: breakdown.assists, show: breakdown.assists > 0 },
    { label: 'Ds', value: breakdown.ds, show: breakdown.ds > 0 },
    { label: 'Callahans', value: breakdown.callahans, show: breakdown.callahans > 0 },
    { label: 'TAs', value: breakdown.throwaways, show: breakdown.throwaways > 0 },
    { label: 'Drops', value: breakdown.drops, show: breakdown.drops > 0 },
  ].filter((s) => s.show);

  return (
    <div className="bg-[#1a0f2e]/80 border border-purple-800/30 rounded-xl overflow-hidden hover:border-purple-600/50 transition-colors">
      {/* Main card content */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-start gap-4"
      >
        {/* Rank + Score */}
        <div className="shrink-0 flex flex-col items-center gap-1">
          <span className="text-xs text-purple-400/50">#{rank}</span>
          <div
            className={`w-14 h-14 rounded-xl bg-gradient-to-br ${getScoreColor(score)} flex items-center justify-center shadow-lg`}
          >
            <span className="text-xl font-bold text-white">{score.toFixed(1)}</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Game context */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-semibold text-purple-100">
              vs {point.opponent}
            </span>
            <span className="text-xs text-purple-400/60">
              {point.tournament} &middot; {formatDate(point.dateTime)}
            </span>
          </div>

          {/* Score + line */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                point.line === 'O'
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'bg-red-500/20 text-red-300'
              }`}
            >
              {point.line === 'O' ? 'O-line' : 'D-line'}
            </span>
            <span className="text-xs text-purple-300/60">
              {point.ourScoreAfter}-{point.theirScoreAfter}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                point.result === 'scored'
                  ? 'bg-green-500/20 text-green-300'
                  : 'bg-red-500/20 text-red-300'
              }`}
            >
              {point.result === 'scored' ? 'Scored' : 'Scored against'}
            </span>
          </div>

          {/* Highlights */}
          {highlights.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {highlights.map((h, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 font-medium border border-purple-500/30"
                >
                  {h}
                </span>
              ))}
            </div>
          )}

          {/* Stats row */}
          <div className="flex flex-wrap gap-3">
            {statItems.map((s) => (
              <div key={s.label} className="flex items-center gap-1 text-xs text-purple-300/70">
                <span className="font-semibold text-purple-200">{s.value}</span>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Expand indicator */}
        <svg
          className={`w-5 h-5 text-purple-500 shrink-0 mt-2 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded timeline */}
      {expanded && (
        <div className="border-t border-purple-800/30 bg-[#12091f] px-4 py-3">
          <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2">
            Event Timeline
          </h4>
          <EventTimeline events={point.events} highlightPlayer={data.player} />
          <div className="mt-3 pt-2 border-t border-purple-800/20 text-xs text-purple-400/50">
            On field: {point.playersOnField.join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}
