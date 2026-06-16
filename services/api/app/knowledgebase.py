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
PREVIOUS_PUBLIC_MANIFEST_PATH = ROOT / "resources" / "manifests" / "ahs-guru-public" / "manifest-20260615T000000Z-no-network-status.json"
CURRENT_PUBLIC_MANIFEST_PATH = ROOT / "resources" / "manifests" / "ahs-guru-public" / "manifest-20260616T053200Z.json"
DERIVED_SOURCE_SPAN_DIR = ROOT / "resources" / "derived" / "source-spans"
SYNTHETIC_SOURCE_PATH = ROOT / "tests" / "fixtures" / "source-documents" / "synthetic-guideline-note.txt"
ACCESS_DATE = "2026-06-15"
EXTRACTION_TIMESTAMP = "2026-06-15T12:00:00Z"
PARSER_VERSION = "source-document-parser-skeleton-v1"
SOURCE_SPAN_COVERAGE_COUNT = 5
MODEL_ROUTING = "none-local-deterministic-search-only"
DETERMINISTIC_PARSER_VERSION = "none-local-deterministic-parser"
MAX_SOURCE_SPAN_SEARCH_RESULTS = 12
REVIEW_QUEUE_ALLOWED_ACTIONS = ("inspect_source", "mark_needs_review_local", "link_source_local")
SURVEILLANCE_REVIEW_STATES = {"changed", "checksum_mismatch", "missing", "resource_added", "resource_removed"}
COVERAGE_STATUS_VOCABULARY = {
    "source_span_ready",
    "partial_source_span",
    "metadata_only",
    "download_failed",
    "checksum_mismatch",
    "parse_failed",
}
PATIENT_ADVICE_LANGUAGE_PATTERNS = (
    re.compile(r"\bdosing\b", re.IGNORECASE),
    re.compile(r"\bdiagnosis\b", re.IGNORECASE),
    re.compile(r"\btreatment advice\b", re.IGNORECASE),
    re.compile(r"\brecommended regimen\b", re.IGNORECASE),
    re.compile(r"\bpatient-specific\b", re.IGNORECASE),
)
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


def _load_manifest_rows(path: Path) -> dict[str, dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload.get("rows", []) if isinstance(payload, dict) else []
    return {
        row["resource_id"]: row
        for row in rows
        if isinstance(row, dict) and isinstance(row.get("resource_id"), str) and row.get("resource_id")
    }


def _manifest_row_status(row: dict[str, Any] | None) -> str | None:
    if row is None:
        return None
    status = row.get("status")
    return status if isinstance(status, str) else None


def _manifest_row_checksum(row: dict[str, Any] | None) -> str | None:
    if row is None:
        return None
    checksum = row.get("sha256")
    return checksum if isinstance(checksum, str) else None


def _manifest_change_state(previous: dict[str, Any] | None, current: dict[str, Any] | None) -> str:
    if previous is None:
        return "resource_added"
    if current is None:
        return "resource_removed"
    previous_status = _manifest_row_status(previous)
    current_status = _manifest_row_status(current)
    previous_checksum = _manifest_row_checksum(previous)
    current_checksum = _manifest_row_checksum(current)
    if current_status == "failed" and previous_status != "failed":
        return "missing"
    if previous_status == current_status and previous_checksum == current_checksum:
        return "unchanged"
    if previous_status == "downloaded" and current_status == "downloaded" and previous_checksum != current_checksum:
        return "checksum_mismatch"
    return "changed"


def _offline_surveillance_status() -> dict[str, Any]:
    previous_rows = _load_manifest_rows(PREVIOUS_PUBLIC_MANIFEST_PATH)
    current_rows = _load_manifest_rows(CURRENT_PUBLIC_MANIFEST_PATH)
    resource_statuses: dict[str, dict[str, Any]] = {}
    summary_counts = {
        "changed": 0,
        "checksum_mismatch": 0,
        "missing": 0,
        "resource_added": 0,
        "resource_removed": 0,
        "unchanged": 0,
    }

    for resource_id in sorted(set(previous_rows) | set(current_rows)):
        previous = previous_rows.get(resource_id)
        current = current_rows.get(resource_id)
        change_state = _manifest_change_state(previous, current)
        summary_counts[change_state] += 1
        review_status = "needs_review" if change_state in SURVEILLANCE_REVIEW_STATES else "no_change"
        resource_statuses[resource_id] = {
            "resource_id": resource_id,
            "status": review_status,
            "change_state": change_state,
            "review_status": review_status,
            "previous_status": _manifest_row_status(previous),
            "current_status": _manifest_row_status(current),
            "previous_checksum_sha256": _manifest_row_checksum(previous),
            "current_checksum_sha256": _manifest_row_checksum(current),
        }

    changed_count = summary_counts["changed"] + summary_counts["checksum_mismatch"] + summary_counts["resource_added"] + summary_counts["resource_removed"]
    missing_count = summary_counts["missing"] + summary_counts["resource_removed"]
    needs_review_count = sum(1 for status in resource_statuses.values() if status["review_status"] == "needs_review")
    return {
        "mode": "local_manifest_status_only",
        "status": "offline_local_archive_comparison",
        "review_status": "needs_review" if needs_review_count else "no_change",
        "resource_count": len(resource_statuses),
        "changed_count": changed_count,
        "missing_count": missing_count,
        "unchanged_count": summary_counts["unchanged"],
        "needs_review_count": needs_review_count,
        "summary_counts": summary_counts,
        "resource_statuses": resource_statuses,
    }


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
        elif isinstance(payload, list):
            records.extend(record for record in payload if isinstance(record, dict))
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
    resource_lookup = {resource["resource_id"]: resource for resource in _corpus_resources()}
    for span in _validated_corpus_source_spans(allowed_resource_ids):
        resource_id = span.get("resource_id")
        excerpt = span.get("bounded_excerpt", span.get("quoted_text", span.get("quoted_span", "")))
        if resource_id in allowed_resource_ids and _contains_query(excerpt, query):
            resource = resource_lookup.get(resource_id)
            if resource is not None:
                results.append(_source_span_hit(span, resource))
                if len(results) >= MAX_SOURCE_SPAN_SEARCH_RESULTS:
                    break
    return results


def _is_sha256(value: Any) -> bool:
    return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) is not None


def _is_validated_source_span(span: dict[str, Any], allowed_resource_ids: set[str]) -> bool:
    resource_id = span.get("resource_id")
    quoted_span = span.get("quoted_span")
    excerpt_checksum = span.get("excerpt_checksum")
    if resource_id not in allowed_resource_ids or not isinstance(quoted_span, str) or quoted_span == "":
        return False
    if any(pattern.search(quoted_span) for pattern in PATIENT_ADVICE_LANGUAGE_PATTERNS):
        return False
    required_text_fields = (
        "span_id",
        "source_document_id",
        "access_date",
        "stable_locator",
        "prompt_or_model_version",
        "reviewer",
        "review_status",
        "timestamp",
        "output_status",
    )
    if any(not isinstance(span.get(field), str) or not span.get(field) for field in required_text_fields):
        return False
    if span.get("prompt_or_model_version") != DETERMINISTIC_PARSER_VERSION:
        return False
    if span.get("reviewer") != "unreviewed" or span.get("review_status") != "draft":
        return False
    if not _is_sha256(excerpt_checksum) or excerpt_checksum != _sha256_text(quoted_span):
        return False
    checksum_sha256 = span.get("checksum_sha256")
    return checksum_sha256 in {None, excerpt_checksum}


def _validated_corpus_source_spans(allowed_resource_ids: set[str] | None = None) -> list[dict[str, Any]]:
    allowed_ids = allowed_resource_ids if allowed_resource_ids is not None else _load_parse_subset_ids()
    return [span for span in _load_corpus_source_spans() if _is_validated_source_span(span, allowed_ids)]


def _resource_graph_context(resource: dict[str, Any]) -> dict[str, Any]:
    graph = build_public_corpus_graph()
    resource_node_id = resource["node_id"]
    edges = [edge for edge in graph["edges"] if edge.get("source") == resource_node_id or edge.get("target") == resource_node_id]
    neighbor_node_ids = sorted(
        {
            edge["target"] if edge.get("source") == resource_node_id else edge["source"]
            for edge in edges
            if isinstance(edge.get("source"), str) and isinstance(edge.get("target"), str)
        }
    )
    edge_types = sorted({edge["type"] for edge in edges if isinstance(edge.get("type"), str)})
    node_lookup = {node["id"]: node for node in graph["nodes"] if isinstance(node.get("id"), str)}
    return {
        "resource_node_id": resource_node_id,
        "neighbor_node_ids": neighbor_node_ids,
        "edge_types": edge_types,
        "neighbor_nodes": [node_lookup[node_id] for node_id in neighbor_node_ids if node_id in node_lookup],
        "edges": edges,
    }


def _coverage_status(resource: dict[str, Any], source_spans: list[dict[str, Any]] | None = None) -> str:
    archive_status = resource.get("archive_status")
    parse_status = resource.get("parse_status")
    spans = source_spans if source_spans is not None else _validated_corpus_source_spans({resource["resource_id"]})
    if archive_status == "checksum_mismatch" or parse_status == "checksum_mismatch":
        return "checksum_mismatch"
    if archive_status == "download_missing" or parse_status == "download_missing":
        return "download_failed"
    if parse_status in {"parse_failed", "encrypted", "empty_text"}:
        return "parse_failed"
    if spans:
        return "source_span_ready"
    if parse_status in {"parsed", "partial_text"}:
        return "partial_source_span"
    return "metadata_only"


def _interpretability_summary(coverage_status: str, source_span_count: int, neighbor_count: int) -> dict[str, Any]:
    return {
        "mode": "deterministic_metadata_and_source_span_lookup",
        "coverage_status": coverage_status,
        "source_span_count": source_span_count,
        "graph_neighbor_count": neighbor_count,
        "model_routing": MODEL_ROUTING,
    }


def _review_task_id(resource_id: str, span_id: str) -> str:
    return f"workflow-task.{_safe_id_part(resource_id)}.{_safe_id_part(span_id)}.evidence-review"


def _empty_pico_placeholder() -> dict[str, None]:
    return {
        "population": None,
        "intervention": None,
        "comparator": None,
        "outcome": None,
    }


def _review_queue_item_from_span(span: dict[str, Any]) -> dict[str, Any]:
    resource_id = span["resource_id"]
    span_id = span["span_id"]
    return {
        "review_task_id": _review_task_id(resource_id, span_id),
        "resource_id": resource_id,
        "source_span_ids": [span_id],
        "pico_placeholder": _empty_pico_placeholder(),
        "review_status": "draft",
        "staleness_status": "not_evaluated_local",
        "allowed_actions": list(REVIEW_QUEUE_ALLOWED_ACTIONS),
    }


def _review_queue_items_from_source_spans(source_spans: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [_review_queue_item_from_span(span) for span in source_spans]


def _resource_interpretability_fields(resource: dict[str, Any], source_spans: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    graph_context = _resource_graph_context(resource)
    spans = source_spans if source_spans is not None else _validated_corpus_source_spans({resource["resource_id"]})
    coverage_status = _coverage_status(resource, spans)
    return {
        "focus_node_id": resource["node_id"],
        "resource_node_id": graph_context["resource_node_id"],
        "neighbor_node_ids": graph_context["neighbor_node_ids"],
        "edge_types": graph_context["edge_types"],
        "source_span_ids": [span["span_id"] for span in spans],
        "review_task_ids": [],
        "coverage_status": coverage_status,
        "interpretability_summary": _interpretability_summary(coverage_status, len(spans), len(graph_context["neighbor_node_ids"])),
    }


def _metadata_hit(resource: dict[str, Any], source_spans: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {**resource, **_resource_interpretability_fields(resource, source_spans)}


def _safe_source_span(span: dict[str, Any]) -> dict[str, Any]:
    return {
        "span_id": span.get("span_id"),
        "resource_id": span.get("resource_id"),
        "document_id": span.get("document_id", span.get("source_document_id")),
        "source_document_id": span.get("source_document_id"),
        "access_date": span.get("access_date"),
        "stable_locator": span.get("stable_locator"),
        "excerpt": span.get("bounded_excerpt", span.get("quoted_text", span.get("quoted_span"))),
        "quoted_span": span.get("quoted_span"),
        "excerpt_checksum": span.get("excerpt_checksum"),
        "checksum_sha256": span.get("checksum_sha256", span.get("excerpt_checksum")),
        "prompt_or_model_version": span.get("prompt_or_model_version"),
        "reviewer": span.get("reviewer"),
        "review_status": span.get("review_status"),
        "timestamp": span.get("timestamp"),
        "output_status": span.get("output_status", span.get("status", "draft")),
    }


def _source_span_hit(span: dict[str, Any], resource: dict[str, Any]) -> dict[str, Any]:
    safe_span = _safe_source_span(span)
    fields = _resource_interpretability_fields(resource, [span])
    return {
        **safe_span,
        **fields,
        "focus_node_id": resource["node_id"],
        "source_span_ids": [span["span_id"]],
        "focus_resource": _metadata_hit(resource, [span]),
    }


def _get_corpus_resource(resource_id: str) -> dict[str, Any]:
    for resource in _corpus_resources():
        if resource["resource_id"] == resource_id:
            return resource
    raise HTTPException(status_code=404, detail=f"corpus resource not found: {resource_id}")


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
    metadata_results = [_metadata_hit(resource) for resource in filtered_resources if query and _metadata_search_match(resource, query)]
    source_span_resource_ids = {resource["resource_id"] for resource in filtered_resources}
    source_span_coverage_ids = {
        span["resource_id"] for span in _validated_corpus_source_spans(source_span_resource_ids) if isinstance(span.get("resource_id"), str)
    }
    source_span_results = _source_span_search_results(query, source_span_resource_ids) if query else []
    return {
        "query": q,
        "metadata_results": metadata_results,
        "source_span_results": source_span_results,
        "metadata_result_count": len(metadata_results),
        "source_span_result_count": len(source_span_results),
        "source_span_coverage_count": len(source_span_coverage_ids),
        "source_span_coverage_note": "Search checks metadata for all 198 resources and canonical validated source-span excerpts for filtered resources; spans containing safety-blocked advice language are excluded.",
        "total_resource_count": len(_corpus_resources()),
        "model_routing": MODEL_ROUTING,
    }


@router.get("/corpus/interpretability")
def get_corpus_interpretability(resource_id: str) -> dict[str, Any]:
    resource = _get_corpus_resource(resource_id)
    source_spans = _validated_corpus_source_spans({resource_id})
    graph_context = _resource_graph_context(resource)
    coverage_status = _coverage_status(resource, source_spans)
    review_queue_items = _review_queue_items_from_source_spans(source_spans)
    return {
        "resource": _metadata_hit(resource),
        "graph_neighborhood": {
            "focus_node_id": resource["node_id"],
            "resource_node_id": graph_context["resource_node_id"],
            "neighbor_node_ids": graph_context["neighbor_node_ids"],
            "edge_types": graph_context["edge_types"],
            "neighbor_nodes": graph_context["neighbor_nodes"],
            "edges": graph_context["edges"],
        },
        "source_spans": [_safe_source_span(span) for span in source_spans],
        "surveillance_status": _offline_surveillance_status(),
        "review_queue_items": review_queue_items,
        "review_task_ids": [item["review_task_id"] for item in review_queue_items],
        "review_queue_contract": {
            "source_of_truth": "validated_loaded_source_spans",
            "invalid_unbacked_items": "metadata_only_excluded_from_production_queue",
        },
        "coverage_status": coverage_status,
        "coverage_status_vocabulary": sorted(COVERAGE_STATUS_VOCABULARY),
        "model_routing": MODEL_ROUTING,
    }


@router.get("/corpus/source-spans")
def get_corpus_source_spans(resource_id: str | None = None) -> dict[str, Any]:
    parse_subset_ids = _load_parse_subset_ids()
    spans = _validated_corpus_source_spans(parse_subset_ids)
    if resource_id is not None:
        spans = [span for span in spans if span.get("resource_id") == resource_id]
    safe_spans = [_safe_source_span(span) for span in spans]
    return {
        "source_spans": safe_spans,
        "count": len(safe_spans),
        "coverage_count": SOURCE_SPAN_COVERAGE_COUNT,
        "coverage_resource_ids": sorted(parse_subset_ids),
        "coverage_note": "Only the five-row parsed subset is eligible for source-span coverage; absent derived files mean no source-span records are reported.",
    }
