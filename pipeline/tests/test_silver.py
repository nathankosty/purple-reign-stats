import random

from builders import play, two_point_game

from reign_pipeline.silver import (
    build_event_players,
    build_events,
    build_games,
    build_point_players,
    build_points,
)


def test_events_drop_non_plays_and_order_by_game_clock(load_export):
    rows = two_point_game()
    random.Random(7).shuffle(rows)  # file order must not matter
    events = build_events(load_export(rows))

    got = [(r.action, r.event_idx) for r in events.orderBy("game_elapsed_s").collect()]
    assert got == [
        ("Catch", 1),
        ("Catch", 2),
        ("Goal", 3),
        ("Pull", 1),
        ("Throwaway", 2),
        ("Catch", 3),
        ("Throwaway", 4),
        ("Goal", 5),
    ]


def test_anonymous_and_blank_players_become_null(load_export):
    events = build_events(load_export(two_point_game()))
    catch = events.filter("game_elapsed_s = 120").first()
    assert (catch.passer, catch.receiver, catch.defender) == ("Ed", None, None)


def test_lineups_unpivot_to_one_row_per_player(load_export):
    event_players = build_event_players(load_export(two_point_game()))
    # 3 O-line events with 7 named players, 5 D-line events with 6 (one slot is Anonymous)
    assert event_players.count() == 3 * 7 + 5 * 6
    assert event_players.filter("player = 'Anonymous'").count() == 0

    lineups = build_point_players(event_players).groupBy("point_id").count()
    assert sorted(r["count"] for r in lineups.collect()) == [6, 7]


def test_point_result_comes_from_the_scoreboard(load_export):
    points = build_points(build_events(load_export(two_point_game())))
    by_number = {r.point_number: r for r in points.collect()}

    assert by_number[1].result == "scored"
    assert (by_number[1].line, by_number[1].n_events) == ("O", 3)
    assert by_number[2].result == "scored_against"
    assert (by_number[2].line, by_number[2].last_action) == ("D", "Goal")


def test_point_that_skips_a_score_has_no_result(load_export):
    # Stat keeper missed a point: score jumps from 0-0 straight to 2-0.
    rows = [play(elapsed=10, action="Goal", passer="Ann", receiver="Bo", ours=2, theirs=0)]
    [point] = build_points(build_events(load_export(rows))).collect()
    assert point.result is None


def test_games_roll_up_final_score(load_export):
    points = build_points(build_events(load_export(two_point_game())))
    [game] = build_games(points).collect()
    assert (game.our_final, game.their_final, game.n_points, game.result) == (1, 1, 2, "T")
