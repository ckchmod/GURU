# Project Context

## Purpose

The CCA GURU Guideline Graph Workbench is a local-first tool for maintaining and exploring cancer care guideline documents as structured, provenance-backed graphs. It supports guideline authors, methodologists, and reviewers by surfacing recommendations, evidence links, update triage, and source spans in a designed interactive canvas.

## Product principle

Graph-first, retrieval-backed, bounded-agent-assisted guideline lifecycle platform. The center of the product is the guideline graph, not a chat interface or a generic PDF question-answering bot. The workbench strengthens expert judgment and workflow; it does not replace expert reviewers, working groups, or approval chains.

## Scope boundaries

This MVP covers:

- Project governance, resource registry, storage policy, and security/privacy gates.
- Next.js frontend (`apps/web`) with a compact Evidence Atlas IDE and React Flow graph canvas.
- FastAPI backend (`services/api`) with health checks and pytest coverage.
- Seed graph and provenance schemas (`packages/schemas/`) with validation scripts.
- A governed resource registry (`resources/registry/`) with 40 metadata/link-only placeholder rows across seven categories.
- A local-first model gateway policy (`docs/model-gateway.md`).
- A secret-free CI baseline (`.github/workflows/ci.yml`).

This MVP does not cover:

- Production guideline authoring workflows.
- Bulk ingestion or embedding of restricted resources without permission.
- Patient-facing advice or clinical decision support for individual patients.
- Neo4j or enterprise graph platform dependencies unless later justified.
- External LLM API usage by default.

## Clinical safety boundaries

### No PHI

No protected health information, patient identifiers, or patient-specific data may enter code, fixtures, logs, prompts, evaluations, resource archives, evidence files, or commit messages. This includes synthetic data that resembles real patient records. Use only explicitly approved synthetic vignettes for tests and evaluation.

### No patient-specific advice

The project builds tools that support guideline maintenance and exploration. Agents and components must not generate patient-specific treatment advice, dosing recommendations, or diagnostic conclusions.

### No clinical claims without source spans

Every clinical statement, guideline summary, recommendation draft, or extraction must include a source span: document identifier, section, and quoted text or stable locator. No source means no claim. Draft status is not approved status.

## Source-span provenance

Every answer, draft, extraction, or derived graph node must carry provenance metadata:

- Source document identifier and access date.
- Stable section or paragraph locator.
- Exact quoted span or checksum-backed excerpt.
- Prompt or model version used for generation.
- Reviewer and review status.
- Timestamp and output status: draft, under-review, or approved.

The graph schema enforces `source_span_ids` on claim-like node types: `Recommendation`, `Citation`, `EvidenceItem`, `FundingRule`, `ReviewDecision`, and `ModelTrace`.

Evaluation harnesses include retrospective benchmarks, gold-labeled screening sets, expert-adjudicated extraction sets, a guideline QA test bank, clinical vignettes, and red-team hallucination tests.

## Resource governance and restricted-resource gates

Every resource that is stored, referenced, or processed must have a registry row. Unknown or restrictive license status defaults to `metadata-only` or `link-only` storage until explicit permission is recorded. A public URL does not grant embedding, summarization, redistribution, or commercial use rights. Derivative artifacts — embeddings, summaries, source spans, graph nodes, extracted fields — require the same allowed-use review as the underlying resource.

Agents cannot approve restricted-source use. When a resource's status is unclear, stop and escalate to a human reviewer, then record the decision, reviewer, date, and basis in the resource registry.

See [`docs/resource-registry.md`](./resource-registry.md), [`docs/security-privacy-license.md`](./security-privacy-license.md), and [`docs/resource-storage-policy.md`](./resource-storage-policy.md).

## Model usage policy

Do not route prompts, documents, or embeddings to external large language model APIs by default. Local, open-weight, or explicitly approved private deployments are the default. Any external routing requires documented approval and a per-use gate. The base policy object sets `external_api_allowed` to `false`; changing it to `true` is a per-use approval, not a default.

See [`docs/model-gateway.md`](./model-gateway.md).

## Governance and workflow

Agents operate inside deterministic workflows, not open-ended autonomy. The loop is:

1. Receive an explicit plan approved by the human or by a prior task definition.
2. Call only approved tools.
3. Write structured intermediate state at each step.
4. Validate schema, citations, and source permissions.
5. Run a verifier before marking work complete.
6. Ask a human when uncertain or when the impact is high.
7. Commit only approved outputs.
8. Log everything, including tool calls, decisions, and failures.

Agents cannot publish recommendations, approve restricted-source use, commit without passing tests, or push without an explicit remote gate check.

## Milestone protocol

At the end of every significant milestone, follow this sequence exactly:

**update docs/memory → run tests → inspect git status/diff → commit → push only if remote configured**

A milestone is significant when it changes architecture, adds a feature, modifies public interfaces, alters compliance boundaries, or completes a planned task.

The remote gate uses `git remote get-url origin`. If `origin` is missing, stop and report `REMOTE_URL_REQUIRED`. Never fabricate a remote or push without a real origin URL.

See [`docs/milestone-protocol.md`](./milestone-protocol.md).

## Test and CI commands

The full local baseline is:

```bash
npm run test:baseline
```

This runs backend pytest, frontend Vitest, lint, typecheck, Playwright E2E, graph/provenance schema validation, and resource registry validation. See [`docs/testing-strategy.md`](./testing-strategy.md) for the complete command sequence, including expected-failure fixture diagnostics.

## Document separation

- Engineering governance lives in `docs/`, `docs/adr/`, and `AGENTS.md`.
- CCA/GURU-facing discovery and proposal artifacts live in `docs/proposal/`.
- Do not mix proposal content with engineering rules.

## Glossary

- **CCA**: Cancer Care Alberta.
- **GURU**: Guideline Update and Review Unit.
- **Source span**: A provenance reference that identifies a specific document, section, and quoted excerpt.
- **Bounded agent**: A tool-calling agent that follows an explicit plan, writes structured state, validates outputs, and stops for human review on uncertainty or high impact.
- **Synthetic vignette**: An artificial clinical scenario constructed for testing, with no real patient identifiers.
