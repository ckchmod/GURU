# Local-First Model Gateway and Subsidy Firewall Policy

This document defines the model gateway policy for the CCA GURU Guideline Graph Workbench. It is an engineering policy, not a model-selection decision or a vendor recommendation. The gateway exists to make every model call explicit, bounded, traceable, and accountable before any token is consumed.

The current Graph-RAG foundation uses the gateway for trace semantics only. Workbench traces may record a command, eval result, retrieval context, source-span IDs, gateway decision, model-class status, citation-verifier status, warnings, abstention status, and evidence IDs. They do not return generated answer text, approved guidance, patient-specific advice, generated clinical summaries, or full RAG answers.

## Default direction: local, open-weight, customer-owned, or private deployment

The workbench does not route prompts, documents, or embeddings to external large language model APIs by default. The default direction is:

- local inference on infrastructure the customer controls;
- open-weight models the customer can host and audit;
- customer-owned or private deployments inside the customer's network or cloud tenancy; or
- explicitly approved private endpoints with documented data handling and approval.

Any deviation from this direction requires a documented business or technical justification, confirmation that the target service's terms and data handling meet project requirements, approval by a human with authority to accept the risk, and logging of the request, content class, and outcome. This rule is already stated in `AGENTS.md`, `docs/CONTEXT.md`, and `docs/security-privacy-license.md`.

## No external LLM API by default

No external LLM API is allowed by default. The base policy object sets `external_api_allowed` to `false`. Changing it to `true` is a per-use gate, not a configuration default.

The current runtime rejects external providers when `external_api_allowed` is `false`. That rejection is expected behavior, not a recoverable production fallback.

## Subsidy firewall

Novara must not silently subsidize unbounded third-party LLM usage. Every model call passes through a gateway that checks budget, quota, cache, task sensitivity, and approval before execution. The gateway rejects calls that exceed limits, lack approval, target a disallowed model class, or attempt to send restricted content outside approved boundaries. Cost and usage are recorded in a per-tenant, per-task cost ledger.

## What the gateway controls

Every model call must carry a policy envelope. The gateway evaluates it before routing to any model provider.

### Policy envelope fields

| Field | Purpose |
| --- | --- |
| `tenant_id` | Organization or customer tenancy that owns the request and the budget. |
| `user_id` | Identity of the user or agent initiating the request. |
| `task_type` | Workbench task class, for example `guideline_search`, `evidence_extraction`, `update_triage`, `recommendation_draft`, `eval_run`. |
| `task_id` | Unique identifier for the bounded task instance. |
| `request_id` | Unique identifier for this individual model request, used for trace and ledger correlation. |
| `allowed_model_classes` | List of approved model classes for the task, not hard-coded model names. |
| `context_token_limit` | Maximum context tokens the call may consume. |
| `output_token_limit` | Maximum output tokens the call may produce. |
| `max_gpu_seconds` | GPU time ceiling for the call or task, used when running local or hosted inference. |
| `max_budget` | Currency budget ceiling for the request or task. |
| `cache_lookup_enabled` | Whether the gateway may return a cached result for identical inputs instead of invoking a model. |
| `trace_logging_enabled` | Whether the call, inputs, outputs, and decision chain are written to the audit trace. |
| `cost_ledger_enabled` | Whether the call records cost, tokens, GPU seconds, and cache outcome to the ledger. |
| `approval_gate_required` | Whether human approval is required before execution. |
| `data_sensitivity` | Sensitivity classification of the input data, for example `public`, `internal`, `restricted`, `phi_prohibited`. |
| `source_permission_check` | Whether the inputs are cleared by the resource registry and allowed-use metadata. |
| `external_api_allowed` | Whether an external provider may be used for this request. Defaults to `false`. |

### Example default policy object

```json
{
  "tenant_id": "<customer-tenant>",
  "user_id": "<user-or-agent-id>",
  "task_type": "evidence_extraction",
  "task_id": "<bounded-task-uuid>",
  "request_id": "<request-uuid>",
  "allowed_model_classes": ["local_open_weight_7b", "local_open_weight_13b"],
  "context_token_limit": 8192,
  "output_token_limit": 2048,
  "max_gpu_seconds": 30,
  "max_budget": 0.00,
  "cache_lookup_enabled": true,
  "trace_logging_enabled": true,
  "cost_ledger_enabled": true,
  "approval_gate_required": true,
  "data_sensitivity": "internal",
  "source_permission_check": true,
  "external_api_allowed": false
}
```

This object is a starting template. Each field is tightened or loosened by task type, tenant budget, data sensitivity, and source-permission status. The default value of `external_api_allowed` never changes.

For the current dry-run trace path, `local_open_weight_7b` is a model class and testable policy label. It is not a hard-coded production model, a downloaded weight, or a vendor choice.

## Gateway decision flow

When a component requests a model call, the gateway performs these checks in order:

1. **Tenant and task metadata validation.** Reject if `tenant_id`, `user_id`, `task_type`, `task_id`, or `request_id` are missing or unknown.
2. **Source-permission check.** Reject if `source_permission_check` is true and the inputs are not cleared by the resource registry or allowed-use metadata.
3. **Data-sensitivity check.** Reject if the sensitivity class forbids the chosen execution path. PHI and PHI-like data never leave local or customer-controlled environments.
4. **Model-class check.** Reject if the requested model is not in `allowed_model_classes`.
5. **External API check.** Reject if the selected provider is external and `external_api_allowed` is `false`.
6. **Cache lookup.** Return a cached result if one exists and `cache_lookup_enabled` is true.
7. **Approval gate.** Hold the request for human approval if `approval_gate_required` is true and the request has not been pre-approved.
8. **Quota and budget check.** Reject if the call would exceed `context_token_limit`, `output_token_limit`, `max_gpu_seconds`, or `max_budget`.
9. **Execute and trace.** Run the call, log the trace, and record the result.
10. **Cost ledger entry.** Write usage to the ledger.

## Cost ledger fields

Every executed or rejected model call writes a ledger entry. The ledger is append-only and tenant-scoped.

| Field | Description |
| --- | --- |
| `request_id` | Correlates with the policy envelope and trace log. |
| `tenant_id` | Budget owner. |
| `user_id` | Requesting user or agent. |
| `task_type` | Task class that triggered the call. |
| `task_id` | Bounded task instance. |
| `model_class` | Model class used or attempted. |
| `provider_kind` | `local`, `private_hosted`, or `external`. |
| `outcome` | `executed`, `cache_hit`, `rejected`, `approval_pending`, `quota_exceeded`. |
| `rejection_reason` | Present when `outcome` is `rejected`. |
| `input_tokens` | Tokens sent to the model, or zero if rejected before tokenization. |
| `output_tokens` | Tokens produced by the model, or zero if rejected. |
| `gpu_seconds` | GPU seconds consumed, or zero for external or cache outcomes. |
| `estimated_cost` | Cost in the tenant's currency, or zero for cache hits and rejected calls. |
| `cache_hit` | True if the result came from cache. |
| `external_api_used` | True if an external provider was used. Always false when the default policy applies. |
| `approval_id` | Identifier of the human approval, if required and granted. |
| `source_permission_status` | Resource registry permission status of the inputs. |
| `timestamp_utc` | Time the ledger entry was written. |

The ledger makes unbounded usage visible and prevents silent subsidy. Alerts fire when a tenant or task approaches its budget or GPU-second ceiling.

## Candidate model classes, not fixed commitments

The workbench treats model selection as a benchmark decision, not a permanent architecture choice. Candidate model classes are placeholders for future evaluation. They are grouped by capability and rough size, not by vendor or exact release name.

| Model class | Typical use | Notes |
| --- | --- | --- |
| `local_open_weight_7b` | Fast classification, light extraction, routing. | Candidate for benchmarking only. |
| `local_open_weight_13b` | Extraction, summarization, short-form drafting. | Candidate for benchmarking only. |
| `local_open_weight_70b` | Complex reasoning, recommendation drafting support. | Candidate for benchmarking only. |
| `customer_private_hosted` | Any task where the customer provides a private endpoint. | Requires explicit allowed-use and data-handling review. |
| `external_api_business_justified` | External provider only when justified and approved. | Never the default; requires per-use gate. |

A real implementation will run a bake-off against gold-labeled extraction sets, update-triage cases, and red-team hallucination tests before promoting any candidate class to a supported default. The gateway policy remains the same regardless of which model class wins the benchmark.

## Current dry-run trace path

The current `local_open_weight_7b` path is local, mockable, and skippable. It exists to test the gateway and ModelTrace contract without calling an external provider or emitting answer text.

The dry-run path:

- Accepts only validated source-span identifiers and digest metadata as context.
- Records gateway policy decisions, model-class status, citation-verifier status, token/GPU placeholders, warning labels, abstention status, and evidence IDs.
- Returns abstention-style trace metadata such as `abstained_no_answer_text`, not generated answer text.
- Blocks advice-like, no-source, and no-match workbench commands before model execution.
- Uses mock local behavior by default for tests and CI.
- Requires explicit environment configuration for any real local runner and may return unavailable when no runner is configured.

This path supports trace evaluation for the Graph-RAG foundation. It is not a delivered chatbot, a full RAG answer product, clinical decision support, or an approved recommendation system.

## Trace logging

Trace logging records:

- the policy envelope used;
- the gateway decision path and any rejections;
- the prompt or input summary, with restricted content redacted;
- the model output or rejection reason;
- source spans and model version identifiers attached to generated claims;
- reviewer and approval identifiers;
- timestamps and outcome status.

Traces support audit, debugging, and evaluation. They are governed by the same PHI and sensitivity rules as all other project artifacts.

`docs/gpt5.5pro_6_15.md` may guide product intent and strategy, but it is not an authoritative implementation spec for trace logging, model routing, or answer behavior. The enforceable contracts are this gateway policy, `docs/CONTEXT.md`, schemas, tests, and the bounded implementation code.

## Approval gates

The gateway uses approval gates for:

- any request where `approval_gate_required` is true;
- any request that would use an external provider;
- any request that processes restricted or internal content;
- any request that exceeds routine task-type budgets.

Approval records include the service or model class, the content class, the purpose, the reviewer identity, and the date. Agents cannot approve restricted-source use or external routing.

## Boundaries

This policy does not:

- integrate real model serving;
- download model weights;
- call external APIs;
- hard-code a named model as the permanent default;
- treat `local_open_weight_7b` as a production model commitment;
- promote GPT 5.5 Pro strategy notes to implementation authority;
- return generated answer text from the current dry-run trace path;
- generate patient-specific advice or clinical recommendations;
- route prompts, documents, or embeddings to external LLM APIs by default.

## References

- `AGENTS.md`: agent rules, no default external LLM routing, milestone protocol.
- `docs/CONTEXT.md`: project scope, model usage policy, source-span provenance.
- `docs/security-privacy-license.md`: licensing gates, per-use external routing approval, restricted-content handling.
- `docs/resource-storage-policy.md`: storage decisions and derivative processing rules.
- `docs/resource-registry.md`: resource registry fields and allowed-use metadata.
