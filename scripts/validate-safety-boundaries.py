#!/usr/bin/env python3
"""Validate ingestion safety boundaries with scoped, high-confidence checks."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

INGESTION_CODE_PATHS = [
    ROOT / "scripts" / "download-public-guidelines.py",
    ROOT / "scripts" / "parse-source-documents.py",
    ROOT / "services" / "api" / "app" / "corpus_graph.py",
    ROOT / "services" / "api" / "app" / "knowledgebase.py",
    ROOT / "apps" / "web" / "lib" / "corpusAtlas.ts",
]

INGESTION_CONTENT_PATHS = [
    ROOT / "tests" / "fixtures" / "source-documents",
    ROOT / "tests" / "fixtures" / "graph-provenance",
    ROOT / "tests" / "fixtures" / "resource-registry",
    ROOT / "resources" / "registry" / "ahs-guru-pilot-subset.json",
    ROOT / "resources" / "registry" / "ahs-guru-public-corpus.json",
    ROOT / "resources" / "derived",
    ROOT / "resources" / "manifests",
    ROOT / "resources" / "raw" / "ahs-guru-public",
]

TEXT_SUFFIXES = {".csv", ".json", ".jsonl", ".md", ".py", ".ts", ".tsx", ".txt", ".yaml", ".yml"}

OFFICIAL_EMAIL_ALLOWLIST = {"guru@ahs.ca"}


@dataclass(frozen=True)
class PatternRule:
    name: str
    regex: re.Pattern[str]


@dataclass(frozen=True)
class Finding:
    path: Path
    line_number: int
    rule_name: str
    excerpt: str


PHI_RULES = [
    PatternRule("mrn-label", re.compile(r"\b(?:mrn|medical record number)\b", re.IGNORECASE)),
    PatternRule("dob-label", re.compile(r"\b(?:dob|date of birth)\b", re.IGNORECASE)),
    PatternRule("patient-name-label", re.compile(r"\bpatient[_ -]?name\b", re.IGNORECASE)),
    PatternRule("health-card-label", re.compile(r"\b(?:health card|healthcare card|hin|phn)\b", re.IGNORECASE)),
    PatternRule("phone-label", re.compile(r"\b(?:patient[_ -]?)?(?:phone|telephone|mobile)(?:[_ -]?number)?\b", re.IGNORECASE)),
    PatternRule("address-label", re.compile(r"\b(?:patient[_ -]?)?(?:street[_ -]?)?address\b", re.IGNORECASE)),
    PatternRule("email-label", re.compile(r"\bpatient[_ -]?email\b", re.IGNORECASE)),
    PatternRule("email-address", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")),
]

EXTERNAL_LLM_RULES = [
    PatternRule(
        "external-llm-sdk-import",
        re.compile(
            r"\b(?:from\s+(?:openai|anthropic|cohere|mistral|google\.generativeai|google\.genai)\b|"
            r"import\s+(?:openai|anthropic|cohere|mistral|google\.generativeai|google\.genai)\b)"
        ),
    ),
    PatternRule(
        "external-llm-api-host",
        re.compile(
            r"https?://(?:api\.openai\.com|api\.anthropic\.com|api\.cohere\.ai|api\.mistral\.ai|generativelanguage\.googleapis\.com)"
        ),
    ),
    PatternRule("external-embeddings-endpoint", re.compile(r"/v1/embeddings\b|/embeddings\b")),
    PatternRule("external-chat-completions-call", re.compile(r"\bchat\.completions\b")),
]

PATIENT_ADVICE_RULES = [
    PatternRule("dosing-advice", re.compile(r"\bdosing\b", re.IGNORECASE)),
    PatternRule("diagnosis-advice", re.compile(r"\bdiagnosis\b", re.IGNORECASE)),
    PatternRule("treatment-advice", re.compile(r"\btreatment advice\b", re.IGNORECASE)),
    PatternRule("recommended-regimen", re.compile(r"\brecommended regimen\b", re.IGNORECASE)),
    PatternRule("patient-specific", re.compile(r"\bpatient-specific\b", re.IGNORECASE)),
]

GENERATED_ANSWER_FORBIDDEN_KEYS = {
    "answer_text",
    "output_text",
    "generated_answer",
    "generatedAnswer",
    "clinical_summary",
    "suggested_treatment",
    "raw_model_output",
}
GENERATED_ANSWER_FORBIDDEN_TEXT = re.compile(
    r"\b(?:chat transcript|assistant response|recommendation text|treatment advice|dosing|diagnosis)\b",
    re.IGNORECASE,
)
CONVERSATION_TURN_ALLOWED_REQUEST_KEYS = {"question", "turn_id", "source_span_id", "selected_node_id", "resource_id"}
CONVERSATION_TURN_FORBIDDEN_REQUEST_KEYS = {
    "messages",
    "history",
    "transcript",
    "chat_prompt",
    "global_corpus_chat",
    "corpus_chat",
    "raw_model_output",
    "source_span_ids",
}

BLOCKED_PLACEHOLDER_LABELS = re.compile(
    r"\b(?:Synthetic|Packet Alpha|Model Trace Stub|Evidence Hub|Mock|Demo|Placeholder)\b",
    re.IGNORECASE,
)
RAW_PUBLIC_DIR = ROOT / "resources" / "raw" / "ahs-guru-public"
README_PATH = ROOT / "README.md"
COMMITTED_ALL_PUBLIC_MANIFEST = ROOT / "resources" / "manifests" / "ahs-guru-public" / "manifest-20260615T000000Z-no-network-status.json"
VALIDATED_ALL_PUBLIC_MANIFEST = ROOT / "resources" / "manifests" / "ahs-guru-public" / "manifest-20260616T053200Z.json"
PARSE_SUBSET_REGISTRY = ROOT / "resources" / "registry" / "ahs-guru-parse-subset.json"
PUBLIC_CORPUS_REGISTRY = ROOT / "resources" / "registry" / "ahs-guru-public-corpus.json"
DERIVED_SOURCE_DOCUMENT_DIR = ROOT / "resources" / "derived" / "source-documents"
DERIVED_SOURCE_SPAN_DIR = ROOT / "resources" / "derived" / "source-spans"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
DATETIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$")
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")
SAFE_ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$")
CANONICAL_SOURCE_DOCUMENT_FIELDS = {
    "source_document_id",
    "resource_id",
    "access_date",
    "parse_status",
    "parser_version",
    "timestamp",
    "output_status",
}
CANONICAL_SOURCE_SPAN_FIELDS = {
    "source_document_id",
    "access_date",
    "stable_locator",
    "quoted_span",
    "excerpt_checksum",
    "prompt_or_model_version",
    "reviewer",
    "review_status",
    "timestamp",
    "output_status",
}
DETERMINISTIC_MODEL_VERSION = "none-local-deterministic-parser"
EXPECTED_README_TITLE = "# GURU"
BLOCKED_README_TITLE = "# Source-backed Evidence Atlas Workbench v2"
EXPECTED_README_TAGLINE = "A local-first guideline knowledge graph and evidence atlas for source-backed cancer guideline exploration."
README_REQUIRED_SAFETY_PATTERNS = [
    ("no PHI", re.compile(r"\bNo PHI\b", re.IGNORECASE)),
    ("no patient-specific advice", re.compile(r"\bNo patient-specific\b", re.IGNORECASE)),
    ("no clinical claim without source span", re.compile(r"\bNo clinical claim without (?:a cited )?source span\b", re.IGNORECASE)),
    ("no default external LLM routing", re.compile(r"\bNo default external LLM routing\b", re.IGNORECASE)),
    (
        "selected-context cited draft answers only",
        re.compile(r"\bOnly selected-context cited draft answers are allowed\b", re.IGNORECASE),
    ),
]


def iter_existing_paths(paths: list[Path]) -> list[Path]:
    return [path for path in paths if path.exists()]


def iter_text_files(paths: list[Path]) -> list[Path]:
    files: list[Path] = []
    for path in iter_existing_paths(paths):
        if path.is_file() and path.suffix in TEXT_SUFFIXES:
            files.append(path)
        elif path.is_dir():
            for candidate in sorted(path.rglob("*")):
                if candidate.is_file() and candidate.suffix in TEXT_SUFFIXES and "__pycache__" not in candidate.parts:
                    files.append(candidate)
    return files


def relative(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def read_lines(path: Path) -> list[str]:
    try:
        return path.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError as exc:
        raise SystemExit(f"ERROR {relative(path)}: expected UTF-8 text") from exc


def is_allowed_email(match_text: str) -> bool:
    return match_text.lower() in OFFICIAL_EMAIL_ALLOWLIST


def scan_files(files: list[Path], rules: list[PatternRule]) -> list[Finding]:
    findings: list[Finding] = []
    for path in files:
        for line_number, line in enumerate(read_lines(path), start=1):
            for rule in rules:
                for match in rule.regex.finditer(line):
                    if rule.name == "email-address" and is_allowed_email(match.group(0)):
                        continue
                    findings.append(Finding(path=path, line_number=line_number, rule_name=rule.name, excerpt=line.strip()))
    return findings


def print_findings(kind: str, findings: list[Finding]) -> None:
    for finding in findings:
        print(
            f"ERROR {kind}: {relative(finding.path)}:{finding.line_number}: "
            f"{finding.rule_name}: {finding.excerpt}",
            file=sys.stderr,
        )


def error(message: str) -> None:
    print(f"ERROR {message}", file=sys.stderr)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def unsafe_json_string(value: Any) -> bool:
    if not isinstance(value, str):
        return True
    return any((ord(character) < 32 and character not in "\n\t") for character in value)


def load_json_records(directory: Path) -> list[tuple[Path, dict[str, Any]]]:
    records: list[tuple[Path, dict[str, Any]]] = []
    if not directory.exists():
        return records
    for path in sorted(directory.glob("*.json")):
        payload = load_json(path)
        if isinstance(payload, list):
            records.extend((path, record) for record in payload if isinstance(record, dict))
        elif isinstance(payload, dict):
            records.append((path, payload))
    return records


def validated_all_public_manifest_ids() -> set[str]:
    manifest = load_json(VALIDATED_ALL_PUBLIC_MANIFEST)
    corpus = load_json(PUBLIC_CORPUS_REGISTRY)
    manifest_rows = manifest.get("rows") if isinstance(manifest, dict) else None
    corpus_rows = corpus.get("rows") if isinstance(corpus, dict) else None
    if not isinstance(manifest_rows, list) or not isinstance(corpus_rows, list):
        return set()
    corpus_ids = {row.get("resource_id") for row in corpus_rows if isinstance(row, dict)}
    manifest_ids = {row.get("resource_id") for row in manifest_rows if isinstance(row, dict)}
    if len(manifest_rows) != 198 or manifest_ids != corpus_ids:
        return set()
    return {str(resource_id) for resource_id in manifest_ids if isinstance(resource_id, str)}


def parse_subset_resource_ids() -> set[str]:
    payload = load_json(PARSE_SUBSET_REGISTRY)
    rows = payload.get("rows") if isinstance(payload, dict) else None
    if not isinstance(rows, list) or len(rows) != 5:
        return set()
    return {str(row["resource_id"]) for row in rows if isinstance(row, dict) and isinstance(row.get("resource_id"), str)}


def validate_derived_source_provenance() -> list[str]:
    errors: list[str] = []
    allowed_resource_ids = parse_subset_resource_ids() | validated_all_public_manifest_ids()
    if not allowed_resource_ids:
        errors.append("derived provenance resource allowlist could not be loaded")
        return errors

    source_documents = load_json_records(DERIVED_SOURCE_DOCUMENT_DIR)
    source_spans = load_json_records(DERIVED_SOURCE_SPAN_DIR)
    document_ids = {record.get("source_document_id") for _, record in source_documents if isinstance(record.get("source_document_id"), str)}

    for path, record in source_documents:
        label = relative(path)
        missing = CANONICAL_SOURCE_DOCUMENT_FIELDS - set(record)
        if missing:
            errors.append(f"{label}: source document missing canonical fields {sorted(missing)!r}")
        if record.get("source_document_id") != record.get("document_id"):
            errors.append(f"{label}: source_document_id must match document_id")
        if record.get("resource_id") not in allowed_resource_ids:
            errors.append(f"{label}: unsafe resource_id outside parse subset or validated all-public manifest")
        if not isinstance(record.get("source_document_id"), str) or not SAFE_ID_RE.fullmatch(str(record.get("source_document_id"))):
            errors.append(f"{label}: source_document_id must be a safe identifier")
        if not isinstance(record.get("access_date"), str) or not DATE_RE.fullmatch(record["access_date"]):
            errors.append(f"{label}: access_date must use YYYY-MM-DD")
        if not isinstance(record.get("timestamp"), str) or not DATETIME_RE.fullmatch(record["timestamp"]):
            errors.append(f"{label}: timestamp must be UTC date-time")
        if record.get("output_status") != "draft":
            errors.append(f"{label}: output_status must be draft")
        if unsafe_json_string(record.get("source_document_id")) or unsafe_json_string(record.get("resource_id")):
            errors.append(f"{label}: unsafe control character in canonical identifier fields")

    seen_span_ids: set[str] = set()
    for path, record in source_spans:
        label = relative(path)
        missing = CANONICAL_SOURCE_SPAN_FIELDS - set(record)
        if missing:
            errors.append(f"{label}: source span missing canonical fields {sorted(missing)!r}")
        span_id = record.get("span_id")
        if not isinstance(span_id, str) or not SAFE_ID_RE.fullmatch(span_id):
            errors.append(f"{label}: span_id must be a safe identifier")
        elif span_id in seen_span_ids:
            errors.append(f"{label}: duplicate span_id {span_id!r}")
        else:
            seen_span_ids.add(span_id)
        if record.get("source_document_id") not in document_ids:
            errors.append(f"{label}: source_document_id does not match a derived source document")
        if record.get("resource_id") not in allowed_resource_ids:
            errors.append(f"{label}: unsafe resource_id outside parse subset or validated all-public manifest")
        if not isinstance(record.get("access_date"), str) or not DATE_RE.fullmatch(record["access_date"]):
            errors.append(f"{label}: access_date must use YYYY-MM-DD")
        if not isinstance(record.get("stable_locator"), str) or unsafe_json_string(record.get("stable_locator")):
            errors.append(f"{label}: stable_locator must be a safe string")
        quoted_span = record.get("quoted_span")
        if unsafe_json_string(quoted_span):
            errors.append(f"{label}: quoted_span must be a safe string")
        checksum = record.get("excerpt_checksum")
        if not isinstance(checksum, str) or not SHA256_RE.fullmatch(checksum):
            errors.append(f"{label}: excerpt_checksum must be SHA-256")
        elif isinstance(quoted_span, str) and checksum != sha256_text(quoted_span):
            errors.append(f"{label}: excerpt_checksum does not match quoted_span")
        if record.get("prompt_or_model_version") != DETERMINISTIC_MODEL_VERSION:
            errors.append(f"{label}: prompt_or_model_version must mark the deterministic parser")
        if record.get("reviewer") != "unreviewed":
            errors.append(f"{label}: reviewer must be unreviewed")
        if record.get("review_status") != "draft":
            errors.append(f"{label}: review_status must be draft")
        if not isinstance(record.get("timestamp"), str) or not DATETIME_RE.fullmatch(record["timestamp"]):
            errors.append(f"{label}: timestamp must be UTC date-time")
        if record.get("output_status") != "draft":
            errors.append(f"{label}: output_status must be draft")

    return errors


def validate_real_corpus_counts() -> list[str]:
    from services.api.app.corpus_graph import build_public_corpus_graph, load_public_corpus
    from services.api.app.knowledgebase import _load_parse_subset_ids

    errors: list[str] = []
    registry = load_public_corpus()
    rows = registry.get("rows", [])
    graph = build_public_corpus_graph(registry)
    resource_nodes = [node for node in graph["nodes"] if node.get("type") == "resource"]
    parse_subset_ids = _load_parse_subset_ids()

    if len(rows) != 198:
        errors.append(f"public corpus registry must contain exactly 198 rows, found {len(rows)}")
    if len(resource_nodes) != 198 or graph["metadata"].get("resource_node_count") != 198:
        errors.append("public corpus graph must project exactly 198 resource nodes")
    if len(parse_subset_ids) != 5:
        errors.append(f"parse subset must contain exactly 5 resources, found {len(parse_subset_ids)}")
    return errors


def validate_readme_docs_identity() -> list[str]:
    errors: list[str] = []
    lines = read_lines(README_PATH)
    title = lines[0].strip() if lines else ""
    body = "\n".join(lines)

    if not title.startswith(EXPECTED_README_TITLE):
        errors.append(f"README title must start with {EXPECTED_README_TITLE!r}, found {title!r}")
    if title == BLOCKED_README_TITLE:
        errors.append(f"README title must not use milestone/workbench name {BLOCKED_README_TITLE!r}")
    if EXPECTED_README_TAGLINE not in body:
        errors.append("README tagline must identify GURU as a local-first guideline knowledge graph and evidence atlas")
    for label, pattern in README_REQUIRED_SAFETY_PATTERNS:
        if not pattern.search(body):
            errors.append(f"README safety boundary missing: {label}")
    return errors


def validate_corpus_runtime_labels() -> list[str]:
    from services.api.app.corpus_graph import build_public_corpus_graph
    from services.api.app.knowledgebase import _corpus_resources, get_corpus_source_spans, search_corpus

    errors: list[str] = []
    payloads = {
        "corpus graph": build_public_corpus_graph(),
        "corpus resources": {"resources": _corpus_resources()},
        "corpus source spans": get_corpus_source_spans(),
        "corpus search": search_corpus(q="adjuvant radiotherapy"),
    }
    for name, payload in payloads.items():
        rendered = json.dumps(payload, sort_keys=True)
        if BLOCKED_PLACEHOLDER_LABELS.search(rendered):
            errors.append(f"blocked placeholder label found in {name} output")
        for rule in PATIENT_ADVICE_RULES:
            if rule.regex.search(rendered):
                errors.append(f"patient-specific advice language found in {name} output: {rule.name}")
    return errors


def iter_payload_records(value: Any, path: str = "$") -> list[tuple[str, Any]]:
    records = [(path, value)]
    if isinstance(value, dict):
        for key, item in value.items():
            records.extend(iter_payload_records(item, f"{path}.{key}"))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            records.extend(iter_payload_records(item, f"{path}[{index}]"))
    return records


def validate_conversation_turn_request_shape(label: str, payload: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    request_keys = set(payload)
    forbidden_keys = request_keys & CONVERSATION_TURN_FORBIDDEN_REQUEST_KEYS
    unexpected_keys = request_keys - CONVERSATION_TURN_ALLOWED_REQUEST_KEYS
    if forbidden_keys:
        errors.append(f"{label} request includes forbidden whole-corpus/transcript/raw-output keys: {sorted(forbidden_keys)!r}")
    if unexpected_keys:
        errors.append(f"{label} request includes non-allowlisted keys: {sorted(unexpected_keys)!r}")
    if not isinstance(payload.get("question"), str) or not payload.get("question", "").strip():
        errors.append(f"{label} request must include a non-empty question")
    if "turn_id" in payload and not isinstance(payload["turn_id"], str):
        errors.append(f"{label} request turn_id must be a string when present")
    return errors


def validate_conversation_turn_response(label: str, payload: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    status = payload.get("status")
    if payload.get("raw_output_included") is not False:
        errors.append(f"{label} must report raw_output_included=false")
    gateway_decision = payload.get("gateway_decision")
    if not isinstance(gateway_decision, dict) or gateway_decision.get("external_api_used") is not False:
        errors.append(f"{label} must report gateway_decision.external_api_used=false")
    persistence = payload.get("persistence")
    if not isinstance(persistence, dict):
        errors.append(f"{label} must include explicit non-persistence metadata")
    elif persistence.get("stored") is not False or persistence.get("transcript_persisted") is not False:
        errors.append(f"{label} must not persist answer or transcript state")

    for path, value in iter_payload_records(payload):
        if isinstance(value, dict):
            forbidden_keys = GENERATED_ANSWER_FORBIDDEN_KEYS & set(value)
            if forbidden_keys:
                errors.append(f"{label} exposes forbidden generated-answer/raw-output keys at {path}: {sorted(forbidden_keys)!r}")
        elif isinstance(value, str) and GENERATED_ANSWER_FORBIDDEN_TEXT.search(value):
            errors.append(f"{label} exposes forbidden answer/advice text at {path}")

    fragments = payload.get("answer_fragments")
    citations = payload.get("citations")
    if not isinstance(fragments, list) or not isinstance(citations, list):
        errors.append(f"{label} must include answer_fragments and citations arrays")
        return errors

    if status != "draft":
        if fragments or citations or payload.get("graph_links"):
            errors.append(f"{label} non-draft response must not include answer fragments, citations, or graph links")
        return errors

    if payload.get("answer_mode") != "selected_context_cited_draft":
        errors.append(f"{label} draft response must use selected_context_cited_draft mode")
    citations_by_span_id = {
        citation.get("source_span_id"): citation
        for citation in citations
        if isinstance(citation, dict) and isinstance(citation.get("source_span_id"), str)
    }
    if not fragments:
        errors.append(f"{label} draft response must include at least one cited fragment")
    for index, fragment in enumerate(fragments):
        if not isinstance(fragment, dict):
            errors.append(f"{label} answer fragment {index} must be an object")
            continue
        fragment_id = fragment.get("fragment_id")
        source_span_ids = fragment.get("source_span_ids")
        if fragment.get("unsupported") is True:
            errors.append(f"{label} draft fragment {fragment_id!r} must not be marked unsupported")
        if not isinstance(fragment_id, str) or not isinstance(source_span_ids, list) or not source_span_ids:
            errors.append(f"{label} draft fragment {index} must carry source_span_ids")
            continue
        for source_span_id in source_span_ids:
            citation = citations_by_span_id.get(source_span_id)
            if citation is None:
                errors.append(f"{label} draft fragment {fragment_id!r} lacks citation for source span {source_span_id!r}")
                continue
            if fragment_id not in citation.get("answer_fragment_ids", []):
                errors.append(f"{label} citation {source_span_id!r} does not support fragment {fragment_id!r}")
            for required_key in ("source_document_id", "stable_locator", "display_label", "quoted_span", "excerpt_digest"):
                if not citation.get(required_key):
                    errors.append(f"{label} citation {source_span_id!r} missing {required_key}")
    return errors


def invalid_conversation_turn_examples() -> dict[str, dict[str, Any]]:
    base_gateway = {
        "allowed": True,
        "outcome": "executed",
        "reason_code": None,
        "policy_request_id": "policy-request-invalid-example",
        "external_api_used": False,
    }
    base = {
        "status": "draft",
        "answer_mode": "selected_context_cited_draft",
        "answer_fragments": [
            {
                "fragment_id": "fragment-1",
                "text": "For the selected question, the Page 1 · Span 1 source span states: \"Local deterministic parsed excerpt.\" Local gateway trace status: executed.",
                "source_span_ids": ["source-span.invalid"],
                "unsupported": False,
            }
        ],
        "citations": [{"source_span_id": "source-span.invalid", "source_document_id": "source-document.invalid", "stable_locator": "page:1;span:1", "display_label": "Page 1 · Span 1", "quoted_span": "Local deterministic parsed excerpt.", "excerpt_digest": "sha256:invalid", "answer_fragment_ids": ["fragment-1"]}],
        "graph_links": [{"source_span_id": "source-span.invalid", "highlight_node_ids": ["resource.invalid"]}],
        "safety_notice": "Draft answer for selected source context only; not medical advice.",
        "gateway_decision": base_gateway,
        "evidence_ids": ["source-span.invalid"],
        "raw_output_included": False,
        "persistence": {"stored": False, "transcript_persisted": False},
        "model_routing": "none-local-deterministic-search-only",
    }
    return {
        "uncited draft answer example": {**base, "citations": []},
        "raw output example": {**base, "raw_output_included": True, "raw_model_output": "unsafe raw output"},
        "external routing example": {**base, "gateway_decision": {**base_gateway, "external_api_used": True}},
        "missing persistence example": {key: value for key, value in base.items() if key != "persistence"},
        "non-dict persistence example": {**base, "persistence": None},
        "persisted answer example": {**base, "persistence": {"stored": True, "transcript_persisted": True}},
        "patient advice example": {**base, "answer_fragments": [{"fragment_id": "fragment-1", "text": "treatment advice with dosing", "source_span_ids": ["source-span.invalid"], "unsupported": False}]},
    }


def validate_no_generated_answer_drift() -> list[str]:
    from fastapi.testclient import TestClient

    from services.api.app.main import app

    errors: list[str] = []
    previous_debug_gate = os.environ.get("GURU_LOCAL_DEBUG_MODEL_OUTPUT")
    os.environ["GURU_LOCAL_DEBUG_MODEL_OUTPUT"] = "0"
    try:
        client = TestClient(app)
        source_spans_response = client.get("/knowledgebase/corpus/source-spans")
        source_span_id = None
        if source_spans_response.status_code == 200:
            source_spans = source_spans_response.json().get("source_spans", [])
            if source_spans:
                source_span_id = source_spans[0].get("span_id")
        responses = {
            "corpus search": client.get("/knowledgebase/corpus/search", params={"q": "adjuvant radiotherapy"}),
            "workbench trace": client.get("/knowledgebase/corpus/workbench/trace", params={"q": "adjuvant radiotherapy"}),
            "explain selection metadata-only": client.post(
                "/knowledgebase/corpus/workbench/explain-selection",
                json={"resource_id": "ahs-guru-breast-br005-adjuvant-rt-invasive-breast"},
            ),
            "conversation selected-context required": client.post(
                "/knowledgebase/corpus/workbench/conversation-turn",
                json={"question": "Summarize the selected source context.", "turn_id": "turn-safety-selected-context-required"},
            ),
            "conversation patient advice refusal": client.post(
                "/knowledgebase/corpus/workbench/conversation-turn",
                json={"question": "what should someone choose for treatment", "turn_id": "turn-safety-patient-advice", "source_span_id": source_span_id or "source-span.missing"},
            ),
            "conversation broad source set refusal": client.post(
                "/knowledgebase/corpus/workbench/conversation-turn",
                json={"question": "Summarize the selected source context.", "turn_id": "turn-safety-broad-source-set", "source_span_ids": [source_span_id or "source-span.missing", "source-span.extra"]},
            ),
        }
        if isinstance(source_span_id, str):
            responses["conversation selected-context cited draft"] = client.post(
                "/knowledgebase/corpus/workbench/conversation-turn",
                json={"question": "Summarize the selected source context.", "turn_id": "turn-safety-cited-draft", "source_span_id": source_span_id},
            )
    finally:
        if previous_debug_gate is None:
            os.environ.pop("GURU_LOCAL_DEBUG_MODEL_OUTPUT", None)
        else:
            os.environ["GURU_LOCAL_DEBUG_MODEL_OUTPUT"] = previous_debug_gate

    for label, response in responses.items():
        if response.status_code != 200:
            errors.append(f"{label} normal API response failed with HTTP {response.status_code}")
            continue
        for path, value in iter_payload_records(response.json()):
            if isinstance(value, dict):
                forbidden_keys = GENERATED_ANSWER_FORBIDDEN_KEYS & set(value)
                if forbidden_keys:
                    errors.append(f"{label} exposes forbidden generated-answer/raw-output keys at {path}: {sorted(forbidden_keys)!r}")
                if value.get("raw_output_included") is True:
                    errors.append(f"{label} reports raw_output_included=true at {path} while debug gates are off")
                if value.get("external_api_used") is True:
                    errors.append(f"{label} reports external_api_used=true at {path}")
            elif isinstance(value, str) and GENERATED_ANSWER_FORBIDDEN_TEXT.search(value):
                errors.append(f"{label} exposes forbidden answer/advice text at {path}")
        if label.startswith("conversation "):
            errors.extend(validate_conversation_turn_response(label, response.json()))

    valid_request = {
        "question": "Summarize the selected source context.",
        "turn_id": "turn-safety-request-shape",
        "source_span_id": "source-span.valid",
        "selected_node_id": "resource.valid",
        "resource_id": "resource.valid",
    }
    errors.extend(validate_conversation_turn_request_shape("conversation selected-context allowlist", valid_request))
    for label, request_payload in {
        "conversation whole-corpus/open-chat request": {**valid_request, "messages": [], "global_corpus_chat": True},
        "conversation transcript persistence request": {**valid_request, "transcript": "persist me"},
        "conversation raw-output request": {**valid_request, "raw_model_output": "include raw output"},
    }.items():
        if not validate_conversation_turn_request_shape(label, request_payload):
            errors.append(f"{label} unexpectedly passed request-shape validation")
    for label, payload in invalid_conversation_turn_examples().items():
        if not validate_conversation_turn_response(label, payload):
            errors.append(f"{label} unexpectedly passed conversation-turn safety validation")
    return errors


def load_downloader_module() -> Any:
    module_path = ROOT / "scripts" / "download-public-guidelines.py"
    spec = importlib.util.spec_from_file_location("download_public_guidelines", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load {module_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def validate_manifest_plan_rows() -> list[str]:
    errors: list[str] = []
    downloader = load_downloader_module()
    corpus_path = ROOT / "resources" / "registry" / "ahs-guru-public-corpus.json"
    rows = downloader.all_public_rows(corpus_path)
    plans = downloader.build_plans(rows, RAW_PUBLIC_DIR)
    manifest_rows = [downloader.make_manifest_row(plan, "2026-06-15T00:00:00Z", "failed", plan.media_type, "planned CI fixture failure") for plan in plans]
    required = {"resource_id", "url", "retrieved_at", "file_path", "media_type", "status", "failure_reason"}

    if len(manifest_rows) != 198:
        errors.append(f"all-public manifest plan must account for exactly 198 rows, found {len(manifest_rows)}")
    for index, row in enumerate(manifest_rows, start=1):
        missing = required - set(row)
        if missing:
            errors.append(f"manifest planned row {index} missing fields {sorted(missing)!r}")
        if row.get("status") not in {"downloaded", "failed"}:
            errors.append(f"manifest planned row {index} has invalid status {row.get('status')!r}")
    return errors


def validate_committed_manifest_artifact() -> list[str]:
    errors: list[str] = []
    corpus_rows = load_json(ROOT / "resources" / "registry" / "ahs-guru-public-corpus.json").get("rows", [])
    expected_resource_ids = {row.get("resource_id") for row in corpus_rows if isinstance(row, dict)}
    try:
        manifest = load_json(COMMITTED_ALL_PUBLIC_MANIFEST)
    except FileNotFoundError:
        return [f"committed all-public manifest missing: {relative(COMMITTED_ALL_PUBLIC_MANIFEST)}"]
    rows = manifest.get("rows") if isinstance(manifest, dict) else None
    required = {"resource_id", "url", "retrieved_at", "file_path", "media_type", "status", "failure_reason"}

    if not isinstance(rows, list):
        return [f"committed all-public manifest must contain rows array: {relative(COMMITTED_ALL_PUBLIC_MANIFEST)}"]
    manifest_resource_ids = {row.get("resource_id") for row in rows if isinstance(row, dict)}
    if len(rows) != 198 or manifest_resource_ids != expected_resource_ids:
        errors.append("committed all-public manifest must account for exactly the 198 public corpus resource IDs")
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            errors.append(f"committed manifest row {index} must be an object")
            continue
        missing = required - set(row)
        if missing:
            errors.append(f"committed manifest row {index} missing fields {sorted(missing)!r}")
        if row.get("status") != "failed":
            errors.append(f"committed manifest row {index} must use failed no-network status")
        if row.get("failure_reason") != "no-network committed status artifact; raw PDF download not attempted":
            errors.append(f"committed manifest row {index} must explain no-network status artifact")
        if not str(row.get("file_path", "")).startswith("resources/raw/ahs-guru-public/"):
            errors.append(f"committed manifest row {index} file path must target ignored raw public directory")
    return errors


def validate_raw_public_dir_ignored_and_untracked() -> list[str]:
    errors: list[str] = []
    try:
        check_ignore = subprocess.run(
            ["git", "check-ignore", "resources/raw/ahs-guru-public/example.pdf"],
            cwd=ROOT,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
    except OSError as exc:
        return [f"git check-ignore unavailable: {exc}"]
    if check_ignore.returncode != 0:
        errors.append("resources/raw/ahs-guru-public/*.pdf must be ignored by git")

    tracked = subprocess.run(
        ["git", "ls-files", "resources/raw/ahs-guru-public"],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if tracked.returncode != 0:
        errors.append(f"git ls-files failed for raw public directory: {tracked.stderr.strip()}")
    elif tracked.stdout.strip():
        errors.append(f"raw public files must remain untracked: {tracked.stdout.strip()}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate ingestion PHI and external LLM safety boundaries")
    parser.add_argument("--skip-phi", action="store_true", help="Skip scoped PHI-like content checks")
    parser.add_argument("--skip-llm", action="store_true", help="Skip external LLM SDK/API checks")
    parser.add_argument("--skip-real-corpus", action="store_true", help="Skip real corpus count, placeholder, manifest, and raw-file checks")
    args = parser.parse_args()

    findings: list[Finding] = []
    if not args.skip_phi:
        content_files = iter_text_files(INGESTION_CONTENT_PATHS)
        phi_findings = scan_files(content_files, PHI_RULES)
        print_findings("PHI-like content", phi_findings)
        findings.extend(phi_findings)

    if not args.skip_llm:
        code_files = iter_text_files(INGESTION_CODE_PATHS)
        llm_findings = scan_files(code_files, EXTERNAL_LLM_RULES)
        print_findings("external LLM usage", llm_findings)
        findings.extend(llm_findings)

    docs_errors = validate_readme_docs_identity()
    for message in docs_errors:
        error(message)

    no_answer_errors = validate_no_generated_answer_drift()
    for message in no_answer_errors:
        error(message)

    real_corpus_errors: list[str] = []
    if not args.skip_real_corpus:
        real_corpus_errors.extend(validate_real_corpus_counts())
        real_corpus_errors.extend(validate_corpus_runtime_labels())
        real_corpus_errors.extend(validate_manifest_plan_rows())
        real_corpus_errors.extend(validate_committed_manifest_artifact())
        real_corpus_errors.extend(validate_raw_public_dir_ignored_and_untracked())
        real_corpus_errors.extend(validate_derived_source_provenance())
        for message in real_corpus_errors:
            error(message)

    if findings or docs_errors or no_answer_errors or real_corpus_errors:
        total = len(findings) + len(docs_errors) + len(no_answer_errors) + len(real_corpus_errors)
        print(f"Safety boundary validation failed: {total} finding(s)", file=sys.stderr)
        return 1

    print("Safety boundary validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
