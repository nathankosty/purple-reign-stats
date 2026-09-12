'use client';

import { RawEvent } from '@/lib/types';

interface EventTimelineProps {
  events: RawEvent[];
  highlightPlayer: string;
}

// Dot color for what the event meant for Purple Reign: yellow scored, red cost us,
// green kept the disc moving, blue won it back.
function actionTone(event: RawEvent): string {
  const ours = event.eventType === 'Offense';
  if (event.action === 'Goal') return ours ? 'bg-yellow-400' : 'bg-red-500';
  // An Offense Callahan is one of our throws caught for a Callahan.
  if (event.action === 'Callahan') return ours ? 'bg-red-500' : 'bg-yellow-400';
  if (event.action === 'Catch') return 'bg-emerald-400';
  if (event.action === 'Throwaway') return ours ? 'bg-red-400' : 'bg-sky-400';
  if (event.action === 'D') return 'bg-sky-400';
  if (event.action === 'Drop' || event.action === 'Stall') return 'bg-red-400';
  return 'bg-purple-400/50';
}

function describeEvent(event: RawEvent): string {
  const { action, eventType, passer, receiver, defender } = event;

  if (action === 'Pull' || action === 'PullOb') {
    return `${defender || 'Team'} pulls${action === 'PullOb' ? ' (OB)' : ''}`;
  }
  if (action === 'Catch') {
    return `${passer || '?'} → ${receiver || '?'}`;
  }
  if (action === 'Goal' && eventType === 'Offense') {
    return `${passer || '?'} → ${receiver || '?'} GOAL!`;
  }
  if (action === 'Goal' && eventType === 'Defense') {
    return 'Opponent scores';
  }
  if (action === 'Throwaway' && eventType === 'Offense') {
    return `${passer || '?'} turnover (throwaway)`;
  }
  if (action === 'Throwaway' && eventType === 'Defense') {
    return 'Opponent turnover (throwaway)';
  }
  if (action === 'D') {
    return `${defender || '?'} gets a block!`;
  }
  if (action === 'Drop') {
    return `${receiver || '?'} drops it (from ${passer || '?'})`;
  }
  if (action === 'Callahan') {
    return `${defender || '?'} CALLAHAN!`;
  }
  if (action === 'Stall') {
    return `${passer || '?'} stalled out`;
  }
  return `${action}`;
}

function isPlayerInvolved(event: RawEvent, player: string): boolean {
  return event.passer === player || event.receiver === player || event.defender === player;
}

export function EventTimeline({ events, highlightPlayer }: EventTimelineProps) {
  return (
    <div className="space-y-0">
      {events.map((ev, i) => {
        const involved = isPlayerInvolved(ev, highlightPlayer);
        const isPossessionChange =
          i > 0 && events[i - 1].eventType !== ev.eventType;

        return (
          <div key={i}>
            {isPossessionChange && (
              <div className="flex items-center gap-2 py-1.5 px-2">
                <div className="flex-1 h-px bg-purple-700/40" />
                <span className="text-[10px] text-purple-500 uppercase tracking-wider">
                  {ev.eventType === 'Offense' ? 'Offense' : 'Defense'}
                </span>
                <div className="flex-1 h-px bg-purple-700/40" />
              </div>
            )}
            <div
              className={`flex items-start gap-3 px-3 py-1.5 rounded-md text-sm transition-colors ${
                involved
                  ? 'bg-purple-500/15 text-purple-100 font-medium'
                  : 'text-purple-300/70'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${actionTone(ev)}`}
                title={ev.action}
              />
              <span className="flex-1">{describeEvent(ev)}</span>
              <span className="text-[10px] text-purple-500/50 shrink-0 mt-1">
                {ev.eventType === 'Offense' ? 'O' : 'D'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
