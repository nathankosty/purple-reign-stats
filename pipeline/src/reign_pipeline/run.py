"""Run the pipeline locally: UltiAnalytics export -> bronze -> silver Delta tables."""

import argparse
import sys
from datetime import date
from pathlib import Path
from urllib.request import urlopen

from pyspark.sql import DataFrame, SparkSession

from reign_pipeline import bronze, quality, silver
from reign_pipeline.spark import local_spark

EXPORT_URL = "https://www.ultianalytics.com/rest/view/team/6594451383255040/stats/export"


def fetch_export(landing: Path) -> Path:
    landing.mkdir(parents=True, exist_ok=True)
    target = landing / f"export_{date.today():%Y%m%d}.csv"
    with urlopen(EXPORT_URL, timeout=60) as response:
        target.write_bytes(response.read())
    return target


def save(spark: SparkSession, df: DataFrame, lakehouse: Path, layer: str, name: str) -> DataFrame:
    """Overwrite a Delta table and read it back, so the next layer builds from storage.

    Each export is a full-season snapshot, so a full overwrite is correct for now.
    """
    path = str(lakehouse / layer / name)
    df.write.format("delta").mode("overwrite").option("overwriteSchema", "true").save(path)
    return spark.read.format("delta").load(path)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="CSV export; fetched live if omitted")
    parser.add_argument("--lakehouse", type=Path, default=Path("data/lakehouse"))
    args = parser.parse_args(argv)

    source = args.input or fetch_export(args.lakehouse.parent / "landing")
    spark = local_spark()
    spark.sparkContext.setLogLevel("ERROR")

    raw = save(
        spark,
        bronze.read_export(spark, str(source.resolve())),
        args.lakehouse,
        "bronze",
        "raw_events",
    )
    events = save(spark, silver.build_events(raw), args.lakehouse, "silver", "events")
    event_players = save(
        spark, silver.build_event_players(raw), args.lakehouse, "silver", "event_players"
    )
    save(
        spark, silver.build_point_players(event_players), args.lakehouse, "silver", "point_players"
    )
    points = save(spark, silver.build_points(events), args.lakehouse, "silver", "points")
    games = save(spark, silver.build_games(points), args.lakehouse, "silver", "games")

    print(
        f"bronze {raw.count():,} rows -> {events.count():,} events, "
        f"{points.count():,} points, {games.count():,} games"
    )

    results = quality.run_checks(events, event_players, points)
    for r in results:
        print(f"  [{r.severity}] {r.name}: {r.failures}")
    return 1 if any(r.severity == "error" and r.failures for r in results) else 0


if __name__ == "__main__":
    sys.exit(main())
