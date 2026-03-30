# Purple Reign Stats

**[Live App](https://purple-reign-stats.vercel.app/)**

A Next.js web app that analyzes Ultimate Frisbee event-level statistics from UltiAnalytics and surfaces each player's most valuable points across a season.

The app fetches CSV data from the UltiAnalytics API, parses it client-side, and applies a configurable scoring system to rank every player's contribution on a per-point basis — factoring in completions, goals, assists, defensive blocks, turnovers, chain bonuses, and impact sequences.

## Features

- **Player scoring engine** — configurable weighted scoring for every action type (goals, assists, Ds, turnovers, etc.) with bonuses for sustained involvement and D-to-score sequences
- **Top points leaderboard** — see any player's highest-scoring points with detailed breakdowns
- **Event timeline** — expand any point to see the full play-by-play with the selected player's actions highlighted
- **Filters** — filter by player, tournament, game, minimum score, point result, and number of results
- **Player records** — track personal bests and milestone stats
- **Role management** — manage player roles and positions
- **Dark theme** — purple-accented dark UI built with Tailwind CSS

## Tech Stack

Next.js 16 (App Router), TypeScript, Tailwind CSS, PapaParse (CSV parsing)

## Getting Started

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Run the dev server:**

   ```bash
   npm run dev
   ```

3. **Open** [http://localhost:3000](http://localhost:3000) in your browser.

The app fetches live data from UltiAnalytics on load — no database or additional setup required.

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main page with tabs and filters
│   ├── layout.tsx            # Root layout
│   └── api/stats/route.ts    # CSV proxy to avoid CORS
├── components/
│   ├── StatsProvider.tsx     # React context — fetches, parses, and provides data
│   ├── Sidebar.tsx           # Filter controls
│   ├── TopPointsList.tsx     # Top N points display
│   ├── PointCard.tsx         # Individual point card with score breakdown
│   ├── EventTimeline.tsx     # Expandable play-by-play timeline
│   ├── RecordsBoard.tsx      # Team records dashboard
│   ├── PlayerRecords.tsx     # Individual player records
│   ├── RoleManager.tsx       # Player role management
│   └── Header.tsx            # App header with team name
└── lib/
    ├── types.ts              # TypeScript interfaces
    ├── parser.ts             # CSV parsing and data grouping
    ├── scoring.ts            # Point value scoring system
    └── records.ts            # Records computation
```

## Deploy on Vercel

The easiest way to deploy this app is with [Vercel](https://vercel.com/new). See the [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for details.
