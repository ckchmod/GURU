from __future__ import annotations

from copy import deepcopy
from typing import Any

from services.api.app.corpus_graph import build_public_corpus_graph, load_public_corpus


CLAIM_LIKE_NODE_TYPES = {
    "Recommendation",
    "EvidenceItem",
    "Citation",
    "FundingRule",
    "ReviewDecision",
    "ModelTrace",
}


def test_public_corpus_graph_projects_exactly_198_resource_nodes() -> None:
    graph = build_public_corpus_graph()

    resource_nodes = [node for node in graph["nodes"] if node["type"] == "resource"]
    assert len(resource_nodes) == 198
    assert graph["metadata"]["resource_node_count"] == 198
    assert len({node["resource_id"] for node in resource_nodes}) == 198
    assert len([edge for edge in graph["edges"] if edge["type"] == "resource_to_disease_site"]) == 198
    assert len([edge for edge in graph["edges"] if edge["type"] == "resource_to_document_type"]) == 198
    assert len([edge for edge in graph["edges"] if edge["type"] == "resource_to_archive_status"]) == 198


def test_public_corpus_cluster_counts_derive_from_registry_metadata() -> None:
    registry = load_public_corpus()
    rows = registry["rows"]
    graph = build_public_corpus_graph(registry)

    expected_disease_sites = {_cluster_value(row.get("disease_site")) for row in rows}
    expected_document_types = {_cluster_value(row.get("resource_type")) for row in rows}
    expected_statuses = {"metadata-only:not-parsed"}

    assert graph["metadata"]["disease_site_cluster_count"] == len(expected_disease_sites) == 19
    assert graph["metadata"]["document_type_cluster_count"] == len(expected_document_types) == 6
    assert graph["metadata"]["archive_status_cluster_count"] == len(expected_statuses) == 1
    assert _node_values(graph, "disease_site_cluster") == expected_disease_sites
    assert _node_values(graph, "document_type_cluster") == expected_document_types
    assert _node_values(graph, "archive_status") == expected_statuses


def test_resource_nodes_preserve_safe_registry_metadata_and_provenance() -> None:
    graph = build_public_corpus_graph()
    node = next(
        node
        for node in graph["nodes"]
        if node["id"] == "resource.ahs-guru-breast-br005-adjuvant-rt-invasive-breast"
    )

    assert node["title"] == "Adjuvant Radiotherapy for Invasive Breast Cancer"
    assert node["disease_site"] == "breast"
    assert node["document_type"] == "guideline"
    assert node["resource_type"] == "guideline"
    assert node["url"].endswith("if-hp-cancer-guide-br005-adjuvant-rt-invasive-breast.pdf")
    assert node["access_date"] == "2026-06-15"
    assert node["archive_status"] == "metadata-only"
    assert node["parse_status"] == "not-parsed"
    assert node["provenance"]["source_document_identifier"] == "resources/registry/ahs-guru-public-corpus.json"
    assert node["provenance"]["stable_locator"].startswith("rows[")
    assert node["provenance"]["generated_by"] == "corpus-metadata-graph-v1"


def test_missing_cluster_metadata_maps_to_explicit_unknown_nodes() -> None:
    registry = _registry_with_rows(
        [
            _row(
                resource_id="safe-resource-with-missing-metadata",
                title="Metadata Row With Missing Cluster Fields",
                disease_site=" ",
                resource_type="",
            )
        ]
    )

    graph = build_public_corpus_graph(registry)
    resource = next(node for node in graph["nodes"] if node["type"] == "resource")

    assert resource["disease_site"] == "unknown"
    assert resource["document_type"] == "unknown"
    assert "disease-site.unknown" in {node["id"] for node in graph["nodes"]}
    assert "document-type.unknown" in {node["id"] for node in graph["nodes"]}
    assert "archive-status.metadata-only.not-parsed" in {node["id"] for node in graph["nodes"]}


def test_duplicate_resource_ids_keep_first_row_and_record_duplicate() -> None:
    first = _row(resource_id="duplicate-safe-resource", title="First Safe Title", disease_site="breast")
    second = _row(resource_id="duplicate-safe-resource", title="Second Safe Title", disease_site="lung")

    graph = build_public_corpus_graph(_registry_with_rows([first, second]))
    resource_nodes = [node for node in graph["nodes"] if node["type"] == "resource"]

    assert len(resource_nodes) == 1
    assert resource_nodes[0]["title"] == "First Safe Title"
    assert graph["metadata"]["duplicate_resource_ids"] == ["duplicate-safe-resource"]
    assert len(graph["edges"]) == 3


def test_special_characters_and_long_titles_are_preserved() -> None:
    long_title = "Safe metadata title: CCA/GURU & AHS updates (2026) - " + "x" * 180
    graph = build_public_corpus_graph(
        _registry_with_rows([_row(resource_id="special-title-resource", title=long_title, disease_site="head & neck")])
    )

    resource = next(node for node in graph["nodes"] if node["type"] == "resource")

    disease_cluster = next(node for node in graph["nodes"] if node["type"] == "disease_site_cluster")


    assert resource["title"] == long_title
    assert resource["label"] == long_title
    assert disease_cluster["id"] == "disease-site.head-neck"
    assert disease_cluster["value"] == "head-&-neck"


def test_projection_emits_no_claim_like_or_source_span_nodes() -> None:
    graph = build_public_corpus_graph()
    node_types = {node["type"] for node in graph["nodes"]}

    assert node_types == {"resource", "disease_site_cluster", "document_type_cluster", "archive_status"}
    assert node_types.isdisjoint(CLAIM_LIKE_NODE_TYPES)
    assert "source_span" not in node_types
    assert {edge["type"] for edge in graph["edges"]} == {
        "resource_to_disease_site",
        "resource_to_document_type",
        "resource_to_archive_status",
    }


def _node_values(graph: dict[str, Any], node_type: str) -> set[str]:
    return {node["value"] for node in graph["nodes"] if node["type"] == node_type}


def _cluster_value(value: Any) -> str:
    if not isinstance(value, str):
        return "unknown"
    normalized = value.strip().lower().replace("_", "-").replace(" ", "-")
    return normalized or "unknown"


def _registry_with_rows(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "registry_version": "1.0.0",
        "last_updated": "2026-06-15",
        "category": "AHS/GURU public corpus",
        "rows": rows,
    }


def _row(
    *,
    resource_id: str,
    title: str,
    disease_site: str = "breast",
    resource_type: str = "guideline",
) -> dict[str, Any]:
    row = {
        "resource_id": resource_id,
        "title": title,
        "source_owner": "Alberta Health Services / Cancer Care Alberta / GURU",
        "source_url_or_access_path": f"https://example.test/{resource_id}.pdf",
        "access_method": "public_url",
        "access_date": "2026-06-15",
        "resource_type": resource_type,
        "jurisdiction": "CA-AB",
        "disease_site": disease_site,
        "document_status": "unknown",
        "version_or_date": "accessed 2026-06-15",
        "license_status": "government_open",
        "allowed_use": ["link", "view", "metadata"],
        "permission_required": False,
        "permission_status": "not_applicable",
        "local_storage_decision": "local raw archive",
        "checksum_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "notes": "Synthetic metadata-only test row. No clinical recommendations, excerpts, PHI, or patient-specific advice.",
    }
    return deepcopy(row)
