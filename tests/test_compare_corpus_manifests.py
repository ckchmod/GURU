from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "compare-corpus-manifests.py"
FIXTURES = ROOT / "tests" / "fixtures" / "manifests"


def run_compare(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )


def diff_by_id(payload: dict[str, object]) -> dict[str, dict[str, object]]:
    diffs = payload["diffs"]
    assert isinstance(diffs, list)
    return {str(diff["resource_id"]): diff for diff in diffs if isinstance(diff, dict)}


def test_compare_manifest_snapshots_emits_required_change_states() -> None:
    result = run_compare(
        "tests/fixtures/manifests/surveillance-previous.json",
        "tests/fixtures/manifests/surveillance-current.json",
    )

    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    rows = diff_by_id(payload)
    assert list(rows) == sorted(rows)
    assert payload["summary"] == {
        "changed": 1,
        "checksum_mismatch": 1,
        "missing": 1,
        "resource_added": 1,
        "resource_removed": 1,
        "unchanged": 1,
    }

    unchanged = rows["fixture-unchanged-resource"]
    assert unchanged["previous_status"] == "downloaded"
    assert unchanged["previous_checksum"] == "4444444444444444444444444444444444444444444444444444444444444444"
    assert unchanged["current_status"] == "downloaded"
    assert unchanged["current_checksum"] == "4444444444444444444444444444444444444444444444444444444444444444"
    assert unchanged["change_state"] == "unchanged"
    assert unchanged["review_status"] == "no_change"

    changed = rows["fixture-changed-status"]
    assert changed["previous_status"] == "failed"
    assert changed["previous_checksum"] is None
    assert changed["current_status"] == "downloaded"
    assert changed["current_checksum"] == "6666666666666666666666666666666666666666666666666666666666666666"
    assert changed["change_state"] == "changed"
    assert changed["review_status"] == "needs_review"

    checksum = rows["fixture-checksum-changed"]
    assert checksum["change_state"] == "checksum_mismatch"
    assert checksum["previous_checksum"] == "1111111111111111111111111111111111111111111111111111111111111111"
    assert checksum["current_checksum"] == "7777777777777777777777777777777777777777777777777777777777777777"
    assert checksum["review_status"] == "needs_review"

    missing = rows["fixture-missing-resource"]
    assert missing["previous_status"] == "downloaded"
    assert missing["current_status"] == "failed"
    assert missing["current_checksum"] is None
    assert missing["change_state"] == "missing"
    assert missing["review_status"] == "needs_review"

    added = rows["fixture-added-resource"]
    assert added["previous_status"] is None
    assert added["current_status"] == "downloaded"
    assert added["change_state"] == "resource_added"
    assert added["review_status"] == "needs_review"

    removed = rows["fixture-removed-resource"]
    assert removed["previous_status"] == "downloaded"
    assert removed["current_status"] is None
    assert removed["change_state"] == "resource_removed"
    assert removed["review_status"] == "needs_review"


def test_compare_manifest_snapshots_can_write_output_file(tmp_path: Path) -> None:
    output_path = tmp_path / "diff.json"

    result = run_compare(
        str(FIXTURES / "surveillance-previous.json"),
        str(FIXTURES / "surveillance-current.json"),
        "--output",
        str(output_path),
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout == ""
    payload = json.loads(output_path.read_text(encoding="utf-8"))
    assert payload["comparison_version"] == "1.0.0"
    assert len(payload["diffs"]) == 6


def test_compare_manifest_rejects_malformed_manifest_with_clear_error() -> None:
    result = run_compare(
        "tests/fixtures/manifests/malformed-missing-resource-id.json",
        "tests/fixtures/manifests/surveillance-current.json",
    )

    assert result.returncode != 0
    assert "resource_id: expected non-empty string" in result.stderr
