#!/usr/bin/env python3
"""Validate ingestion safety boundaries with scoped, high-confidence checks."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

INGESTION_CODE_PATHS = [
    ROOT / "scripts" / "download-public-guidelines.py",
    ROOT / "scripts" / "parse-source-documents.py",
    ROOT / "services" / "api" / "app" / "knowledgebase.py",
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

TEXT_SUFFIXES = {".csv", ".json", ".jsonl", ".md", ".py", ".txt", ".yaml", ".yml"}

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
            r"\b(?:from\s+(?:openai|anthropic|cohere|google\.generativeai|google\.genai)\b|"
            r"import\s+(?:openai|anthropic|cohere|google\.generativeai|google\.genai)\b)"
        ),
    ),
    PatternRule(
        "external-llm-api-host",
        re.compile(
            r"https?://(?:api\.openai\.com|api\.anthropic\.com|api\.cohere\.ai|generativelanguage\.googleapis\.com)"
        ),
    ),
    PatternRule("external-embeddings-endpoint", re.compile(r"/v1/embeddings\b|/embeddings\b")),
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


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate ingestion PHI and external LLM safety boundaries")
    parser.add_argument("--skip-phi", action="store_true", help="Skip scoped PHI-like content checks")
    parser.add_argument("--skip-llm", action="store_true", help="Skip external LLM SDK/API checks")
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

    if findings:
        print(f"Safety boundary validation failed: {len(findings)} finding(s)", file=sys.stderr)
        return 1

    print("Safety boundary validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
