import pytest
from builders import two_point_game

from reign_pipeline.bronze import read_export, to_snake


def test_to_snake():
    assert to_snake("Our Score - End of Point") == "our_score_end_of_point"
    assert to_snake("Hang Time (secs)") == "hang_time_secs"
    assert to_snake("Date/Time") == "date_time"


def test_columns_renamed_but_values_left_as_strings(load_export):
    bronze = load_export(two_point_game())
    types = dict(bronze.dtypes)
    assert types["tournamemnt"] == "string"
    assert types["our_score_end_of_point"] == "string"
    assert bronze.first()["_source_file"].endswith("export.csv")


def test_ingest_row_follows_file_order(load_export):
    rows = two_point_game()
    bronze = load_export(rows)
    got = [r.elapsed_time_secs for r in bronze.orderBy("_ingest_row").collect()]
    assert got == [str(r["Elapsed Time (secs)"]) for r in rows]


def test_missing_columns_fail_loudly(spark, tmp_path):
    path = tmp_path / "renamed_upstream.csv"
    path.write_text("Date/Time,Opponent\n2026-03-21 09:00,Mankato\n")
    with pytest.raises(ValueError, match="Tournamemnt"):
        read_export(spark, str(path))
