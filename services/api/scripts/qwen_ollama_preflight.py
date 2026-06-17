from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from typing import Any, Callable, Mapping

from services.api.app import model_gateway


UrlOpen = Callable[[object, float], Any]


TASK_ID = "99999999-9999-4999-8999-999999999999"
REQUEST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


def run_preflight(*, run_smoke: bool = False, urlopen: UrlOpen | None = None) -> dict[str, Any]:
    resolved_urlopen = urlopen or urllib.request.urlopen
    base_url = os.environ.get(model_gateway.OLLAMA_BASE_URL_ENV, model_gateway.OLLAMA_DEFAULT_BASE_URL)
    model_name = os.environ.get(model_gateway.OLLAMA_MODEL_ENV, model_gateway.OLLAMA_DEFAULT_MODEL)
    provider = os.environ.get(model_gateway.LOCAL_INSTRUCTION_PROVIDER_ENV, "")
    real_enabled = os.environ.get(model_gateway.LOCAL_INSTRUCTION_REAL_RUNNER_ENV, "")
    loopback_only = model_gateway._is_loopback_http_url(base_url)

    tags = _check_ollama_tags(base_url, loopback_only=loopback_only, urlopen=resolved_urlopen)
    model_present = model_name in tags["models"]
    env_ready = real_enabled == "1" and provider == model_gateway.OLLAMA_PROVIDER and loopback_only
    ready = env_ready and tags["reachable"] and model_present

    result: dict[str, Any] = {
        "preflight": "local-qwen-ollama",
        "external_api_used": False,
        "environment": {
            model_gateway.LOCAL_INSTRUCTION_REAL_RUNNER_ENV: {
                "value": real_enabled,
                "ok": real_enabled == "1",
                "expected": "1",
            },
            model_gateway.LOCAL_INSTRUCTION_PROVIDER_ENV: {
                "value": provider,
                "ok": provider == model_gateway.OLLAMA_PROVIDER,
                "expected": model_gateway.OLLAMA_PROVIDER,
            },
            model_gateway.OLLAMA_BASE_URL_ENV: {
                "value": base_url,
                "ok": loopback_only,
                "expected": model_gateway.OLLAMA_DEFAULT_BASE_URL,
                "loopback_only": loopback_only,
            },
            model_gateway.OLLAMA_MODEL_ENV: {
                "value": model_name,
                "ok": model_name == model_gateway.OLLAMA_DEFAULT_MODEL,
                "expected": model_gateway.OLLAMA_DEFAULT_MODEL,
            },
        },
        "ollama": {
            "tags_url": _ollama_tags_url(base_url),
            "reachable": tags["reachable"],
            "status": tags["status"],
            "models": tags["models"],
            "model": model_name,
            "model_present": model_present,
        },
        "ready": ready,
        "actions": _setup_actions(
            real_enabled=real_enabled,
            provider=provider,
            base_url=base_url,
            model_name=model_name,
            loopback_only=loopback_only,
            reachable=tags["reachable"],
            model_present=model_present,
        ),
    }
    if run_smoke:
        result["smoke"] = _run_gateway_smoke(ready=ready)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Check local Qwen/Ollama readiness without requiring Ollama in CI.")
    parser.add_argument("--smoke", action="store_true", help="Run an opt-in real local smoke through model_gateway.py when preflight is ready.")
    args = parser.parse_args()
    print(json.dumps(run_preflight(run_smoke=args.smoke), indent=2, sort_keys=True))


def _check_ollama_tags(base_url: str, *, loopback_only: bool, urlopen: UrlOpen) -> dict[str, Any]:
    if not loopback_only:
        return {"reachable": False, "status": model_gateway.LOCAL_QWEN_NON_LOOPBACK_BASE_URL, "models": []}

    request = urllib.request.Request(_ollama_tags_url(base_url), method="GET")
    try:
        with urlopen(request, timeout=model_gateway.OLLAMA_REQUEST_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except TimeoutError:
        return {"reachable": False, "status": model_gateway.LOCAL_QWEN_TIMEOUT, "models": []}
    except urllib.error.URLError as error:
        status = model_gateway.LOCAL_QWEN_TIMEOUT if isinstance(error.reason, TimeoutError) else model_gateway.LOCAL_QWEN_RUNNER_REQUIRED
        return {"reachable": False, "status": status, "models": []}
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {"reachable": False, "status": model_gateway.LOCAL_QWEN_MALFORMED_RESPONSE, "models": []}

    models = _tag_model_names(payload)
    return {"reachable": True, "status": "ollama_tags_reachable", "models": models}


def _tag_model_names(payload: Mapping[str, Any]) -> list[str]:
    models = payload.get("models")
    if not isinstance(models, list):
        return []
    names: list[str] = []
    for entry in models:
        if isinstance(entry, Mapping) and isinstance(entry.get("name"), str):
            names.append(entry["name"])
    return sorted(names)


def _setup_actions(
    *,
    real_enabled: str,
    provider: str,
    base_url: str,
    model_name: str,
    loopback_only: bool,
    reachable: bool,
    model_present: bool,
) -> list[str]:
    actions: list[str] = []
    if real_enabled != "1":
        actions.append(f"export {model_gateway.LOCAL_INSTRUCTION_REAL_RUNNER_ENV}=1")
    if provider != model_gateway.OLLAMA_PROVIDER:
        actions.append(f"export {model_gateway.LOCAL_INSTRUCTION_PROVIDER_ENV}=ollama")
    if base_url != model_gateway.OLLAMA_DEFAULT_BASE_URL or not loopback_only:
        actions.append(f"export {model_gateway.OLLAMA_BASE_URL_ENV}={model_gateway.OLLAMA_DEFAULT_BASE_URL}")
    if model_name != model_gateway.OLLAMA_DEFAULT_MODEL:
        actions.append(f"export {model_gateway.OLLAMA_MODEL_ENV}={model_gateway.OLLAMA_DEFAULT_MODEL}")
    if real_enabled != "1" or provider != model_gateway.OLLAMA_PROVIDER or not loopback_only or not reachable or not model_present:
        _append_missing_action(actions, f"export {model_gateway.LOCAL_INSTRUCTION_REAL_RUNNER_ENV}=1")
        _append_missing_action(actions, f"export {model_gateway.LOCAL_INSTRUCTION_PROVIDER_ENV}=ollama")
        _append_missing_action(actions, f"export {model_gateway.OLLAMA_BASE_URL_ENV}={model_gateway.OLLAMA_DEFAULT_BASE_URL}")
        _append_missing_action(actions, f"export {model_gateway.OLLAMA_MODEL_ENV}={model_gateway.OLLAMA_DEFAULT_MODEL}")
    if not reachable:
        actions.append("Install Ollama from https://ollama.com/download, then start it with `ollama serve` if it is not already running.")
    if not model_present:
        actions.append(f"ollama pull {model_gateway.OLLAMA_DEFAULT_MODEL}")
    actions.append("Keep the gateway policy envelope at external_api_allowed=false; this preflight never enables external routing.")
    return actions


def _append_missing_action(actions: list[str], action: str) -> None:
    if action not in actions:
        actions.append(action)


def _run_gateway_smoke(*, ready: bool) -> dict[str, Any]:
    if not ready:
        return {"attempted": False, "reason": "preflight_not_ready", "external_api_used": False}

    result = model_gateway.run_local_open_weight_7b_dry_run(
        _smoke_envelope(),
        [
            {
                "source_span_id": "source-span.qwen-preflight-smoke",
                "source_document_id": "source-document.qwen-preflight-smoke",
                "excerpt_digest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "stable_locator": "preflight:local-qwen-smoke",
            }
        ],
    )
    trace = result.trace
    return {
        "attempted": True,
        "trace_status": trace["trace_status"],
        "runner_status": trace["runner_status"],
        "source_span_ids": trace["source_span_ids"],
        "raw_output_included": trace["raw_output_included"],
        "raw_output_withheld": "raw_model_output" not in trace,
        "external_api_used": result.ledger_entry["external_api_used"],
        "output_digest": trace["output_digest"],
    }


def _smoke_envelope() -> dict[str, Any]:
    return {
        "tenant_id": "local-preflight",
        "user_id": "developer-preflight",
        "task_type": "eval_run",
        "task_id": TASK_ID,
        "request_id": REQUEST_ID,
        "allowed_model_classes": [model_gateway.LOCAL_OPEN_WEIGHT_7B_MODEL_CLASS],
        "context_token_limit": 8192,
        "output_token_limit": 128,
        "max_gpu_seconds": 30,
        "max_budget": 0,
        "cache_lookup_enabled": False,
        "trace_logging_enabled": True,
        "cost_ledger_enabled": True,
        "approval_gate_required": False,
        "data_sensitivity": "internal",
        "source_permission_check": True,
        "external_api_allowed": False,
    }


def _ollama_tags_url(base_url: str) -> str:
    return base_url.rstrip("/") + "/api/tags"


if __name__ == "__main__":
    main()
