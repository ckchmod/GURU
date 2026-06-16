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
SAFETY_VALIDATOR = ROOT / "scripts" / "validate-safety-boundaries.py"
FIXTURE = ROOT / "tests" / "fixtures" / "source-documents" / "synthetic-guideline-note.txt"
INVALID_GRAPH_FIXTURE = ROOT / "tests" / "fixtures" / "graph-provenance" / "recommendation-missing-source-span.json"
PARSE_SUBSET = ROOT / "resources" / "registry" / "ahs-guru-parse-subset.json"
PUBLIC_CORPUS = ROOT / "resources" / "registry" / "ahs-guru-public-corpus.json"
PUBLIC_MANIFEST = ROOT / "resources" / "manifests" / "ahs-guru-public" / "manifest-20260616T053200Z.json"


def load_parser_module():
    spec = importlib.util.spec_from_file_location("parse_source_documents", SCRIPT)
    assert spec is not None
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def load_safety_module():
    spec = importlib.util.spec_from_file_location("validate_safety_boundaries", SAFETY_VALIDATOR)
    assert spec is not None
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[spec.name] = module
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


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def manifest_row(resource_id: str, file_path: Path, payload: bytes, **overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
        "resource_id": resource_id,
        "url": f"https://example.invalid/{resource_id}.pdf",
        "retrieved_at": "2026-06-16T05:32:00Z",
        "file_path": str(file_path),
        "media_type": "application/pdf",
        "status": "downloaded",
        "byte_size": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
    }
    row.update(overrides)
    return row


def corpus_row(resource_id: str) -> dict[str, str]:
    return {
        "resource_id": resource_id,
        "title": f"Synthetic {resource_id}",
        "source_url_or_access_path": f"https://example.invalid/{resource_id}.pdf",
        "access_date": "2026-06-15",
    }


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
    assert source_document["source_document_id"] == source_document["document_id"]
    assert source_document["access_date"] == "2026-06-15"
    assert source_document["timestamp"] == "2026-06-15T12:00:00Z"
    assert source_document["status"] == "draft"
    assert source_document["output_status"] == "draft"
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
        assert span["prompt_or_model_version"] == "none-local-deterministic-parser"
        assert span["reviewer"] == "unreviewed"
        assert span["review_status"] == "draft"
        assert span["extraction_timestamp"] == "2026-06-15T12:00:00Z"
        assert span["timestamp"] == "2026-06-15T12:00:00Z"
        assert span["status"] == "draft"
        assert span["output_status"] == "draft"


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
    assert any("excerpt_checksum: does not match quoted_span" in error for error in errors)


def test_pdf_parser_emits_page_source_spans_with_checksums(tmp_path: Path) -> None:
    parser_module = load_parser_module()
    pdf_path = tmp_path / "synthetic.pdf"
    pdf_path.write_bytes(b"%PDF synthetic safe fixture")

    def stub_extract_pdf_pages(input_path: Path) -> tuple[list[str | None], list[str]]:
        assert input_path == pdf_path
        return ["Synthetic page one.\n\nSecond bounded paragraph.", "Synthetic page two."], []

    parser_module.extract_pdf_pages = stub_extract_pdf_pages
    payload = parser_module.parse_pdf_source_document(
        input_path=pdf_path,
        resource_id="synthetic-pdf-resource",
        access_date="2026-06-15",
        title="Synthetic PDF Resource",
        source_url="https://example.invalid/synthetic.pdf",
        extraction_timestamp="2026-06-15T12:00:00Z",
    )

    assert parser_module.validate_parser_output(payload) == []
    source_document = payload["source_document"]
    source_spans = payload["source_spans"]
    source_pdf_checksum = hashlib.sha256(pdf_path.read_bytes()).hexdigest()

    assert source_document["parse_status"] == "parsed"
    assert source_document["source_checksum_sha256"] == source_pdf_checksum
    assert len(source_spans) == 3
    assert source_spans[0]["source_pdf_checksum_sha256"] == source_pdf_checksum
    assert source_spans[0]["page_number"] == 1
    assert source_spans[0]["stable_locator"] == "page:1;span:1"
    assert source_spans[0]["bounded_excerpt"] == "Synthetic page one."
    assert source_spans[0]["excerpt_checksum"] == hashlib.sha256(b"Synthetic page one.").hexdigest()
    assert source_spans[0]["parser_version"] == parser_module.PDF_PARSER_VERSION
    assert source_spans[0]["prompt_or_model_version"] == "none-local-deterministic-parser"
    assert source_spans[0]["reviewer"] == "unreviewed"
    assert source_spans[0]["review_status"] == "draft"
    assert source_spans[0]["output_status"] == "draft"
    assert source_spans[0]["parse_warnings"] == []


def test_pdf_parser_sanitizes_control_characters_before_checksum(tmp_path: Path) -> None:
    parser_module = load_parser_module()
    pdf_path = tmp_path / "control-character.pdf"
    pdf_path.write_bytes(b"%PDF control character fixture")

    def stub_extract_pdf_pages(input_path: Path) -> tuple[list[str | None], list[str]]:
        assert input_path == pdf_path
        return ["Visible\x00text\n\nSecond\x1fspan"], []

    parser_module.extract_pdf_pages = stub_extract_pdf_pages
    payload = parser_module.parse_pdf_source_document(
        input_path=pdf_path,
        resource_id="control-character-resource",
        access_date="2026-06-15",
        title="Control Character Resource",
        source_url=None,
        extraction_timestamp="2026-06-15T12:00:00Z",
    )

    assert parser_module.validate_parser_output(payload) == []
    source_spans = payload["source_spans"]

    assert [span["quoted_span"] for span in source_spans] == ["Visible text", "Second span"]
    for span in source_spans:
        assert "\x00" not in span["quoted_span"]
        assert "\x1f" not in span["quoted_span"]
        assert span["quoted_text"] == span["quoted_span"]
        assert span["bounded_excerpt"] == span["quoted_span"]
        assert span["excerpt_checksum"] == hashlib.sha256(span["quoted_span"].encode("utf-8")).hexdigest()


def test_safety_validator_accepts_canonical_derived_provenance_and_rejects_tampering(tmp_path: Path) -> None:
    safety_module = load_safety_module()
    source_document_dir = tmp_path / "source-documents"
    source_span_dir = tmp_path / "source-spans"
    output_path = tmp_path / "combined.json"

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
        str(output_path),
        "--extraction-timestamp",
        "2026-06-15T12:00:00Z",
    )
    assert result.returncode == 0, result.stderr

    safety_module.DERIVED_SOURCE_DOCUMENT_DIR = source_document_dir
    safety_module.DERIVED_SOURCE_SPAN_DIR = source_span_dir
    safety_module.parse_subset_resource_ids = lambda: {"synthetic-resource-workbench-note"}
    safety_module.validated_all_public_manifest_ids = lambda: set()

    assert safety_module.validate_derived_source_provenance() == []

    span_path = next(source_span_dir.glob("*.json"))
    spans = json.loads(span_path.read_text(encoding="utf-8"))
    del spans[0]["reviewer"]
    spans[1]["excerpt_checksum"] = "0" * 64
    spans[2]["span_id"] = spans[1]["span_id"]
    write_json(span_path, spans)

    errors = safety_module.validate_derived_source_provenance()

    assert any("missing canonical fields ['reviewer']" in error for error in errors)
    assert any("excerpt_checksum does not match quoted_span" in error for error in errors)
    assert any("duplicate span_id" in error for error in errors)


def test_safety_validator_rejects_unsafe_resource_id_and_control_escaping(tmp_path: Path) -> None:
    safety_module = load_safety_module()
    source_document_dir = tmp_path / "source-documents"
    source_span_dir = tmp_path / "source-spans"
    source_document_dir.mkdir()
    source_span_dir.mkdir()
    document_id = "source-document.unsafe-resource.synthetic.abc123"
    span_id = f"source-span.{document_id}.p0001"
    quoted_span = "Safe visible text\x00"

    write_json(
        source_document_dir / f"{document_id}.json",
        {
            "record_type": "source_document",
            "resource_id": "unsafe-resource",
            "document_id": document_id,
            "source_document_id": document_id,
            "access_date": "2026-06-15",
            "parse_status": "parsed",
            "parser_version": "source-document-pdf-parser-v1",
            "timestamp": "2026-06-15T12:00:00Z",
            "output_status": "draft",
        },
    )
    write_json(
        source_span_dir / f"{document_id}.json",
        [
            {
                "record_type": "source_span",
                "span_id": span_id,
                "resource_id": "unsafe-resource",
                "document_id": document_id,
                "source_document_id": document_id,
                "access_date": "2026-06-15",
                "stable_locator": "section:synthetic;paragraph:1",
                "quoted_span": quoted_span,
                "excerpt_checksum": hashlib.sha256(quoted_span.encode("utf-8")).hexdigest(),
                "prompt_or_model_version": "none-local-deterministic-parser",
                "reviewer": "unreviewed",
                "review_status": "draft",
                "timestamp": "2026-06-15T12:00:00Z",
                "output_status": "draft",
            }
        ],
    )

    safety_module.DERIVED_SOURCE_DOCUMENT_DIR = source_document_dir
    safety_module.DERIVED_SOURCE_SPAN_DIR = source_span_dir
    safety_module.parse_subset_resource_ids = lambda: {"allowed-resource"}
    safety_module.validated_all_public_manifest_ids = lambda: set()

    errors = safety_module.validate_derived_source_provenance()

    assert any("unsafe resource_id outside parse subset" in error for error in errors)
    assert any("quoted_span must be a safe string" in error for error in errors)


def test_pdf_parser_records_missing_empty_partial_encrypted_and_failed_cases(tmp_path: Path) -> None:
    parser_module = load_parser_module()
    existing_pdf = tmp_path / "synthetic.pdf"
    existing_pdf.write_bytes(b"%PDF synthetic safe fixture")

    def parse_with_pages(pages: list[str | None], warnings: list[str]) -> dict[str, object]:
        parser_module.extract_pdf_pages = lambda _path: (pages, warnings)
        return parser_module.parse_pdf_source_document(
            input_path=existing_pdf,
            resource_id="synthetic-pdf-resource",
            access_date="2026-06-15",
            title="Synthetic PDF Resource",
            source_url=None,
            extraction_timestamp="2026-06-15T12:00:00Z",
        )

    missing = parser_module.parse_pdf_source_document(
        input_path=tmp_path / "missing.pdf",
        resource_id="synthetic-missing-resource",
        access_date="2026-06-15",
        title="Synthetic Missing Resource",
        source_url=None,
        extraction_timestamp="2026-06-15T12:00:00Z",
    )
    empty = parse_with_pages(["", "   "], [])
    partial = parse_with_pages(["Extracted safe text.", None], ["page:2:extract_text_failed:ValueError"])
    encrypted = parse_with_pages([], ["encrypted_pdf"])
    parser_module.extract_pdf_pages = lambda _path: (_ for _ in ()).throw(RuntimeError("broken pdf"))
    failed = parser_module.parse_pdf_source_document(
        input_path=existing_pdf,
        resource_id="synthetic-failed-resource",
        access_date="2026-06-15",
        title="Synthetic Failed Resource",
        source_url=None,
        extraction_timestamp="2026-06-15T12:00:00Z",
    )

    assert missing["source_document"]["parse_status"] == "download_missing"
    assert empty["source_document"]["parse_status"] == "empty_text"
    assert partial["source_document"]["parse_status"] == "partial_text"
    assert encrypted["source_document"]["parse_status"] == "encrypted"
    assert failed["source_document"]["parse_status"] == "parse_failed"
    for payload in (missing, empty, partial, encrypted, failed):
        assert parser_module.validate_parser_output(payload) == []


def test_pdf_parser_filters_unsafe_extracted_spans_but_keeps_safe_spans(tmp_path: Path) -> None:
    parser_module = load_parser_module()
    pdf_path = tmp_path / "mixed-safety.pdf"
    pdf_path.write_bytes(b"%PDF mixed safety fixture")

    def stub_extract_pdf_pages(input_path: Path) -> tuple[list[str | None], list[str]]:
        assert input_path == pdf_path
        return ["Stable public guideline summary.\n\nPhone Number"], []

    parser_module.extract_pdf_pages = stub_extract_pdf_pages
    payload = parser_module.parse_pdf_source_document(
        input_path=pdf_path,
        resource_id="mixed-safety-resource",
        access_date="2026-06-15",
        title="Mixed Safety Resource",
        source_url=None,
        extraction_timestamp="2026-06-15T12:00:00Z",
    )

    assert parser_module.validate_parser_output(payload) == []
    assert payload["source_document"]["parse_status"] == "partial_text"
    assert payload["source_document"]["parse_warnings"] == ["safety_filtered_spans:1"]
    assert [span["quoted_text"] for span in payload["source_spans"]] == ["Stable public guideline summary."]


def test_pdf_parser_fails_closed_when_safety_filter_removes_all_spans(tmp_path: Path) -> None:
    parser_module = load_parser_module()
    pdf_path = tmp_path / "unsafe-only.pdf"
    pdf_path.write_bytes(b"%PDF unsafe only fixture")

    def stub_extract_pdf_pages(input_path: Path) -> tuple[list[str | None], list[str]]:
        assert input_path == pdf_path
        return ["Patient Name"], []

    parser_module.extract_pdf_pages = stub_extract_pdf_pages
    payload = parser_module.parse_pdf_source_document(
        input_path=pdf_path,
        resource_id="unsafe-only-resource",
        access_date="2026-06-15",
        title="Unsafe Only Resource",
        source_url=None,
        extraction_timestamp="2026-06-15T12:00:00Z",
    )

    assert parser_module.validate_parser_output(payload) == []
    assert payload["source_document"]["parse_status"] == "parse_failed"
    assert payload["source_document"]["parse_warnings"] == ["safety_filtered_spans:1", "safety_filter_no_safe_spans"]
    assert payload["source_spans"] == []


def test_pdf_parser_allows_official_guru_email_in_extracted_spans(tmp_path: Path) -> None:
    parser_module = load_parser_module()
    pdf_path = tmp_path / "official-email.pdf"
    pdf_path.write_bytes(b"%PDF official email fixture")

    def stub_extract_pdf_pages(input_path: Path) -> tuple[list[str | None], list[str]]:
        assert input_path == pdf_path
        return ["Guideline Resource Unit guru@ahs.ca"], []

    parser_module.extract_pdf_pages = stub_extract_pdf_pages
    payload = parser_module.parse_pdf_source_document(
        input_path=pdf_path,
        resource_id="official-email-resource",
        access_date="2026-06-15",
        title="Official Email Resource",
        source_url=None,
        extraction_timestamp="2026-06-15T12:00:00Z",
    )

    assert parser_module.validate_parser_output(payload) == []
    assert payload["source_document"]["parse_status"] == "parsed"
    assert payload["source_document"]["parse_warnings"] == []
    assert len(payload["source_spans"]) == 1


def test_manifest_parser_status_vocabulary_is_plan_limited() -> None:
    parser_module = load_parser_module()

    assert parser_module.PARSE_STATUSES == {
        "parsed",
        "partial_text",
        "download_missing",
        "checksum_mismatch",
        "encrypted",
        "empty_text",
        "parse_failed",
    }


def test_manifest_parser_emits_all_plan_statuses_and_is_idempotent(tmp_path: Path) -> None:
    parser_module = load_parser_module()
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()
    source_document_dir = tmp_path / "source-documents"
    source_span_dir = tmp_path / "source-spans"
    output_path = tmp_path / "manifest-output.json"
    manifest_path = tmp_path / "manifest.json"
    corpus_path = tmp_path / "corpus.json"

    payloads = {
        "parsed": b"%PDF parsed",
        "partial": b"%PDF partial",
        "encrypted": b"%PDF encrypted",
        "empty": b"%PDF empty",
        "parse-failed": b"%PDF parse failed",
        "zero-byte": b"",
        "checksum-mismatch": b"%PDF checksum mismatch",
        "unsupported-media": b"<html>not a pdf</html>",
    }
    paths = {resource_id: raw_dir / f"{resource_id}.pdf" for resource_id in payloads}
    for resource_id, payload in payloads.items():
        paths[resource_id].write_bytes(payload)

    missing_path = raw_dir / "missing.pdf"
    failed_path = raw_dir / "failed.pdf"
    rows = [
        manifest_row("parsed", paths["parsed"], payloads["parsed"]),
        manifest_row("partial", paths["partial"], payloads["partial"]),
        manifest_row("encrypted", paths["encrypted"], payloads["encrypted"]),
        manifest_row("empty", paths["empty"], payloads["empty"]),
        manifest_row("parse-failed", paths["parse-failed"], payloads["parse-failed"]),
        manifest_row("missing", missing_path, b"missing"),
        manifest_row("zero-byte", paths["zero-byte"], payloads["zero-byte"], byte_size=0),
        manifest_row("checksum-mismatch", paths["checksum-mismatch"], payloads["checksum-mismatch"], sha256="f" * 64),
        manifest_row("unsupported-media", paths["unsupported-media"], payloads["unsupported-media"], media_type="text/html"),
        {
            "resource_id": "failed",
            "url": "mailto:GURU@ahs.ca",
            "retrieved_at": "2026-06-16T05:32:00Z",
            "file_path": str(failed_path),
            "media_type": "application/pdf",
            "status": "failed",
            "failure_reason": "<urlopen error unknown url type: mailto>",
        },
    ]
    write_json(manifest_path, {"manifest_version": "1.0.0", "rows": rows})
    write_json(corpus_path, {"rows": [corpus_row(str(row["resource_id"])) for row in rows]})

    def stub_extract_pdf_pages(input_path: Path) -> tuple[list[str | None], list[str]]:
        if input_path == paths["parsed"]:
            return ["Stable safe parser text."], []
        if input_path == paths["partial"]:
            return ["Stable partial safe text.", ""], []
        if input_path == paths["encrypted"]:
            return [], ["encrypted_pdf"]
        if input_path == paths["empty"]:
            return ["", "   "], []
        if input_path == paths["parse-failed"]:
            raise RuntimeError("synthetic parser failure")
        raise AssertionError(f"unexpected parse attempt for {input_path}")

    parser_module.extract_pdf_pages = stub_extract_pdf_pages
    first_result = parser_module.parse_manifest_corpus(
        manifest_path=manifest_path,
        corpus_path=corpus_path,
        source_document_dir=source_document_dir,
        source_span_dir=source_span_dir,
        extraction_timestamp="2026-06-16T06:00:00Z",
        output_path=output_path,
    )
    first_payload = json.loads(output_path.read_text(encoding="utf-8"))
    first_document_ids = [record["document_id"] for record in first_payload["source_documents"]]
    first_span_ids = [record["span_id"] for record in first_payload["source_spans"]]

    second_result = parser_module.parse_manifest_corpus(
        manifest_path=manifest_path,
        corpus_path=corpus_path,
        source_document_dir=source_document_dir,
        source_span_dir=source_span_dir,
        extraction_timestamp="2026-06-16T06:00:00Z",
        output_path=output_path,
    )
    second_payload = json.loads(output_path.read_text(encoding="utf-8"))

    assert first_result == 0
    assert second_result == 0
    assert [record["parse_status"] for record in first_payload["source_documents"]] == [
        "parsed",
        "partial_text",
        "encrypted",
        "empty_text",
        "parse_failed",
        "download_missing",
        "download_missing",
        "checksum_mismatch",
        "parse_failed",
        "download_missing",
    ]
    assert first_document_ids == [record["document_id"] for record in second_payload["source_documents"]]
    assert first_span_ids == [record["span_id"] for record in second_payload["source_spans"]]
    assert len(first_document_ids) == len(set(first_document_ids)) == len(rows)
    assert len(first_span_ids) == len(set(first_span_ids)) == 2
    assert len(list(source_document_dir.glob("*.json"))) == len(rows)
    assert len(list(source_span_dir.glob("*.json"))) == len(rows)
    for record in first_payload["source_documents"]:
        if record["parse_status"] not in {"parsed", "partial_text"}:
            document_spans = [span for span in first_payload["source_spans"] if span["document_id"] == record["document_id"]]
            assert document_spans == []


def test_manifest_parser_rejects_missing_corpus_resource_before_writes(tmp_path: Path, capsys) -> None:
    parser_module = load_parser_module()
    manifest_path = tmp_path / "manifest.json"
    corpus_path = tmp_path / "corpus.json"
    output_path = tmp_path / "manifest-output.json"
    source_document_dir = tmp_path / "source-documents"
    source_span_dir = tmp_path / "source-spans"

    write_json(
        manifest_path,
        {
            "manifest_version": "1.0.0",
            "rows": [manifest_row("accounted", tmp_path / "accounted.pdf", b"", status="failed")],
        },
    )
    write_json(corpus_path, {"rows": [corpus_row("accounted"), corpus_row("missing-from-manifest")]})

    result = parser_module.parse_manifest_corpus(
        manifest_path=manifest_path,
        corpus_path=corpus_path,
        source_document_dir=source_document_dir,
        source_span_dir=source_span_dir,
        extraction_timestamp="2026-06-16T06:00:00Z",
        output_path=output_path,
    )

    assert result == 1
    assert "missing manifest resource_id" in capsys.readouterr().err
    assert not output_path.exists()
    assert not list(source_document_dir.glob("*.json"))
    assert not list(source_span_dir.glob("*.json"))


def test_manifest_parser_rejects_extra_manifest_resource_before_writes(tmp_path: Path, capsys) -> None:
    parser_module = load_parser_module()
    manifest_path = tmp_path / "manifest.json"
    corpus_path = tmp_path / "corpus.json"
    output_path = tmp_path / "manifest-output.json"
    source_document_dir = tmp_path / "source-documents"
    source_span_dir = tmp_path / "source-spans"

    write_json(
        manifest_path,
        {
            "manifest_version": "1.0.0",
            "rows": [
                manifest_row("accounted", tmp_path / "accounted.pdf", b"", status="failed"),
                manifest_row("extra-in-manifest", tmp_path / "extra.pdf", b"", status="failed"),
            ],
        },
    )
    write_json(corpus_path, {"rows": [corpus_row("accounted")]})

    result = parser_module.parse_manifest_corpus(
        manifest_path=manifest_path,
        corpus_path=corpus_path,
        source_document_dir=source_document_dir,
        source_span_dir=source_span_dir,
        extraction_timestamp="2026-06-16T06:00:00Z",
        output_path=output_path,
    )

    assert result == 1
    assert "extra manifest resource_id" in capsys.readouterr().err
    assert not output_path.exists()
    assert not list(source_document_dir.glob("*.json"))
    assert not list(source_span_dir.glob("*.json"))


def test_manifest_parser_rejects_duplicate_manifest_resource_before_writes(tmp_path: Path, capsys) -> None:
    parser_module = load_parser_module()
    manifest_path = tmp_path / "manifest.json"
    corpus_path = tmp_path / "corpus.json"
    output_path = tmp_path / "manifest-output.json"
    source_document_dir = tmp_path / "source-documents"
    source_span_dir = tmp_path / "source-spans"

    write_json(
        manifest_path,
        {
            "manifest_version": "1.0.0",
            "rows": [
                manifest_row("duplicated", tmp_path / "first.pdf", b"", status="failed"),
                manifest_row("duplicated", tmp_path / "second.pdf", b"", status="failed"),
            ],
        },
    )
    write_json(corpus_path, {"rows": [corpus_row("duplicated")]})

    result = parser_module.parse_manifest_corpus(
        manifest_path=manifest_path,
        corpus_path=corpus_path,
        source_document_dir=source_document_dir,
        source_span_dir=source_span_dir,
        extraction_timestamp="2026-06-16T06:00:00Z",
        output_path=output_path,
    )

    assert result == 1
    assert "duplicate manifest resource_id" in capsys.readouterr().err
    assert not output_path.exists()
    assert not list(source_document_dir.glob("*.json"))
    assert not list(source_span_dir.glob("*.json"))


def test_manifest_parser_cli_checksum_mismatch_fails_closed(tmp_path: Path) -> None:
    pdf_path = tmp_path / "checksum.pdf"
    payload = b"%PDF checksum fixture"
    pdf_path.write_bytes(payload)
    manifest_path = tmp_path / "manifest.json"
    corpus_path = tmp_path / "corpus.json"
    output_path = tmp_path / "manifest-output.json"
    resource_id = "checksum-mismatch"
    write_json(
        manifest_path,
        {
            "manifest_version": "1.0.0",
            "rows": [manifest_row(resource_id, pdf_path, payload, sha256="0" * 64)],
        },
    )
    write_json(corpus_path, {"rows": [corpus_row(resource_id)]})

    result = run_parser(
        "--manifest",
        str(manifest_path),
        "--corpus",
        str(corpus_path),
        "--source-document-dir",
        str(tmp_path / "source-documents"),
        "--source-span-dir",
        str(tmp_path / "source-spans"),
        "--output",
        str(output_path),
        "--extraction-timestamp",
        "2026-06-16T06:00:00Z",
    )

    assert result.returncode == 0, result.stderr
    assert "parse_status=checksum_mismatch" in result.stdout
    parsed = json.loads(output_path.read_text(encoding="utf-8"))
    assert parsed["source_documents"][0]["parse_status"] == "checksum_mismatch"
    assert parsed["source_spans"] == []


def test_manifest_parser_accepts_real_198_row_manifest_with_local_validation(tmp_path: Path) -> None:
    manifest_payload = json.loads(PUBLIC_MANIFEST.read_text(encoding="utf-8"))
    for row in manifest_payload["rows"]:
        row["file_path"] = str(tmp_path / "raw" / Path(row["file_path"]).name)
    manifest_path = tmp_path / "public-manifest-missing-raw.json"
    write_json(manifest_path, manifest_payload)

    result = run_parser(
        "--manifest",
        str(manifest_path),
        "--corpus",
        str(PUBLIC_CORPUS),
        "--source-document-dir",
        str(tmp_path / "source-documents"),
        "--source-span-dir",
        str(tmp_path / "source-spans"),
        "--output",
        str(tmp_path / "manifest-output.json"),
        "--extraction-timestamp",
        "2026-06-16T06:00:00Z",
    )

    assert result.returncode == 0, result.stderr
    assert "Parsed manifest statuses: resource_count=198" in result.stdout


def test_parse_subset_registry_command_emits_five_source_document_statuses(tmp_path: Path) -> None:
    combined_path = tmp_path / "subset-output.json"
    result = run_parser(
        "--registry",
        str(PARSE_SUBSET),
        "--raw-dir",
        str(tmp_path / "raw"),
        "--source-document-dir",
        str(tmp_path / "source-documents"),
        "--source-span-dir",
        str(tmp_path / "source-spans"),
        "--output",
        str(combined_path),
        "--extraction-timestamp",
        "2026-06-15T12:00:00Z",
    )

    assert result.returncode == 0, result.stderr
    assert "resource_count=5" in result.stdout
    payload = json.loads(combined_path.read_text(encoding="utf-8"))
    source_documents = payload["source_documents"]
    source_spans = payload["source_spans"]
    expected_resource_ids = [row["resource_id"] for row in json.loads(PARSE_SUBSET.read_text(encoding="utf-8"))["rows"]]

    assert len(source_documents) == 5
    assert [record["resource_id"] for record in source_documents] == expected_resource_ids
    assert [record["parse_status"] for record in source_documents] == ["download_missing"] * 5
    assert source_spans == []
    assert len(list((tmp_path / "source-documents").glob("*.json"))) == 5
    assert len(list((tmp_path / "source-spans").glob("*.json"))) == 5


def test_parse_subset_registry_rejects_non_five_row_registry(tmp_path: Path) -> None:
    subset_payload = json.loads(PARSE_SUBSET.read_text(encoding="utf-8"))
    four_row_registry = tmp_path / "four-row-registry.json"
    four_row_registry.write_text(
        json.dumps({**subset_payload, "rows": subset_payload["rows"][:4]}),
        encoding="utf-8",
    )

    result = run_parser(
        "--registry",
        str(four_row_registry),
        "--raw-dir",
        str(tmp_path / "raw"),
        "--source-document-dir",
        str(tmp_path / "source-documents"),
        "--source-span-dir",
        str(tmp_path / "source-spans"),
        "--extraction-timestamp",
        "2026-06-15T12:00:00Z",
    )

    assert result.returncode == 1
    assert "expected exactly 5 parse subset rows, found 4" in result.stderr
    assert not (tmp_path / "source-documents").exists()
    assert not (tmp_path / "source-spans").exists()


def test_registry_parser_refuses_all_public_corpus_instead_of_parsing_198_rows(tmp_path: Path) -> None:
    result = run_parser(
        "--registry",
        str(PUBLIC_CORPUS),
        "--raw-dir",
        str(tmp_path / "raw"),
        "--source-document-dir",
        str(tmp_path / "source-documents"),
        "--source-span-dir",
        str(tmp_path / "source-spans"),
        "--extraction-timestamp",
        "2026-06-15T12:00:00Z",
    )

    assert result.returncode == 1
    assert "expected exactly 5 parse subset rows, found 198" in result.stderr
    assert not (tmp_path / "source-documents").exists()
    assert not (tmp_path / "source-spans").exists()


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
