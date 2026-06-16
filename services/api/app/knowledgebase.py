from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

from services.api.app.corpus_graph import build_public_corpus_graph


ROOT = Path(__file__).resolve().parents[3]
PILOT_SUBSET_PATH = ROOT / "resources" / "registry" / "ahs-guru-pilot-subset.json"
PARSE_SUBSET_PATH = ROOT / "resources" / "registry" / "ahs-guru-parse-subset.json"
DERIVED_SOURCE_SPAN_DIR = ROOT / "resources" / "derived" / "source-spans"
SYNTHETIC_SOURCE_PATH = ROOT / "tests" / "fixtures" / "source-documents" / "synthetic-guideline-note.txt"
ACCESS_DATE = "2026-06-15"
EXTRACTION_TIMESTAMP = "2026-06-15T12:00:00Z"
PARSER_VERSION = "source-document-parser-skeleton-v1"
SOURCE_SPAN_COVERAGE_COUNT = 5
RESPONSE_STATE_VOCABULARY = {
    "metadata_only": "Registry metadata exists, but no local parsed artifact is exposed.",
    "downloaded_unparsed": "A local raw archive state is recorded, but parser output is not available.",
    "parsed": "A parsed or partial-text parser artifact is available for the bounded subset.",
    "download_failed": "Download or expected raw-file availability failed before parsing.",
    "parse_failed": "Parser execution failed or produced no usable technical extraction.",
}

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


def _load_parse_subset_ids() -> set[str]:
    payload = json.loads(PARSE_SUBSET_PATH.read_text(encoding="utf-8"))
    return {row["resource_id"] for row in payload.get("rows", []) if isinstance(row, dict) and row.get("resource_id")}


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


def _load_json_records(directory: Path, key: str) -> list[dict[str, Any]]:
    if not directory.exists():
        return []
    records: list[dict[str, Any]] = []
    for path in sorted(directory.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, dict) and isinstance(payload.get(key), list):
            records.extend(record for record in payload[key] if isinstance(record, dict))
        elif isinstance(payload, dict):
            records.append(payload)
    return records


def _load_corpus_source_spans() -> list[dict[str, Any]]:
    return _load_json_records(DERIVED_SOURCE_SPAN_DIR, "source_spans")


def _status_token(value: Any) -> str:
    if not isinstance(value, str):
        return "unknown"
    cleaned = value.strip().lower().replace("_", "-")
    return re.sub(r"\s+", "-", cleaned) or "unknown"


def _status_contract_value(value: Any) -> str:
    return _status_token(value).replace("-", "_")


def _resource_response_state(archive_status: str, parse_status: str) -> str:
    archive = _status_contract_value(archive_status)
    parse = _status_contract_value(parse_status)
    if parse in {"parsed", "partial_text"}:
        return "parsed"
    if parse in {"parse_failed", "encrypted", "empty_text"}:
        return "parse_failed"
    if archive in {"download_missing", "checksum_mismatch"} or parse == "download_missing":
        return "download_failed"
    if archive == "downloaded":
        return "downloaded_unparsed"
    return "metadata_only"


def _resource_type_contract_value(value: Any) -> str:
    if not isinstance(value, str):
        return "unknown"
    return value.strip().lower().replace("-", "_") or "unknown"


def _resource_from_graph_node(node: dict[str, Any], parse_subset_ids: set[str]) -> dict[str, Any]:
    archive_status = node.get("archive_status", "metadata-only")
    parse_status = node.get("parse_status", "not-parsed")
    source_url = node.get("url", "unknown")
    return {
        "resource_id": node["resource_id"],
        "node_id": node["id"],
        "title": node["title"],
        "disease_site": node["disease_site"],
        "document_type": _resource_type_contract_value(node["document_type"]),
        "resource_type": _resource_type_contract_value(node["resource_type"]),
        "document_status": node["document_status"],
        "archive_status": _status_contract_value(archive_status),
        "parse_status": _status_contract_value(parse_status),
        "response_state": _resource_response_state(archive_status, parse_status),
        "source_url": source_url,
        "url": source_url,
        "access_date": node["access_date"],
        "license_status": node["license_status"],
        "allowed_use": node["allowed_use"],
        "local_storage_decision": node["local_storage_decision"],
        "checksum_sha256": node["checksum_sha256"],
        "parsed_subset": node["resource_id"] in parse_subset_ids,
        "raw_pdf_exposed": False,
        "output_status": node["output_status"],
        "provenance": node["provenance"],
    }


def _corpus_resources() -> list[dict[str, Any]]:
    graph = build_public_corpus_graph()
    parse_subset_ids = _load_parse_subset_ids()
    return [_resource_from_graph_node(node, parse_subset_ids) for node in graph["nodes"] if node.get("type") == "resource"]


def _matches_filter(resource: dict[str, Any], filters: dict[str, str | None]) -> bool:
    for key, value in filters.items():
        if value is None:
            continue
        if _status_contract_value(resource.get(key)) != _status_contract_value(value):
            return False
    return True


def _filtered_corpus_resources(
    *,
    disease_site: str | None = None,
    resource_type: str | None = None,
    document_status: str | None = None,
    archive_status: str | None = None,
    parse_status: str | None = None,
) -> list[dict[str, Any]]:
    return [
        resource
        for resource in _corpus_resources()
        if _matches_filter(
            resource,
            {
                "disease_site": disease_site,
                "resource_type": resource_type,
                "document_status": document_status,
                "archive_status": archive_status,
                "parse_status": parse_status,
            },
        )
    ]


def _contains_query(value: Any, query: str) -> bool:
    return isinstance(value, str) and query in value.lower()


def _metadata_search_match(resource: dict[str, Any], query: str) -> bool:
    return any(
        _contains_query(resource.get(field), query)
        for field in ("title", "resource_id", "disease_site", "document_type", "resource_type")
    )


def _source_span_search_results(query: str, allowed_resource_ids: set[str]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for span in _load_corpus_source_spans():
        resource_id = span.get("resource_id")
        excerpt = span.get("bounded_excerpt", span.get("quoted_text", span.get("quoted_span", "")))
        if resource_id in allowed_resource_ids and _contains_query(excerpt, query):
            results.append(
                {
                    "span_id": span.get("span_id"),
                    "resource_id": resource_id,
                    "document_id": span.get("document_id", span.get("source_document_id")),
                    "stable_locator": span.get("stable_locator"),
                    "excerpt": excerpt,
                    "checksum_sha256": span.get("checksum_sha256", span.get("excerpt_checksum")),
                    "output_status": span.get("output_status", span.get("status", "draft")),
                }
            )
    return results


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


@router.get("/corpus/resources")
def get_corpus_resources(
    disease_site: str | None = None,
    resource_type: str | None = None,
    document_status: str | None = None,
    archive_status: str | None = None,
    parse_status: str | None = None,
) -> dict[str, Any]:
    resources = _filtered_corpus_resources(
        disease_site=disease_site,
        resource_type=resource_type,
        document_status=document_status,
        archive_status=archive_status,
        parse_status=parse_status,
    )
    return {
        "resources": resources,
        "count": len(resources),
        "total_count": len(_corpus_resources()),
        "response_state_vocabulary": RESPONSE_STATE_VOCABULARY,
    }


@router.get("/corpus/graph")
def get_corpus_graph() -> dict[str, Any]:
    graph = build_public_corpus_graph()
    graph["metadata"]["source_span_coverage_count"] = SOURCE_SPAN_COVERAGE_COUNT
    graph["metadata"]["source_span_node_count"] = 0
    graph["metadata"]["source_span_coverage_note"] = "Source-span coverage is limited to the five-row parsed subset and depends on derived parser outputs."
    return graph


@router.get("/corpus/search")
def search_corpus(
    q: str = "",
    disease_site: str | None = None,
    resource_type: str | None = None,
    document_status: str | None = None,
    archive_status: str | None = None,
    parse_status: str | None = None,
) -> dict[str, Any]:
    query = q.strip().lower()
    filtered_resources = _filtered_corpus_resources(
        disease_site=disease_site,
        resource_type=resource_type,
        document_status=document_status,
        archive_status=archive_status,
        parse_status=parse_status,
    )
    metadata_results = [resource for resource in filtered_resources if query and _metadata_search_match(resource, query)]
    source_span_resource_ids = {resource["resource_id"] for resource in filtered_resources} & _load_parse_subset_ids()
    source_span_results = _source_span_search_results(query, source_span_resource_ids) if query else []
    return {
        "query": q,
        "metadata_results": metadata_results,
        "source_span_results": source_span_results,
        "metadata_result_count": len(metadata_results),
        "source_span_result_count": len(source_span_results),
        "source_span_coverage_count": SOURCE_SPAN_COVERAGE_COUNT,
        "source_span_coverage_note": "Search checks metadata for all 198 resources and parsed source-span excerpts only for the five-row parsed subset when derived outputs are present.",
        "total_resource_count": len(_corpus_resources()),
        "model_routing": "none-local-deterministic-search-only",
    }


@router.get("/corpus/source-spans")
def get_corpus_source_spans(resource_id: str | None = None) -> dict[str, Any]:
    parse_subset_ids = _load_parse_subset_ids()
    spans = [span for span in _load_corpus_source_spans() if span.get("resource_id") in parse_subset_ids]
    if resource_id is not None:
        spans = [span for span in spans if span.get("resource_id") == resource_id]
    safe_spans = [
        {
            "span_id": span.get("span_id"),
            "resource_id": span.get("resource_id"),
            "document_id": span.get("document_id", span.get("source_document_id")),
            "stable_locator": span.get("stable_locator"),
            "excerpt": span.get("bounded_excerpt", span.get("quoted_text", span.get("quoted_span"))),
            "checksum_sha256": span.get("checksum_sha256", span.get("excerpt_checksum")),
            "output_status": span.get("output_status", span.get("status", "draft")),
        }
        for span in spans
    ]
    return {
        "source_spans": safe_spans,
        "count": len(safe_spans),
        "coverage_count": SOURCE_SPAN_COVERAGE_COUNT,
        "coverage_resource_ids": sorted(parse_subset_ids),
        "coverage_note": "Only the five-row parsed subset is eligible for source-span coverage; absent derived files mean no source-span records are reported.",
    }
