# Project Context

## Purpose

The CCA GURU Guideline Graph Workbench is a local-first tool for maintaining and exploring cancer care guideline documents as structured, provenance-backed graphs. It supports guideline authors, methodologists, and reviewers by surfacing recommendations, evidence links, update triage, source spans, and public guideline knowledgebase records in a designed interactive canvas.

## Product principle

Graph-first, retrieval-backed, bounded-agent-assisted guideline lifecycle platform. The center of the product is the guideline graph, not a chat interface or a generic PDF question-answering bot. The workbench strengthens expert judgment and workflow; it does not replace expert reviewers, working groups, or approval chains.

## Scope boundaries

The current buildout covers:

- Project governance, resource registry, storage policy, and security/privacy gates.
- Next.js frontend (`apps/web`) with an Evidence Atlas IDE and React Flow graph canvas.
- FastAPI backend (`services/api`) with health checks, knowledgebase routes, and pytest coverage.
- Seed graph and provenance schemas (`packages/schemas/`) with validation scripts.
- A preserved resource registry (`resources/registry/`) with 235 rows, including 198 public AHS/GURU corpus metadata rows.
- A public guideline knowledgebase buildout that may use public AHS/GURU resources for prototype download manifests, parsing, source-document records, source spans, graph-ready records, backend API responses, and Evidence Atlas browsing.
- A local-first model gateway policy (`docs/model-gateway.md`).
- A secret-free CI baseline (`.github/workflows/ci.yml`).

This buildout does not cover:

- Production guideline authoring workflows.
- Raw guideline downloads in normal Git history.
- External LLM API usage by default.
- Patient-facing advice or clinical decision support for individual patients.
- Neo4j or enterprise graph platform dependencies unless later justified.

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

## Public guideline knowledgebase buildout

The active milestone moves from the preserved metadata catalogue to a public guideline knowledgebase prototype. Public AHS/GURU resources from the AHS cancer guideline page may be used for prototype acquisition, local raw downloads, manifests, checksums, parser outputs, source-document records, source spans, graph-ready records, backend routes, and Evidence Atlas views.

Remaining safeguards are not optional: no PHI, no patient-specific advice, source-span provenance for every clinical claim-like record, and no default external LLM routing. Raw public guideline downloads stay out of normal Git history by default; committed artifacts should be manifests, checksums, schemas, safe fixtures, and bounded derived records.

See [`docs/research/public-guideline-acquisition.md`](./research/public-guideline-acquisition.md), [`docs/research/accuracy-first-acquisition-ingestion-plan.md`](./research/accuracy-first-acquisition-ingestion-plan.md), [`docs/resource-registry.md`](./resource-registry.md), and [`docs/resource-storage-policy.md`](./resource-storage-policy.md).

## Roadmap families after the knowledgebase foundation

The next product families build on the public guideline knowledgebase foundation:

- Surveillance for guideline updates and practice-changing evidence.
- PICO/evidence workflows for scoping, screening, extraction, and evidence tables.
- Recommendation-impact diff for mapping new evidence to affected recommendations.
- Consensus workflow for review packets, votes, conflicts, and decision status.
- Alberta-local overlays for funding, trials, referral pathways, testing access, and implementation context.
- Computable guideline compiler for structured guideline outputs once source spans, review state, and governance are mature.

## Model usage policy

Do not route prompts, documents, or embeddings to external large language model APIs by default. Local, open-weight, or explicitly approved private deployments are the default. Any external routing requires documented approval and a per-use gate. The base policy object sets `external_api_allowed` to `false`; changing it to `true` is a per-use approval, not a default.

See [`docs/model-gateway.md`](./model-gateway.md).

## Governance and workflow

Agents operate inside deterministic workflows, not open-ended autonomy. The loop is:

1. Receive an explicit plan approved by the human or by a prior task definition.
2. Call only approved tools.
3. Write structured intermediate state at each step.
4. Validate schema, citations, and source-span provenance.
5. Run a verifier before marking work complete.
6. Ask a human when uncertain or when the impact is high.
7. Commit only approved outputs.
8. Log everything, including tool calls, decisions, and failures.

Agents cannot publish recommendations, commit without passing tests, or push without an explicit remote gate check.

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
