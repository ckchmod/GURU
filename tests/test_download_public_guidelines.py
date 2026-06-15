from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "download-public-guidelines.py"


def run_downloader(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )


def test_dry_run_plans_bounded_pilot_without_network() -> None:
    result = run_downloader("--dry-run")

    assert result.returncode == 0, result.stderr
    assert "resource_count=2" in result.stdout
    assert "resource_id=ahs-guru-breast-br005-adjuvant-rt-invasive-breast" in result.stdout
    assert "resource_id=ahs-guru-central-nervous-system-cns014-management-of-brain-metastases" in result.stdout
    assert "resources/raw/ahs-guru-public" in result.stdout


def test_local_fixture_acquisition_writes_and_validates_manifest(tmp_path: Path) -> None:
    fixture_dir = tmp_path / "fixtures"
    raw_dir = tmp_path / "raw"
    manifest_path = tmp_path / "manifest.json"
    fixture_dir.mkdir()
    (
        fixture_dir / "if-hp-cancer-guide-br005-adjuvant-rt-invasive-breast.pdf"
    ).write_bytes(b"synthetic public guideline fixture A\nno clinical content\n")
    (
        fixture_dir / "if-hp-cancer-guide-cns014-management-of-brain-metastases.pdf"
    ).write_bytes(b"synthetic public guideline fixture B\nno clinical content\n")

    result = run_downloader(
        "--fixture-dir",
        str(fixture_dir),
        "--raw-dir",
        str(raw_dir),
        "--manifest-path",
        str(manifest_path),
        "--retrieved-at",
        "2026-06-15T00:00:00Z",
    )

    assert result.returncode == 0, result.stderr
    assert "Downloaded 2 resource(s)" in result.stdout
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["manifest_version"] == "1.0.0"
    assert [row["resource_id"] for row in manifest["rows"]] == [
        "ahs-guru-breast-br005-adjuvant-rt-invasive-breast",
        "ahs-guru-central-nervous-system-cns014-management-of-brain-metastases",
    ]
    for row in manifest["rows"]:
        assert row["retrieved_at"] == "2026-06-15T00:00:00Z"
        assert row["media_type"] == "application/pdf"
        assert row["byte_size"] > 0
        assert len(row["sha256"]) == 64
        assert Path(row["file_path"]).exists()

    validation = run_downloader("--validate-manifest", str(manifest_path))

    assert validation.returncode == 0, validation.stderr
    assert "Manifest validation passed: 2 row(s)" in validation.stdout


def test_missing_selected_id_exits_nonzero_with_clear_message(tmp_path: Path) -> None:
    selector_path = tmp_path / "selector.json"
    selector_path.write_text(json.dumps({"resource_ids": ["ahs-guru-missing-resource"]}), encoding="utf-8")

    result = run_downloader("--selector", str(selector_path), "--dry-run")

    assert result.returncode != 0
    assert "missing from corpus rows" in result.stderr
