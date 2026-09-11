from builders import play, two_point_game

from reign_pipeline.quality import (
    players_not_in_lineup,
    points_not_ending_in_score,
    points_without_result,
    results_contradicting_events,
    run_checks,
)
from reign_pipeline.silver import build_event_players, build_events, build_points


def silver_tables(load_export, rows):
    bronze = load_export(rows)
    events = build_events(bronze)
    return events, build_event_players(bronze), build_points(events)


def test_clean_game_passes_every_check(load_export):
    results = run_checks(*silver_tables(load_export, two_point_game()))
    assert [r.failures for r in results] == [0] * len(results)


def test_thrown_callahan_is_a_point_against(load_export):
    rows = [play(elapsed=10, action="Callahan", passer="Ann", ours=0, theirs=1)]
    _, _, points = silver_tables(load_export, rows)
    assert points.first().result == "scored_against"
    assert results_contradicting_events(points).count() == 0


def test_scoreboard_contradicting_last_event_is_caught(load_export):
    # Log says we scored, scoreboard says they did.
    rows = [play(elapsed=10, action="Goal", passer="Ann", receiver="Bo", ours=0, theirs=1)]
    _, _, points = silver_tables(load_export, rows)
    assert results_contradicting_events(points).count() == 1


def test_point_cut_off_before_anyone_scores(load_export):
    unfinished = play(
        elapsed=200, action="Throwaway", event_type="Defense", ours=1, theirs=1, point_s=30
    )
    _, _, points = silver_tables(load_export, two_point_game() + [unfinished])
    assert points_without_result(points).count() == 1
    assert points_not_ending_in_score(points).count() == 1


def test_passer_missing_from_lineup(load_export):
    rows = [
        play(elapsed=10, action="Catch", passer="Zed", receiver="Ann"),
        play(elapsed=20, action="Goal", passer="Ann", receiver="Bo"),
    ]
    events, event_players, _ = silver_tables(load_export, rows)
    [row] = players_not_in_lineup(events, event_players).collect()
    assert (row.role, row.player) == ("passer", "Zed")
