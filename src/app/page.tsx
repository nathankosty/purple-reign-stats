'use client';

import { useState } from 'react';
import { StatsProvider } from '@/components/StatsProvider';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { TopPointsList } from '@/components/TopPointsList';
import { RecordsBoard } from '@/components/RecordsBoard';
import { PlayerRecords } from '@/components/PlayerRecords';
import { RoleManager } from '@/components/RoleManager';
import { Filters } from '@/lib/types';

type Tab = 'points' | 'records' | 'player-records' | 'roles';

const defaultFilters: Filters = {
  player: '',
  tournaments: [],
  game: '',
  minScore: 0,
  topN: 20,
  pointResult: 'all',
};

function AppContent() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('points');

  return (
    <div className="flex flex-col h-screen">
      <Header />

      {/* Tab bar */}
      <div className="flex border-b border-purple-800/30 bg-[#0d0717]/60 px-6">
        <button
          onClick={() => setTab('points')}
          className={`px-5 py-2.5 text-sm font-medium transition-colors relative ${
            tab === 'points'
              ? 'text-purple-200'
              : 'text-purple-400/50 hover:text-purple-300'
          }`}
        >
          Top Points
          {tab === 'points' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setTab('records')}
          className={`px-5 py-2.5 text-sm font-medium transition-colors relative ${
            tab === 'records'
              ? 'text-purple-200'
              : 'text-purple-400/50 hover:text-purple-300'
          }`}
        >
          Team Records
          {tab === 'records' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setTab('player-records')}
          className={`px-5 py-2.5 text-sm font-medium transition-colors relative ${
            tab === 'player-records'
              ? 'text-purple-200'
              : 'text-purple-400/50 hover:text-purple-300'
          }`}
        >
          Player Records
          {tab === 'player-records' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setTab('roles')}
          className={`px-5 py-2.5 text-sm font-medium transition-colors relative ${
            tab === 'roles'
              ? 'text-purple-200'
              : 'text-purple-400/50 hover:text-purple-300'
          }`}
        >
          Manage Roles
          {tab === 'roles' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full" />
          )}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {tab === 'points' && (
          <>
            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-purple-600 shadow-lg flex items-center justify-center"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>

            {/* Sidebar - mobile overlay */}
            {sidebarOpen && (
              <div
                className="lg:hidden fixed inset-0 bg-black/60 z-40"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            <div
              className={`${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
              } lg:translate-x-0 fixed lg:static z-40 h-full transition-transform duration-200`}
            >
              <Sidebar filters={filters} onChange={setFilters} />
            </div>

            <TopPointsList filters={filters} />
          </>
        )}

        {tab === 'records' && <RecordsBoard />}
        {tab === 'player-records' && <PlayerRecords />}
        {tab === 'roles' && <RoleManager />}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <StatsProvider>
      <AppContent />
    </StatsProvider>
  );
}
