#!/usr/bin/env python3
"""Validate resource registry files against the documented schema and policy.

The validator checks:
- top-level registry structure from docs/resource-registry.schema.json
- row-level required fields, enums, patterns, and additionalProperties=false
- conservative storage rules for unknown/restrictive licenses
- duplicate resource IDs / locators with checksum drift (warning only)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCHEMA = ROOT / "docs" / "resource-registry.schema.json"
DEFAULT_REGISTRY_DIR = ROOT / "resources" / "registry"
EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


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


def normalize_inputs(paths: Iterable[str]) -> list[Path]:
    discovered: list[Path] = []
    for raw in paths:
        candidate = Path(raw)
        if not candidate.is_absolute():
            candidate = (ROOT / candidate).resolve()
        if candidate.is_dir():
            discovered.extend(sorted(candidate.glob("*.json")))
        elif candidate.is_file():
            discovered.append(candidate)
        else:
            raise SystemExit(f"ERROR {candidate}: path does not exist")
    unique: list[Path] = []
    seen: set[Path] = set()
    for path in discovered:
        resolved = path.resolve()
        if resolved not in seen:
            seen.add(resolved)
            unique.append(resolved)
    return unique


def add_error(findings: list[Finding], message: str) -> None:
    findings.append(Finding("ERROR", message))


def add_warning(findings: list[Finding], message: str) -> None:
    findings.append(Finding("WARNING", message))


def validate_scalar(value: Any, expected_type: type, path: str, findings: list[Finding]) -> None:
    if not isinstance(value, expected_type):
        add_error(findings, f"{path}: expected {expected_type.__name__}, got {type(value).__name__}")


def validate_enum(value: str, allowed: set[str], path: str, findings: list[Finding]) -> None:
    if value not in allowed:
        add_error(findings, f"{path}: invalid value {value!r}; expected one of {sorted(allowed)!r}")


def validate_pattern(value: str, pattern: re.Pattern[str], path: str, findings: list[Finding]) -> None:
    if not pattern.fullmatch(value):
        add_error(findings, f"{path}: value {value!r} does not match {pattern.pattern}")


def validate_row(row: dict[str, Any], file_path: Path, index: int, findings: list[Finding]) -> None:
    row_path = f"{file_path} rows[{index}]"
    required_fields = [
        "resource_id",
        "title",
        "source_owner",
        "source_url_or_access_path",
        "access_method",
        "access_date",
        "resource_type",
        "jurisdiction",
        "disease_site",
        "document_status",
        "version_or_date",
        "license_status",
        "allowed_use",
        "permission_required",
        "permission_status",
        "local_storage_decision",
        "checksum_sha256",
        "notes",
    ]
    properties = set(required_fields)
    missing = [field for field in required_fields if field not in row]
    for field in missing:
        add_error(findings, f"{row_path}: missing required field {field!r}")
    extras = sorted(set(row) - properties)
    for field in extras:
        add_error(findings, f"{row_path}: unexpected field {field!r}")
    if missing:
        return

    validate_scalar(row["resource_id"], str, f"{row_path}.resource_id", findings)
    if isinstance(row["resource_id"], str):
        validate_pattern(row["resource_id"], re.compile(r"^[a-z0-9][a-z0-9_.:-]*$"), f"{row_path}.resource_id", findings)
        if not row["resource_id"]:
            add_error(findings, f"{row_path}.resource_id: must not be empty")

    for key in ["title", "source_owner", "source_url_or_access_path", "disease_site", "version_or_date", "notes"]:
        validate_scalar(row[key], str, f"{row_path}.{key}", findings)
        if isinstance(row[key], str) and not row[key]:
            add_error(findings, f"{row_path}.{key}: must not be empty")

    validate_enum(
        row["access_method"],
        {"public_url", "doi", "internal_share", "api", "subscription_api", "manual_request", "email", "unknown"},
        f"{row_path}.access_method",
        findings,
    )
    validate_enum(
        row["resource_type"],
        {"guideline", "evidence_table", "algorithm", "summary", "letter", "methodology", "standard", "trial_registry", "regulatory", "terminology", "api", "other"},
        f"{row_path}.resource_type",
        findings,
    )
    validate_enum(row["jurisdiction"], {"CA-AB", "CA", "US", "EU", "International", "Organization"}, f"{row_path}.jurisdiction", findings)
    validate_enum(row["document_status"], {"draft", "under_review", "approved", "archived", "superseded", "unknown"}, f"{row_path}.document_status", findings)
    validate_enum(
        row["license_status"],
        {"unknown", "public_domain", "cc_by", "cc_by_nc", "cc_by_sa", "proprietary", "subscription", "government_open", "restricted"},
        f"{row_path}.license_status",
        findings,
    )
    validate_enum(
        row["permission_status"],
        {"pending", "unknown", "not_applicable", "approved", "denied"},
        f"{row_path}.permission_status",
        findings,
    )
    validate_enum(
        row["local_storage_decision"],
        {"link-only", "metadata-only", "local raw archive", "Git LFS", "object storage", "prohibited"},
        f"{row_path}.local_storage_decision",
        findings,
    )
    validate_pattern(row["access_date"], DATE_RE, f"{row_path}.access_date", findings)
    if not isinstance(row["allowed_use"], list):
        add_error(findings, f"{row_path}.allowed_use: expected array, got {type(row['allowed_use']).__name__}")
    else:
        if not row["allowed_use"]:
            add_error(findings, f"{row_path}.allowed_use: must not be empty")
        for item in row["allowed_use"]:
            if not isinstance(item, str):
                add_error(findings, f"{row_path}.allowed_use: expected strings, got {type(item).__name__}")
                continue
            validate_enum(item, {"link", "view", "metadata", "summarize", "embed", "redistribute", "derive_graph", "commercial"}, f"{row_path}.allowed_use[]", findings)

    if not isinstance(row["permission_required"], bool):
        add_error(findings, f"{row_path}.permission_required: expected boolean, got {type(row['permission_required']).__name__}")

    validate_pattern(row["checksum_sha256"], re.compile(r"^[a-f0-9]{64}$"), f"{row_path}.checksum_sha256", findings)

    conservative_uses = {"link", "view", "metadata"}
    restricted_storage = {"unknown", "restricted", "proprietary", "subscription"}
    if row["license_status"] in restricted_storage and row["local_storage_decision"] in {"local raw archive", "Git LFS", "object storage"}:
        add_error(
            findings,
            f"{row_path}.local_storage_decision: {row['license_status']!r} license cannot use {row['local_storage_decision']!r}",
        )

    if row["local_storage_decision"] in {"link-only", "metadata-only"}:
        bad_uses = [use for use in row["allowed_use"] if isinstance(use, str) and use not in conservative_uses]
        if bad_uses:
            add_error(
                findings,
                f"{row_path}.allowed_use: {row['local_storage_decision']!r} rows may only request {sorted(conservative_uses)!r}; found {bad_uses!r}",
            )


def validate_registry_file(path: Path, schema: dict[str, Any], findings: list[Finding], seen: dict[str, tuple[str, str, Path]]) -> None:
    data = load_json(path)
    if not isinstance(data, dict):
        add_error(findings, f"{path}: expected object at top level, got {type(data).__name__}")
        return

    required = set(schema["required"])
    extras = sorted(set(data) - required)
    missing = sorted(required - set(data))
    for field in missing:
        add_error(findings, f"{path}: missing required field {field!r}")
    for field in extras:
        add_error(findings, f"{path}: unexpected top-level field {field!r}")

    if missing:
        return

    validate_pattern(data["registry_version"], re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+$"), f"{path}.registry_version", findings)
    validate_pattern(data["last_updated"], DATE_RE, f"{path}.last_updated", findings)
    validate_enum(data["category"], set(schema["properties"]["category"]["enum"]), f"{path}.category", findings)
    if not isinstance(data["rows"], list):
        add_error(findings, f"{path}.rows: expected array, got {type(data['rows']).__name__}")
        return

    for index, row in enumerate(data["rows"], start=1):
        if not isinstance(row, dict):
            add_error(findings, f"{path}.rows[{index}]: expected object, got {type(row).__name__}")
            continue
        validate_row(row, path, index, findings)
        if "resource_id" not in row or "checksum_sha256" not in row or "source_url_or_access_path" not in row:
            continue
        for duplicate_key, label in ((row["resource_id"], "resource_id"), (row["source_url_or_access_path"], "source_url_or_access_path")):
            existing = seen.get(f"{label}:{duplicate_key}")
            current = (row["checksum_sha256"], row.get("title", ""), path)
            if existing and existing[0] != current[0]:
                add_warning(
                    findings,
                    f"{path}.rows[{index}]: duplicate {label} {duplicate_key!r} checksum changed from {existing[0]} in {existing[2]} to {current[0]}",
                )
            else:
                seen[f"{label}:{duplicate_key}"] = current


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate resource registry JSON files")
    parser.add_argument("paths", nargs="*", help="Registry files or directories to validate (defaults to resources/registry)")
    parser.add_argument("--schema", default=str(DEFAULT_SCHEMA), help="Path to the JSON Schema file")
    args = parser.parse_args()

    schema_path = Path(args.schema)
    if not schema_path.is_absolute():
        schema_path = (ROOT / schema_path).resolve()
    schema = load_json(schema_path)

    inputs = normalize_inputs(args.paths or [str(DEFAULT_REGISTRY_DIR)])
    findings: list[Finding] = []
    seen: dict[str, tuple[str, str, Path]] = {}
    for path in inputs:
        validate_registry_file(path, schema, findings, seen)

    for finding in findings:
        print(f"{finding.level}: {finding.message}", file=sys.stderr if finding.level == "ERROR" else sys.stdout)

    error_count = sum(1 for finding in findings if finding.level == "ERROR")
    warning_count = sum(1 for finding in findings if finding.level == "WARNING")
    if error_count:
        print(f"Validation failed: {error_count} error(s), {warning_count} warning(s)", file=sys.stderr)
        return 1
    print(f"Validation passed: {len(inputs)} file(s), {warning_count} warning(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
