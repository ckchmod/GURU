from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Mapping, Sequence


PROVIDER_KINDS = {"local", "private_hosted", "external"}
DATA_SENSITIVITY_CLASSES = {"public", "internal", "restricted", "phi_prohibited"}
LEDGER_OUTCOMES = {"executed", "cache_hit", "rejected", "approval_pending", "quota_exceeded"}
SOURCE_PERMISSION_ALLOWED_STATUSES = {"cleared", "allowed"}
LOCAL_OPEN_WEIGHT_7B_MODEL_CLASS = "local_open_weight_7b"
LOCAL_OPEN_WEIGHT_7B_MOCK_VERSION = "local-open-weight-7b-dry-run-mock-v1"
LOCAL_OPEN_WEIGHT_7B_REAL_RUNNER_ENV = "GURU_ENABLE_REAL_LOCAL_OPEN_WEIGHT_7B"
LOCAL_OPEN_WEIGHT_7B_REAL_RUNNER_PATH_ENV = "GURU_LOCAL_OPEN_WEIGHT_7B_RUNNER"
LOCAL_TRACE_STATUSES = {"executed", "rejected", "approval_pending", "quota_exceeded", "abstained", "unavailable"}
LOCAL_RUNNER_STATUSES = {"mock_dry_run", "real_runner_unavailable"}
SOURCE_CONTEXT_REQUIRED_FIELDS = {"source_span_id", "excerpt_digest"}
SOURCE_CONTEXT_OPTIONAL_FIELDS = {"source_document_id", "source_document_digest", "stable_locator"}
SOURCE_CONTEXT_FORBIDDEN_FIELDS = {
    "raw_pdf",
    "raw_pdf_bytes",
    "pdf_bytes",
    "document_bytes",
    "quoted_span",
    "text",
    "content",
    "answer_text",
}
UUID_PATTERN = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)

REASON_VALIDATION_FAILED = "validation_failed"
REASON_SOURCE_PERMISSION_DENIED = "source_permission_denied"
REASON_DATA_SENSITIVITY_FORBIDDEN = "data_sensitivity_forbidden"
REASON_MODEL_CLASS_NOT_ALLOWED = "model_class_not_allowed"
REASON_EXTERNAL_API_NOT_ALLOWED = "external_api_not_allowed"
REASON_APPROVAL_REQUIRED = "approval_required"
REASON_QUOTA_EXCEEDED = "quota_exceeded"

POLICY_ENVELOPE_REQUIRED_FIELDS = {
    "tenant_id",
    "user_id",
    "task_type",
    "task_id",
    "request_id",
    "allowed_model_classes",
    "context_token_limit",
    "output_token_limit",
    "max_gpu_seconds",
    "max_budget",
    "cache_lookup_enabled",
    "trace_logging_enabled",
    "cost_ledger_enabled",
    "approval_gate_required",
    "data_sensitivity",
    "source_permission_check",
    "external_api_allowed",
}

COST_LEDGER_REQUIRED_FIELDS = {
    "request_id",
    "tenant_id",
    "user_id",
    "task_type",
    "task_id",
    "model_class",
    "provider_kind",
    "outcome",
    "input_tokens",
    "output_tokens",
    "gpu_seconds",
    "estimated_cost",
    "cache_hit",
    "external_api_used",
    "source_permission_status",
    "timestamp_utc",
}

POLICY_ENVELOPE_OPTIONAL_FIELDS: set[str] = set()
COST_LEDGER_OPTIONAL_FIELDS = {"rejection_reason", "approval_id"}


class GatewayPolicyError(ValueError):
    def __init__(self, reason_code: str, message: str) -> None:
        super().__init__(message)
        self.reason_code = reason_code


@dataclass(frozen=True)
class GatewayRequest:
    model_class: str
    provider_kind: str
    input_tokens: int = 0
    requested_output_tokens: int = 0
    gpu_seconds: float = 0.0
    estimated_cost: float = 0.0
    source_permission_status: str = "cleared"
    cache_hit: bool = False
    approval_id: str | None = None


@dataclass(frozen=True)
class GatewayDecision:
    allowed: bool
    outcome: str
    reason_code: str | None
    ledger_entry: dict[str, Any]


@dataclass(frozen=True)
class LocalSourceSpanContext:
    source_span_id: str
    excerpt_digest: str
    source_document_id: str | None = None
    source_document_digest: str | None = None
    stable_locator: str | None = None


@dataclass(frozen=True)
class LocalModelDryRunResult:
    decision: GatewayDecision
    trace: dict[str, Any]
    ledger_entry: dict[str, Any]


def evaluate_model_gateway_policy(envelope: Mapping[str, Any], request: GatewayRequest) -> GatewayDecision:
    validate_policy_envelope(envelope)
    _validate_gateway_request(request)

    if envelope["source_permission_check"] and request.source_permission_status not in SOURCE_PERMISSION_ALLOWED_STATUSES:
        return _decision(envelope, request, "rejected", REASON_SOURCE_PERMISSION_DENIED)

    if _sensitivity_forbids_path(envelope["data_sensitivity"], request.provider_kind):
        return _decision(envelope, request, "rejected", REASON_DATA_SENSITIVITY_FORBIDDEN)

    if request.model_class not in envelope["allowed_model_classes"]:
        return _decision(envelope, request, "rejected", REASON_MODEL_CLASS_NOT_ALLOWED)

    if request.provider_kind == "external" and envelope["external_api_allowed"] is False:
        return _decision(envelope, request, "rejected", REASON_EXTERNAL_API_NOT_ALLOWED)

    if envelope["cache_lookup_enabled"] and request.cache_hit:
        return _decision(envelope, request, "cache_hit", None)

    if envelope["approval_gate_required"] and request.approval_id is None:
        return _decision(envelope, request, "approval_pending", REASON_APPROVAL_REQUIRED)

    if _exceeds_quota(envelope, request):
        return _decision(envelope, request, "quota_exceeded", REASON_QUOTA_EXCEEDED)

    return _decision(envelope, request, "executed", None)


def run_local_open_weight_7b_dry_run(
    envelope: Mapping[str, Any],
    source_span_contexts: Sequence[Mapping[str, Any] | LocalSourceSpanContext],
    *,
    source_permission_status: str = "cleared",
    approval_id: str | None = None,
) -> LocalModelDryRunResult:
    bounded_contexts = _normalize_source_span_contexts(source_span_contexts)
    context_digest = _digest_mapping(
        {
            "request_id": envelope.get("request_id"),
            "model_class": LOCAL_OPEN_WEIGHT_7B_MODEL_CLASS,
            "source_span_contexts": bounded_contexts,
        }
    )
    request = GatewayRequest(
        model_class=LOCAL_OPEN_WEIGHT_7B_MODEL_CLASS,
        provider_kind="local",
        input_tokens=len(bounded_contexts),
        requested_output_tokens=0,
        gpu_seconds=0.0,
        estimated_cost=0.0,
        source_permission_status=source_permission_status,
        approval_id=approval_id,
    )
    decision = evaluate_model_gateway_policy(envelope, request)
    trace = _local_trace(
        envelope=envelope,
        decision=decision,
        bounded_contexts=bounded_contexts,
        context_digest=context_digest,
        runner_status=_local_runner_status(decision),
    )
    return LocalModelDryRunResult(decision=decision, trace=trace, ledger_entry=decision.ledger_entry)


def validate_policy_envelope(envelope: Mapping[str, Any]) -> None:
    fields = set(envelope)
    _reject_missing_or_extra_fields(fields, POLICY_ENVELOPE_REQUIRED_FIELDS, POLICY_ENVELOPE_OPTIONAL_FIELDS, "policy envelope")
    _require_non_empty_string(envelope, "tenant_id")
    _require_non_empty_string(envelope, "user_id")
    _require_non_empty_string(envelope, "task_type")
    _require_uuid(envelope, "task_id")
    _require_uuid(envelope, "request_id")
    _require_non_empty_string_list(envelope, "allowed_model_classes")
    _require_non_negative_int(envelope, "context_token_limit")
    _require_non_negative_int(envelope, "output_token_limit")
    _require_non_negative_number(envelope, "max_gpu_seconds")
    _require_non_negative_number(envelope, "max_budget")
    _require_bool(envelope, "cache_lookup_enabled")
    _require_bool(envelope, "trace_logging_enabled")
    _require_bool(envelope, "cost_ledger_enabled")
    _require_bool(envelope, "approval_gate_required")
    _require_bool(envelope, "source_permission_check")
    _require_bool(envelope, "external_api_allowed")
    if envelope["external_api_allowed"] is not False:
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, "external_api_allowed must remain false in the base runtime contract")
    if envelope["data_sensitivity"] not in DATA_SENSITIVITY_CLASSES:
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, "data_sensitivity is not allowed")


def validate_cost_ledger_entry(entry: Mapping[str, Any]) -> None:
    fields = set(entry)
    _reject_missing_or_extra_fields(fields, COST_LEDGER_REQUIRED_FIELDS, COST_LEDGER_OPTIONAL_FIELDS, "cost ledger entry")
    _require_uuid(entry, "request_id")
    _require_non_empty_string(entry, "tenant_id")
    _require_non_empty_string(entry, "user_id")
    _require_non_empty_string(entry, "task_type")
    _require_uuid(entry, "task_id")
    _require_non_empty_string(entry, "model_class")
    _require_non_empty_string(entry, "source_permission_status")
    if entry["provider_kind"] not in PROVIDER_KINDS:
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, "provider_kind is not allowed")
    if entry["outcome"] not in LEDGER_OUTCOMES:
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, "outcome is not allowed")
    _require_non_negative_int(entry, "input_tokens")
    _require_non_negative_int(entry, "output_tokens")
    _require_non_negative_number(entry, "gpu_seconds")
    _require_non_negative_number(entry, "estimated_cost")
    _require_bool(entry, "cache_hit")
    _require_bool(entry, "external_api_used")
    if entry["outcome"] == "rejected" and not entry.get("rejection_reason"):
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, "rejected ledger entries require rejection_reason")
    if entry["external_api_used"] and entry["provider_kind"] != "external":
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, "external_api_used requires external provider_kind")
    if "approval_id" in entry:
        _require_uuid(entry, "approval_id")
    datetime.fromisoformat(str(entry["timestamp_utc"]).replace("Z", "+00:00"))


def validate_local_model_trace(trace: Mapping[str, Any]) -> None:
    _require_non_empty_string(trace, "model_name")
    _require_non_empty_string(trace, "model_version")
    _require_non_empty_string(trace, "model_class")
    _require_non_empty_string(trace, "trace_status")
    _require_uuid(trace, "policy_request_id")
    _require_non_empty_string(trace, "citation_verifier_status")
    _require_non_empty_string(trace, "abstention_status")
    _require_non_empty_string(trace, "input_digest")
    _require_non_empty_string(trace, "output_digest")
    _require_non_empty_string_list(trace, "source_span_ids")
    _require_non_negative_int(trace, "input_tokens")
    _require_non_negative_int(trace, "output_tokens")
    _require_non_negative_number(trace, "gpu_seconds")
    if trace["model_class"] != LOCAL_OPEN_WEIGHT_7B_MODEL_CLASS:
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, "local trace model_class must be local_open_weight_7b")
    if trace["trace_status"] not in LOCAL_TRACE_STATUSES:
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, "local trace status is not allowed")
    if trace["citation_verifier_status"] != "pass":
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, "local trace citation verifier must pass")
    if "output_text" in trace or "answer_text" in trace:
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, "local trace must not emit answer text")
    input_summary = trace.get("input_summary")
    if not isinstance(input_summary, Mapping):
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, "local trace input_summary is required")
    contexts = input_summary.get("source_span_contexts")
    if not isinstance(contexts, list) or not contexts:
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, "local trace requires source span contexts")
    _normalize_source_span_contexts(contexts)


def _decision(envelope: Mapping[str, Any], request: GatewayRequest, outcome: str, reason_code: str | None) -> GatewayDecision:
    ledger_entry = _ledger_entry(envelope, request, outcome, reason_code)
    validate_cost_ledger_entry(ledger_entry)
    return GatewayDecision(
        allowed=outcome in {"executed", "cache_hit"},
        outcome=outcome,
        reason_code=reason_code,
        ledger_entry=ledger_entry,
    )


def _normalize_source_span_contexts(
    source_span_contexts: Sequence[Mapping[str, Any] | LocalSourceSpanContext],
) -> list[dict[str, str]]:
    if not source_span_contexts:
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, "local dry-run requires at least one source span context")
    normalized: list[dict[str, str]] = []
    for context in source_span_contexts:
        payload = _source_context_payload(context)
        fields = set(payload)
        forbidden = sorted(fields & SOURCE_CONTEXT_FORBIDDEN_FIELDS)
        if forbidden:
            raise GatewayPolicyError(REASON_VALIDATION_FAILED, f"source span context includes forbidden raw fields: {', '.join(forbidden)}")
        _reject_missing_or_extra_fields(fields, SOURCE_CONTEXT_REQUIRED_FIELDS, SOURCE_CONTEXT_OPTIONAL_FIELDS, "source span context")
        _require_non_empty_string(payload, "source_span_id")
        _require_non_empty_string(payload, "excerpt_digest")
        clean = {"source_span_id": payload["source_span_id"], "excerpt_digest": payload["excerpt_digest"]}
        for field_name in sorted(SOURCE_CONTEXT_OPTIONAL_FIELDS):
            if field_name in payload:
                _require_non_empty_string(payload, field_name)
                clean[field_name] = payload[field_name]
        normalized.append(clean)
    return normalized


def _source_context_payload(context: Mapping[str, Any] | LocalSourceSpanContext) -> Mapping[str, Any]:
    if isinstance(context, LocalSourceSpanContext):
        payload: dict[str, Any] = {
            "source_span_id": context.source_span_id,
            "excerpt_digest": context.excerpt_digest,
        }
        if context.source_document_id is not None:
            payload["source_document_id"] = context.source_document_id
        if context.source_document_digest is not None:
            payload["source_document_digest"] = context.source_document_digest
        if context.stable_locator is not None:
            payload["stable_locator"] = context.stable_locator
        return payload
    return context


def _local_runner_status(decision: GatewayDecision) -> str:
    if not decision.allowed:
        return "mock_dry_run"
    if os.environ.get(LOCAL_OPEN_WEIGHT_7B_REAL_RUNNER_ENV) != "1":
        return "mock_dry_run"
    if not os.environ.get(LOCAL_OPEN_WEIGHT_7B_REAL_RUNNER_PATH_ENV):
        return "real_runner_unavailable"
    return "real_runner_unavailable"


def _local_trace(
    *,
    envelope: Mapping[str, Any],
    decision: GatewayDecision,
    bounded_contexts: list[dict[str, str]],
    context_digest: str,
    runner_status: str,
) -> dict[str, Any]:
    if runner_status not in LOCAL_RUNNER_STATUSES:
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, "local runner status is not allowed")
    trace_status = _trace_status(decision, runner_status)
    output_digest = _digest_mapping(
        {
            "trace_status": trace_status,
            "abstention_status": "abstained_no_answer_text",
            "runner_status": runner_status,
            "request_id": envelope["request_id"],
        }
    )
    trace: dict[str, Any] = {
        "model_name": "local-open-weight-7b-dry-run",
        "model_version": LOCAL_OPEN_WEIGHT_7B_MOCK_VERSION,
        "model_class": LOCAL_OPEN_WEIGHT_7B_MODEL_CLASS,
        "provider_kind": "local",
        "trace_status": trace_status,
        "runner_status": runner_status,
        "policy_request_id": envelope["request_id"],
        "gateway_outcome": decision.outcome,
        "gateway_reason_code": decision.reason_code,
        "citation_verifier_status": "pass",
        "abstention_status": "abstained_no_answer_text",
        "input_digest": context_digest,
        "output_digest": output_digest,
        "source_span_ids": [context["source_span_id"] for context in bounded_contexts],
        "input_tokens": decision.ledger_entry["input_tokens"],
        "output_tokens": decision.ledger_entry["output_tokens"],
        "gpu_seconds": decision.ledger_entry["gpu_seconds"],
        "input_summary": {"source_span_contexts": bounded_contexts},
        "timestamp_utc": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
    }
    validate_local_model_trace(trace)
    return trace


def _trace_status(decision: GatewayDecision, runner_status: str) -> str:
    if runner_status == "real_runner_unavailable" and decision.allowed:
        return "unavailable"
    if decision.outcome == "executed":
        return "abstained"
    return decision.outcome


def _digest_mapping(payload: Mapping[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def _ledger_entry(
    envelope: Mapping[str, Any],
    request: GatewayRequest,
    outcome: str,
    reason_code: str | None,
) -> dict[str, Any]:
    consumed = outcome in {"executed", "cache_hit"}
    entry: dict[str, Any] = {
        "request_id": envelope["request_id"],
        "tenant_id": envelope["tenant_id"],
        "user_id": envelope["user_id"],
        "task_type": envelope["task_type"],
        "task_id": envelope["task_id"],
        "model_class": request.model_class,
        "provider_kind": request.provider_kind,
        "outcome": outcome,
        "input_tokens": request.input_tokens if consumed else 0,
        "output_tokens": 0 if outcome == "cache_hit" else request.requested_output_tokens if outcome == "executed" else 0,
        "gpu_seconds": request.gpu_seconds if outcome == "executed" and request.provider_kind == "local" else 0.0,
        "estimated_cost": request.estimated_cost if outcome == "executed" else 0.0,
        "cache_hit": outcome == "cache_hit",
        "external_api_used": outcome == "executed" and request.provider_kind == "external",
        "source_permission_status": request.source_permission_status,
        "timestamp_utc": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
    }
    if reason_code is not None:
        entry["rejection_reason"] = reason_code
    if request.approval_id is not None:
        entry["approval_id"] = request.approval_id
    return entry


def _sensitivity_forbids_path(data_sensitivity: str, provider_kind: str) -> bool:
    if data_sensitivity == "phi_prohibited":
        return True
    if data_sensitivity == "restricted" and provider_kind == "external":
        return True
    return False


def _exceeds_quota(envelope: Mapping[str, Any], request: GatewayRequest) -> bool:
    return (
        request.input_tokens > envelope["context_token_limit"]
        or request.requested_output_tokens > envelope["output_token_limit"]
        or request.gpu_seconds > envelope["max_gpu_seconds"]
        or request.estimated_cost > envelope["max_budget"]
    )


def _validate_gateway_request(request: GatewayRequest) -> None:
    if not isinstance(request.model_class, str) or not request.model_class:
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, "model_class is required")
    if request.provider_kind not in PROVIDER_KINDS:
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, "provider_kind is not allowed")
    if not isinstance(request.source_permission_status, str) or not request.source_permission_status:
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, "source_permission_status is required")
    for field_name in ("input_tokens", "requested_output_tokens"):
        value = getattr(request, field_name)
        if not isinstance(value, int) or isinstance(value, bool) or value < 0:
            raise GatewayPolicyError(REASON_VALIDATION_FAILED, f"{field_name} must be a non-negative integer")
    for field_name in ("gpu_seconds", "estimated_cost"):
        value = getattr(request, field_name)
        if not isinstance(value, int | float) or isinstance(value, bool) or value < 0:
            raise GatewayPolicyError(REASON_VALIDATION_FAILED, f"{field_name} must be a non-negative number")


def _reject_missing_or_extra_fields(fields: set[str], required: set[str], optional: set[str], name: str) -> None:
    missing = sorted(required - fields)
    if missing:
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, f"{name} missing required fields: {', '.join(missing)}")
    extra = sorted(fields - required - optional)
    if extra:
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, f"{name} has unsupported fields: {', '.join(extra)}")


def _require_non_empty_string(payload: Mapping[str, Any], field_name: str) -> None:
    if not isinstance(payload[field_name], str) or not payload[field_name]:
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, f"{field_name} must be a non-empty string")


def _require_uuid(payload: Mapping[str, Any], field_name: str) -> None:
    _require_non_empty_string(payload, field_name)
    if UUID_PATTERN.fullmatch(payload[field_name]) is None:
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, f"{field_name} must be a UUID string")


def _require_non_empty_string_list(payload: Mapping[str, Any], field_name: str) -> None:
    value = payload[field_name]
    if not isinstance(value, list) or not value:
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, f"{field_name} must be a non-empty list")
    if any(not isinstance(item, str) or not item for item in value):
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, f"{field_name} entries must be non-empty strings")


def _require_non_negative_int(payload: Mapping[str, Any], field_name: str) -> None:
    value = payload[field_name]
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, f"{field_name} must be a non-negative integer")


def _require_non_negative_number(payload: Mapping[str, Any], field_name: str) -> None:
    value = payload[field_name]
    if not isinstance(value, int | float) or isinstance(value, bool) or value < 0:
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, f"{field_name} must be a non-negative number")


def _require_bool(payload: Mapping[str, Any], field_name: str) -> None:
    if not isinstance(payload[field_name], bool):
        raise GatewayPolicyError(REASON_VALIDATION_FAILED, f"{field_name} must be a boolean")
