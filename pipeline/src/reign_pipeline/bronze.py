"""Bronze: the UltiAnalytics CSV export as-is, with safe column names and ingest metadata."""

import re

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F

EXPORT_COLUMNS = [
    "Date/Time",
    "Tournamemnt",  # misspelled upstream; corrected in silver
    "Opponent",
    "Point Elapsed Seconds",
    "Line",
    "Our Score - End of Point",
    "Their Score - End of Point",
    "Event Type",
    "Action",
    "Passer",
    "Receiver",
    "Defender",
    "Hang Time (secs)",
    *[f"Player {i}" for i in range(28)],
    "Elapsed Time (secs)",
    "Begin Area",
    "Begin X",
    "Begin Y",
    "End Area",
    "End X",
    "End Y",
    "Distance Unit of Measure",
    "Absolute Distance",
    "Lateral Distance",
    "Toward Our Goal Distance",
]


def to_snake(name: str) -> str:
    """'Our Score - End of Point' -> 'our_score_end_of_point'. Delta rejects spaces in names."""
    return re.sub(r"[^0-9a-z]+", "_", name.lower()).strip("_")


def read_export(spark: SparkSession, path: str) -> DataFrame:
    # Every column stays a string here. Casting happens in silver, where a bad value
    # can be traced back to this table instead of silently becoming null on read.
    raw = spark.read.option("header", True).option("inferSchema", False).csv(path)

    missing = [c for c in EXPORT_COLUMNS if c not in raw.columns]
    if missing:
        raise ValueError(f"Export is missing expected columns: {missing}")

    return raw.select(
        *[F.col(f"`{c}`").alias(to_snake(c)) for c in raw.columns],
        # Spark does not guarantee row order after a shuffle, so capture file order now.
        # Silver orders by the game clock; this is the tiebreaker and an audit trail.
        F.monotonically_increasing_id().alias("_ingest_row"),
        F.col("_metadata.file_path").alias("_source_file"),
        F.current_timestamp().alias("_ingested_at"),
    )
