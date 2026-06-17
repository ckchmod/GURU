from __future__ import annotations

import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from fastapi.testclient import TestClient

from services.api.app import knowledgebase
from services.api.app.main import app


client = TestClient(app)

PILOT_RESOURCE_ID = "ahs-guru-breast-br005-adjuvant-rt-invasive-breast"
ADVICE_PATTERNS = ("you should", "your patient", "dose", "diagnosis", "treatment recommendation")
CORPUS_ADVICE_PATTERNS = ("dosing", "diagnosis", "treatment advice", "recommended regimen", "patient-specific")
BLOCKED_PLACEHOLDER_LABELS = ("Synthetic", "Packet Alpha", "Model Trace Stub", "Evidence Hub", "Mock", "Demo", "Placeholder")
EXPECTED_COVERAGE_STATUSES = {
    "source_span_ready",
    "partial_source_span",
    "metadata_only",
    "download_failed",
    "checksum_mismatch",
    "parse_failed",
}
TYPED_CLAIM_FIXTURE_PATH = Path("tests/fixtures/graph-provenance/typed-claim-eval-contract.json")
FORBIDDEN_GRAPH_RAG_CONTEXT_FIELDS = {
    "answer_text",
    "chunks",
    "document_bytes",
    "document_text",
    "full_document",
    "full_text",
    "generated_answer",
    "generated_response",
    "generated_summary",
    "output_text",
    "pdf_bytes",
    "raw_chunks",
    "raw_pdf",
    "raw_pdf_bytes",
}


def assert_no_patient_specific_advice(payload: Any) -> None:
    rendered = str(payload).lower()
    for pattern in ADVICE_PATTERNS:
        assert pattern not in rendered


def assert_no_blocked_placeholder_labels(payload: Any) -> None:
    rendered = str(payload)
    for label in BLOCKED_PLACEHOLDER_LABELS:
        assert label not in rendered


def assert_no_corpus_patient_specific_advice_strings(payload: Any) -> None:
    rendered = str(payload).lower()
    for pattern in CORPUS_ADVICE_PATTERNS:
        assert pattern not in rendered


def assert_no_generated_answer_or_clinical_claim_fields(payload: Any) -> None:
    blocked_keys = {
        "generated_answer",
        "generated_response",
        "generated_summary",
        "clinical_answer",
        "clinical_summary",
        "recommendation",
        "recommendations",
        "recommendation_text",
        "suggested_treatment",
        "dosing",
    }
    if isinstance(payload, dict):
        assert blocked_keys.isdisjoint(payload)
        for value in payload.values():
            assert_no_generated_answer_or_clinical_claim_fields(value)
    elif isinstance(payload, list):
        for value in payload:
            assert_no_generated_answer_or_clinical_claim_fields(value)


def assert_no_forbidden_graph_rag_context_fields(payload: Any) -> None:
    if isinstance(payload, dict):
        assert FORBIDDEN_GRAPH_RAG_CONTEXT_FIELDS.isdisjoint(payload)
        for value in payload.values():
            assert_no_forbidden_graph_rag_context_fields(value)
    elif isinstance(payload, list):
        for value in payload:
            assert_no_forbidden_graph_rag_context_fields(value)


def valid_corpus_span(resource_id: str, excerpt: str = "Local deterministic parsed excerpt for search coverage.") -> dict[str, Any]:
    checksum = hashlib.sha256(excerpt.encode("utf-8")).hexdigest()
    return {
        "span_id": f"source-span.{resource_id}.local-test",
        "resource_id": resource_id,
        "document_id": f"source-document.{resource_id}.local-test",
        "source_document_id": f"source-document.{resource_id}.local-test",
        "access_date": "2026-06-15",
        "stable_locator": "page:1;span:1",
        "bounded_excerpt": excerpt,
        "quoted_span": excerpt,
        "quoted_text": excerpt,
        "excerpt_checksum": checksum,
        "checksum_sha256": checksum,
        "prompt_or_model_version": "none-local-deterministic-parser",
        "reviewer": "unreviewed",
        "review_status": "draft",
        "timestamp": "2026-06-16T06:20:00Z",
        "output_status": "draft",
    }


def test_health_still_returns_exact_payload() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "guru-api"}


def test_resources_list_uses_pilot_registry_metadata() -> None:
    response = client.get("/knowledgebase/resources")

    assert response.status_code == 200
    payload = response.json()
    resource_ids = {resource["resource_id"] for resource in payload["resources"]}
    assert PILOT_RESOURCE_ID in resource_ids
    assert "ahs-guru-central-nervous-system-cns014-management-of-brain-metastases" in resource_ids
    assert all(resource["data_source"] == "local_pilot_registry_fixture" for resource in payload["resources"])
    assert_no_patient_specific_advice(payload)


def test_resource_lookup_returns_metadata_only_record() -> None:
    response = client.get(f"/knowledgebase/resources/{PILOT_RESOURCE_ID}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["resource_id"] == PILOT_RESOURCE_ID
    assert payload["title"] == "Adjuvant Radiotherapy for Invasive Breast Cancer"
    assert payload["status"] == "draft"
    assert_no_patient_specific_advice(payload)


def test_source_document_and_span_lookup_return_safe_fixture_records() -> None:
    graph_record = client.get(f"/knowledgebase/graph-records/knowledgebase-record.{PILOT_RESOURCE_ID}").json()
    document_id = graph_record["source_document_id"]
    span_id = graph_record["source_span_ids"][0]

    document_response = client.get(f"/knowledgebase/source-documents/{document_id}")
    span_response = client.get(f"/knowledgebase/source-spans/{span_id}")

    assert document_response.status_code == 200
    assert span_response.status_code == 200
    source_document = document_response.json()
    source_span = span_response.json()
    assert source_document["record_type"] == "source_document"
    assert source_document["resource_id"] == PILOT_RESOURCE_ID
    assert source_document["status"] == "draft"
    assert source_span["record_type"] == "source_span"
    assert source_span["span_id"] == span_id
    assert source_span["document_id"] == document_id
    assert source_span["quoted_text"] == source_span["quoted_span"]
    assert "patient facts" in source_span["quoted_text"]
    assert_no_patient_specific_advice(source_document)
    assert_no_patient_specific_advice(source_span)


def test_graph_ready_record_includes_source_spans_and_no_llm_model() -> None:
    response = client.get(f"/knowledgebase/graph-records/knowledgebase-record.{PILOT_RESOURCE_ID}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["record_type"] == "knowledgebase_record"
    assert payload["resource_id"] == PILOT_RESOURCE_ID
    assert len(payload["source_span_ids"]) == 3
    assert all(span_id.startswith("source-span.") for span_id in payload["source_span_ids"])
    assert payload["model_version"] == "none-local-fixture-only"
    assert_no_patient_specific_advice(payload)


def test_missing_ids_return_clear_404_errors() -> None:
    response = client.get("/knowledgebase/source-spans/missing-span")

    assert response.status_code == 404
    assert response.json() == {"detail": "source_spans record not found: missing-span"}


def test_corpus_resources_expose_all_198_public_metadata_rows() -> None:
    response = client.get("/knowledgebase/corpus/resources")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 198
    assert payload["total_count"] == 198
    assert set(payload["response_state_vocabulary"]) == {
        "metadata_only",
        "downloaded_unparsed",
        "parsed",
        "download_failed",
        "parse_failed",
    }
    assert len({resource["resource_id"] for resource in payload["resources"]}) == 198
    assert all(resource["raw_pdf_exposed"] is False for resource in payload["resources"])
    assert "generated_answer" not in payload
    assert "raw_pdf_bytes" not in payload
    assert_no_corpus_patient_specific_advice_strings(payload)
    assert_no_blocked_placeholder_labels(payload)


def test_corpus_graph_endpoint_reuses_task_6_projection_counts() -> None:
    response = client.get("/knowledgebase/corpus/graph")

    assert response.status_code == 200
    graph = response.json()
    resource_nodes = [node for node in graph["nodes"] if node["type"] == "resource"]
    assert len(resource_nodes) == 198
    assert graph["metadata"]["resource_node_count"] == 198
    assert graph["metadata"]["disease_site_cluster_count"] == 19
    assert graph["metadata"]["document_type_cluster_count"] == 6
    assert graph["metadata"]["archive_status_cluster_count"] == 1
    assert graph["metadata"]["source_span_coverage_count"] == 5
    assert graph["metadata"]["source_span_node_count"] == 0
    assert_no_corpus_patient_specific_advice_strings(graph)
    assert_no_blocked_placeholder_labels(graph)


def test_corpus_resource_filters_support_single_combined_and_empty_results() -> None:
    breast_response = client.get("/knowledgebase/corpus/resources", params={"disease_site": "breast"})
    evidence_response = client.get("/knowledgebase/corpus/resources", params={"resource_type": "evidence_table"})
    combined_response = client.get(
        "/knowledgebase/corpus/resources",
        params={"disease_site": "breast", "resource_type": "guideline", "document_status": "unknown"},
    )
    empty_response = client.get(
        "/knowledgebase/corpus/resources",
        params={"disease_site": "not-a-site", "resource_type": "guideline"},
    )

    assert breast_response.status_code == 200
    assert evidence_response.status_code == 200
    assert combined_response.status_code == 200
    assert empty_response.status_code == 200
    assert breast_response.json()["count"] > 0
    assert all(resource["disease_site"] == "breast" for resource in breast_response.json()["resources"])
    assert evidence_response.json()["count"] > 0
    assert all(resource["resource_type"] == "evidence_table" for resource in evidence_response.json()["resources"])
    assert combined_response.json()["count"] > 0
    assert all(
        resource["disease_site"] == "breast"
        and resource["resource_type"] == "guideline"
        and resource["document_status"] == "unknown"
        for resource in combined_response.json()["resources"]
    )
    assert empty_response.json()["resources"] == []
    assert empty_response.json()["count"] == 0


def test_corpus_filters_support_archive_and_parse_status_aliases() -> None:
    response = client.get(
        "/knowledgebase/corpus/resources",
        params={"archive_status": "metadata-only", "parse_status": "not_parsed"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 198
    assert all(resource["archive_status"] == "metadata_only" for resource in payload["resources"])
    assert all(resource["parse_status"] == "not_parsed" for resource in payload["resources"])
    assert all(resource["response_state"] == "metadata_only" for resource in payload["resources"])


def test_corpus_search_is_case_insensitive_over_public_metadata() -> None:
    response = client.get("/knowledgebase/corpus/search", params={"q": "adjuvant radiotherapy"})
    upper_response = client.get("/knowledgebase/corpus/search", params={"q": "BREAST"})
    id_response = client.get("/knowledgebase/corpus/search", params={"q": "CNS014"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["metadata_result_count"] >= 1
    pilot_hit = next(resource for resource in payload["metadata_results"] if resource["resource_id"] == PILOT_RESOURCE_ID)
    assert pilot_hit["focus_node_id"] == f"resource.{PILOT_RESOURCE_ID}"
    assert pilot_hit["resource_node_id"] == f"resource.{PILOT_RESOURCE_ID}"
    assert pilot_hit["neighbor_node_ids"]
    assert set(pilot_hit["edge_types"]) == {
        "resource_to_archive_status",
        "resource_to_disease_site",
        "resource_to_document_type",
    }
    assert isinstance(pilot_hit["source_span_ids"], list)
    assert pilot_hit["review_task_ids"] == []
    assert pilot_hit["coverage_status"] in EXPECTED_COVERAGE_STATUSES
    assert pilot_hit["interpretability_summary"]["model_routing"] == "none-local-deterministic-search-only"
    assert upper_response.json()["metadata_result_count"] > 0
    assert all("breast" in str(resource).lower() for resource in upper_response.json()["metadata_results"])
    assert id_response.json()["metadata_result_count"] == 1
    assert id_response.json()["metadata_results"][0]["resource_id"] == "ahs-guru-central-nervous-system-cns014-management-of-brain-metastases"


def test_corpus_search_bounds_safe_generic_radiotherapy_query() -> None:
    response = client.get("/knowledgebase/corpus/search", params={"q": "radiotherapy"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["query"] == "radiotherapy"
    assert payload["metadata_result_count"] >= 1
    assert payload["source_span_result_count"] <= 12
    assert len(payload["source_span_results"]) == payload["source_span_result_count"]
    assert payload["model_routing"] == "none-local-deterministic-search-only"
    assert "generated_answer" not in payload
    assert_no_generated_answer_or_clinical_claim_fields(payload)
    assert_no_corpus_patient_specific_advice_strings(payload)


def test_corpus_search_returns_empty_for_nonsense_or_blank_queries() -> None:
    nonsense_response = client.get("/knowledgebase/corpus/search", params={"q": "zzzz-no-such-guideline"})
    blank_response = client.get("/knowledgebase/corpus/search", params={"q": "   "})

    assert nonsense_response.status_code == 200
    assert blank_response.status_code == 200
    assert nonsense_response.json()["metadata_results"] == []
    assert nonsense_response.json()["source_span_results"] == []
    assert blank_response.json()["metadata_result_count"] == 0
    assert blank_response.json()["source_span_result_count"] == 0
    assert blank_response.json()["model_routing"] == "none-local-deterministic-search-only"
    assert "generated_answer" not in blank_response.json()


def test_corpus_source_span_endpoints_report_five_row_partial_coverage() -> None:
    source_span_response = client.get("/knowledgebase/corpus/source-spans")
    search_response = client.get("/knowledgebase/corpus/search", params={"q": "source span fixture phrase"})

    assert source_span_response.status_code == 200
    source_span_payload = source_span_response.json()
    assert source_span_payload["coverage_count"] == 5
    assert len(source_span_payload["coverage_resource_ids"]) == 5
    assert source_span_payload["count"] >= 0
    assert all(span["prompt_or_model_version"] == "none-local-deterministic-parser" for span in source_span_payload["source_spans"])
    assert search_response.status_code == 200
    assert search_response.json()["source_span_coverage_count"] >= 0
    assert search_response.json()["source_span_result_count"] == 0
    assert search_response.json()["total_resource_count"] == 198


def test_corpus_search_uses_only_local_loaded_source_spans(monkeypatch: Any) -> None:
    monkeypatch.setattr(
        knowledgebase,
        "_load_corpus_source_spans",
        lambda: [valid_corpus_span(PILOT_RESOURCE_ID)],
    )

    response = client.get("/knowledgebase/corpus/search", params={"q": "deterministic parsed excerpt"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["model_routing"] == "none-local-deterministic-search-only"
    assert payload["source_span_result_count"] == 1
    span_hit = payload["source_span_results"][0]
    assert span_hit["focus_node_id"] == f"resource.{PILOT_RESOURCE_ID}"
    assert span_hit["resource_node_id"] == f"resource.{PILOT_RESOURCE_ID}"
    assert span_hit["neighbor_node_ids"]
    assert span_hit["edge_types"]
    assert span_hit["source_span_ids"] == [f"source-span.{PILOT_RESOURCE_ID}.local-test"]
    assert span_hit["review_task_ids"] == []
    assert span_hit["coverage_status"] == "source_span_ready"
    assert span_hit["interpretability_summary"]["coverage_status"] == "source_span_ready"
    assert span_hit["source_document_id"] == f"source-document.{PILOT_RESOURCE_ID}.local-test"
    assert span_hit["stable_locator"] == "page:1;span:1"
    assert span_hit["excerpt_checksum"] == hashlib.sha256(span_hit["quoted_span"].encode("utf-8")).hexdigest()
    assert "generated_answer" not in payload
    assert "summary" not in payload
    assert_no_corpus_patient_specific_advice_strings(payload)
    assert_no_blocked_placeholder_labels(payload)


def test_corpus_search_includes_validated_source_spans_outside_parse_subset(monkeypatch: Any) -> None:
    parse_subset_ids = knowledgebase._load_parse_subset_ids()
    non_subset_resource = next(
        resource
        for resource in knowledgebase._corpus_resources()
        if resource["resource_id"] not in parse_subset_ids
    )
    monkeypatch.setattr(
        knowledgebase,
        "_load_corpus_source_spans",
        lambda: [valid_corpus_span(non_subset_resource["resource_id"], "Unique non subset local parser excerpt for search boundary.")],
    )

    response = client.get("/knowledgebase/corpus/search", params={"q": "unique non subset local parser excerpt"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_span_result_count"] == 1
    assert payload["source_span_results"][0]["resource_id"] == non_subset_resource["resource_id"]


def test_corpus_search_excludes_unvalidated_source_spans(monkeypatch: Any) -> None:
    invalid_span = valid_corpus_span(PILOT_RESOURCE_ID, "Unique invalid checksum local parser excerpt.")
    invalid_span["excerpt_checksum"] = "0" * 64
    monkeypatch.setattr(knowledgebase, "_load_corpus_source_spans", lambda: [invalid_span])

    response = client.get("/knowledgebase/corpus/search", params={"q": "unique invalid checksum"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_span_result_count"] == 0
    assert payload["source_span_results"] == []


def test_corpus_interpretability_endpoint_returns_local_deterministic_contract(monkeypatch: Any) -> None:
    monkeypatch.setattr(knowledgebase, "_load_corpus_source_spans", lambda: [valid_corpus_span(PILOT_RESOURCE_ID)])

    response = client.get("/knowledgebase/corpus/interpretability", params={"resource_id": PILOT_RESOURCE_ID})

    payload = response.json()

    assert response.status_code == 200
    assert payload["resource"]["resource_id"] == PILOT_RESOURCE_ID
    assert payload["resource"]["focus_node_id"] == f"resource.{PILOT_RESOURCE_ID}"
    assert payload["graph_neighborhood"]["resource_node_id"] == f"resource.{PILOT_RESOURCE_ID}"
    assert payload["graph_neighborhood"]["neighbor_node_ids"]
    assert payload["source_spans"][0]["span_id"] == f"source-span.{PILOT_RESOURCE_ID}.local-test"
    assert payload["surveillance_status"]["mode"] == "local_manifest_status_only"
    assert set(payload["surveillance_status"]) >= {
        "changed_count",
        "missing_count",
        "unchanged_count",
        "needs_review_count",
        "resource_statuses",
    }
    assert PILOT_RESOURCE_ID in payload["surveillance_status"]["resource_statuses"]
    assert len(payload["review_queue_items"]) == 1
    review_item = payload["review_queue_items"][0]
    assert review_item == {
        "review_task_id": f"workflow-task.{PILOT_RESOURCE_ID}.source-span.{PILOT_RESOURCE_ID}.local-test.evidence-review",
        "resource_id": PILOT_RESOURCE_ID,
        "source_span_ids": [f"source-span.{PILOT_RESOURCE_ID}.local-test"],
        "review_status": "draft",
        "staleness_status": "not_evaluated_local",
        "allowed_actions": ["inspect_source", "mark_needs_review_local", "link_source_local"],
    }
    assert payload["review_task_ids"] == [review_item["review_task_id"]]
    assert payload["review_queue_contract"] == {
        "source_of_truth": "validated_loaded_source_spans",
        "invalid_unbacked_items": "metadata_only_excluded_from_production_queue",
    }
    assert payload["coverage_status"] == "source_span_ready"
    assert set(payload["coverage_status_vocabulary"]) == EXPECTED_COVERAGE_STATUSES
    assert payload["model_routing"] == "none-local-deterministic-search-only"
    assert "generated_answer" not in payload
    assert_no_generated_answer_or_clinical_claim_fields(payload)


def test_corpus_interpretability_surveillance_maps_changed_checksum_to_needs_review(monkeypatch: Any) -> None:
    unchanged_resource_id = "ahs-guru-central-nervous-system-cns014-management-of-brain-metastases"
    monkeypatch.setattr(knowledgebase, "_load_corpus_source_spans", lambda: [])
    monkeypatch.setattr(
        knowledgebase,
        "_load_manifest_rows",
        lambda path: {
            PILOT_RESOURCE_ID: {"resource_id": PILOT_RESOURCE_ID, "status": "downloaded", "sha256": "1" * 64},
            unchanged_resource_id: {"resource_id": unchanged_resource_id, "status": "downloaded", "sha256": "3" * 64},
            "missing-local-resource": {"resource_id": "missing-local-resource", "status": "downloaded", "sha256": "4" * 64},
        }
        if "20260615" in path.name
        else {
            PILOT_RESOURCE_ID: {"resource_id": PILOT_RESOURCE_ID, "status": "downloaded", "sha256": "2" * 64},
            unchanged_resource_id: {"resource_id": unchanged_resource_id, "status": "downloaded", "sha256": "3" * 64},
            "missing-local-resource": {"resource_id": "missing-local-resource", "status": "failed"},
        },
    )

    response = client.get("/knowledgebase/corpus/interpretability", params={"resource_id": PILOT_RESOURCE_ID})

    assert response.status_code == 200
    surveillance = response.json()["surveillance_status"]
    assert surveillance["status"] == "offline_local_archive_comparison"
    assert surveillance["changed_count"] == 1
    assert surveillance["missing_count"] == 1
    assert surveillance["unchanged_count"] == 1
    assert surveillance["needs_review_count"] == 2
    assert surveillance["resource_statuses"][PILOT_RESOURCE_ID]["change_state"] == "checksum_mismatch"
    assert surveillance["resource_statuses"][PILOT_RESOURCE_ID]["review_status"] == "needs_review"
    assert surveillance["resource_statuses"][unchanged_resource_id]["change_state"] == "unchanged"
    assert surveillance["resource_statuses"][unchanged_resource_id]["review_status"] == "no_change"
    assert surveillance["resource_statuses"]["missing-local-resource"]["change_state"] == "missing"
    assert surveillance["resource_statuses"]["missing-local-resource"]["review_status"] == "needs_review"


def test_corpus_interpretability_rejects_unknown_resource_id() -> None:
    response = client.get("/knowledgebase/corpus/interpretability", params={"resource_id": "missing-resource"})

    assert response.status_code == 404
    assert response.json() == {"detail": "corpus resource not found: missing-resource"}


def test_graph_rag_context_assembler_builds_resource_selection_package(monkeypatch: Any) -> None:
    span = valid_corpus_span(PILOT_RESOURCE_ID)
    monkeypatch.setattr(knowledgebase, "_load_corpus_source_spans", lambda: [span])

    payload = knowledgebase.assemble_graph_rag_selection_context(selected_node_id=f"resource.{PILOT_RESOURCE_ID}")
    repeat_payload = knowledgebase.assemble_graph_rag_selection_context(selected_node_id=f"resource.{PILOT_RESOURCE_ID}")

    assert payload["status"] == "context_ready"
    assert payload["refusal_ready"] is False
    assert payload["selected_node_id"] == f"resource.{PILOT_RESOURCE_ID}"
    assert payload["selected_node_type"] == "resource"
    assert payload["resource_id"] == PILOT_RESOURCE_ID
    assert payload["neighbor_node_ids"]
    assert set(payload["edge_types"]) == {
        "resource_to_archive_status",
        "resource_to_disease_site",
        "resource_to_document_type",
    }
    assert payload["source_span_ids"] == [span["span_id"]]
    assert payload["source_span_contexts"][0]["stable_locator"] == "page:1;span:1"
    assert payload["source_span_contexts"][0]["excerpt_digest"] == f"sha256:{span['excerpt_checksum']}"
    assert payload["context_package_digest"] == repeat_payload["context_package_digest"]
    assert payload["provenance"]["model_routing"] == "none-local-deterministic-search-only"
    assert_no_forbidden_graph_rag_context_fields(payload)
    assert_no_generated_answer_or_clinical_claim_fields(payload)


def test_graph_rag_context_assembler_builds_source_span_selection_package(monkeypatch: Any) -> None:
    span = valid_corpus_span(PILOT_RESOURCE_ID, "Unique source span selection context excerpt.")
    monkeypatch.setattr(knowledgebase, "_load_corpus_source_spans", lambda: [span])

    payload = knowledgebase.assemble_graph_rag_selection_context(source_span_id=span["span_id"])

    assert payload["status"] == "context_ready"
    assert payload["selected_node_id"] == span["span_id"]
    assert payload["selected_node_type"] == "SourceSpan"
    assert payload["resource_id"] == PILOT_RESOURCE_ID
    assert payload["neighbor_node_ids"]
    assert payload["source_span_ids"] == [span["span_id"]]
    assert payload["stable_locators"] == ["page:1;span:1"]
    assert payload["excerpt_digests"] == [f"sha256:{span['excerpt_checksum']}"]
    assert payload["source_span_contexts"][0]["quoted_span"] == "Unique source span selection context excerpt."
    assert_no_forbidden_graph_rag_context_fields(payload)


def test_graph_rag_context_assembler_builds_typed_synthetic_recommendation_context() -> None:
    graph = json.loads(TYPED_CLAIM_FIXTURE_PATH.read_text(encoding="utf-8"))

    payload = knowledgebase.assemble_graph_rag_selection_context(selected_node_id="rec.eval.001", graph=graph)

    assert payload["status"] == "context_ready"
    assert payload["selected_node_id"] == "rec.eval.001"
    assert payload["selected_node_type"] == "Recommendation"
    assert payload["neighbor_node_ids"] == ["evidence.eval.001", "span.eval.001"]
    assert set(payload["edge_types"]) == {"derived_from", "has_evidence"}
    assert payload["source_span_ids"] == ["span.eval.001"]
    assert payload["stable_locators"] == ["Synthetic Eval Contract, Paragraph 1"]
    assert payload["source_span_contexts"][0]["source_document_id"] == "source.eval.001"
    assert payload["source_span_contexts"][0]["excerpt_digest"] == "sha256:6666666666666666666666666666666666666666666666666666666666666666"
    assert payload["provenance"]["selected_node_provenance"]["source_span_ids"] == ["span.eval.001"]
    assert_no_forbidden_graph_rag_context_fields(payload)


def test_graph_rag_context_assembler_refuses_metadata_only_resource(monkeypatch: Any) -> None:
    monkeypatch.setattr(knowledgebase, "_load_corpus_source_spans", lambda: [])

    payload = knowledgebase.assemble_graph_rag_selection_context(selected_node_id=f"resource.{PILOT_RESOURCE_ID}")

    assert payload["status"] == "insufficient_source_span_context"
    assert payload["refusal_ready"] is True
    assert payload["source_span_ids"] == []
    assert payload["source_span_contexts"] == []
    assert payload["warnings"] == ["missing_validated_source_span_context"]
    assert payload["context_package_digest"].startswith("sha256:")
    assert_no_forbidden_graph_rag_context_fields(payload)


def test_graph_rag_context_assembler_excludes_forbidden_raw_fields(monkeypatch: Any) -> None:
    span = valid_corpus_span(PILOT_RESOURCE_ID)
    span.update(
        {
            "raw_pdf": "blocked raw pdf marker",
            "pdf_bytes": "blocked bytes marker",
            "full_document": "blocked full document marker",
            "answer_text": "blocked generated answer marker",
            "output_text": "blocked generated output marker",
        }
    )
    monkeypatch.setattr(knowledgebase, "_load_corpus_source_spans", lambda: [span])

    payload = knowledgebase.assemble_graph_rag_selection_context(source_span_id=span["span_id"])

    assert payload["status"] == "context_ready"
    assert "blocked raw pdf marker" not in str(payload)
    assert "blocked bytes marker" not in str(payload)
    assert "blocked full document marker" not in str(payload)
    assert "blocked generated answer marker" not in str(payload)
    assert "blocked generated output marker" not in str(payload)
    assert_no_forbidden_graph_rag_context_fields(payload)


def test_corpus_interpretability_excludes_unvalidated_source_spans(monkeypatch: Any) -> None:
    invalid_span = valid_corpus_span(PILOT_RESOURCE_ID, "Unique invalid interpretability local parser excerpt.")
    invalid_span["review_status"] = "unreviewed"
    invalid_span["recommendation_text"] = "blocked unbacked fixture claim text"
    invalid_span["suggested_treatment"] = "blocked unbacked fixture treatment text"
    invalid_span["dosing"] = "blocked unbacked fixture dosing text"
    monkeypatch.setattr(knowledgebase, "_load_corpus_source_spans", lambda: [invalid_span])

    response = client.get("/knowledgebase/corpus/interpretability", params={"resource_id": PILOT_RESOURCE_ID})

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_spans"] == []
    assert payload["resource"]["source_span_ids"] == []
    assert payload["review_queue_items"] == []
    assert payload["review_task_ids"] == []
    assert payload["review_queue_contract"]["invalid_unbacked_items"] == "metadata_only_excluded_from_production_queue"
    assert "blocked unbacked fixture" not in str(payload)
    assert_no_generated_answer_or_clinical_claim_fields(payload)


def test_corpus_workbench_trace_runs_digest_only_gateway_dry_run(monkeypatch: Any) -> None:
    monkeypatch.setattr(knowledgebase, "_load_corpus_source_spans", lambda: [valid_corpus_span(PILOT_RESOURCE_ID)])

    response = client.get("/knowledgebase/corpus/workbench/trace", params={"q": "deterministic parsed excerpt"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["command_label"] == "run-evals:corpus-workbench-trace"
    assert payload["model_class"] == "local_open_weight_7b"
    assert payload["gateway_decision"]["allowed"] is True
    assert payload["gateway_decision"]["outcome"] == "executed"
    assert payload["gateway_decision"]["external_api_used"] is False
    assert payload["model_trace"]["trace_status"] == "abstained"
    assert payload["citation_verifier_status"] == "pass"
    assert payload["abstention_status"] == "abstained_no_answer_text"
    assert payload["abstained"] is True
    assert payload["no_claim"] is True
    assert payload["source_ids_used"] == [
        {
            "source_span_id": f"source-span.{PILOT_RESOURCE_ID}.local-test",
            "resource_id": PILOT_RESOURCE_ID,
            "source_document_id": f"source-document.{PILOT_RESOURCE_ID}.local-test",
            "stable_locator": "page:1;span:1",
            "status": "used",
            "evidence_id": f"source-span.{PILOT_RESOURCE_ID}.local-test",
        }
    ]
    assert payload["source_ids_rejected"] == []
    assert payload["evidence_ids"] == [f"source-span.{PILOT_RESOURCE_ID}.local-test"]
    assert payload["model_trace"]["input_summary"]["source_span_contexts"] == [
        {
            "source_span_id": f"source-span.{PILOT_RESOURCE_ID}.local-test",
            "excerpt_digest": f"sha256:{hashlib.sha256('Local deterministic parsed excerpt for search coverage.'.encode('utf-8')).hexdigest()}",
            "source_document_id": f"source-document.{PILOT_RESOURCE_ID}.local-test",
            "stable_locator": "page:1;span:1",
        }
    ]
    assert "quoted_span" not in payload["model_trace"]["input_summary"]["source_span_contexts"][0]
    assert "raw_pdf" not in payload["model_trace"]["input_summary"]["source_span_contexts"][0]
    assert_no_generated_answer_or_clinical_claim_fields(payload)


def test_corpus_workbench_trace_blocks_missing_source_context_without_model_execution(monkeypatch: Any) -> None:
    monkeypatch.setattr(knowledgebase, "_load_corpus_source_spans", lambda: [])

    response = client.get("/knowledgebase/corpus/workbench/trace", params={"q": "adjuvant radiotherapy"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_ids_used"] == []
    assert payload["source_ids_rejected"]
    assert payload["gateway_decision"] == {
        "allowed": False,
        "outcome": "blocked_before_gateway",
        "reason_code": "missing_validated_source_span_context",
        "policy_request_id": payload["gateway_decision"]["policy_request_id"],
        "external_api_used": False,
    }
    assert payload["model_trace"]["runner_status"] == "not_invoked"
    assert payload["model_trace"]["citation_verifier_status"] == "not_run"
    assert payload["abstention_status"] == "abstained_no_model_execution"
    assert "missing_validated_source_span_context" in payload["warnings"]
    assert payload["cost_ledger_entry"] is None
    assert_no_generated_answer_or_clinical_claim_fields(payload)


def test_corpus_workbench_trace_blocks_advice_like_prompt_without_model_execution(monkeypatch: Any) -> None:
    monkeypatch.setattr(knowledgebase, "_load_corpus_source_spans", lambda: [valid_corpus_span(PILOT_RESOURCE_ID)])

    response = client.get("/knowledgebase/corpus/workbench/trace", params={"q": "what should someone choose for treatment"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["retrieval_steps"][1]["abstained"] is True
    assert payload["source_ids_used"] == []
    assert payload["gateway_decision"]["allowed"] is False
    assert payload["gateway_decision"]["reason_code"] == "unsupported_advice_like_prompt"
    assert payload["model_trace"]["runner_status"] == "not_invoked"
    assert payload["model_trace"]["source_span_ids"] == []
    assert payload["cost_ledger_entry"] is None
    assert "abstain_advice_like_prompt" in payload["warnings"]
    assert "unsupported_advice_like_prompt" in payload["warnings"]
    assert_no_generated_answer_or_clinical_claim_fields(payload)


def test_corpus_workbench_explain_selection_runs_mocked_local_runner_trace_only(monkeypatch: Any) -> None:
    span = valid_corpus_span(PILOT_RESOURCE_ID)
    runner_calls: list[tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any]]] = []
    monkeypatch.setattr(knowledgebase, "_load_corpus_source_spans", lambda: [span])

    def fake_runner(envelope: dict[str, Any], source_contexts: list[dict[str, Any]], **kwargs: Any) -> SimpleNamespace:
        runner_calls.append((envelope, source_contexts, kwargs))
        assert kwargs == {}
        assert envelope["output_token_limit"] == 512
        assert envelope["external_api_allowed"] is False
        assert source_contexts == [
            {
                "source_span_id": span["span_id"],
                "excerpt_digest": f"sha256:{span['excerpt_checksum']}",
                "source_document_id": span["source_document_id"],
                "stable_locator": span["stable_locator"],
            }
        ]
        trace = {
            "model_class": "local_open_weight_7b",
            "provider_kind": "local",
            "trace_status": "abstained",
            "runner_status": "mocked_local_runner",
            "policy_request_id": envelope["request_id"],
            "gateway_outcome": "executed",
            "gateway_reason_code": None,
            "citation_verifier_status": "pass",
            "abstention_status": "abstained_no_answer_text",
            "input_digest": "sha256:mock-input",
            "output_digest": "sha256:mock-output",
            "source_span_ids": [span["span_id"]],
            "input_tokens": 1,
            "output_tokens": 0,
            "gpu_seconds": 0.0,
            "raw_output_included": False,
            "input_summary": {"source_span_contexts": source_contexts},
        }
        ledger_entry = {
            "external_api_used": False,
            "outcome": "executed",
        }
        decision = SimpleNamespace(allowed=True, outcome="executed", reason_code=None)
        return SimpleNamespace(decision=decision, trace=trace, ledger_entry=ledger_entry)

    monkeypatch.setattr(knowledgebase, "run_local_open_weight_7b_dry_run", fake_runner)

    response = client.post("/knowledgebase/corpus/workbench/explain-selection", json={"source_span_id": span["span_id"]})

    assert response.status_code == 200
    payload = response.json()
    assert len(runner_calls) == 1
    envelope, _, kwargs = runner_calls[0]
    assert envelope["output_token_limit"] == 512
    assert envelope["external_api_allowed"] is False
    assert kwargs == {}
    assert payload["command_label"] == "explain-selection"
    assert payload["selected_node_id"] == span["span_id"]
    assert payload["selected_node_type"] == "SourceSpan"
    assert payload["resource_id"] == PILOT_RESOURCE_ID
    assert payload["source_span_ids"] == [span["span_id"]]
    assert payload["context_digest"].startswith("sha256:")
    assert payload["output_digest"] == "sha256:mock-output"
    assert payload["gateway_decision"] == {
        "allowed": True,
        "outcome": "executed",
        "reason_code": None,
        "policy_request_id": payload["gateway_decision"]["policy_request_id"],
        "external_api_used": False,
    }
    assert payload["runner_status"] == "mocked_local_runner"
    assert payload["raw_output_included"] is False
    assert payload["no_claim"] is True
    assert payload["source_ids_used"][0]["source_span_id"] == span["span_id"]
    assert payload["source_ids_rejected"] == []
    assert payload["evidence_ids"] == [span["span_id"]]
    assert "quoted_span" not in str(payload["model_trace"]["input_summary"])
    assert "raw_model_output" not in str(payload)
    assert "persistence_record" not in payload
    assert "graph_mutation_result" not in payload
    assert_no_forbidden_graph_rag_context_fields(payload)
    assert_no_generated_answer_or_clinical_claim_fields(payload)


def test_corpus_workbench_explain_selection_blocks_metadata_only_before_runner(monkeypatch: Any) -> None:
    runner_calls: list[Any] = []
    monkeypatch.setattr(knowledgebase, "_load_corpus_source_spans", lambda: [])
    monkeypatch.setattr(knowledgebase, "run_local_open_weight_7b_dry_run", lambda *args, **kwargs: runner_calls.append(args))

    response = client.post("/knowledgebase/corpus/workbench/explain-selection", json={"resource_id": PILOT_RESOURCE_ID})

    assert response.status_code == 200
    payload = response.json()
    assert runner_calls == []
    assert payload["command_label"] == "explain-selection"
    assert payload["selected_node_id"] == f"resource.{PILOT_RESOURCE_ID}"
    assert payload["source_span_ids"] == []
    assert payload["gateway_decision"]["allowed"] is False
    assert payload["gateway_decision"]["outcome"] == "blocked_before_gateway"
    assert payload["gateway_decision"]["reason_code"] == "missing_validated_source_span_context"
    assert payload["runner_status"] == "not_invoked"
    assert payload["source_ids_used"] == []
    assert payload["source_ids_rejected"][0]["reason"] == "missing_validated_source_span_context"
    assert "missing_validated_source_span_context" in payload["warnings"]
    assert payload["cost_ledger_entry"] is None
    assert payload["raw_output_included"] is False
    assert payload["no_claim"] is True
    assert_no_generated_answer_or_clinical_claim_fields(payload)


def test_corpus_workbench_explain_selection_blocks_advice_like_metadata_before_runner(monkeypatch: Any) -> None:
    span = valid_corpus_span(PILOT_RESOURCE_ID)
    runner_calls: list[Any] = []
    monkeypatch.setattr(knowledgebase, "_load_corpus_source_spans", lambda: [span])
    monkeypatch.setattr(knowledgebase, "run_local_open_weight_7b_dry_run", lambda *args, **kwargs: runner_calls.append(args))

    response = client.post(
        "/knowledgebase/corpus/workbench/explain-selection",
        json={"source_span_id": span["span_id"], "command_metadata": {"selection_note": "what should someone choose"}},
    )

    assert response.status_code == 200
    payload = response.json()
    assert runner_calls == []
    assert payload["command_label"] == "explain-selection"
    assert payload["gateway_decision"]["allowed"] is False
    assert payload["gateway_decision"]["reason_code"] == "unsupported_advice_like_prompt"
    assert payload["runner_status"] == "not_invoked"
    assert payload["source_ids_used"] == []
    assert payload["model_trace"]["source_span_ids"] == []
    assert payload["cost_ledger_entry"] is None
    assert "unsupported_advice_like_prompt" in payload["warnings"]
    assert payload["raw_output_included"] is False
    assert payload["no_claim"] is True
    assert "what should someone choose" not in str(payload)
    assert_no_generated_answer_or_clinical_claim_fields(payload)
