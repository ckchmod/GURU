#!/usr/bin/env python3
"""Compare two local public-corpus manifest snapshots without network access."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CHANGE_REVIEW_STATUSES = {
    "changed",
    "checksum_mismatch",
    "missing",
    "resource_added",
    "resource_removed",
}


class ManifestError(ValueError):
    pass


def resolve_path(raw: str | Path) -> Path:
    path = Path(raw)
    if not path.is_absolute():
        return (ROOT / path).resolve()
    return path.resolve()


def load_json(path: Path) -> Any:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError as exc:
        raise ManifestError(f"{path}: file not found") from exc
    except json.JSONDecodeError as exc:
        raise ManifestError(f"{path}:{exc.lineno}:{exc.colno}: invalid JSON: {exc.msg}") from exc


def load_manifest_rows(path: Path) -> dict[str, dict[str, Any]]:
    manifest = load_json(path)
    if not isinstance(manifest, dict):
        raise ManifestError(f"{path}: expected top-level JSON object")
    rows = manifest.get("rows")
    if not isinstance(rows, list):
        raise ManifestError(f"{path}: expected top-level rows array")
    indexed: dict[str, dict[str, Any]] = {}
    for index, row in enumerate(rows, start=1):
        row_path = f"{path}.rows[{index}]"
        if not isinstance(row, dict):
            raise ManifestError(f"{row_path}: expected object")
        resource_id = row.get("resource_id")
        if not isinstance(resource_id, str) or not resource_id:
            raise ManifestError(f"{row_path}.resource_id: expected non-empty string")
        status = row.get("status")
        if not isinstance(status, str) or not status:
            raise ManifestError(f"{row_path}.status: expected non-empty string")
        checksum = row.get("sha256")
        if checksum is not None and (not isinstance(checksum, str) or not checksum):
            raise ManifestError(f"{row_path}.sha256: expected non-empty string when present")
        if resource_id in indexed:
            raise ManifestError(f"{path}: duplicate resource ID {resource_id!r}")
        indexed[resource_id] = row
    return indexed


def row_checksum(row: dict[str, Any] | None) -> str | None:
    if row is None:
        return None
    checksum = row.get("sha256")
    return checksum if isinstance(checksum, str) else None


def row_status(row: dict[str, Any] | None) -> str | None:
    if row is None:
        return None
    status = row.get("status")
    return status if isinstance(status, str) else None


def classify_change(previous: dict[str, Any] | None, current: dict[str, Any] | None) -> str:
    if previous is None:
        return "resource_added"
    if current is None:
        return "resource_removed"

    previous_status = row_status(previous)
    current_status = row_status(current)
    previous_checksum = row_checksum(previous)
    current_checksum = row_checksum(current)

    if current_status == "failed" and previous_status != "failed":
        return "missing"
    if previous_status == current_status and previous_checksum == current_checksum:
        return "unchanged"
    if previous_status == "downloaded" and current_status == "downloaded" and previous_checksum != current_checksum:
        return "checksum_mismatch"
    return "changed"


def compare_manifests(previous_rows: dict[str, dict[str, Any]], current_rows: dict[str, dict[str, Any]]) -> dict[str, Any]:
    resource_ids = sorted(set(previous_rows) | set(current_rows))
    diffs: list[dict[str, Any]] = []
    summary = {
        "changed": 0,
        "checksum_mismatch": 0,
        "missing": 0,
        "resource_added": 0,
        "resource_removed": 0,
        "unchanged": 0,
    }
    for resource_id in resource_ids:
        previous = previous_rows.get(resource_id)
        current = current_rows.get(resource_id)
        change_state = classify_change(previous, current)
        summary[change_state] += 1
        diffs.append(
            {
                "resource_id": resource_id,
                "previous_status": row_status(previous),
                "previous_checksum": row_checksum(previous),
                "current_status": row_status(current),
                "current_checksum": row_checksum(current),
                "change_state": change_state,
                "review_status": "needs_review" if change_state in CHANGE_REVIEW_STATUSES else "no_change",
            }
        )
    return {"comparison_version": "1.0.0", "summary": summary, "diffs": diffs}


def write_json(payload: dict[str, Any], output_path: Path | None) -> None:
    if output_path is None:
        json.dump(payload, sys.stdout, indent=2, sort_keys=True)
        sys.stdout.write("\n")
        return
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
        handle.write("\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare two local manifest snapshots and emit deterministic JSON.")
    parser.add_argument("previous_manifest", help="Earlier local manifest JSON")
    parser.add_argument("current_manifest", help="Later local manifest JSON")
    parser.add_argument("--output", help="Optional JSON output path; stdout is used when omitted")
    args = parser.parse_args()

    try:
        previous_rows = load_manifest_rows(resolve_path(args.previous_manifest))
        current_rows = load_manifest_rows(resolve_path(args.current_manifest))
        output_path = resolve_path(args.output) if args.output else None
        write_json(compare_manifests(previous_rows, current_rows), output_path)
    except ManifestError as exc:
        print(f"ERROR {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
