'use client';

import { RawEvent } from '@/lib/types';

interface EventTimelineProps {
  events: RawEvent[];
  highlightPlayer: string;
}

function getActionIcon(event: RawEvent): string {
  if (event.action === 'Goal' && event.eventType === 'Offense') return '\u2b50';
  if (event.action === 'Goal' && event.eventType === 'Defense') return '\ud83d\udfe5';
  if (event.action === 'Catch') return '\u2705';
  if (event.action === 'Throwaway' && event.eventType === 'Offense') return '\u274c';
  if (event.action === 'Throwaway' && event.eventType === 'Defense') return '\ud83d\udd04';
  if (event.action === 'D') return '\ud83d\udee1\ufe0f';
  if (event.action === 'Drop') return '\ud83d\udc4e';
  if (event.action === 'Pull' || event.action === 'PullOb') return '\ud83c\udfc8';
  if (event.action === 'Callahan') return '\ud83c\udf1f';
  if (event.action === 'Stall') return '\u23f0';
  return '\u26aa';
}

function describeEvent(event: RawEvent): string {
  const { action, eventType, passer, receiver, defender } = event;

  if (action === 'Pull' || action === 'PullOb') {
    return `${defender || 'Team'} pulls${action === 'PullOb' ? ' (OB)' : ''}`;
  }
  if (action === 'Catch') {
    return `${passer || '?'} \u2192 ${receiver || '?'}`;
  }
  if (action === 'Goal' && eventType === 'Offense') {
    return `${passer || '?'} \u2192 ${receiver || '?'} GOAL!`;
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
              <span className="text-base shrink-0 mt-0.5">{getActionIcon(ev)}</span>
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
