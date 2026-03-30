'use client';

import Image from 'next/image';
import { useStats } from './StatsProvider';

export function Header() {
  const { refresh, loading, lastUpdated } = useStats();

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-purple-900/50 bg-[#0d0717]/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <Image
          src="/logo.png"
          alt="Purple Reign"
          width={40}
          height={40}
          className="w-10 h-10 drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]"
        />
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-300 to-purple-100 bg-clip-text text-transparent">
            Purple Reign Stats
          </h1>
          <p className="text-xs text-purple-400/60">Most Valuable Points</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {lastUpdated && (
          <span className="text-xs text-purple-400/50 hidden sm:block">
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
        <button
          onClick={refresh}
          disabled={loading}
          className="px-4 py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          <svg
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </header>
  );
}
