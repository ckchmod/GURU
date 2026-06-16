#!/usr/bin/env python3
"""Download bounded public AHS/GURU guideline resources and write a checksum manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import shutil
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SELECTOR = ROOT / "resources" / "registry" / "ahs-guru-pilot-subset.json"
DEFAULT_CORPUS = ROOT / "resources" / "registry" / "ahs-guru-public-corpus.json"
DEFAULT_RAW_DIR = ROOT / "resources" / "raw" / "ahs-guru-public"
DEFAULT_MANIFEST_DIR = ROOT / "resources" / "manifests" / "ahs-guru-public"
MANIFEST_VERSION = "1.0.0"


@dataclass(frozen=True)
class ResourcePlan:
    resource_id: str
    url: str
    media_type: str
    output_path: Path


def resolve_path(raw: str | Path) -> Path:
    path = Path(raw)
    if not path.is_absolute():
        return (ROOT / path).resolve()
    return path.resolve()


def load_json(path: Path) -> Any:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        raise SystemExit(f"ERROR {path}: file not found")
    except json.JSONDecodeError as exc:
        raise SystemExit(f"ERROR {path}:{exc.lineno}:{exc.colno}: invalid JSON: {exc.msg}") from exc


def require_object(value: Any, path: Path) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise SystemExit(f"ERROR {path}: expected JSON object")
    return value


def load_selected_ids(selector_path: Path) -> list[str]:
    selector = require_object(load_json(selector_path), selector_path)
    resource_ids = selector.get("resource_ids")
    if resource_ids is None and isinstance(selector.get("rows"), list):
        resource_ids = [row.get("resource_id") if isinstance(row, dict) else None for row in selector["rows"]]
    if not isinstance(resource_ids, list) or not resource_ids:
        raise SystemExit(f"ERROR {selector_path}: expected non-empty resource_ids array or rows array")
    selected: list[str] = []
    seen: set[str] = set()
    for index, resource_id in enumerate(resource_ids, start=1):
        if not isinstance(resource_id, str) or not resource_id:
            raise SystemExit(f"ERROR {selector_path}: resource_ids[{index}] must be a non-empty string")
        if resource_id in seen:
            raise SystemExit(f"ERROR {selector_path}: duplicate resource ID {resource_id!r}")
        selected.append(resource_id)
        seen.add(resource_id)
    return selected


def load_corpus_rows(corpus_path: Path) -> dict[str, dict[str, Any]]:
    corpus = require_object(load_json(corpus_path), corpus_path)
    rows = corpus.get("rows")
    if not isinstance(rows, list):
        raise SystemExit(f"ERROR {corpus_path}: expected top-level rows array")
    indexed: dict[str, dict[str, Any]] = {}
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            raise SystemExit(f"ERROR {corpus_path}: rows[{index}] must be an object")
        resource_id = row.get("resource_id")
        if not isinstance(resource_id, str) or not resource_id:
            raise SystemExit(f"ERROR {corpus_path}: rows[{index}].resource_id must be a non-empty string")
        if resource_id in indexed:
            raise SystemExit(f"ERROR {corpus_path}: duplicate resource ID {resource_id!r}")
        indexed[resource_id] = row
    return indexed


def selected_rows(selector_path: Path, corpus_path: Path) -> list[dict[str, Any]]:
    selected_ids = load_selected_ids(selector_path)
    corpus_rows = load_corpus_rows(corpus_path)
    missing = [resource_id for resource_id in selected_ids if resource_id not in corpus_rows]
    if missing:
        joined = ", ".join(missing)
        raise SystemExit(f"ERROR selected resource ID(s) missing from corpus rows: {joined}")
    return [corpus_rows[resource_id] for resource_id in selected_ids]


def all_public_rows(corpus_path: Path) -> list[dict[str, Any]]:
    return list(load_corpus_rows(corpus_path).values())


def filename_from_url(resource_id: str, url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    name = Path(urllib.parse.unquote(parsed.path)).name
    if name:
        return name
    return f"{resource_id}.bin"


def media_type_from_name(name: str, fallback: str = "application/octet-stream") -> str:
    media_type, _ = mimetypes.guess_type(name)
    return media_type or fallback


def build_plans(rows: Iterable[dict[str, Any]], raw_dir: Path) -> list[ResourcePlan]:
    plans: list[ResourcePlan] = []
    for row in rows:
        resource_id = row.get("resource_id")
        url = row.get("source_url_or_access_path")
        if not isinstance(resource_id, str) or not resource_id:
            raise SystemExit("ERROR corpus row is missing resource_id")
        if not isinstance(url, str) or not url:
            raise SystemExit(f"ERROR {resource_id}: missing source_url_or_access_path")
        output_name = filename_from_url(resource_id, url)
        plans.append(
            ResourcePlan(
                resource_id=resource_id,
                url=url,
                media_type=media_type_from_name(output_name),
                output_path=raw_dir / output_name,
            )
        )
    return plans


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def copy_fixture(plan: ResourcePlan, fixture_dir: Path) -> tuple[Path, str]:
    candidates = [fixture_dir / plan.output_path.name, fixture_dir / f"{plan.resource_id}{plan.output_path.suffix}", fixture_dir / plan.resource_id]
    fixture_path = next((candidate for candidate in candidates if candidate.exists()), None)
    if fixture_path is None:
        expected = ", ".join(str(candidate) for candidate in candidates)
        raise SystemExit(f"ERROR {plan.resource_id}: local fixture not found; expected one of {expected}")
    plan.output_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(fixture_path, plan.output_path)
    return plan.output_path, media_type_from_name(fixture_path.name, plan.media_type)


def download_url(plan: ResourcePlan, timeout_seconds: int) -> tuple[Path, str]:
    request = urllib.request.Request(plan.url, headers={"User-Agent": "GURU-public-guideline-downloader/1.0"})
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        media_type = response.headers.get_content_type() or plan.media_type
        plan.output_path.parent.mkdir(parents=True, exist_ok=True)
        with plan.output_path.open("wb") as handle:
            shutil.copyfileobj(response, handle)
    return plan.output_path, media_type


def make_manifest_path(manifest_dir: Path, retrieved_at: str) -> Path:
    safe_timestamp = retrieved_at.replace(":", "").replace("-", "").replace("+", "Z")
    return manifest_dir / f"manifest-{safe_timestamp}.json"


def write_manifest(rows: list[dict[str, Any]], manifest_path: Path) -> None:
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"manifest_version": MANIFEST_VERSION, "rows": rows}
    with manifest_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
        handle.write("\n")


def relative_to_root(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def failure_reason(exc: BaseException) -> str:
    return " ".join(str(exc).split()) or exc.__class__.__name__


def make_manifest_row(plan: ResourcePlan, retrieved_at: str, status: str, media_type: str, failure: str | None = None) -> dict[str, Any]:
    row: dict[str, Any] = {
        "file_path": relative_to_root(plan.output_path),
        "media_type": media_type,
        "resource_id": plan.resource_id,
        "retrieved_at": retrieved_at,
        "status": status,
        "url": plan.url,
    }
    if failure is not None:
        row["failure_reason"] = failure
    return row


def success_metadata(path: Path) -> dict[str, Any]:
    byte_size = path.stat().st_size
    if byte_size <= 0:
        raise OSError(f"downloaded file is empty: {path}")
    return {"byte_size": byte_size, "sha256": sha256_file(path)}


def acquire(plans: list[ResourcePlan], fixture_dir: Path | None, timeout_seconds: int, retrieved_at: str) -> list[dict[str, Any]]:
    manifest_rows: list[dict[str, Any]] = []
    for plan in plans:
        row = make_manifest_row(plan, retrieved_at, "downloaded", plan.media_type)
        try:
            if fixture_dir is not None:
                output_path, media_type = copy_fixture(plan, fixture_dir)
            else:
                output_path, media_type = download_url(plan, timeout_seconds)
        except (OSError, TimeoutError, urllib.error.URLError, SystemExit) as exc:
            manifest_rows.append(make_manifest_row(plan, retrieved_at, "failed", plan.media_type, failure_reason(exc)))
            continue
        row["media_type"] = media_type
        try:
            row.update(success_metadata(output_path))
        except OSError as exc:
            manifest_rows.append(make_manifest_row(plan, retrieved_at, "failed", media_type, failure_reason(exc)))
            continue
        manifest_rows.append(row)
    return manifest_rows


def validate_manifest(path: Path) -> int:
    manifest = require_object(load_json(path), path)
    rows = manifest.get("rows")
    if not isinstance(rows, list) or not rows:
        print(f"ERROR {path}: expected non-empty rows array", file=sys.stderr)
        return 1
    required = {"resource_id", "url", "retrieved_at", "file_path", "media_type", "status"}
    success_fields = {"byte_size", "sha256"}
    allowed = required | success_fields | {"failure_reason"}
    errors: list[str] = []
    downloaded_count = 0
    failed_count = 0
    for index, row in enumerate(rows, start=1):
        row_path = f"{path}.rows[{index}]"
        if not isinstance(row, dict):
            errors.append(f"{row_path}: expected object")
            continue
        missing = sorted(required - set(row))
        extras = sorted(set(row) - allowed)
        if missing:
            errors.append(f"{row_path}: missing fields {missing!r}")
        if extras:
            errors.append(f"{row_path}: unexpected fields {extras!r}")
        if missing:
            continue
        status = row["status"]
        if status not in {"downloaded", "failed"}:
            errors.append(f"{row_path}.status: expected 'downloaded' or 'failed', found {status!r}")
            continue
        invalid_common_fields = False
        for field in ["resource_id", "url", "retrieved_at", "file_path", "media_type"]:
            if not isinstance(row[field], str) or not row[field]:
                errors.append(f"{row_path}.{field}: expected non-empty string")
                invalid_common_fields = True
        if status == "failed":
            failed_count += 1
            if "failure_reason" not in row or not isinstance(row["failure_reason"], str) or not row["failure_reason"]:
                errors.append(f"{row_path}.failure_reason: required for failed rows")
            for field in success_fields:
                if field in row:
                    errors.append(f"{row_path}.{field}: must be omitted for failed rows")
            continue
        downloaded_count += 1
        success_missing = sorted(success_fields - set(row))
        if success_missing:
            errors.append(f"{row_path}: downloaded row missing fields {success_missing!r}")
            continue
        if "failure_reason" in row:
            errors.append(f"{row_path}.failure_reason: must be omitted for downloaded rows")
        if not isinstance(row["byte_size"], int) or row["byte_size"] <= 0:
            errors.append(f"{row_path}.byte_size: expected positive integer")
            continue
        if not isinstance(row["sha256"], str) or len(row["sha256"]) != 64:
            errors.append(f"{row_path}.sha256: expected 64-character SHA-256 hex string")
            continue
        try:
            int(row["sha256"], 16)
        except ValueError:
            errors.append(f"{row_path}.sha256: expected 64-character SHA-256 hex string")
            continue
        if invalid_common_fields:
            continue
        file_path = resolve_path(row["file_path"])
        if not file_path.exists():
            errors.append(f"{row_path}.file_path: file not found: {file_path}")
            continue
        actual_size = file_path.stat().st_size
        actual_sha256 = sha256_file(file_path)
        if row["byte_size"] != actual_size:
            errors.append(f"{row_path}.byte_size: expected {row['byte_size']}, found {actual_size}")
        if row["sha256"] != actual_sha256:
            errors.append(f"{row_path}.sha256: expected {row['sha256']}, found {actual_sha256}")
    for error in errors:
        print(f"ERROR {error}", file=sys.stderr)
    if errors:
        print(f"Manifest validation failed: {len(errors)} error(s)", file=sys.stderr)
        return 1
    print(f"Manifest validation passed: {len(rows)} row(s), downloaded={downloaded_count}, failed={failed_count}")
    return 0


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def print_dry_run(plans: list[ResourcePlan]) -> None:
    print("DRY RUN public guideline acquisition plan")
    print(f"resource_count={len(plans)}")
    for plan in plans:
        print(
            " ".join(
                [
                    f"resource_id={plan.resource_id}",
                    f"url={plan.url}",
                    f"file_path={relative_to_root(plan.output_path)}",
                    f"media_type={plan.media_type}",
                ]
            )
        )


def ensure_live_raw_dir(raw_dir: Path) -> None:
    try:
        raw_dir.resolve().relative_to(DEFAULT_RAW_DIR.resolve())
    except ValueError:
        raise SystemExit(f"ERROR live downloads must write under {relative_to_root(DEFAULT_RAW_DIR)}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Download bounded public AHS/GURU resources and write a SHA-256 manifest."
    )
    parser.add_argument("--selector", default=str(DEFAULT_SELECTOR), help="Pilot selector JSON with resource_ids")
    parser.add_argument("--corpus", default=str(DEFAULT_CORPUS), help="Public corpus registry JSON with top-level rows")
    parser.add_argument("--all-public", action="store_true", help="Plan or acquire every row in the public corpus registry")
    parser.add_argument("--raw-dir", default=str(DEFAULT_RAW_DIR), help="Destination for raw downloaded or fixture files")
    parser.add_argument("--manifest-dir", default=str(DEFAULT_MANIFEST_DIR), help="Directory for generated manifest JSON")
    parser.add_argument("--manifest-path", help="Exact manifest path to write instead of timestamped default")
    parser.add_argument("--fixture-dir", help="Read local fixture files from this directory instead of using the network")
    parser.add_argument("--timeout-seconds", type=int, default=30, help="Network timeout for each live download")
    parser.add_argument("--retrieved-at", help="ISO-8601 retrieval timestamp override for deterministic fixture tests")
    parser.add_argument("--dry-run", action="store_true", help="Plan selected resources without network or file writes")
    parser.add_argument("--validate-manifest", help="Validate manifest rows against files and SHA-256 values, then exit")
    args = parser.parse_args()

    if args.validate_manifest:
        return validate_manifest(resolve_path(args.validate_manifest))

    selector_path = resolve_path(args.selector)
    corpus_path = resolve_path(args.corpus)
    raw_dir = resolve_path(args.raw_dir)
    rows = all_public_rows(corpus_path) if args.all_public else selected_rows(selector_path, corpus_path)
    plans = build_plans(rows, raw_dir)

    if args.dry_run:
        print_dry_run(plans)
        return 0

    retrieved_at = args.retrieved_at or iso_now()
    fixture_dir = resolve_path(args.fixture_dir) if args.fixture_dir else None
    if fixture_dir is None:
        ensure_live_raw_dir(raw_dir)
    manifest_rows = acquire(plans, fixture_dir, args.timeout_seconds, retrieved_at)
    manifest_path = resolve_path(args.manifest_path) if args.manifest_path else make_manifest_path(resolve_path(args.manifest_dir), retrieved_at)
    write_manifest(manifest_rows, manifest_path)
    downloaded_count = sum(1 for row in manifest_rows if row.get("status") == "downloaded")
    failed_count = sum(1 for row in manifest_rows if row.get("status") == "failed")
    print(f"Processed {len(manifest_rows)} resource(s): downloaded={downloaded_count}, failed={failed_count}")
    print(f"manifest={relative_to_root(manifest_path)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
