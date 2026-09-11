"""Data quality checks on silver tables. Each check returns the offending rows."""

from dataclasses import dataclass

from pyspark.sql import Column, DataFrame
from pyspark.sql import functions as F


@dataclass(frozen=True)
class CheckResult:
    name: str
    severity: str  # "error" fails the run; "warn" is reported and the run continues
    failures: int


def _result_implied_by_last_event() -> Column:
    event_type, action = F.col("last_event_type"), F.col("last_action")
    return (
        F.when((event_type == "Offense") & (action == "Goal"), "scored")
        .when((event_type == "Defense") & (action == "Goal"), "scored_against")
        # An Offense Callahan is one of our throws caught for a Callahan: they score.
        .when((event_type == "Offense") & (action == "Callahan"), "scored_against")
        .when((event_type == "Defense") & (action == "Callahan"), "scored")
    )


def results_contradicting_events(points: DataFrame) -> DataFrame:
    """Scoreboard says one team scored, the event log says the other did."""
    implied = _result_implied_by_last_event()
    return points.filter(
        implied.isNotNull() & F.col("result").isNotNull() & (implied != F.col("result"))
    )


def points_without_result(points: DataFrame) -> DataFrame:
    """Score didn't move by exactly one: a skipped or unfinished point."""
    return points.filter(F.col("result").isNull())


def points_not_ending_in_score(points: DataFrame) -> DataFrame:
    return points.filter(~F.col("last_action").isin("Goal", "Callahan"))


def players_not_in_lineup(events: DataFrame, event_players: DataFrame) -> DataFrame:
    """Passers, receivers, and defenders who aren't in that event's recorded lineup."""
    roles = F.array(
        *[
            F.struct(F.lit(role).alias("role"), F.col(role).alias("player"))
            for role in ("passer", "receiver", "defender")
        ]
    )
    named = (
        events.select("event_id", "point_id", F.explode(roles).alias("named"))
        .select("event_id", "point_id", "named.role", "named.player")
        .filter(F.col("player").isNotNull())
    )
    return named.join(
        event_players.select("event_id", "player"), ["event_id", "player"], "left_anti"
    )


def run_checks(events: DataFrame, event_players: DataFrame, points: DataFrame) -> list[CheckResult]:
    checks = [
        ("results_contradicting_events", "error", results_contradicting_events(points)),
        ("points_without_result", "warn", points_without_result(points)),
        ("points_not_ending_in_score", "warn", points_not_ending_in_score(points)),
        ("players_not_in_lineup", "warn", players_not_in_lineup(events, event_players)),
    ]
    return [CheckResult(name, severity, df.count()) for name, severity, df in checks]
