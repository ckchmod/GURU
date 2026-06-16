from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[3]
PUBLIC_CORPUS_PATH = ROOT / "resources" / "registry" / "ahs-guru-public-corpus.json"
PROJECTION_VERSION = "corpus-metadata-graph-v1"
DEFAULT_ARCHIVE_STATUS = "metadata_only"
DEFAULT_PARSE_STATUS = "not_parsed"
UNKNOWN_CLUSTER_VALUE = "unknown"

CLAIM_LIKE_NODE_TYPES = {
    "Recommendation",
    "EvidenceItem",
    "Citation",
    "FundingRule",
    "ReviewDecision",
    "ModelTrace",
}


def load_public_corpus(path: Path = PUBLIC_CORPUS_PATH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def build_public_corpus_graph(registry: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = registry if registry is not None else load_public_corpus()
    rows = payload.get("rows", [])
    if not isinstance(rows, list):
        raise ValueError("registry rows must be a list")

    registry_version = _string_or_unknown(payload.get("registry_version"))
    registry_last_updated = _string_or_unknown(payload.get("last_updated"))
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, str]] = []
    cluster_nodes: dict[str, dict[str, Any]] = {}
    seen_resource_ids: set[str] = set()
    duplicate_resource_ids: list[str] = []

    for row_index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            continue
        resource_id = _normalize_required_resource_id(row.get("resource_id"))
        if resource_id in seen_resource_ids:
            duplicate_resource_ids.append(resource_id)
            continue
        seen_resource_ids.add(resource_id)

        disease_site = _cluster_value(row.get("disease_site"))
        document_type = _cluster_value(row.get("document_type", row.get("resource_type")))
        archive_status = _cluster_value(row.get("archive_status", DEFAULT_ARCHIVE_STATUS))
        parse_status = _cluster_value(row.get("parse_status", DEFAULT_PARSE_STATUS))
        resource_node_id = f"resource.{resource_id}"
        disease_node_id = _cluster_node_id("disease-site", disease_site)
        document_type_node_id = _cluster_node_id("document-type", document_type)
        status_node_id = _cluster_node_id("archive-status", f"{archive_status}.{parse_status}")

        nodes.append(
            _resource_node(
                row=row,
                row_index=row_index,
                resource_node_id=resource_node_id,
                resource_id=resource_id,
                disease_site=disease_site,
                document_type=document_type,
                archive_status=archive_status,
                parse_status=parse_status,
                registry_version=registry_version,
                registry_last_updated=registry_last_updated,
            )
        )
        cluster_nodes.setdefault(
            disease_node_id,
            _cluster_node(
                node_id=disease_node_id,
                node_type="disease_site_cluster",
                label=_cluster_label("Disease site", disease_site),
                value=disease_site,
                registry_version=registry_version,
                registry_last_updated=registry_last_updated,
            ),
        )
        cluster_nodes.setdefault(
            document_type_node_id,
            _cluster_node(
                node_id=document_type_node_id,
                node_type="document_type_cluster",
                label=_cluster_label("Document type", document_type),
                value=document_type,
                registry_version=registry_version,
                registry_last_updated=registry_last_updated,
            ),
        )
        cluster_nodes.setdefault(
            status_node_id,
            _status_cluster_node(
                node_id=status_node_id,
                archive_status=archive_status,
                parse_status=parse_status,
                registry_version=registry_version,
                registry_last_updated=registry_last_updated,
            ),
        )
        edges.extend(
            [
                _edge(resource_node_id, disease_node_id, "resource_to_disease_site"),
                _edge(resource_node_id, document_type_node_id, "resource_to_document_type"),
                _edge(resource_node_id, status_node_id, "resource_to_archive_status"),
            ]
        )

    nodes.extend(cluster_nodes[node_id] for node_id in sorted(cluster_nodes))
    return {
        "graph_version": "1.0.0",
        "projection_version": PROJECTION_VERSION,
        "registry_version": registry_version,
        "registry_last_updated": registry_last_updated,
        "source_registry": "resources/registry/ahs-guru-public-corpus.json",
        "nodes": nodes,
        "edges": edges,
        "metadata": {
            "resource_node_count": len(seen_resource_ids),
            "disease_site_cluster_count": _count_nodes(cluster_nodes.values(), "disease_site_cluster"),
            "document_type_cluster_count": _count_nodes(cluster_nodes.values(), "document_type_cluster"),
            "archive_status_cluster_count": _count_nodes(cluster_nodes.values(), "archive_status"),
            "duplicate_resource_ids": duplicate_resource_ids,
            "claim_like_node_types_excluded": sorted(CLAIM_LIKE_NODE_TYPES),
        },
    }


def _resource_node(
    *,
    row: dict[str, Any],
    row_index: int,
    resource_node_id: str,
    resource_id: str,
    disease_site: str,
    document_type: str,
    archive_status: str,
    parse_status: str,
    registry_version: str,
    registry_last_updated: str,
) -> dict[str, Any]:
    title = _string_or_unknown(row.get("title"))
    access_date = _string_or_unknown(row.get("access_date"))
    return {
        "id": resource_node_id,
        "type": "resource",
        "label": title,
        "resource_id": resource_id,
        "title": title,
        "disease_site": disease_site,
        "document_type": document_type,
        "resource_type": document_type,
        "url": _string_or_unknown(row.get("url", row.get("source_url_or_access_path"))),
        "access_date": access_date,
        "archive_status": archive_status,
        "parse_status": parse_status,
        "document_status": _string_or_unknown(row.get("document_status")),
        "license_status": _string_or_unknown(row.get("license_status")),
        "allowed_use": list(row.get("allowed_use", [])) if isinstance(row.get("allowed_use"), list) else [],
        "local_storage_decision": _string_or_unknown(row.get("local_storage_decision")),
        "checksum_sha256": _string_or_unknown(row.get("checksum_sha256")),
        "output_status": "draft",
        "provenance": _provenance(
            access_date=access_date,
            registry_version=registry_version,
            registry_last_updated=registry_last_updated,
            stable_locator=f"rows[{row_index}].resource_id:{resource_id}",
        ),
    }


def _cluster_node(
    *,
    node_id: str,
    node_type: str,
    label: str,
    value: str,
    registry_version: str,
    registry_last_updated: str,
) -> dict[str, Any]:
    return {
        "id": node_id,
        "type": node_type,
        "label": label,
        "value": value,
        "output_status": "draft",
        "provenance": _provenance(
            access_date=registry_last_updated,
            registry_version=registry_version,
            registry_last_updated=registry_last_updated,
            stable_locator=f"cluster:{node_type}:{value}",
        ),
    }


def _status_cluster_node(
    *,
    node_id: str,
    archive_status: str,
    parse_status: str,
    registry_version: str,
    registry_last_updated: str,
) -> dict[str, Any]:
    node = _cluster_node(
        node_id=node_id,
        node_type="archive_status",
        label=f"Archive: {archive_status} / Parse: {parse_status}",
        value=f"{archive_status}:{parse_status}",
        registry_version=registry_version,
        registry_last_updated=registry_last_updated,
    )
    node["archive_status"] = archive_status
    node["parse_status"] = parse_status
    return node


def _edge(source: str, target: str, edge_type: str) -> dict[str, str]:
    return {
        "id": f"edge.{edge_type}.{source}.{target}",
        "source": source,
        "target": target,
        "type": edge_type,
    }


def _provenance(*, access_date: str, registry_version: str, registry_last_updated: str, stable_locator: str) -> dict[str, str]:
    return {
        "source_document_identifier": "resources/registry/ahs-guru-public-corpus.json",
        "source_url_or_access_path": "resources/registry/ahs-guru-public-corpus.json",
        "access_date": access_date,
        "stable_locator": stable_locator,
        "registry_version": registry_version,
        "registry_last_updated": registry_last_updated,
        "generated_by": PROJECTION_VERSION,
        "review_status": "unreviewed",
        "output_status": "draft",
    }


def _normalize_required_resource_id(value: Any) -> str:
    normalized = _cluster_value(value)
    if normalized == UNKNOWN_CLUSTER_VALUE:
        raise ValueError("resource rows must have a stable resource_id")
    return normalized


def _cluster_value(value: Any) -> str:
    if not isinstance(value, str):
        return UNKNOWN_CLUSTER_VALUE
    normalized = value.strip().lower().replace("_", "-")
    normalized = re.sub(r"\s+", "-", normalized)
    return normalized or UNKNOWN_CLUSTER_VALUE


def _string_or_unknown(value: Any) -> str:
    if not isinstance(value, str):
        return UNKNOWN_CLUSTER_VALUE
    stripped = value.strip()
    return stripped or UNKNOWN_CLUSTER_VALUE


def _cluster_node_id(prefix: str, value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9_.:-]+", "-", value.lower())
    safe_value = re.sub(r"-+", "-", cleaned).strip("-_.:") or UNKNOWN_CLUSTER_VALUE
    return f"{prefix}.{safe_value}"


def _cluster_label(prefix: str, value: str) -> str:
    return f"{prefix}: {value}" if value != UNKNOWN_CLUSTER_VALUE else f"{prefix}: Unknown"


def _count_nodes(nodes: Any, node_type: str) -> int:
    return sum(1 for node in nodes if node.get("type") == node_type)
