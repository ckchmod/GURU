from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from services.api.app.main import app


client = TestClient(app)

PILOT_RESOURCE_ID = "ahs-guru-breast-br005-adjuvant-rt-invasive-breast"
ADVICE_PATTERNS = ("you should", "your patient", "dose", "diagnosis", "treatment recommendation")


def assert_no_patient_specific_advice(payload: Any) -> None:
    rendered = str(payload).lower()
    for pattern in ADVICE_PATTERNS:
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
