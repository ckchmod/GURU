from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException


ROOT = Path(__file__).resolve().parents[3]
PILOT_SUBSET_PATH = ROOT / "resources" / "registry" / "ahs-guru-pilot-subset.json"
SYNTHETIC_SOURCE_PATH = ROOT / "tests" / "fixtures" / "source-documents" / "synthetic-guideline-note.txt"
ACCESS_DATE = "2026-06-15"
EXTRACTION_TIMESTAMP = "2026-06-15T12:00:00Z"
PARSER_VERSION = "source-document-parser-skeleton-v1"

router = APIRouter(prefix="/knowledgebase", tags=["knowledgebase"])


def _sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _safe_id_part(value: str) -> str:
    lowered = value.lower()
    cleaned = re.sub(r"[^a-z0-9_.:-]+", "-", lowered)
    return re.sub(r"-+", "-", cleaned).strip("-_.:") or "record"


def _normalize_text(text: str) -> str:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    return "\n".join(line.rstrip() for line in normalized.split("\n")).strip()


def _split_blocks(text: str) -> list[str]:
    return [block.strip() for block in re.split(r"\n\s*\n", text) if block.strip()]


def _is_heading(block: str) -> bool:
    if block.startswith("#"):
        return True
    if "\n" in block:
        return False
    words = block.split()
    return 1 <= len(words) <= 8 and len(block) <= 80 and block[-1:] not in ".!?"


def _slugify_locator(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:80] or "document"


def _load_pilot_resources() -> list[dict[str, Any]]:
    payload = json.loads(PILOT_SUBSET_PATH.read_text(encoding="utf-8"))
    rows = payload.get("rows", payload.get("resources", []))
    return list(rows)


def list_resources() -> list[dict[str, Any]]:
    return [
        {
            "resource_id": resource["resource_id"],
            "title": resource["title"],
            "disease_site": resource["disease_site"],
            "document_type": resource.get("document_type", resource["resource_type"]),
            "url": resource.get("url", resource["source_url_or_access_path"]),
            "data_source": "local_pilot_registry_fixture",
            "status": "draft",
        }
        for resource in _load_pilot_resources()
    ]


def _document_id(resource_id: str, checksum: str) -> str:
    return f"source-document.{_safe_id_part(resource_id)}.synthetic-guideline-note.{checksum[:12]}"


def _build_knowledgebase() -> dict[str, dict[str, Any]]:
    text = _normalize_text(SYNTHETIC_SOURCE_PATH.read_text(encoding="utf-8"))
    source_checksum = _sha256_text(text)
    source_path = SYNTHETIC_SOURCE_PATH.relative_to(ROOT).as_posix()
    resources = {resource["resource_id"]: resource for resource in list_resources()}
    source_documents: dict[str, dict[str, Any]] = {}
    source_spans: dict[str, dict[str, Any]] = {}
    graph_records: dict[str, dict[str, Any]] = {}

    for resource in resources.values():
        resource_id = resource["resource_id"]
        document_id = _document_id(resource_id, source_checksum)
        source_documents[document_id] = {
            "record_type": "source_document",
            "resource_id": resource_id,
            "document_id": document_id,
            "title": f"Synthetic source-document fixture for {resource['title']}",
            "access_date": ACCESS_DATE,
            "access_path": source_path,
            "input_path": source_path,
            "source_checksum_sha256": source_checksum,
            "parser_version": PARSER_VERSION,
            "extraction_timestamp": EXTRACTION_TIMESTAMP,
            "status": "draft",
        }

        current_section = "document"
        paragraph_index = 0
        record_span_ids: list[str] = []
        for block in _split_blocks(text):
            if _is_heading(block):
                current_section = _slugify_locator(block.lstrip("# ").strip())
                continue
            paragraph_index += 1
            quoted_text = "\n".join(line.strip() for line in block.split("\n") if line.strip())
            span_checksum = _sha256_text(quoted_text)
            span_id = f"source-span.{document_id}.p{paragraph_index:04d}"
            source_spans[span_id] = {
                "record_type": "source_span",
                "span_id": span_id,
                "resource_id": resource_id,
                "document_id": document_id,
                "source_document_id": document_id,
                "access_date": ACCESS_DATE,
                "stable_locator": f"section:{current_section};paragraph:{paragraph_index}",
                "quoted_text": quoted_text,
                "quoted_span": quoted_text,
                "excerpt_checksum": span_checksum,
                "checksum_sha256": span_checksum,
                "extraction_timestamp": EXTRACTION_TIMESTAMP,
                "timestamp": EXTRACTION_TIMESTAMP,
                "status": "draft",
                "output_status": "draft",
            }
            record_span_ids.append(span_id)

        graph_record_id = f"knowledgebase-record.{_safe_id_part(resource_id)}"
        graph_records[graph_record_id] = {
            "record_type": "knowledgebase_record",
            "record_id": graph_record_id,
            "resource_id": resource_id,
            "source_document_id": document_id,
            "title": resource["title"],
            "summary": "Local synthetic fixture record for testing provenance plumbing only.",
            "source_span_ids": record_span_ids,
            "output_status": "draft",
            "model_version": "none-local-fixture-only",
        }

    return {
        "resources": resources,
        "source_documents": source_documents,
        "source_spans": source_spans,
        "graph_records": graph_records,
    }


def _get_record(collection: str, record_id: str) -> dict[str, Any]:
    records = _build_knowledgebase()[collection]
    try:
        return records[record_id]
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"{collection} record not found: {record_id}") from exc


@router.get("/resources")
def get_resources() -> dict[str, list[dict[str, Any]]]:
    return {"resources": list(_build_knowledgebase()["resources"].values())}


@router.get("/resources/{resource_id}")
def get_resource(resource_id: str) -> dict[str, Any]:
    return _get_record("resources", resource_id)


@router.get("/source-documents/{document_id}")
def get_source_document(document_id: str) -> dict[str, Any]:
    return _get_record("source_documents", document_id)


@router.get("/source-spans/{span_id}")
def get_source_span(span_id: str) -> dict[str, Any]:
    return _get_record("source_spans", span_id)


@router.get("/graph-records/{record_id}")
def get_graph_record(record_id: str) -> dict[str, Any]:
    return _get_record("graph_records", record_id)
