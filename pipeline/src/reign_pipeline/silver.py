"""Silver: typed, cleaned events, plus the lineup, point, and game tables derived from them."""

from pyspark.sql import Column, DataFrame, Window
from pyspark.sql import functions as F

PLAY_EVENT_TYPES = ["Offense", "Defense"]
PLAY_ACTIONS = ["Catch", "Throwaway", "Goal", "D", "Pull", "PullOb", "Drop", "Callahan", "Stall"]
PLAYER_SLOTS = [f"player_{i}" for i in range(28)]


def _player_name(col_name: str) -> Column:
    """Blank and 'Anonymous' both mean the stat keeper didn't record a player."""
    value = F.trim(F.col(col_name))
    return F.when((value == "") | (value == "Anonymous"), F.lit(None)).otherwise(value)


def _short_hash(*cols: str) -> Column:
    return F.substring(F.sha2(F.concat_ws("|", *cols), 256), 1, 16)


def _plays(bronze: DataFrame) -> DataFrame:
    """Rows that are actual plays (drops halftime and other cessation rows), typed, still wide."""
    plays = bronze.filter(
        F.trim("event_type").isin(PLAY_EVENT_TYPES) & F.trim("action").isin(PLAY_ACTIONS)
    )
    return plays.select(
        # Elapsed game time is unique within a game in the source, so it makes a natural key.
        F.concat_ws(":", _short_hash("date_time", "opponent"), "elapsed_time_secs").alias(
            "event_id"
        ),
        _short_hash("date_time", "opponent").alias("game_id"),
        _short_hash(
            "date_time",
            "opponent",
            "our_score_end_of_point",
            "their_score_end_of_point",
            "point_elapsed_seconds",
        ).alias("point_id"),
        F.to_timestamp("date_time", "yyyy-MM-dd HH:mm").alias("game_start"),
        F.trim("tournamemnt").alias("tournament"),
        F.trim("opponent").alias("opponent"),
        F.trim("line").alias("line"),
        F.col("our_score_end_of_point").cast("int").alias("our_score_end"),
        F.col("their_score_end_of_point").cast("int").alias("their_score_end"),
        F.col("point_elapsed_seconds").cast("int").alias("point_duration_s"),
        F.col("elapsed_time_secs").cast("int").alias("game_elapsed_s"),
        F.trim("event_type").alias("event_type"),
        F.trim("action").alias("action"),
        _player_name("passer").alias("passer"),
        _player_name("receiver").alias("receiver"),
        _player_name("defender").alias("defender"),
        F.col("hang_time_secs").cast("double").alias("hang_time_s"),
        *PLAYER_SLOTS,
        "_ingest_row",
    )


def build_events(bronze: DataFrame) -> DataFrame:
    in_point = Window.partitionBy("point_id").orderBy("game_elapsed_s", "_ingest_row")
    return _plays(bronze).drop(*PLAYER_SLOTS).withColumn("event_idx", F.row_number().over(in_point))


def build_event_players(bronze: DataFrame) -> DataFrame:
    """One row per player on the field per event, unpivoted from the 28 Player N columns."""
    return (
        _plays(bronze)
        .unpivot(["event_id", "point_id"], PLAYER_SLOTS, "slot", "raw_player")
        .select("event_id", "point_id", _player_name("raw_player").alias("player"))
        .filter(F.col("player").isNotNull())
    )


def build_point_players(event_players: DataFrame) -> DataFrame:
    # A lineup can change mid-point (injury subs), so take everyone who appeared on any event.
    return event_players.select("point_id", "player").distinct()


def build_points(events: DataFrame) -> DataFrame:
    points = events.groupBy(
        "point_id",
        "game_id",
        "game_start",
        "tournament",
        "opponent",
        "our_score_end",
        "their_score_end",
        "point_duration_s",
    ).agg(
        F.min_by("line", "event_idx").alias("line"),
        F.count("*").alias("n_events"),
        F.min("game_elapsed_s").alias("start_elapsed_s"),
        F.max_by("event_type", "event_idx").alias("last_event_type"),
        F.max_by("action", "event_idx").alias("last_action"),
    )

    # Who scored comes from the scoreboard, not the last event. The event log has gaps
    # (a point can end on a throwaway), but the score columns are recorded every point.
    in_game = Window.partitionBy("game_id").orderBy("start_elapsed_s")
    ours = F.col("our_score_end") - F.coalesce(F.lag("our_score_end").over(in_game), F.lit(0))
    theirs = F.col("their_score_end") - F.coalesce(F.lag("their_score_end").over(in_game), F.lit(0))
    return (
        points.withColumn("point_number", F.row_number().over(in_game))
        .withColumn("our_delta", ours)
        .withColumn("their_delta", theirs)
        .withColumn(
            "result",
            F.when((F.col("our_delta") == 1) & (F.col("their_delta") == 0), "scored").when(
                (F.col("our_delta") == 0) & (F.col("their_delta") == 1), "scored_against"
            ),
        )
        .drop("our_delta", "their_delta")
    )


def build_games(points: DataFrame) -> DataFrame:
    games = points.groupBy("game_id", "game_start", "tournament", "opponent").agg(
        F.max("our_score_end").alias("our_final"),
        F.max("their_score_end").alias("their_final"),
        F.count("*").alias("n_points"),
    )
    return games.withColumn(
        "result",
        F.when(F.col("our_final") > F.col("their_final"), "W")
        .when(F.col("our_final") < F.col("their_final"), "L")
        .otherwise("T"),
    )
