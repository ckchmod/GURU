from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import pytest

from services.api.app import knowledgebase


ROOT = Path(__file__).resolve().parents[3]
GOLD_FIXTURE_PATH = ROOT / "resources" / "derived" / "retrieval-gold" / "graph-linked-source-span-gold.json"
FORBIDDEN_GENERATED_KEYS = {
    "generated_answer",
    "clinical_summary",
    "recommendation_text",
    "suggested_treatment",
    "dosing",
}
EXPECTED_COVERAGE_SCOPE = "bounded_fixture_cases_only"
EXPECTED_MODEL_ROUTING = "none-local-deterministic-search-only"


def _load_gold_fixture() -> dict[str, Any]:
    return json.loads(GOLD_FIXTURE_PATH.read_text(encoding="utf-8"))


def _assert_no_forbidden_generated_keys(payload: Any, path: str = "fixture") -> None:
    if isinstance(payload, dict):
        blocked = FORBIDDEN_GENERATED_KEYS & set(payload)
        if blocked:
            raise AssertionError(f"{path} contains unsafe generated-answer keys: {sorted(blocked)}")
        for key, value in payload.items():
            _assert_no_forbidden_generated_keys(value, f"{path}.{key}")
    elif isinstance(payload, list):
        for index, value in enumerate(payload):
            _assert_no_forbidden_generated_keys(value, f"{path}[{index}]")


def test_retrieval_gold_fixture_defines_bounded_safe_cases() -> None:
    fixture = _load_gold_fixture()

    assert fixture["fixture_id"] == "retrieval-gold.graph-linked-source-span.v1"
    assert fixture["model_routing"] == EXPECTED_MODEL_ROUTING
    assert fixture["source_span_coverage_scope"] == EXPECTED_COVERAGE_SCOPE
    assert 6 <= len(fixture["cases"]) <= 10
    assert any(case["expected_abstention"] for case in fixture["cases"])
    assert any("abstain_advice_like_prompt" in case["warning_labels"] for case in fixture["cases"])
    _assert_no_forbidden_generated_keys(fixture)


def test_retrieval_gold_cases_reference_known_resources_and_graph_focus_nodes() -> None:
    fixture = _load_gold_fixture()
    resource_ids = {resource["resource_id"] for resource in knowledgebase._corpus_resources()}

    for case in fixture["cases"]:
        assert isinstance(case["query"], str) and case["query"].strip()
        assert isinstance(case["allowed_filters"], dict)
        assert isinstance(case["warning_labels"], list)
        assert set(case) == {
            "case_id",
            "query",
            "allowed_filters",
            "expected_resource_ids",
            "expected_source_span_ids",
            "expected_source_spans",
            "expected_graph_focus_node",
            "expected_abstention",
            "warning_labels",
        }
        for resource_id in case["expected_resource_ids"]:
            assert resource_id in resource_ids
        if case["expected_resource_ids"]:
            assert case["expected_graph_focus_node"] == f"resource.{case['expected_resource_ids'][0]}"
        else:
            assert case["expected_graph_focus_node"] is None


def test_retrieval_gold_source_spans_use_safe_provenance_shape() -> None:
    fixture = _load_gold_fixture()
    required_span_fields = {
        "span_id",
        "resource_id",
        "document_id",
        "source_document_id",
        "access_date",
        "stable_locator",
        "bounded_excerpt",
        "quoted_span",
        "quoted_text",
        "excerpt_checksum",
        "checksum_sha256",
        "prompt_or_model_version",
        "reviewer",
        "review_status",
        "timestamp",
        "output_status",
    }

    for case in fixture["cases"]:
        span_ids = [span["span_id"] for span in case["expected_source_spans"]]
        assert case["expected_source_span_ids"] == span_ids
        for span in case["expected_source_spans"]:
            assert set(span) == required_span_fields
            assert span["document_id"] == span["source_document_id"]
            assert span["quoted_text"] == span["quoted_span"] == span["bounded_excerpt"]
            assert span["excerpt_checksum"] == hashlib.sha256(span["quoted_span"].encode("utf-8")).hexdigest()
            assert span["checksum_sha256"] == span["excerpt_checksum"]
            assert span["prompt_or_model_version"] == "none-local-deterministic-parser"
            assert span["reviewer"] == "unreviewed"
            assert span["review_status"] == "draft"
            assert span["output_status"] == "draft"


def test_retrieval_gold_scorer_passes_rank_recall_graph_and_warning_contract() -> None:
    scorecard = knowledgebase.score_retrieval_gold_fixture(k=5)

    assert scorecard["fixture_id"] == "retrieval-gold.graph-linked-source-span.v1"
    assert scorecard["model_routing"] == EXPECTED_MODEL_ROUTING
    assert scorecard["case_count"] == 7
    assert scorecard["passed"] is True
    assert scorecard["passed_count"] == scorecard["case_count"]
    for case in scorecard["cases"]:
        assert case["passed"] is True
        assert case["recall_at_k"] in {0.0, 1.0}
        assert case["no_claim"] is True
        if case["expected_resource_ids"] and case["focus_node_id"] is not None:
            assert case["focus_node_id"] == f"resource.{case['expected_resource_ids'][0]}"
            assert case["neighbor_node_ids"]
            assert set(case["edge_types"]) >= {"resource_to_disease_site", "resource_to_document_type"}
        if case["expected_source_span_ids"]:
            assert set(case["expected_source_span_ids"]).issubset(set(case["observed_source_span_ids"]))
        if case["case_id"].endswith("metadata-only") or case["case_id"].endswith("filtered-metadata"):
            assert "metadata_only_expected" in case["warning_labels"]
    _assert_no_forbidden_generated_keys(scorecard, "scorecard")


def test_corpus_search_abstains_on_advice_like_query_without_generated_answer_fields() -> None:
    payload = knowledgebase.search_corpus(q="Should someone choose radiotherapy based on this atlas result?", disease_site="breast")

    assert payload["abstained"] is True
    assert payload["no_claim"] is True
    assert payload["metadata_results"] == []
    assert payload["source_span_results"] == []
    assert set(payload["warning_labels"]) >= {"abstain_advice_like_prompt", "no_generated_claim"}
    _assert_no_forbidden_generated_keys(payload, "advice_like_payload")


def test_corpus_search_metadata_only_result_exposes_coverage_warning() -> None:
    payload = knowledgebase.search_corpus(
        q="cancer guidelines public index",
        disease_site="not-applicable",
        resource_type="guideline",
    )

    assert payload["abstained"] is False
    assert payload["metadata_result_count"] == 1
    assert payload["metadata_results"][0]["resource_id"] == "ahs-guru-cancer-guidelines-index"
    assert payload["metadata_results"][0]["coverage_status"] == "metadata_only"
    assert set(payload["warning_labels"]) >= {"metadata_only_expected", "source_span_coverage_unavailable"}
    assert payload["source_span_results"] == []
    _assert_no_forbidden_generated_keys(payload, "metadata_only_payload")


@pytest.mark.parametrize("forbidden_key", sorted(FORBIDDEN_GENERATED_KEYS))
def test_retrieval_gold_validation_rejects_unsafe_generated_answer_keys(forbidden_key: str) -> None:
    fixture = _load_gold_fixture()
    unsafe_fixture = dict(fixture)
    unsafe_fixture[forbidden_key] = "unsafe generated clinical output placeholder"

    with pytest.raises(AssertionError, match="unsafe generated-answer keys"):
        _assert_no_forbidden_generated_keys(unsafe_fixture)
