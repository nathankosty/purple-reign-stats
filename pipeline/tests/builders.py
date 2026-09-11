"""Hand-built export rows, so each test states exactly the game it's about."""

import csv
from pathlib import Path

from reign_pipeline.bronze import EXPORT_COLUMNS

O_LINE = ["Ann", "Bo", "Cy", "Di", "Ed", "Flo", "Gus"]
D_LINE = ["Di", "Ed", "Flo", "Gus", "Hal", "Ivy", "Anonymous"]


def play(
    *,
    elapsed: int,
    action: str,
    event_type: str = "Offense",
    passer: str = "",
    receiver: str = "",
    defender: str = "",
    ours: int = 1,
    theirs: int = 0,
    point_s: int = 45,
    line: str = "O",
    lineup: list[str] = O_LINE,
    date: str = "2026-03-21 09:00",
    opponent: str = "Mankato",
    tournament: str = "Meltdown 2026",
) -> dict[str, object]:
    row: dict[str, object] = dict.fromkeys(EXPORT_COLUMNS, "")
    row.update(
        {
            "Date/Time": date,
            "Tournamemnt": tournament,
            "Opponent": opponent,
            "Point Elapsed Seconds": point_s,
            "Line": line,
            "Our Score - End of Point": ours,
            "Their Score - End of Point": theirs,
            "Event Type": event_type,
            "Action": action,
            "Passer": passer,
            "Receiver": receiver,
            "Defender": defender,
            "Elapsed Time (secs)": elapsed,
        }
    )
    for i, name in enumerate(lineup):
        row[f"Player {i}"] = name
    return row


def two_point_game() -> list[dict[str, object]]:
    """We hold on O (1-0), get broken on D (1-1), then a halftime row that isn't a play."""
    d_point = {"ours": 1, "theirs": 1, "point_s": 70, "line": "D", "lineup": D_LINE}
    return [
        play(elapsed=10, action="Catch", passer="Ann", receiver="Bo"),
        play(elapsed=20, action="Catch", passer="Bo", receiver="Cy"),
        play(elapsed=30, action="Goal", passer="Cy", receiver="Ann"),
        play(elapsed=100, action="Pull", event_type="Defense", defender="Di", **d_point),
        play(
            elapsed=110, action="Throwaway", event_type="Defense", defender="Anonymous", **d_point
        ),
        play(elapsed=120, action="Catch", passer="Ed", receiver="Anonymous", **d_point),
        play(elapsed=130, action="Throwaway", passer="Ed", **d_point),
        play(elapsed=140, action="Goal", event_type="Defense", **d_point),
        play(elapsed=150, action="Halftime", event_type="Cessation", ours=1, theirs=1, point_s=0),
    ]


def write_export(rows: list[dict[str, object]], path: Path) -> Path:
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=EXPORT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    return path
