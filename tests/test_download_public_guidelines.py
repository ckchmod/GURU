from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "download-public-guidelines.py"
COMMITTED_ALL_PUBLIC_MANIFEST = ROOT / "resources" / "manifests" / "ahs-guru-public" / "manifest-20260615T000000Z-no-network-status.json"


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


def test_dry_run_all_public_plans_entire_corpus_without_network() -> None:
    result = run_downloader(
        "--corpus",
        "resources/registry/ahs-guru-public-corpus.json",
        "--all-public",
        "--dry-run",
    )

    assert result.returncode == 0, result.stderr
    assert "resource_count=198" in result.stdout
    assert "resource_id=ahs-guru-breast-br021-evidence-table" in result.stdout
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
    assert "Processed 2 resource(s): downloaded=2, failed=0" in result.stdout
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["manifest_version"] == "1.0.0"
    assert [row["resource_id"] for row in manifest["rows"]] == [
        "ahs-guru-breast-br005-adjuvant-rt-invasive-breast",
        "ahs-guru-central-nervous-system-cns014-management-of-brain-metastases",
    ]
    for row in manifest["rows"]:
        assert set(row) == {"file_path", "media_type", "resource_id", "retrieved_at", "status", "url", "byte_size", "sha256"}
        assert row["retrieved_at"] == "2026-06-15T00:00:00Z"
        assert row["media_type"] == "application/pdf"
        assert row["status"] == "downloaded"
        assert row["byte_size"] > 0
        assert len(row["sha256"]) == 64
        assert "failure_reason" not in row
        assert Path(row["file_path"]).exists()

    validation = run_downloader("--validate-manifest", str(manifest_path))

    assert validation.returncode == 0, validation.stderr
    assert "Manifest validation passed: 2 row(s), downloaded=2, failed=0" in validation.stdout


def test_fixture_acquisition_records_failure_reason_and_validates_mixed_manifest(tmp_path: Path) -> None:
    fixture_dir = tmp_path / "fixtures"
    raw_dir = tmp_path / "raw"
    manifest_path = tmp_path / "manifest.json"
    fixture_dir.mkdir()
    (
        fixture_dir / "if-hp-cancer-guide-br005-adjuvant-rt-invasive-breast.pdf"
    ).write_bytes(b"synthetic public guideline fixture A\nno clinical content\n")

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
    assert "Processed 2 resource(s): downloaded=1, failed=1" in result.stdout
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    rows = {row["resource_id"]: row for row in manifest["rows"]}
    downloaded = rows["ahs-guru-breast-br005-adjuvant-rt-invasive-breast"]
    failed = rows["ahs-guru-central-nervous-system-cns014-management-of-brain-metastases"]
    assert downloaded["status"] == "downloaded"
    assert len(downloaded["sha256"]) == 64
    assert downloaded["byte_size"] > 0
    assert failed["status"] == "failed"
    assert "local fixture not found" in failed["failure_reason"]
    assert failed["file_path"].endswith("if-hp-cancer-guide-cns014-management-of-brain-metastases.pdf")
    assert "sha256" not in failed
    assert "byte_size" not in failed

    validation = run_downloader("--validate-manifest", str(manifest_path))

    assert validation.returncode == 0, validation.stderr
    assert "Manifest validation passed: 2 row(s), downloaded=1, failed=1" in validation.stdout


def test_empty_fixture_file_is_accounted_as_failed_without_checksum_fields(tmp_path: Path) -> None:
    fixture_dir = tmp_path / "fixtures"
    raw_dir = tmp_path / "raw"
    manifest_path = tmp_path / "manifest.json"
    fixture_dir.mkdir()
    (
        fixture_dir / "if-hp-cancer-guide-br005-adjuvant-rt-invasive-breast.pdf"
    ).write_bytes(b"")

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
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    row = manifest["rows"][0]
    assert row["status"] == "failed"
    assert "downloaded file is empty" in row["failure_reason"]
    assert "byte_size" not in row
    assert "sha256" not in row


def test_validate_manifest_rejects_non_positive_download_size(tmp_path: Path) -> None:
    raw_path = tmp_path / "empty.pdf"
    raw_path.write_bytes(b"")
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "manifest_version": "1.0.0",
                "rows": [
                    {
                        "byte_size": 0,
                        "file_path": str(raw_path),
                        "media_type": "application/pdf",
                        "resource_id": "synthetic-empty-resource",
                        "retrieved_at": "2026-06-15T00:00:00Z",
                        "sha256": "0" * 64,
                        "status": "downloaded",
                        "url": "https://example.invalid/empty.pdf",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    validation = run_downloader("--validate-manifest", str(manifest_path))

    assert validation.returncode != 0
    assert "byte_size: expected positive integer" in validation.stderr


def test_validate_manifest_rejects_checksum_mismatch(tmp_path: Path) -> None:
    raw_path = tmp_path / "guideline.pdf"
    raw_path.write_bytes(b"synthetic public guideline fixture\nno clinical content\n")
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "manifest_version": "1.0.0",
                "rows": [
                    {
                        "byte_size": raw_path.stat().st_size,
                        "file_path": str(raw_path),
                        "media_type": "application/pdf",
                        "resource_id": "synthetic-checksum-resource",
                        "retrieved_at": "2026-06-15T00:00:00Z",
                        "sha256": "0" * 64,
                        "status": "downloaded",
                        "url": "https://example.invalid/guideline.pdf",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    validation = run_downloader("--validate-manifest", str(manifest_path))

    assert validation.returncode != 0
    assert "sha256: expected" in validation.stderr


def test_all_public_fixture_manifest_accounts_for_198_rows_without_network(tmp_path: Path) -> None:
    fixture_dir = tmp_path / "empty-fixtures"
    manifest_path = tmp_path / "manifest-all-public.json"
    fixture_dir.mkdir()

    result = run_downloader(
        "--corpus",
        "resources/registry/ahs-guru-public-corpus.json",
        "--all-public",
        "--fixture-dir",
        str(fixture_dir),
        "--manifest-path",
        str(manifest_path),
        "--retrieved-at",
        "2026-06-15T00:00:00Z",
    )

    assert result.returncode == 0, result.stderr
    assert "Processed 198 resource(s): downloaded=0, failed=198" in result.stdout
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["manifest_version"] == "1.0.0"
    assert len(manifest["rows"]) == 198
    assert len({row["resource_id"] for row in manifest["rows"]}) == 198
    for row in manifest["rows"]:
        assert set(row) == {"file_path", "media_type", "resource_id", "retrieved_at", "status", "url", "failure_reason"}
        assert row["status"] == "failed"
        assert row["retrieved_at"] == "2026-06-15T00:00:00Z"
        assert row["file_path"].startswith("resources/raw/ahs-guru-public/")
        assert "local fixture not found" in row["failure_reason"]

    validation = run_downloader("--validate-manifest", str(manifest_path))

    assert validation.returncode == 0, validation.stderr
    assert "Manifest validation passed: 198 row(s), downloaded=0, failed=198" in validation.stdout


def test_committed_all_public_status_manifest_accounts_for_198_rows_without_raw_pdfs() -> None:
    manifest = json.loads(COMMITTED_ALL_PUBLIC_MANIFEST.read_text(encoding="utf-8"))

    assert manifest["manifest_version"] == "1.0.0"
    assert len(manifest["rows"]) == 198
    assert len({row["resource_id"] for row in manifest["rows"]}) == 198
    for row in manifest["rows"]:
        assert set(row) == {"file_path", "media_type", "resource_id", "retrieved_at", "status", "url", "failure_reason"}
        assert row["status"] == "failed"
        assert row["retrieved_at"] == "2026-06-15T00:00:00Z"
        assert row["file_path"].startswith("resources/raw/ahs-guru-public/")
        assert row["url"]
        assert row["failure_reason"] == "no-network committed status artifact; raw PDF download not attempted"

    validation = run_downloader("--validate-manifest", str(COMMITTED_ALL_PUBLIC_MANIFEST))

    assert validation.returncode == 0, validation.stderr
    assert "Manifest validation passed: 198 row(s), downloaded=0, failed=198" in validation.stdout


def test_raw_public_pdfs_are_gitignored() -> None:
    result = subprocess.run(
        ["git", "check-ignore", "resources/raw/ahs-guru-public/example.pdf"],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "resources/raw/ahs-guru-public/example.pdf"


def test_missing_selected_id_exits_nonzero_with_clear_message(tmp_path: Path) -> None:
    selector_path = tmp_path / "selector.json"
    selector_path.write_text(json.dumps({"resource_ids": ["ahs-guru-missing-resource"]}), encoding="utf-8")

    result = run_downloader("--selector", str(selector_path), "--dry-run")

    assert result.returncode != 0
    assert "missing from corpus rows" in result.stderr
