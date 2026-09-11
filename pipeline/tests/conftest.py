import pytest
from builders import write_export
from pyspark.sql import SparkSession

from reign_pipeline.bronze import read_export


@pytest.fixture(scope="session")
def spark():
    # Transforms are plain DataFrame functions, so tests don't need Delta.
    session = (
        SparkSession.builder.master("local[1]")
        .appName("reign-pipeline-tests")
        .config("spark.sql.shuffle.partitions", "1")
        .config("spark.sql.session.timeZone", "UTC")
        .config("spark.ui.enabled", "false")
        .getOrCreate()
    )
    yield session
    session.stop()


@pytest.fixture
def load_export(spark, tmp_path):
    def _load(rows):
        return read_export(spark, str(write_export(rows, tmp_path / "export.csv")))

    return _load
