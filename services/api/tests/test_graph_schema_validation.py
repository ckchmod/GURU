"""Smoke tests for the graph/provenance seed schema validator.

These tests use only synthetic fixtures and never import real guideline content.
"""

import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
VALIDATOR = ROOT / "scripts" / "validate-graph-schemas.py"
VALID_FIXTURE = ROOT / "tests" / "fixtures" / "graph-provenance" / "synthetic-graph.json"
INVALID_FIXTURE = ROOT / "tests" / "fixtures" / "graph-provenance" / "recommendation-missing-source-span.json"


def run_validator(fixture: Path) -> tuple[int, str, str]:
    result = subprocess.run(
        [sys.executable, str(VALIDATOR), str(fixture)],
        capture_output=True,
        text=True,
    )
    return result.returncode, result.stdout, result.stderr


def test_synthetic_graph_passes_validation() -> None:
    code, stdout, stderr = run_validator(VALID_FIXTURE)
    combined = stdout + stderr
    assert code == 0, f"Expected exit 0, got {code}. Output:\n{combined}"
    assert "Validation passed" in combined


def test_recommendation_missing_source_span_fails_validation() -> None:
    code, stdout, stderr = run_validator(INVALID_FIXTURE)
    combined = stdout + stderr
    assert code != 0, f"Expected non-zero exit, got {code}. Output:\n{combined}"
    assert "source_span_ids" in combined
    assert "expected at least 1 item(s), got 0" in combined
