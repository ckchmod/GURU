from __future__ import annotations

import hashlib
import importlib.util
import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "parse-source-documents.py"
VALIDATOR = ROOT / "scripts" / "validate-graph-schemas.py"
FIXTURE = ROOT / "tests" / "fixtures" / "source-documents" / "synthetic-guideline-note.txt"
INVALID_GRAPH_FIXTURE = ROOT / "tests" / "fixtures" / "graph-provenance" / "recommendation-missing-source-span.json"


def load_parser_module():
    spec = importlib.util.spec_from_file_location("parse_source_documents", SCRIPT)
    assert spec is not None
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def run_parser(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )


def run_graph_validator(fixture: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(VALIDATOR), str(fixture)],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )


def test_parser_writes_source_document_and_spans_to_derived_paths(tmp_path: Path) -> None:
    source_document_dir = tmp_path / "resources" / "derived" / "source-documents"
    source_span_dir = tmp_path / "resources" / "derived" / "source-spans"
    combined_path = tmp_path / "combined.json"

    result = run_parser(
        str(FIXTURE),
        "--resource-id",
        "synthetic-resource-workbench-note",
        "--access-date",
        "2026-06-15",
        "--source-document-dir",
        str(source_document_dir),
        "--source-span-dir",
        str(source_span_dir),
        "--output",
        str(combined_path),
        "--extraction-timestamp",
        "2026-06-15T12:00:00Z",
    )

    assert result.returncode == 0, result.stderr
    assert "Parsed source document" in result.stdout
    payload = json.loads(combined_path.read_text(encoding="utf-8"))
    source_document = payload["source_document"]
    source_spans = payload["source_spans"]

    assert source_document["record_type"] == "source_document"
    assert source_document["resource_id"] == "synthetic-resource-workbench-note"
    assert source_document["document_id"].startswith("source-document.synthetic-resource-workbench-note.")
    assert source_document["access_date"] == "2026-06-15"
    assert source_document["status"] == "draft"
    assert source_document["source_checksum_sha256"] == hashlib.sha256(
        FIXTURE.read_text(encoding="utf-8").strip().encode("utf-8")
    ).hexdigest()
    assert len(source_spans) == 3
    assert source_document_dir.joinpath(f"{source_document['document_id']}.json").exists()
    assert source_span_dir.joinpath(f"{source_document['document_id']}.json").exists()

    for index, span in enumerate(source_spans, start=1):
        assert span["record_type"] == "source_span"
        assert span["resource_id"] == source_document["resource_id"]
        assert span["document_id"] == source_document["document_id"]
        assert span["source_document_id"] == source_document["document_id"]
        assert span["stable_locator"].startswith("section:")
        assert span["stable_locator"].endswith(f"paragraph:{index}")
        assert span["quoted_text"] == span["quoted_span"]
        assert span["excerpt_checksum"] == hashlib.sha256(span["quoted_text"].encode("utf-8")).hexdigest()
        assert span["checksum_sha256"] == span["excerpt_checksum"]
        assert span["extraction_timestamp"] == "2026-06-15T12:00:00Z"
        assert span["status"] == "draft"


def test_parser_validation_helper_rejects_tampered_span_checksum() -> None:
    parser_module = load_parser_module()
    payload = parser_module.parse_source_document(
        input_path=FIXTURE,
        resource_id="synthetic-resource-workbench-note",
        access_date="2026-06-15",
        title=None,
        source_url=None,
        extraction_timestamp="2026-06-15T12:00:00Z",
    )
    assert parser_module.validate_parser_output(payload) == []

    payload["source_spans"][0]["excerpt_checksum"] = "0" * 64

    errors = parser_module.validate_parser_output(payload)
    assert any("excerpt_checksum: does not match quoted_text" in error for error in errors)


def test_parser_validate_output_cli_accepts_generated_payload(tmp_path: Path) -> None:
    combined_path = tmp_path / "combined.json"
    parse_result = run_parser(
        str(FIXTURE),
        "--resource-id",
        "synthetic-resource-workbench-note",
        "--access-date",
        "2026-06-15",
        "--source-document-dir",
        str(tmp_path / "source-documents"),
        "--source-span-dir",
        str(tmp_path / "source-spans"),
        "--output",
        str(combined_path),
        "--extraction-timestamp",
        "2026-06-15T12:00:00Z",
    )
    assert parse_result.returncode == 0, parse_result.stderr

    validation_result = run_parser("--validate-output", str(combined_path))

    assert validation_result.returncode == 0, validation_result.stderr
    assert "Parser output validation passed" in validation_result.stdout


def test_claim_like_graph_record_without_source_span_ids_still_fails_validation() -> None:
    result = run_graph_validator(INVALID_GRAPH_FIXTURE)
    combined = result.stdout + result.stderr

    assert result.returncode != 0
    assert "source_span_ids" in combined
    assert "expected at least 1 item(s), got 0" in combined
