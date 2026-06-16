#!/usr/bin/env python3
"""Validate guideline graph documents against the seed graph/provenance schema.

The validator uses only the Python standard library. It checks:
- top-level graph structure
- node-level required fields and type-specific fields
- provenance metadata on every node
- MANDATORY source_span_ids for claim-like nodes (Recommendation, Citation,
  EvidenceItem, FundingRule, ReviewDecision, ModelTrace)
- edge references point to known nodes
- edge relation enum values
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCHEMA = ROOT / "packages" / "schemas" / "graph-provenance-schema.json"
SEMVER_RE = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
DATETIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$")
ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$")
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")

NODE_TYPES = {
    "Guideline",
    "GuidelineVersion",
    "Recommendation",
    "PICOQuestion",
    "SourceDocument",
    "SourceSpan",
    "Citation",
    "EvidenceItem",
    "FundingRule",
    "WorkflowTask",
    "ReviewDecision",
    "ModelTrace",
}

CLAIM_LIKE_NODE_TYPES = {
    "Recommendation",
    "Citation",
    "EvidenceItem",
    "FundingRule",
    "ReviewDecision",
    "ModelTrace",
}

NODE_STATUSES = {"draft", "under_review", "approved", "superseded", "deprecated"}
OUTPUT_STATUSES = {"draft", "under_review", "approved"}
REVIEW_STATUSES = {"unreviewed", "under_review", "reviewer_approved", "rejected"}

RELATIONS = {
    "has_version",
    "has_recommendation",
    "has_pico",
    "has_evidence",
    "has_citation",
    "has_source_span",
    "has_funding_rule",
    "has_task",
    "has_review_decision",
    "has_model_trace",
    "cites",
    "supports",
    "contradicts",
    "updates",
    "replaces",
    "derived_from",
    "reviewed_by",
    "funded_by",
    "depends_on",
}

ACCESS_METHODS = {
    "public_url",
    "doi",
    "internal_share",
    "api",
    "subscription_api",
    "manual_request",
    "email",
    "unknown",
}

RESOURCE_TYPES = {
    "guideline",
    "evidence_table",
    "algorithm",
    "summary",
    "letter",
    "methodology",
    "standard",
    "trial_registry",
    "regulatory",
    "terminology",
    "api",
    "other",
}

JURISDICTIONS = {"CA-AB", "CA", "US", "EU", "International", "Organization"}
DOCUMENT_STATUSES = {"draft", "under_review", "approved", "archived", "superseded", "unknown"}
LICENSE_STATUSES = {
    "unknown",
    "public_domain",
    "cc_by",
    "cc_by_nc",
    "cc_by_sa",
    "proprietary",
    "subscription",
    "government_open",
    "restricted",
}

RECOMMENDATION_STRENGTHS = {
    "strong_for",
    "conditional_for",
    "strong_against",
    "conditional_against",
    "consensus",
    "no_recommendation",
}

CERTAINTIES = {"high", "moderate", "low", "very_low"}
STUDY_DESIGNS = {
    "systematic_review",
    "rct",
    "observational",
    "expert_opinion",
    "modeling",
    "case_series",
    "unknown",
}

TASK_TYPES = {"review", "extract", "update", "validate", "triage", "publish"}
REVIEW_DECISIONS = {"accept", "revise", "reject", "defer"}
TRACE_STATUSES = {"executed", "rejected", "approval_pending", "quota_exceeded", "abstained"}


@dataclass(frozen=True)
class Finding:
    level: str
    message: str


def load_json(path: Path) -> Any:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        raise SystemExit(f"ERROR {path}: file not found")
    except json.JSONDecodeError as exc:
        raise SystemExit(f"ERROR {path}:{exc.lineno}:{exc.colno}: invalid JSON: {exc.msg}") from exc


def add_error(findings: list[Finding], message: str) -> None:
    findings.append(Finding("ERROR", message))


def add_warning(findings: list[Finding], message: str) -> None:
    findings.append(Finding("WARNING", message))


def expect_object(value: Any, path: str, findings: list[Finding]) -> bool:
    if not isinstance(value, dict):
        add_error(findings, f"{path}: expected object, got {type(value).__name__}")
        return False
    return True


def expect_string(value: Any, path: str, findings: list[Finding], non_empty: bool = True) -> bool:
    if not isinstance(value, str):
        add_error(findings, f"{path}: expected string, got {type(value).__name__}")
        return False
    if non_empty and not value:
        add_error(findings, f"{path}: must not be empty")
        return False
    return True


def expect_array(value: Any, path: str, findings: list[Finding], min_items: int | None = None) -> bool:
    if not isinstance(value, list):
        add_error(findings, f"{path}: expected array, got {type(value).__name__}")
        return False
    if min_items is not None and len(value) < min_items:
        add_error(findings, f"{path}: expected at least {min_items} item(s), got {len(value)}")
        return False
    return True


def expect_enum(value: Any, allowed: set[str], path: str, findings: list[Finding]) -> bool:
    if not expect_string(value, path, findings, non_empty=True):
        return False
    if value not in allowed:
        add_error(findings, f"{path}: invalid value {value!r}; expected one of {sorted(allowed)!r}")
        return False
    return True


def expect_pattern(value: Any, pattern: re.Pattern[str], path: str, findings: list[Finding]) -> bool:
    if not expect_string(value, path, findings, non_empty=True):
        return False
    if not pattern.fullmatch(value):
        add_error(findings, f"{path}: value {value!r} does not match pattern {pattern.pattern!r}")
        return False
    return True


def expect_datetime(value: Any, path: str, findings: list[Finding]) -> bool:
    if not expect_string(value, path, findings, non_empty=True):
        return False
    if not DATETIME_RE.fullmatch(value):
        add_error(findings, f"{path}: expected ISO 8601 date-time, got {value!r}")
        return False
    return True


def expect_date(value: Any, path: str, findings: list[Finding]) -> bool:
    if not expect_string(value, path, findings, non_empty=True):
        return False
    if not DATE_RE.fullmatch(value):
        add_error(findings, f"{path}: expected ISO 8601 date (YYYY-MM-DD), got {value!r}")
        return False
    return True


def validate_provenance(value: Any, path: str, findings: list[Finding]) -> None:
    if not expect_object(value, path, findings):
        return
    required = {"source_span_ids", "generated_by", "output_status", "timestamp"}
    missing = sorted(required - set(value.keys()))
    for field in missing:
        add_error(findings, f"{path}: missing required provenance field {field!r}")
    extras = sorted(set(value.keys()) - {"source_span_ids", "generated_by", "model_version", "reviewer", "review_status", "output_status", "timestamp"})
    for field in extras:
        add_error(findings, f"{path}: unexpected provenance field {field!r}")
    if "source_span_ids" in value:
        expect_array(value["source_span_ids"], f"{path}.source_span_ids", findings)
        if isinstance(value["source_span_ids"], list):
            for idx, span_id in enumerate(value["source_span_ids"]):
                expect_pattern(span_id, ID_RE, f"{path}.source_span_ids[{idx}]", findings)
    if "generated_by" in value:
        expect_string(value["generated_by"], f"{path}.generated_by", findings)
    if "model_version" in value and value["model_version"] is not None:
        expect_string(value["model_version"], f"{path}.model_version", findings)
    if "reviewer" in value and value["reviewer"] is not None:
        expect_string(value["reviewer"], f"{path}.reviewer", findings)
    if "review_status" in value:
        expect_enum(value["review_status"], REVIEW_STATUSES, f"{path}.review_status", findings)
    if "output_status" in value:
        expect_enum(value["output_status"], OUTPUT_STATUSES, f"{path}.output_status", findings)
    if "timestamp" in value:
        expect_datetime(value["timestamp"], f"{path}.timestamp", findings)


def validate_base_node(node: dict[str, Any], path: str, findings: list[Finding]) -> str | None:
    required = {"id", "node_type", "label", "status", "created_at", "updated_at", "provenance"}
    missing = sorted(required - set(node.keys()))
    for field in missing:
        add_error(findings, f"{path}: missing required field {field!r}")
    extras = sorted(set(node.keys()) - required - {"title", "jurisdiction", "disease_site", "topic", "version", "effective_date", "guideline_id", "recommendation_text", "strength", "certainty", "source_span_ids", "pico_ids", "population", "intervention", "comparison", "outcome", "owner", "access_date", "access_path", "license_status", "checksum_sha256", "version_or_date", "span_id", "source_document_id", "stable_locator", "quoted_span", "excerpt_checksum", "prompt_or_model_version", "reviewer", "review_status", "timestamp", "output_status", "citation_text", "evidence_text", "study_design", "rule_text", "task_type", "description", "assignee", "due_date", "decision", "rationale", "model_name", "model_version", "model_class", "trace_status", "policy_request_id", "citation_verifier_status", "input_digest", "output_digest", "output_text", "gpu_seconds", "cost_ledger_id"})
    for field in extras:
        add_error(findings, f"{path}: unexpected field {field!r}")

    expect_pattern(node.get("id"), ID_RE, f"{path}.id", findings)
    node_type = node.get("node_type")
    expect_enum(node_type, NODE_TYPES, f"{path}.node_type", findings)
    expect_string(node.get("label"), f"{path}.label", findings)
    expect_enum(node.get("status"), NODE_STATUSES, f"{path}.status", findings)
    expect_datetime(node.get("created_at"), f"{path}.created_at", findings)
    expect_datetime(node.get("updated_at"), f"{path}.updated_at", findings)
    validate_provenance(node.get("provenance"), f"{path}.provenance", findings)
    return node_type if isinstance(node_type, str) else None


def validate_recommendation(node: dict[str, Any], path: str, findings: list[Finding]) -> None:
    text = node.get("recommendation_text")
    expect_string(text, f"{path}.recommendation_text", findings)
    expect_enum(node.get("strength"), RECOMMENDATION_STRENGTHS, f"{path}.strength", findings)
    if "certainty" in node and node["certainty"] is not None:
        expect_enum(node["certainty"], CERTAINTIES, f"{path}.certainty", findings)
    if not expect_array(node.get("source_span_ids"), f"{path}.source_span_ids", findings, min_items=1):
        return
    for idx, span_id in enumerate(node["source_span_ids"]):
        expect_pattern(span_id, ID_RE, f"{path}.source_span_ids[{idx}]", findings)
    if "pico_ids" in node and node["pico_ids"] is not None:
        if expect_array(node["pico_ids"], f"{path}.pico_ids", findings):
            for idx, pico_id in enumerate(node["pico_ids"]):
                expect_pattern(pico_id, ID_RE, f"{path}.pico_ids[{idx}]", findings)


def validate_citation(node: dict[str, Any], path: str, findings: list[Finding]) -> None:
    expect_string(node.get("citation_text"), f"{path}.citation_text", findings)
    if not expect_array(node.get("source_span_ids"), f"{path}.source_span_ids", findings, min_items=1):
        return
    for idx, span_id in enumerate(node["source_span_ids"]):
        expect_pattern(span_id, ID_RE, f"{path}.source_span_ids[{idx}]", findings)


def validate_evidence_item(node: dict[str, Any], path: str, findings: list[Finding]) -> None:
    expect_string(node.get("evidence_text"), f"{path}.evidence_text", findings)
    expect_enum(node.get("study_design"), STUDY_DESIGNS, f"{path}.study_design", findings)
    if not expect_array(node.get("source_span_ids"), f"{path}.source_span_ids", findings, min_items=1):
        return
    for idx, span_id in enumerate(node["source_span_ids"]):
        expect_pattern(span_id, ID_RE, f"{path}.source_span_ids[{idx}]", findings)


def validate_funding_rule(node: dict[str, Any], path: str, findings: list[Finding]) -> None:
    expect_string(node.get("rule_text"), f"{path}.rule_text", findings)
    if not expect_array(node.get("source_span_ids"), f"{path}.source_span_ids", findings, min_items=1):
        return
    for idx, span_id in enumerate(node["source_span_ids"]):
        expect_pattern(span_id, ID_RE, f"{path}.source_span_ids[{idx}]", findings)


def validate_review_decision(node: dict[str, Any], path: str, findings: list[Finding]) -> None:
    expect_enum(node.get("decision"), REVIEW_DECISIONS, f"{path}.decision", findings)
    expect_string(node.get("rationale"), f"{path}.rationale", findings)
    if not expect_array(node.get("source_span_ids"), f"{path}.source_span_ids", findings, min_items=1):
        return
    for idx, span_id in enumerate(node["source_span_ids"]):
        expect_pattern(span_id, ID_RE, f"{path}.source_span_ids[{idx}]", findings)


def validate_model_trace(node: dict[str, Any], path: str, findings: list[Finding]) -> None:
    expect_string(node.get("model_name"), f"{path}.model_name", findings)
    expect_string(node.get("model_version"), f"{path}.model_version", findings)
    expect_string(node.get("model_class"), f"{path}.model_class", findings)
    expect_enum(node.get("trace_status"), TRACE_STATUSES, f"{path}.trace_status", findings)
    expect_string(node.get("policy_request_id"), f"{path}.policy_request_id", findings)
    if expect_string(node.get("citation_verifier_status"), f"{path}.citation_verifier_status", findings):
        if node["citation_verifier_status"] != "pass":
            add_error(findings, f"{path}.citation_verifier_status: expected 'pass', got {node['citation_verifier_status']!r}")
    expect_string(node.get("input_digest"), f"{path}.input_digest", findings)
    expect_string(node.get("output_digest"), f"{path}.output_digest", findings)
    if "output_text" in node and node["output_text"] is not None:
        expect_string(node.get("output_text"), f"{path}.output_text", findings)
    if not expect_array(node.get("source_span_ids"), f"{path}.source_span_ids", findings, min_items=1):
        return
    for idx, span_id in enumerate(node["source_span_ids"]):
        expect_pattern(span_id, ID_RE, f"{path}.source_span_ids[{idx}]", findings)
    if "gpu_seconds" in node and node["gpu_seconds"] is not None:
        if not isinstance(node["gpu_seconds"], (int, float)):
            add_error(findings, f"{path}.gpu_seconds: expected number, got {type(node['gpu_seconds']).__name__}")
        elif node["gpu_seconds"] < 0:
            add_error(findings, f"{path}.gpu_seconds: must be >= 0")
    if "cost_ledger_id" in node and node["cost_ledger_id"] is not None:
        expect_string(node["cost_ledger_id"], f"{path}.cost_ledger_id", findings)


def validate_guideline(node: dict[str, Any], path: str, findings: list[Finding]) -> None:
    expect_string(node.get("title"), f"{path}.title", findings)
    expect_string(node.get("jurisdiction"), f"{path}.jurisdiction", findings)
    if "disease_site" in node and node["disease_site"] is not None:
        expect_string(node["disease_site"], f"{path}.disease_site", findings, non_empty=False)
    if "topic" in node and node["topic"] is not None:
        expect_string(node["topic"], f"{path}.topic", findings, non_empty=False)


def validate_guideline_version(node: dict[str, Any], path: str, findings: list[Finding]) -> None:
    expect_string(node.get("version"), f"{path}.version", findings)
    expect_date(node.get("effective_date"), f"{path}.effective_date", findings)
    expect_pattern(node.get("guideline_id"), ID_RE, f"{path}.guideline_id", findings)


def validate_pico(node: dict[str, Any], path: str, findings: list[Finding]) -> None:
    expect_string(node.get("population"), f"{path}.population", findings)
    expect_string(node.get("intervention"), f"{path}.intervention", findings)
    if "comparison" in node and node["comparison"] is not None:
        expect_string(node["comparison"], f"{path}.comparison", findings, non_empty=False)
    expect_string(node.get("outcome"), f"{path}.outcome", findings)


def validate_source_document(node: dict[str, Any], path: str, findings: list[Finding]) -> None:
    expect_string(node.get("title"), f"{path}.title", findings)
    expect_string(node.get("owner"), f"{path}.owner", findings)
    expect_date(node.get("access_date"), f"{path}.access_date", findings)
    expect_string(node.get("access_path"), f"{path}.access_path", findings)
    expect_enum(node.get("license_status"), LICENSE_STATUSES, f"{path}.license_status", findings)
    if "checksum_sha256" in node and node["checksum_sha256"] is not None:
        expect_pattern(node["checksum_sha256"], SHA256_RE, f"{path}.checksum_sha256", findings)
    if "version_or_date" in node and node["version_or_date"] is not None:
        expect_string(node["version_or_date"], f"{path}.version_or_date", findings, non_empty=False)


def validate_source_span(node: dict[str, Any], path: str, findings: list[Finding]) -> None:
    expect_pattern(node.get("span_id"), ID_RE, f"{path}.span_id", findings)
    expect_pattern(node.get("source_document_id"), ID_RE, f"{path}.source_document_id", findings)
    expect_date(node.get("access_date"), f"{path}.access_date", findings)
    expect_string(node.get("stable_locator"), f"{path}.stable_locator", findings)
    expect_string(node.get("quoted_span"), f"{path}.quoted_span", findings)
    expect_pattern(node.get("excerpt_checksum"), SHA256_RE, f"{path}.excerpt_checksum", findings)
    if "prompt_or_model_version" in node and node["prompt_or_model_version"] is not None:
        expect_string(node["prompt_or_model_version"], f"{path}.prompt_or_model_version", findings, non_empty=False)
    if "reviewer" in node and node["reviewer"] is not None:
        expect_string(node["reviewer"], f"{path}.reviewer", findings, non_empty=False)
    if "review_status" in node and node["review_status"] is not None:
        expect_enum(node["review_status"], REVIEW_STATUSES, f"{path}.review_status", findings)
    if "timestamp" in node and node["timestamp"] is not None:
        expect_datetime(node["timestamp"], f"{path}.timestamp", findings)
    if "output_status" in node and node["output_status"] is not None:
        expect_enum(node["output_status"], OUTPUT_STATUSES, f"{path}.output_status", findings)


def validate_workflow_task(node: dict[str, Any], path: str, findings: list[Finding]) -> None:
    expect_enum(node.get("task_type"), TASK_TYPES, f"{path}.task_type", findings)
    expect_string(node.get("description"), f"{path}.description", findings)
    expect_string(node.get("assignee"), f"{path}.assignee", findings)
    if "due_date" in node and node["due_date"] is not None:
        expect_date(node["due_date"], f"{path}.due_date", findings)


TYPE_VALIDATORS = {
    "Guideline": validate_guideline,
    "GuidelineVersion": validate_guideline_version,
    "Recommendation": validate_recommendation,
    "PICOQuestion": validate_pico,
    "SourceDocument": validate_source_document,
    "SourceSpan": validate_source_span,
    "Citation": validate_citation,
    "EvidenceItem": validate_evidence_item,
    "FundingRule": validate_funding_rule,
    "WorkflowTask": validate_workflow_task,
    "ReviewDecision": validate_review_decision,
    "ModelTrace": validate_model_trace,
}


def validate_graph_document(data: Any, schema_path: Path, findings: list[Finding]) -> None:
    if not expect_object(data, "<root>", findings):
        return

    required = {"graph_version", "generated_at", "nodes", "edges"}
    missing = sorted(required - set(data.keys()))
    for field in missing:
        add_error(findings, f"<root>: missing required field {field!r}")
    extras = sorted(set(data.keys()) - required)
    for field in extras:
        add_error(findings, f"<root>: unexpected field {field!r}")

    if "graph_version" in data:
        expect_pattern(data["graph_version"], SEMVER_RE, "<root>.graph_version", findings)
    if "generated_at" in data:
        expect_datetime(data["generated_at"], "<root>.generated_at", findings)
    if "nodes" in data:
        if not expect_array(data["nodes"], "<root>.nodes", findings, min_items=1):
            return
    else:
        return

    node_ids: set[str] = set()
    span_ids: set[str] = set()
    for index, node in enumerate(data["nodes"]):
        node_path = f"<root>.nodes[{index}]"
        if not expect_object(node, node_path, findings):
            continue
        node_type = validate_base_node(node, node_path, findings)
        if node_type in TYPE_VALIDATORS:
            TYPE_VALIDATORS[node_type](node, node_path, findings)
        if "id" in node and isinstance(node["id"], str):
            if node["id"] in node_ids:
                add_error(findings, f"{node_path}.id: duplicate node id {node['id']!r}")
            node_ids.add(node["id"])
        if node_type == "SourceSpan" and "span_id" in node and isinstance(node["span_id"], str):
            span_ids.add(node["span_id"])

    # Cross-reference check: claim-like nodes must reference existing source spans.
    for index, node in enumerate(data["nodes"]):
        node_path = f"<root>.nodes[{index}]"
        node_type = node.get("node_type")
        if node_type not in CLAIM_LIKE_NODE_TYPES:
            continue
        source_span_ids = node.get("source_span_ids", [])
        if not isinstance(source_span_ids, list):
            continue
        for span_index, span_id in enumerate(source_span_ids):
            if span_id not in span_ids:
                add_error(
                    findings,
                    f"{node_path}.source_span_ids[{span_index}]: referenced SourceSpan {span_id!r} not found in graph nodes",
                )

    if "edges" in data:
        if not expect_array(data["edges"], "<root>.edges", findings):
            return
        for index, edge in enumerate(data["edges"]):
            edge_path = f"<root>.edges[{index}]"
            if not expect_object(edge, edge_path, findings):
                continue
            required_edge = {"id", "source", "target", "relation"}
            missing_edge = sorted(required_edge - set(edge.keys()))
            for field in missing_edge:
                add_error(findings, f"{edge_path}: missing required field {field!r}")
            extras_edge = sorted(set(edge.keys()) - required_edge - {"weight", "created_at"})
            for field in extras_edge:
                add_error(findings, f"{edge_path}: unexpected field {field!r}")
            expect_pattern(edge.get("id"), ID_RE, f"{edge_path}.id", findings)
            source = edge.get("source")
            target = edge.get("target")
            expect_pattern(source, ID_RE, f"{edge_path}.source", findings)
            expect_pattern(target, ID_RE, f"{edge_path}.target", findings)
            expect_enum(edge.get("relation"), RELATIONS, f"{edge_path}.relation", findings)
            if isinstance(source, str) and source not in node_ids:
                add_error(findings, f"{edge_path}.source: referenced node {source!r} not found")
            if isinstance(target, str) and target not in node_ids:
                add_error(findings, f"{edge_path}.target: referenced node {target!r} not found")
            if "weight" in edge and edge["weight"] is not None:
                if not isinstance(edge["weight"], (int, float)):
                    add_error(findings, f"{edge_path}.weight: expected number, got {type(edge['weight']).__name__}")
                elif edge["weight"] < 0 or edge["weight"] > 1:
                    add_error(findings, f"{edge_path}.weight: must be between 0 and 1")
            if "created_at" in edge and edge["created_at"] is not None:
                expect_datetime(edge["created_at"], f"{edge_path}.created_at", findings)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate guideline graph documents against the seed schema")
    parser.add_argument("paths", nargs="+", help="Graph JSON files to validate")
    parser.add_argument("--schema", default=str(DEFAULT_SCHEMA), help="Path to the JSON Schema file (used for presence check)")
    args = parser.parse_args()

    schema_path = Path(args.schema)
    if not schema_path.is_absolute():
        schema_path = (ROOT / schema_path).resolve()
    if not schema_path.exists():
        raise SystemExit(f"ERROR schema file not found: {schema_path}")

    findings: list[Finding] = []
    for raw in args.paths:
        path = Path(raw)
        if not path.is_absolute():
            path = (ROOT / path).resolve()
        data = load_json(path)
        validate_graph_document(data, schema_path, findings)

    for finding in findings:
        print(f"{finding.level}: {finding.message}", file=sys.stderr if finding.level == "ERROR" else sys.stdout)

    error_count = sum(1 for finding in findings if finding.level == "ERROR")
    warning_count = sum(1 for finding in findings if finding.level == "WARNING")
    if error_count:
        print(f"Validation failed: {error_count} error(s), {warning_count} warning(s)", file=sys.stderr)
        return 1
    print(f"Validation passed: {len(args.paths)} file(s), {warning_count} warning(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
