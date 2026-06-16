from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from services.api.app import knowledgebase
from services.api.app.main import app


client = TestClient(app)

PILOT_RESOURCE_ID = "ahs-guru-breast-br005-adjuvant-rt-invasive-breast"
ADVICE_PATTERNS = ("you should", "your patient", "dose", "diagnosis", "treatment recommendation")
CORPUS_ADVICE_PATTERNS = ("dosing", "diagnosis", "treatment advice", "recommended regimen", "patient-specific")
BLOCKED_PLACEHOLDER_LABELS = ("Synthetic", "Packet Alpha", "Model Trace Stub", "Evidence Hub", "Mock", "Demo", "Placeholder")


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
    assert PILOT_RESOURCE_ID in {resource["resource_id"] for resource in payload["metadata_results"]}
    assert upper_response.json()["metadata_result_count"] > 0
    assert all("breast" in str(resource).lower() for resource in upper_response.json()["metadata_results"])
    assert id_response.json()["metadata_result_count"] == 1
    assert id_response.json()["metadata_results"][0]["resource_id"] == "ahs-guru-central-nervous-system-cns014-management-of-brain-metastases"


def test_corpus_search_returns_empty_for_nonsense_or_blank_queries() -> None:
    nonsense_response = client.get("/knowledgebase/corpus/search", params={"q": "zzzz-no-such-guideline"})
    blank_response = client.get("/knowledgebase/corpus/search", params={"q": "   "})

    assert nonsense_response.status_code == 200
    assert blank_response.status_code == 200
    assert nonsense_response.json()["metadata_results"] == []
    assert nonsense_response.json()["source_span_results"] == []
    assert blank_response.json()["metadata_result_count"] == 0
    assert blank_response.json()["source_span_result_count"] == 0


def test_corpus_source_span_endpoints_report_five_row_partial_coverage() -> None:
    source_span_response = client.get("/knowledgebase/corpus/source-spans")
    search_response = client.get("/knowledgebase/corpus/search", params={"q": "source span fixture phrase"})

    assert source_span_response.status_code == 200
    source_span_payload = source_span_response.json()
    assert source_span_payload["coverage_count"] == 5
    assert len(source_span_payload["coverage_resource_ids"]) == 5
    assert source_span_payload["count"] == 0
    assert source_span_payload["source_spans"] == []
    assert search_response.status_code == 200
    assert search_response.json()["source_span_coverage_count"] == 5
    assert search_response.json()["source_span_result_count"] == 0
    assert search_response.json()["total_resource_count"] == 198


def test_corpus_search_uses_only_local_loaded_source_spans(monkeypatch: Any) -> None:
    monkeypatch.setattr(
        knowledgebase,
        "_load_corpus_source_spans",
        lambda: [
            {
                "span_id": "source-span.local-test",
                "resource_id": PILOT_RESOURCE_ID,
                "document_id": "source-document.local-test",
                "stable_locator": "page:1;span:1",
                "bounded_excerpt": "Local deterministic parsed excerpt for search coverage.",
                "checksum_sha256": "0" * 64,
                "output_status": "draft",
            }
        ],
    )

    response = client.get("/knowledgebase/corpus/search", params={"q": "deterministic parsed excerpt"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["model_routing"] == "none-local-deterministic-search-only"
    assert payload["source_span_result_count"] == 1
    assert "generated_answer" not in payload
    assert "summary" not in payload
    assert_no_corpus_patient_specific_advice_strings(payload)
    assert_no_blocked_placeholder_labels(payload)


def test_corpus_search_excludes_source_spans_outside_parse_subset(monkeypatch: Any) -> None:
    parse_subset_ids = knowledgebase._load_parse_subset_ids()
    non_subset_resource = next(
        resource
        for resource in knowledgebase._corpus_resources()
        if resource["resource_id"] not in parse_subset_ids
    )
    monkeypatch.setattr(
        knowledgebase,
        "_load_corpus_source_spans",
        lambda: [
            {
                "span_id": "source-span.non-subset-local-test",
                "resource_id": non_subset_resource["resource_id"],
                "document_id": "source-document.non-subset-local-test",
                "stable_locator": "page:1;span:1",
                "bounded_excerpt": "Unique non subset local parser excerpt for search boundary.",
                "checksum_sha256": "0" * 64,
                "output_status": "draft",
            }
        ],
    )

    response = client.get("/knowledgebase/corpus/search", params={"q": "unique non subset local parser excerpt"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_span_result_count"] == 0
    assert payload["source_span_results"] == []
