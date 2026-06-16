#!/usr/bin/env python3
"""Validate ingestion safety boundaries with scoped, high-confidence checks."""

from __future__ import annotations

import argparse
import importlib.util
import json
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

BLOCKED_PLACEHOLDER_LABELS = re.compile(
    r"\b(?:Synthetic|Packet Alpha|Model Trace Stub|Evidence Hub|Mock|Demo|Placeholder)\b",
    re.IGNORECASE,
)
RAW_PUBLIC_DIR = ROOT / "resources" / "raw" / "ahs-guru-public"
COMMITTED_ALL_PUBLIC_MANIFEST = ROOT / "resources" / "manifests" / "ahs-guru-public" / "manifest-20260615T000000Z-no-network-status.json"


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

    real_corpus_errors: list[str] = []
    if not args.skip_real_corpus:
        real_corpus_errors.extend(validate_real_corpus_counts())
        real_corpus_errors.extend(validate_corpus_runtime_labels())
        real_corpus_errors.extend(validate_manifest_plan_rows())
        real_corpus_errors.extend(validate_committed_manifest_artifact())
        real_corpus_errors.extend(validate_raw_public_dir_ignored_and_untracked())
        for message in real_corpus_errors:
            error(message)

    if findings or real_corpus_errors:
        total = len(findings) + len(real_corpus_errors)
        print(f"Safety boundary validation failed: {total} finding(s)", file=sys.stderr)
        return 1

    print("Safety boundary validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
