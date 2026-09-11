# reign-pipeline

A PySpark pipeline over the same UltiAnalytics export the web app reads. The app parses and scores the CSV in the browser; this rebuilds it as layered Delta tables with tests and data quality checks, so the data can be queried and analyzed outside the app.

**Why Spark for 8,000 rows?** It isn't needed at this size, and pandas would handle it fine. This is practice building the pipeline the way it would run on Databricks: raw data kept apart from cleaned data, transforms written as plain DataFrame functions, and checks that can fail the run. Loading more teams wouldn't change the design.

## Tables

| Layer | Table | One row per | Rows (current export) |
|---|---|---|---:|
| Bronze | `raw_events` | CSV row, all strings, snake_case columns, plus `_ingest_row`, `_source_file`, `_ingested_at` | 8,156 |
| Silver | `events` | play, typed, `Anonymous` as null, `event_idx` ordering plays within a point | 8,156 |
| Silver | `event_players` | player on the field per event, unpivoted from `Player 0..27` | 57,014 |
| Silver | `point_players` | player per point | 5,589 |
| Silver | `points` | point, with `result` taken from the scoreboard | 799 |
| Silver | `games` | game, with final score | 44 |

## Design decisions

- **Event order comes from the game clock, not the file.** Spark doesn't guarantee row order, and scoring depends on it. `Elapsed Time (secs)` is unique within every game in the export, so silver orders by it and uses bronze's `_ingest_row` only as a tiebreaker. `test_events_drop_non_plays_and_order_by_game_clock` shuffles the CSV to prove it.
- **Point results come from the scoreboard.** The app decides who scored from the last event of a point. The pipeline uses the change in score since the previous point, then cross-checks it against the last event as an `error`-level check. They agree on every point that ends in a goal or Callahan.
- **Bronze stays as strings.** Casting in silver means a bad value can be traced back to the raw table instead of quietly becoming null on read.
- **No runtime dependency on pyspark.** Databricks ships its own Spark, and installing another copy on a cluster causes version conflicts. The `local` extra adds it for local runs.

## What the quality checks found

Checks in [`quality.py`](src/reign_pipeline/quality.py) run after every build. An `error` fails the run; a `warn` is reported.

| Check | Severity | Current export |
|---|---|---:|
| `results_contradicting_events` | error | 0 |
| `points_without_result` | warn | 1 |
| `points_not_ending_in_score` | warn | 1 |
| `players_not_in_lineup` | warn | 52 |

- **7 points have the wrong lineup recorded.** 52 passers, receivers, and defenders aren't listed on the field for their event, and none of them appear anywhere in that point's lineup. The app only scores players in the lineup, so those actions are never credited to anyone.
- **One game was cut off mid-point.** Bethel at Sectionals 2026 ends at 1-6 on a throwaway. The app counts that point as scored against; the pipeline leaves its result null.
- **Every Callahan in the export was thrown by Purple Reign, not caught.** All 4 are recorded as Offense events, and the scoreboard confirms the opponent scored each time. The app's model has no case for a thrown Callahan, so the thrower loses nothing for it, while an ordinary throwaway costs -3.

## Running locally

Requires Java 17+ and Python 3.11+.

```bash
cd pipeline
python3 -m venv .venv
.venv/bin/pip install -e ".[local,dev]"
.venv/bin/pytest
.venv/bin/python -m reign_pipeline.run                      # fetches the live export
.venv/bin/python -m reign_pipeline.run --input export.csv   # or load a saved one
```

Tables are written to `pipeline/data/lakehouse/`, which is gitignored.

## Roadmap

- [x] Bronze and silver tables, tests, quality checks
- [ ] Possessions via window functions, gold per-player point scores, and a parity test against `src/lib/scoring.ts`
- [ ] Run on Databricks: land the CSV in a Unity Catalog volume, define the job as an asset bundle, schedule it
- [ ] Estimate action values from possession outcomes and compare them to the hand-set weights
