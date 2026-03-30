'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { parseCSV } from '@/lib/parser';
import { computeAllPlayerScores } from '@/lib/scoring';
import { Game, Point, PlayerPointScore } from '@/lib/types';

export type PlayerRole = 'handler' | 'cutter';

interface StatsContextValue {
  games: Game[];
  points: Point[];
  players: string[];
  tournaments: string[];
  playerScores: Map<string, PlayerPointScore[]>;
  playerRoles: Record<string, PlayerRole>;
  setPlayerRole: (player: string, role: PlayerRole | null) => void;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

const StatsContext = createContext<StatsContextValue | null>(null);

export function useStats() {
  const ctx = useContext(StatsContext);
  if (!ctx) throw new Error('useStats must be used within StatsProvider');
  return ctx;
}

export function StatsProvider({ children }: { children: React.ReactNode }) {
  const [games, setGames] = useState<Game[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [players, setPlayers] = useState<string[]>([]);
  const [tournaments, setTournaments] = useState<string[]>([]);
  const [playerScores, setPlayerScores] = useState<Map<string, PlayerPointScore[]>>(new Map());
  const [playerRoles, setPlayerRoles] = useState<Record<string, PlayerRole>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load roles from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('purple-reign-player-roles');
      if (stored) setPlayerRoles(JSON.parse(stored));
    } catch {}
  }, []);

  const setPlayerRole = useCallback((player: string, role: PlayerRole | null) => {
    setPlayerRoles((prev) => {
      const next = { ...prev };
      if (role === null) {
        delete next[player];
      } else {
        next[player] = role;
      }
      localStorage.setItem('purple-reign-player-roles', JSON.stringify(next));
      return next;
    });
  }, []);

  const fetchAndParse = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const csvText = await res.text();
      const parsed = parseCSV(csvText);
      const scores = computeAllPlayerScores(parsed.points);
      const tournamentSet = new Set(parsed.games.map((g) => g.tournament));

      setGames(parsed.games);
      setPoints(parsed.points);
      setPlayers(parsed.players);
      setTournaments(Array.from(tournamentSet).sort());
      setPlayerScores(scores);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAndParse();
  }, [fetchAndParse]);

  return (
    <StatsContext.Provider
      value={{
        games,
        points,
        players,
        tournaments,
        playerScores,
        playerRoles,
        setPlayerRole,
        loading,
        error,
        lastUpdated,
        refresh: fetchAndParse,
      }}
    >
      {children}
    </StatsContext.Provider>
  );
}
