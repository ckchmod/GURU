from __future__ import annotations

import urllib.error

import pytest

from services.api.app import model_gateway
from services.api.app.model_gateway import (
    COST_LEDGER_REQUIRED_FIELDS,
    LOCAL_DEBUG_MODEL_OUTPUT_ENV,
    LOCAL_INSTRUCTION_PROVIDER_ENV,
    LOCAL_INSTRUCTION_REAL_RUNNER_ENV,
    LOCAL_OPEN_WEIGHT_7B_REAL_RUNNER_ENV,
    LOCAL_OPEN_WEIGHT_7B_REAL_RUNNER_PATH_ENV,
    LOCAL_QWEN_MALFORMED_RESPONSE,
    LOCAL_QWEN_MODEL_MISSING,
    LOCAL_QWEN_NON_LOOPBACK_BASE_URL,
    LOCAL_QWEN_RUNNER_REQUIRED,
    LOCAL_QWEN_TIMEOUT,
    OLLAMA_BASE_URL_ENV,
    OLLAMA_MODEL_ENV,
    OLLAMA_PROVIDER,
    POLICY_ENVELOPE_REQUIRED_FIELDS,
    REASON_EXTERNAL_API_NOT_ALLOWED,
    REASON_MODEL_CLASS_NOT_ALLOWED,
    REASON_SOURCE_PERMISSION_DENIED,
    GatewayPolicyError,
    GatewayRequest,
    evaluate_model_gateway_policy,
    run_local_open_weight_7b_dry_run,
    validate_cost_ledger_entry,
    validate_local_model_trace,
    validate_policy_envelope,
)


TASK_ID = "11111111-1111-4111-8111-111111111111"
REQUEST_ID = "22222222-2222-4222-8222-222222222222"
APPROVAL_ID = "33333333-3333-4333-8333-333333333333"


class FakeOllamaResponse:
    def __init__(self, body: bytes) -> None:
        self.body = body

    def __enter__(self) -> FakeOllamaResponse:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def read(self) -> bytes:
        return self.body


def test_allowed_local_dry_run_executes_and_writes_schema_ledger_fields() -> None:
    envelope = valid_envelope(approval_gate_required=False)
    request = GatewayRequest(
        model_class="local_open_weight_7b",
        provider_kind="local",
        input_tokens=128,
        requested_output_tokens=32,
        gpu_seconds=1.5,
        estimated_cost=0,
        source_permission_status="cleared",
    )

    decision = evaluate_model_gateway_policy(envelope, request)

    assert decision.allowed is True
    assert decision.outcome == "executed"
    assert decision.reason_code is None
    assert set(decision.ledger_entry).issuperset(COST_LEDGER_REQUIRED_FIELDS)
    assert decision.ledger_entry["external_api_used"] is False
    assert decision.ledger_entry["provider_kind"] == "local"
    assert decision.ledger_entry["input_tokens"] == 128
    assert decision.ledger_entry["output_tokens"] == 32
    assert decision.ledger_entry["gpu_seconds"] == 1.5
    validate_cost_ledger_entry(decision.ledger_entry)


def test_mock_local_open_weight_7b_trace_uses_source_span_digests_without_answer_text() -> None:
    result = run_local_open_weight_7b_dry_run(
        valid_envelope(approval_gate_required=False),
        [
            {
                "source_span_id": "source-span.safe-local-test",
                "source_document_id": "source-document.safe-local-test",
                "excerpt_digest": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
                "source_document_digest": "sha256:2222222222222222222222222222222222222222222222222222222222222222",
                "stable_locator": "section:test-only",
            }
        ],
    )

    assert result.decision.allowed is True
    assert result.trace["provider_kind"] == "local"
    assert result.trace["model_class"] == "local_open_weight_7b"
    assert result.trace["trace_status"] == "abstained"
    assert result.trace["runner_status"] == "mock_dry_run"
    assert result.trace["citation_verifier_status"] == "pass"
    assert result.trace["abstention_status"] == "abstained_no_answer_text"
    assert result.trace["source_span_ids"] == ["source-span.safe-local-test"]
    assert "output_text" not in result.trace
    assert "answer_text" not in result.trace
    assert "quoted_span" not in result.trace["input_summary"]["source_span_contexts"][0]
    assert "raw_pdf" not in result.trace["input_summary"]["source_span_contexts"][0]
    assert result.ledger_entry["provider_kind"] == "local"
    assert result.ledger_entry["external_api_used"] is False
    validate_local_model_trace(result.trace)


def test_dry_run_rejects_raw_pdf_or_text_context_before_runner() -> None:
    with pytest.raises(GatewayPolicyError, match="forbidden raw fields"):
        run_local_open_weight_7b_dry_run(
            valid_envelope(approval_gate_required=False),
            [
                {
                    "source_span_id": "source-span.safe-local-test",
                    "excerpt_digest": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
                    "raw_pdf": "not allowed",
                }
            ],
        )


def test_external_provider_accidental_config_is_blocked_before_execution() -> None:
    decision = evaluate_model_gateway_policy(
        valid_envelope(approval_gate_required=False, allowed_model_classes=["local_open_weight_7b"]),
        GatewayRequest(
            model_class="local_open_weight_7b",
            provider_kind="external",
            input_tokens=1,
            requested_output_tokens=1,
            source_permission_status="cleared",
        ),
    )

    assert decision.allowed is False
    assert decision.reason_code == REASON_EXTERNAL_API_NOT_ALLOWED
    assert decision.ledger_entry["external_api_used"] is False
    assert decision.ledger_entry["input_tokens"] == 0


def test_missing_real_local_runner_returns_unavailable_trace_without_ci_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(LOCAL_OPEN_WEIGHT_7B_REAL_RUNNER_ENV, "1")
    monkeypatch.delenv(LOCAL_OPEN_WEIGHT_7B_REAL_RUNNER_PATH_ENV, raising=False)

    result = run_local_open_weight_7b_dry_run(
        valid_envelope(approval_gate_required=False),
        [
            {
                "source_span_id": "source-span.safe-local-test",
                "excerpt_digest": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
            }
        ],
    )

    assert result.decision.allowed is True
    assert result.trace["trace_status"] == "unavailable"
    assert result.trace["runner_status"] == "real_runner_unavailable"
    assert result.trace["abstention_status"] == "abstained_no_answer_text"
    assert result.ledger_entry["external_api_used"] is False
    validate_local_model_trace(result.trace)


def test_real_ollama_qwen_success_records_digest_and_withholds_raw_output(monkeypatch: pytest.MonkeyPatch) -> None:
    enable_mocked_ollama(monkeypatch)

    def fake_urlopen(request: object, timeout: float) -> FakeOllamaResponse:
        assert timeout == model_gateway.OLLAMA_REQUEST_TIMEOUT_SECONDS
        assert getattr(request, "full_url") == "http://127.0.0.1:11434/api/generate"
        body = getattr(request, "data").decode("utf-8")
        assert '"model": "qwen3:4b"' in body
        assert '"num_predict": 512' in body
        return FakeOllamaResponse(b'{"response":"trace-only local model output"}')

    monkeypatch.setattr(model_gateway.urllib.request, "urlopen", fake_urlopen)

    result = run_local_open_weight_7b_dry_run(valid_envelope(approval_gate_required=False), safe_source_contexts())

    assert result.decision.allowed is True
    assert result.trace["trace_status"] == "executed"
    assert result.trace["runner_status"] == "ollama_qwen_executed"
    assert result.trace["model_name"] == "ollama/qwen3"
    assert result.trace["model_version"] == "qwen3:4b"
    assert result.trace["input_digest"].startswith("sha256:")
    assert result.trace["output_digest"].startswith("sha256:")
    assert result.trace["source_span_ids"] == ["source-span.safe-local-test"]
    assert result.trace["output_tokens"] == 4
    assert result.trace["gpu_seconds"] >= 0
    assert result.trace["raw_output_included"] is False
    assert "raw_model_output" not in result.trace
    assert "output_text" not in result.trace
    assert "answer_text" not in result.trace
    assert result.ledger_entry["provider_kind"] == "local"
    assert result.ledger_entry["external_api_used"] is False
    assert result.ledger_entry["output_tokens"] == 4
    validate_local_model_trace(result.trace)


def test_real_ollama_qwen_env_only_debug_gate_still_withholds_raw_output(monkeypatch: pytest.MonkeyPatch) -> None:
    enable_mocked_ollama(monkeypatch)
    monkeypatch.setenv(LOCAL_DEBUG_MODEL_OUTPUT_ENV, "1")
    monkeypatch.setattr(
        model_gateway.urllib.request,
        "urlopen",
        lambda request, timeout: FakeOllamaResponse(b'{"response":"debug local output"}'),
    )

    result = run_local_open_weight_7b_dry_run(valid_envelope(approval_gate_required=False), safe_source_contexts())

    assert result.trace["raw_output_included"] is False
    assert "raw_model_output" not in result.trace
    assert "output_text" not in result.trace
    assert "answer_text" not in result.trace
    assert result.ledger_entry["external_api_used"] is False
    validate_local_model_trace(result.trace)


def test_real_ollama_qwen_env_and_request_debug_gates_include_raw_output(monkeypatch: pytest.MonkeyPatch) -> None:
    enable_mocked_ollama(monkeypatch)
    monkeypatch.setenv(LOCAL_DEBUG_MODEL_OUTPUT_ENV, "1")
    monkeypatch.setattr(
        model_gateway.urllib.request,
        "urlopen",
        lambda request, timeout: FakeOllamaResponse(b'{"response":"debug local output"}'),
    )

    result = run_local_open_weight_7b_dry_run(
        valid_envelope(approval_gate_required=False),
        safe_source_contexts(),
        include_debug_model_output=True,
    )

    assert result.trace["raw_output_included"] is True
    assert result.trace["raw_model_output"] == "debug local output"
    assert "output_text" not in result.trace
    assert "answer_text" not in result.trace
    assert result.ledger_entry["external_api_used"] is False
    validate_local_model_trace(result.trace)


def test_real_ollama_qwen_non_loopback_base_url_fails_before_network(monkeypatch: pytest.MonkeyPatch) -> None:
    enable_mocked_ollama(monkeypatch)
    monkeypatch.setenv(OLLAMA_BASE_URL_ENV, "http://192.0.2.10:11434")

    def fail_if_called(request: object, timeout: float) -> FakeOllamaResponse:
        raise AssertionError("non-loopback Ollama URL must fail before network call")

    monkeypatch.setattr(model_gateway.urllib.request, "urlopen", fail_if_called)

    result = run_local_open_weight_7b_dry_run(valid_envelope(approval_gate_required=False), safe_source_contexts())

    assert result.trace["trace_status"] == "unavailable"
    assert result.trace["runner_status"] == LOCAL_QWEN_NON_LOOPBACK_BASE_URL
    assert result.trace["raw_output_included"] is False
    assert result.trace["output_tokens"] == 0
    assert result.ledger_entry["external_api_used"] is False
    assert result.ledger_entry["output_tokens"] == 0
    validate_local_model_trace(result.trace)


@pytest.mark.parametrize(
    ("urlopen_result", "expected_status"),
    [
        (urllib.error.URLError("connection refused"), LOCAL_QWEN_RUNNER_REQUIRED),
        (urllib.error.HTTPError("http://127.0.0.1:11434/api/generate", 404, "not found", {}, None), LOCAL_QWEN_MODEL_MISSING),
        (TimeoutError("timed out"), LOCAL_QWEN_TIMEOUT),
        (FakeOllamaResponse(b'{"done":true}'), LOCAL_QWEN_MALFORMED_RESPONSE),
    ],
)
def test_real_ollama_qwen_unavailable_model_timeout_and_malformed_response_are_stable(
    monkeypatch: pytest.MonkeyPatch,
    urlopen_result: object,
    expected_status: str,
) -> None:
    enable_mocked_ollama(monkeypatch)

    def fake_urlopen(request: object, timeout: float) -> FakeOllamaResponse:
        if isinstance(urlopen_result, BaseException):
            raise urlopen_result
        return urlopen_result

    monkeypatch.setattr(model_gateway.urllib.request, "urlopen", fake_urlopen)

    result = run_local_open_weight_7b_dry_run(valid_envelope(approval_gate_required=False), safe_source_contexts())

    assert result.trace["trace_status"] == "unavailable"
    assert result.trace["runner_status"] == expected_status
    assert result.trace["raw_output_included"] is False
    assert result.trace["output_tokens"] == 0
    assert "raw_model_output" not in result.trace
    assert result.ledger_entry["external_api_used"] is False
    assert result.ledger_entry["output_tokens"] == 0
    validate_local_model_trace(result.trace)


def test_external_provider_is_rejected_when_external_api_allowed_is_false() -> None:
    decision = evaluate_model_gateway_policy(
        valid_envelope(approval_gate_required=False, allowed_model_classes=["external_api_business_justified"]),
        GatewayRequest(
            model_class="external_api_business_justified",
            provider_kind="external",
            input_tokens=64,
            requested_output_tokens=16,
            estimated_cost=0,
            source_permission_status="cleared",
        ),
    )

    assert decision.allowed is False
    assert decision.outcome == "rejected"
    assert decision.reason_code == REASON_EXTERNAL_API_NOT_ALLOWED
    assert decision.ledger_entry["rejection_reason"] == REASON_EXTERNAL_API_NOT_ALLOWED
    assert decision.ledger_entry["external_api_used"] is False
    assert decision.ledger_entry["input_tokens"] == 0
    assert decision.ledger_entry["estimated_cost"] == 0


def test_disallowed_model_class_rejects_before_external_provider_check() -> None:
    decision = evaluate_model_gateway_policy(
        valid_envelope(approval_gate_required=False, allowed_model_classes=["local_open_weight_13b"]),
        GatewayRequest(
            model_class="local_open_weight_70b",
            provider_kind="local",
            source_permission_status="cleared",
        ),
    )

    assert decision.allowed is False
    assert decision.outcome == "rejected"
    assert decision.reason_code == REASON_MODEL_CLASS_NOT_ALLOWED
    assert decision.ledger_entry["rejection_reason"] == REASON_MODEL_CLASS_NOT_ALLOWED


def test_missing_source_permission_rejects_before_model_execution() -> None:
    decision = evaluate_model_gateway_policy(
        valid_envelope(approval_gate_required=False, source_permission_check=True),
        GatewayRequest(
            model_class="local_open_weight_7b",
            provider_kind="local",
            input_tokens=12,
            requested_output_tokens=4,
            source_permission_status="denied",
        ),
    )

    assert decision.allowed is False
    assert decision.outcome == "rejected"
    assert decision.reason_code == REASON_SOURCE_PERMISSION_DENIED
    assert decision.ledger_entry["source_permission_status"] == "denied"
    assert decision.ledger_entry["input_tokens"] == 0


def test_approval_gate_records_pending_outcome_until_approval_id_exists() -> None:
    pending = evaluate_model_gateway_policy(
        valid_envelope(approval_gate_required=True),
        GatewayRequest(model_class="local_open_weight_7b", provider_kind="local", source_permission_status="cleared"),
    )

    approved = evaluate_model_gateway_policy(
        valid_envelope(approval_gate_required=True),
        GatewayRequest(
            model_class="local_open_weight_7b",
            provider_kind="local",
            source_permission_status="cleared",
            approval_id=APPROVAL_ID,
        ),
    )

    assert pending.allowed is False
    assert pending.outcome == "approval_pending"
    assert pending.reason_code == "approval_required"
    assert approved.allowed is True
    assert approved.outcome == "executed"
    assert approved.ledger_entry["approval_id"] == APPROVAL_ID


def test_quota_and_cache_outcomes_are_stable() -> None:
    cache_hit = evaluate_model_gateway_policy(
        valid_envelope(approval_gate_required=False, cache_lookup_enabled=True),
        GatewayRequest(model_class="local_open_weight_7b", provider_kind="local", source_permission_status="cleared", cache_hit=True),
    )
    quota = evaluate_model_gateway_policy(
        valid_envelope(approval_gate_required=False, context_token_limit=10),
        GatewayRequest(
            model_class="local_open_weight_7b",
            provider_kind="local",
            input_tokens=11,
            source_permission_status="cleared",
        ),
    )

    assert cache_hit.allowed is True
    assert cache_hit.outcome == "cache_hit"
    assert cache_hit.ledger_entry["cache_hit"] is True
    assert quota.allowed is False
    assert quota.outcome == "quota_exceeded"
    assert quota.reason_code == "quota_exceeded"


def test_policy_envelope_validation_matches_schema_required_fields_and_external_default() -> None:
    envelope = valid_envelope()

    validate_policy_envelope(envelope)
    assert set(envelope) == POLICY_ENVELOPE_REQUIRED_FIELDS

    invalid = dict(envelope)
    invalid["external_api_allowed"] = True
    with pytest.raises(GatewayPolicyError, match="external_api_allowed"):
        validate_policy_envelope(invalid)


def enable_mocked_ollama(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(LOCAL_INSTRUCTION_REAL_RUNNER_ENV, "1")
    monkeypatch.setenv(LOCAL_INSTRUCTION_PROVIDER_ENV, OLLAMA_PROVIDER)
    monkeypatch.setenv(OLLAMA_BASE_URL_ENV, "http://127.0.0.1:11434")
    monkeypatch.setenv(OLLAMA_MODEL_ENV, "qwen3:4b")
    monkeypatch.delenv(LOCAL_DEBUG_MODEL_OUTPUT_ENV, raising=False)


def safe_source_contexts() -> list[dict[str, str]]:
    return [
        {
            "source_span_id": "source-span.safe-local-test",
            "source_document_id": "source-document.safe-local-test",
            "excerpt_digest": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
            "stable_locator": "section:test-only",
        }
    ]


def valid_envelope(**overrides: object) -> dict[str, object]:
    envelope: dict[str, object] = {
        "tenant_id": "tenant-local-test",
        "user_id": "agent-task-2",
        "task_type": "evidence_extraction",
        "task_id": TASK_ID,
        "request_id": REQUEST_ID,
        "allowed_model_classes": ["local_open_weight_7b", "local_open_weight_13b"],
        "context_token_limit": 8192,
        "output_token_limit": 2048,
        "max_gpu_seconds": 30,
        "max_budget": 0,
        "cache_lookup_enabled": True,
        "trace_logging_enabled": True,
        "cost_ledger_enabled": True,
        "approval_gate_required": True,
        "data_sensitivity": "internal",
        "source_permission_check": True,
        "external_api_allowed": False,
    }
    envelope.update(overrides)
    return envelope
