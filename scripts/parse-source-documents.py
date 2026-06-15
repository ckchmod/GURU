#!/usr/bin/env python3
"""Parse local text source files into source-document and source-span records."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_DOCUMENT_DIR = ROOT / "resources" / "derived" / "source-documents"
DEFAULT_SOURCE_SPAN_DIR = ROOT / "resources" / "derived" / "source-spans"
PARSER_VERSION = "source-document-parser-skeleton-v1"
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
        "parser_version": PARSER_VERSION,
        "extraction_timestamp": extraction_timestamp,
        "status": "draft",
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
    if not isinstance(spans, list) or not spans:
        errors.append("source_spans: expected non-empty array")
        return errors
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


def main() -> int:
    parser = argparse.ArgumentParser(description="Parse local text source files into source-document and source-span records")
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
    args = parser.parse_args()

    if args.validate_output:
        return validate_output_file(resolve_path(args.validate_output))
    if not args.input:
        parser.error("input is required unless --validate-output is used")
    if not args.resource_id:
        parser.error("--resource-id is required")
    if not args.access_date:
        parser.error("--access-date is required")
    if not DATE_RE.fullmatch(args.access_date):
        parser.error("--access-date must use YYYY-MM-DD")

    input_path = resolve_path(args.input)
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
    write_json(source_document_path, payload["source_document"])
    write_json(source_span_path, payload["source_spans"])
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
