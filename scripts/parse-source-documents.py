#!/usr/bin/env python3
"""Parse local text and bounded PDF source files into provenance records."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_DOCUMENT_DIR = ROOT / "resources" / "derived" / "source-documents"
DEFAULT_SOURCE_SPAN_DIR = ROOT / "resources" / "derived" / "source-spans"
PARSER_VERSION = "source-document-parser-skeleton-v1"
PDF_PARSER_VERSION = "source-document-pdf-parser-v1"
EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
PARSE_STATUSES = {"parsed", "download_missing", "encrypted", "empty_text", "partial_text", "parse_failed"}
DEFAULT_RAW_DIR = ROOT / "resources" / "raw" / "ahs-guru-public"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
DATETIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$")
ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$")
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def resolve_path(raw: str | Path) -> Path:
    path = Path(raw)
    if path.is_absolute():
        return path.resolve()
    return (ROOT / path).resolve()


def relative_to_root(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_id_part(value: str) -> str:
    lowered = value.lower()
    cleaned = re.sub(r"[^a-z0-9_.:-]+", "-", lowered)
    cleaned = re.sub(r"-+", "-", cleaned).strip("-_.:")
    return cleaned or "document"


def read_text_file(path: Path) -> str:
    payload = path.read_bytes()
    if b"\x00" in payload:
        raise SystemExit(f"ERROR {path}: binary input is not supported by this parser skeleton")
    try:
        return payload.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise SystemExit(f"ERROR {path}: expected UTF-8 text input") from exc


def normalize_text(text: str) -> str:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.rstrip() for line in normalized.split("\n")]
    return "\n".join(lines).strip()


def slugify_locator(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:80] or "untitled"


def is_heading(block: str) -> bool:
    if block.startswith("#"):
        return True
    if "\n" in block:
        return False
    words = block.split()
    return 1 <= len(words) <= 8 and len(block) <= 80 and block[-1:] not in ".!?"


def split_blocks(text: str) -> list[str]:
    return [block.strip() for block in re.split(r"\n\s*\n", text) if block.strip()]


def make_document_id(resource_id: str, source_checksum: str, input_path: Path) -> str:
    basename = safe_id_part(input_path.stem)
    return f"source-document.{safe_id_part(resource_id)}.{basename}.{source_checksum[:12]}"


def build_source_document(
    *,
    resource_id: str,
    document_id: str,
    title: str,
    input_path: Path,
    access_date: str,
    source_checksum: str,
    extraction_timestamp: str,
    source_url: str | None,
    parser_version: str = PARSER_VERSION,
    parse_status: str = "parsed",
    parse_warnings: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "record_type": "source_document",
        "resource_id": resource_id,
        "document_id": document_id,
        "title": title,
        "access_date": access_date,
        "access_path": source_url or relative_to_root(input_path),
        "input_path": relative_to_root(input_path),
        "source_checksum_sha256": source_checksum,
        "parser_version": parser_version,
        "extraction_timestamp": extraction_timestamp,
        "status": "draft",
        "output_status": "draft",
        "parse_status": parse_status,
        "parse_warnings": parse_warnings or [],
    }


def build_source_spans(
    *,
    resource_id: str,
    document_id: str,
    access_date: str,
    text: str,
    extraction_timestamp: str,
) -> list[dict[str, Any]]:
    spans: list[dict[str, Any]] = []
    current_section = "document"
    paragraph_index = 0
    for block in split_blocks(text):
        if is_heading(block):
            current_section = slugify_locator(block.lstrip("# ").strip())
            continue
        paragraph_index += 1
        quoted_text = "\n".join(line.strip() for line in block.split("\n") if line.strip())
        checksum = sha256_text(quoted_text)
        span_id = f"source-span.{document_id}.p{paragraph_index:04d}"
        spans.append(
            {
                "record_type": "source_span",
                "span_id": span_id,
                "resource_id": resource_id,
                "document_id": document_id,
                "source_document_id": document_id,
                "access_date": access_date,
                "stable_locator": f"section:{current_section};paragraph:{paragraph_index}",
                "quoted_text": quoted_text,
                "quoted_span": quoted_text,
                "excerpt_checksum": checksum,
                "checksum_sha256": checksum,
                "extraction_timestamp": extraction_timestamp,
                "timestamp": extraction_timestamp,
                "status": "draft",
                "output_status": "draft",
            }
        )
    if not spans:
        raise SystemExit("ERROR input did not contain any span paragraphs")
    return spans


def source_filename_from_url(resource_id: str, url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    name = Path(urllib.parse.unquote(parsed.path)).name
    return name or f"{resource_id}.pdf"


def source_document_for_status(
    *,
    resource_id: str,
    title: str,
    input_path: Path,
    access_date: str,
    source_url: str | None,
    source_checksum: str,
    extraction_timestamp: str,
    parse_status: str,
    parse_warnings: list[str],
) -> dict[str, Any]:
    document_id = make_document_id(resource_id, source_checksum, input_path)
    return build_source_document(
        resource_id=resource_id,
        document_id=document_id,
        title=title,
        input_path=input_path,
        access_date=access_date,
        source_checksum=source_checksum,
        extraction_timestamp=extraction_timestamp,
        source_url=source_url,
        parser_version=PDF_PARSER_VERSION,
        parse_status=parse_status,
        parse_warnings=parse_warnings,
    )


def bounded_excerpt(text: str, limit: int = 1200) -> str:
    normalized = " ".join(text.split())
    return normalized[:limit].strip()


def split_page_spans(page_text: str) -> list[str]:
    blocks = [bounded_excerpt(block) for block in re.split(r"\n\s*\n", page_text) if bounded_excerpt(block)]
    if blocks:
        return blocks
    excerpt = bounded_excerpt(page_text)
    return [excerpt] if excerpt else []


def extract_pdf_pages(input_path: Path) -> tuple[list[str | None], list[str]]:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise RuntimeError("pypdf is required for PDF parsing") from exc

    reader = PdfReader(str(input_path))
    if reader.is_encrypted:
        return [], ["encrypted_pdf"]
    pages: list[str | None] = []
    warnings: list[str] = []
    for index, page in enumerate(reader.pages, start=1):
        try:
            pages.append(page.extract_text() or "")
        except Exception as exc:
            pages.append(None)
            warnings.append(f"page:{index}:extract_text_failed:{exc.__class__.__name__}")
    return pages, warnings


def parse_pdf_source_document(
    *,
    input_path: Path,
    resource_id: str,
    access_date: str,
    title: str,
    source_url: str | None,
    extraction_timestamp: str,
) -> dict[str, Any]:
    if not input_path.exists():
        source_document = source_document_for_status(
            resource_id=resource_id,
            title=title,
            input_path=input_path,
            access_date=access_date,
            source_url=source_url,
            source_checksum=EMPTY_SHA256,
            extraction_timestamp=extraction_timestamp,
            parse_status="download_missing",
            parse_warnings=["raw_pdf_missing"],
        )
        return {"source_document": source_document, "source_spans": []}

    source_checksum = sha256_file(input_path)
    try:
        pages, warnings = extract_pdf_pages(input_path)
    except Exception as exc:
        source_document = source_document_for_status(
            resource_id=resource_id,
            title=title,
            input_path=input_path,
            access_date=access_date,
            source_url=source_url,
            source_checksum=source_checksum,
            extraction_timestamp=extraction_timestamp,
            parse_status="parse_failed",
            parse_warnings=[f"pdf_parse_failed:{exc.__class__.__name__}"],
        )
        return {"source_document": source_document, "source_spans": []}

    if warnings == ["encrypted_pdf"]:
        source_document = source_document_for_status(
            resource_id=resource_id,
            title=title,
            input_path=input_path,
            access_date=access_date,
            source_url=source_url,
            source_checksum=source_checksum,
            extraction_timestamp=extraction_timestamp,
            parse_status="encrypted",
            parse_warnings=warnings,
        )
        return {"source_document": source_document, "source_spans": []}

    document_id = make_document_id(resource_id, source_checksum, input_path)
    source_spans: list[dict[str, Any]] = []
    for page_number, page_text in enumerate(pages, start=1):
        if page_text is None:
            continue
        for span_index, excerpt in enumerate(split_page_spans(page_text), start=1):
            checksum = sha256_text(excerpt)
            stable_locator = f"page:{page_number};span:{span_index}"
            source_spans.append(
                {
                    "record_type": "source_span",
                    "span_id": f"source-span.{document_id}.page-{page_number:04d}.span-{span_index:04d}",
                    "resource_id": resource_id,
                    "document_id": document_id,
                    "source_document_id": document_id,
                    "access_date": access_date,
                    "source_pdf_checksum_sha256": source_checksum,
                    "page_number": page_number,
                    "stable_locator": stable_locator,
                    "quoted_text": excerpt,
                    "quoted_span": excerpt,
                    "bounded_excerpt": excerpt,
                    "excerpt_checksum": checksum,
                    "checksum_sha256": checksum,
                    "parser_version": PDF_PARSER_VERSION,
                    "extraction_timestamp": extraction_timestamp,
                    "timestamp": extraction_timestamp,
                    "status": "draft",
                    "output_status": "draft",
                    "parse_warnings": [],
                }
            )

    if not source_spans:
        parse_status = "empty_text"
    elif warnings or any(page_text == "" for page_text in pages):
        parse_status = "partial_text"
    else:
        parse_status = "parsed"
    source_document = build_source_document(
        resource_id=resource_id,
        document_id=document_id,
        title=title,
        input_path=input_path,
        access_date=access_date,
        source_checksum=source_checksum,
        extraction_timestamp=extraction_timestamp,
        source_url=source_url,
        parser_version=PDF_PARSER_VERSION,
        parse_status=parse_status,
        parse_warnings=warnings,
    )
    return {"source_document": source_document, "source_spans": source_spans}


def parse_source_document(
    *,
    input_path: Path,
    resource_id: str,
    access_date: str,
    title: str | None,
    source_url: str | None,
    extraction_timestamp: str,
) -> dict[str, Any]:
    text = normalize_text(read_text_file(input_path))
    if not text:
        raise SystemExit(f"ERROR {input_path}: input text is empty")
    source_checksum = sha256_text(text)
    document_id = make_document_id(resource_id, source_checksum, input_path)
    first_line = next((line.strip("# ").strip() for line in text.split("\n") if line.strip()), input_path.stem)
    source_document = build_source_document(
        resource_id=resource_id,
        document_id=document_id,
        title=title or first_line,
        input_path=input_path,
        access_date=access_date,
        source_checksum=source_checksum,
        extraction_timestamp=extraction_timestamp,
        source_url=source_url,
    )
    source_spans = build_source_spans(
        resource_id=resource_id,
        document_id=document_id,
        access_date=access_date,
        text=text,
        extraction_timestamp=extraction_timestamp,
    )
    return {"source_document": source_document, "source_spans": source_spans}


def validate_source_document(record: Any) -> list[str]:
    errors: list[str] = []
    if not isinstance(record, dict):
        return ["source_document: expected object"]
    required = {
        "record_type",
        "resource_id",
        "document_id",
        "title",
        "access_date",
        "access_path",
        "input_path",
        "source_checksum_sha256",
        "parser_version",
        "extraction_timestamp",
        "status",
        "output_status",
        "parse_status",
        "parse_warnings",
    }
    for field in sorted(required - set(record)):
        errors.append(f"source_document: missing {field}")
    if record.get("record_type") != "source_document":
        errors.append("source_document.record_type: expected source_document")
    if "document_id" in record and not ID_RE.fullmatch(str(record["document_id"])):
        errors.append("source_document.document_id: invalid identifier")
    if "access_date" in record and not DATE_RE.fullmatch(str(record["access_date"])):
        errors.append("source_document.access_date: expected YYYY-MM-DD")
    if "source_checksum_sha256" in record and not SHA256_RE.fullmatch(str(record["source_checksum_sha256"])):
        errors.append("source_document.source_checksum_sha256: expected SHA-256")
    if "extraction_timestamp" in record and not DATETIME_RE.fullmatch(str(record["extraction_timestamp"])):
        errors.append("source_document.extraction_timestamp: expected UTC date-time")
    if record.get("status") != "draft":
        errors.append("source_document.status: expected draft")
    if record.get("output_status") != "draft":
        errors.append("source_document.output_status: expected draft")
    if record.get("parse_status") not in PARSE_STATUSES:
        errors.append("source_document.parse_status: expected parser status vocabulary")
    if not isinstance(record.get("parse_warnings"), list):
        errors.append("source_document.parse_warnings: expected array")
    return errors


def validate_source_span(record: Any, document_id: str | None = None) -> list[str]:
    errors: list[str] = []
    if not isinstance(record, dict):
        return ["source_span: expected object"]
    required = {
        "record_type",
        "span_id",
        "resource_id",
        "document_id",
        "source_document_id",
        "access_date",
        "stable_locator",
        "quoted_text",
        "quoted_span",
        "excerpt_checksum",
        "checksum_sha256",
        "extraction_timestamp",
        "timestamp",
        "status",
        "output_status",
    }
    for field in sorted(required - set(record)):
        errors.append(f"source_span: missing {field}")
    if record.get("record_type") != "source_span":
        errors.append("source_span.record_type: expected source_span")
    for field in ("span_id", "document_id", "source_document_id"):
        if field in record and not ID_RE.fullmatch(str(record[field])):
            errors.append(f"source_span.{field}: invalid identifier")
    if document_id is not None and record.get("document_id") != document_id:
        errors.append("source_span.document_id: does not match source document")
    if record.get("source_document_id") != record.get("document_id"):
        errors.append("source_span.source_document_id: does not match document_id")
    if record.get("quoted_span") != record.get("quoted_text"):
        errors.append("source_span.quoted_span: does not match quoted_text")
    if "access_date" in record and not DATE_RE.fullmatch(str(record["access_date"])):
        errors.append("source_span.access_date: expected YYYY-MM-DD")
    for field in ("excerpt_checksum", "checksum_sha256"):
        if field in record and not SHA256_RE.fullmatch(str(record[field])):
            errors.append(f"source_span.{field}: expected SHA-256")
    if record.get("excerpt_checksum") != record.get("checksum_sha256"):
        errors.append("source_span.checksum_sha256: does not match excerpt_checksum")
    if "quoted_text" in record and record.get("excerpt_checksum") != sha256_text(str(record["quoted_text"])):
        errors.append("source_span.excerpt_checksum: does not match quoted_text")
    for field in ("extraction_timestamp", "timestamp"):
        if field in record and not DATETIME_RE.fullmatch(str(record[field])):
            errors.append(f"source_span.{field}: expected UTC date-time")
    if record.get("status") != "draft":
        errors.append("source_span.status: expected draft")
    if record.get("output_status") != "draft":
        errors.append("source_span.output_status: expected draft")
    if "source_pdf_checksum_sha256" in record and not SHA256_RE.fullmatch(str(record["source_pdf_checksum_sha256"])):
        errors.append("source_span.source_pdf_checksum_sha256: expected SHA-256")
    if "page_number" in record and (not isinstance(record["page_number"], int) or record["page_number"] < 1):
        errors.append("source_span.page_number: expected positive integer")
    if "bounded_excerpt" in record and record.get("bounded_excerpt") != record.get("quoted_text"):
        errors.append("source_span.bounded_excerpt: does not match quoted_text")
    if "parser_version" in record and not isinstance(record["parser_version"], str):
        errors.append("source_span.parser_version: expected string")
    if "parse_warnings" in record and not isinstance(record["parse_warnings"], list):
        errors.append("source_span.parse_warnings: expected array")
    return errors


def validate_parser_output(payload: Any) -> list[str]:
    if not isinstance(payload, dict):
        return ["parser output: expected object"]
    errors = validate_source_document(payload.get("source_document"))
    document_id = None
    source_document = payload.get("source_document")
    if isinstance(source_document, dict) and isinstance(source_document.get("document_id"), str):
        document_id = source_document["document_id"]
    spans = payload.get("source_spans")
    parse_status = source_document.get("parse_status") if isinstance(source_document, dict) else None
    if not isinstance(spans, list):
        errors.append("source_spans: expected array")
        return errors
    if parse_status in {"parsed", "partial_text"} and not spans:
        errors.append("source_spans: expected non-empty array for parsed PDF/text output")
    seen: set[str] = set()
    for index, span in enumerate(spans):
        span_errors = validate_source_span(span, document_id=document_id)
        errors.extend(f"source_spans[{index}].{error}" for error in span_errors)
        if isinstance(span, dict) and isinstance(span.get("span_id"), str):
            if span["span_id"] in seen:
                errors.append(f"source_spans[{index}].span_id: duplicate identifier")
            seen.add(span["span_id"])
    return errors


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
        handle.write("\n")


def validate_output_file(path: Path) -> int:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"ERROR {path}: file not found", file=sys.stderr)
        return 1
    except json.JSONDecodeError as exc:
        print(f"ERROR {path}:{exc.lineno}:{exc.colno}: invalid JSON: {exc.msg}", file=sys.stderr)
        return 1
    errors = validate_parser_output(payload)
    for error in errors:
        print(f"ERROR {path}: {error}", file=sys.stderr)
    if errors:
        print(f"Parser output validation failed: {len(errors)} error(s)", file=sys.stderr)
        return 1
    print(f"Parser output validation passed: {path}")
    return 0


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise SystemExit(f"ERROR {path}: file not found")
    except json.JSONDecodeError as exc:
        raise SystemExit(f"ERROR {path}:{exc.lineno}:{exc.colno}: invalid JSON: {exc.msg}") from exc


def load_registry_rows(path: Path) -> list[dict[str, Any]]:
    payload = load_json(path)
    if not isinstance(payload, dict) or not isinstance(payload.get("rows"), list):
        raise SystemExit(f"ERROR {path}: expected registry object with rows array")
    rows: list[dict[str, Any]] = []
    for index, row in enumerate(payload["rows"], start=1):
        if not isinstance(row, dict):
            raise SystemExit(f"ERROR {path}: rows[{index}] must be an object")
        rows.append(row)
    return rows


def write_parser_payload(payload: dict[str, Any], source_document_dir: Path, source_span_dir: Path) -> None:
    document_id = payload["source_document"]["document_id"]
    write_json(source_document_dir / f"{document_id}.json", payload["source_document"])
    write_json(source_span_dir / f"{document_id}.json", payload["source_spans"])


def parse_registry_subset(
    *,
    registry_path: Path,
    raw_dir: Path,
    source_document_dir: Path,
    source_span_dir: Path,
    extraction_timestamp: str,
    output_path: Path | None,
) -> int:
    rows = load_registry_rows(registry_path)
    if len(rows) != 5:
        print(f"ERROR {registry_path}: expected exactly 5 parse subset rows, found {len(rows)}", file=sys.stderr)
        return 1
    outputs: list[dict[str, Any]] = []
    status_counts: dict[str, int] = {}
    for row in rows:
        resource_id = str(row.get("resource_id") or "")
        title = str(row.get("title") or resource_id)
        source_url = str(row.get("source_url_or_access_path") or "")
        access_date = str(row.get("access_date") or "")
        if not resource_id or not source_url or not DATE_RE.fullmatch(access_date):
            print(f"ERROR {registry_path}: invalid parse subset row for resource {resource_id!r}", file=sys.stderr)
            return 1
        input_path = raw_dir / source_filename_from_url(resource_id, source_url)
        payload = parse_pdf_source_document(
            input_path=input_path,
            resource_id=resource_id,
            access_date=access_date,
            title=title,
            source_url=source_url,
            extraction_timestamp=extraction_timestamp,
        )
        errors = validate_parser_output(payload)
        if errors:
            for error in errors:
                print(f"ERROR {resource_id}: {error}", file=sys.stderr)
            return 1
        write_parser_payload(payload, source_document_dir, source_span_dir)
        outputs.append(payload)
        parse_status = payload["source_document"]["parse_status"]
        status_counts[parse_status] = status_counts.get(parse_status, 0) + 1
        print(f"Parsed subset resource: resource_id={resource_id} parse_status={parse_status}")
    batch_payload = {"parser_version": PDF_PARSER_VERSION, "source_documents": [item["source_document"] for item in outputs], "source_spans": [span for item in outputs for span in item["source_spans"]]}
    if output_path is not None:
        write_json(output_path, batch_payload)
    print(f"Parsed subset statuses: resource_count={len(outputs)} status_counts={json.dumps(status_counts, sort_keys=True)}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Parse local text or bounded PDF source files into source-document and source-span records")
    parser.add_argument("input", nargs="?", help="UTF-8 text source file to parse")
    parser.add_argument("--resource-id", help="Stable resource ID for the input")
    parser.add_argument("--access-date", help="Source access date as YYYY-MM-DD")
    parser.add_argument("--title", help="Optional source-document title override")
    parser.add_argument("--source-url", help="Optional source URL or access path")
    parser.add_argument("--source-document-dir", default=str(DEFAULT_SOURCE_DOCUMENT_DIR), help="Directory for source-document records")
    parser.add_argument("--source-span-dir", default=str(DEFAULT_SOURCE_SPAN_DIR), help="Directory for source-span records")
    parser.add_argument("--output", help="Optional combined output JSON path")
    parser.add_argument("--extraction-timestamp", default=iso_now(), help="UTC extraction timestamp")
    parser.add_argument("--validate-output", help="Validate an existing combined parser output JSON file")
    parser.add_argument("--input-format", choices=["text", "pdf"], default="text", help="Input parser to use for a single input")
    parser.add_argument("--registry", help="Parse exactly the five-row PDF parse subset registry")
    parser.add_argument("--raw-dir", default=str(DEFAULT_RAW_DIR), help="Raw PDF directory for --registry")
    args = parser.parse_args()

    if args.validate_output:
        return validate_output_file(resolve_path(args.validate_output))
    if args.registry:
        return parse_registry_subset(
            registry_path=resolve_path(args.registry),
            raw_dir=resolve_path(args.raw_dir),
            source_document_dir=resolve_path(args.source_document_dir),
            source_span_dir=resolve_path(args.source_span_dir),
            extraction_timestamp=args.extraction_timestamp,
            output_path=resolve_path(args.output) if args.output else None,
        )
    if not args.input:
        parser.error("input is required unless --validate-output is used")
    if not args.resource_id:
        parser.error("--resource-id is required")
    if not args.access_date:
        parser.error("--access-date is required")
    if not DATE_RE.fullmatch(args.access_date):
        parser.error("--access-date must use YYYY-MM-DD")

    input_path = resolve_path(args.input)
    if args.input_format == "pdf":
        payload = parse_pdf_source_document(
            input_path=input_path,
            resource_id=args.resource_id,
            access_date=args.access_date,
            title=args.title or input_path.stem,
            source_url=args.source_url,
            extraction_timestamp=args.extraction_timestamp,
        )
    else:
        payload = parse_source_document(
            input_path=input_path,
            resource_id=args.resource_id,
            access_date=args.access_date,
            title=args.title,
            source_url=args.source_url,
            extraction_timestamp=args.extraction_timestamp,
        )
    errors = validate_parser_output(payload)
    if errors:
        for error in errors:
            print(f"ERROR {error}", file=sys.stderr)
        return 1

    document_id = payload["source_document"]["document_id"]
    source_document_path = resolve_path(args.source_document_dir) / f"{document_id}.json"
    source_span_path = resolve_path(args.source_span_dir) / f"{document_id}.json"
    write_parser_payload(payload, resolve_path(args.source_document_dir), resolve_path(args.source_span_dir))
    if args.output:
        write_json(resolve_path(args.output), payload)

    print(
        "Parsed source document: "
        f"document_id={document_id} span_count={len(payload['source_spans'])} "
        f"source_document_path={relative_to_root(source_document_path)} "
        f"source_span_path={relative_to_root(source_span_path)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
