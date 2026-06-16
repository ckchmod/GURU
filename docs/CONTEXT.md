# Project Context

## Purpose

GURU is a local-first tool for maintaining and exploring cancer care guideline documents as structured, provenance-backed graphs. It supports guideline authors, methodologists, clinicians, and reviewers by surfacing corpus resources, graph neighborhoods, archive status, source spans, review workflow metadata, and public guideline knowledgebase records in a designed interactive canvas.

## Product principle

Graph-first, source-backed, bounded-agent-assisted guideline lifecycle platform. The center of the product is the guideline graph, not a chat interface, generated-answer RAG system, or generic PDF question-answering bot. GURU strengthens expert judgment and workflow; it does not replace expert reviewers, working groups, or approval chains.

The Graph-RAG foundation means graph-first traceability before generation. Workbench commands retrieve graph resources, source-span identifiers, path/context nodes, provenance fields, warnings, abstention status, and evidence IDs. They do not emit answer text, approved guidance, patient-specific advice, generated clinical summaries, or full RAG answers. Generated answers remain disabled.

## Scope boundaries

The current buildout covers:

- Project governance, resource registry, storage policy, and security/privacy gates.
- Next.js frontend (`apps/web`) with an Evidence Atlas IDE using Sigma.js and Graphology as the default atlas graph, plus graph-linked retrieval surfaces for graph focus, provenance, trace evidence, offline status, and draft review metadata.
- FastAPI backend (`services/api`) with health checks, knowledgebase routes, and pytest coverage.
- Seed graph and provenance schemas (`packages/schemas/`) with validation scripts.
- A preserved resource registry (`resources/registry/`) with 235 rows, including 198 public AHS/GURU corpus metadata rows.
- A real public corpus atlas milestone using the 198 public AHS/GURU metadata rows for graph, API, search, and archive-status metadata scope, accounted for through manifests rather than claimed as guaranteed parsed coverage.
- A bounded parse path with an exact-five `--registry` gate plus a separate manifest-driven parse mode for local source-document and source-span extraction when approved raw files exist.
- A bounded workbench trace contract for command, eval, retrieval, source-selection, gateway decision, model-class, citation-verifier, abstention, warning, and evidence-ID metadata. It is trace evidence only, not answer generation.
- A local, mockable, and skippable `local_open_weight_7b` dry-run path for ModelTrace coverage when validated source-span context exists. It records metadata and abstention status without answer text.
- A local-first model gateway policy (`docs/model-gateway.md`).
- A secret-free CI baseline (`.github/workflows/ci.yml`).

This buildout does not cover:

- Production guideline authoring workflows.
- Raw guideline downloads in normal Git history.
- External LLM API usage by default.
- Patient-facing advice or clinical decision support for individual patients.
- Generated answers, generated clinical summaries, or full RAG answers. Generated answers remain disabled.
- Live surveillance, crawling, clinical inference, or recommendation-impact diff.
- Approved recommendations from draft review metadata.
- Treating `docs/gpt5.5pro_6_15.md` as an authoritative implementation spec. That document is intent and strategy guidance only; engineering contracts live in `docs/`, `AGENTS.md`, schemas, tests, and bounded implementation tasks.
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

## Real public corpus atlas milestone

The active milestone moves from the preserved metadata catalogue to GURU's graph-linked Evidence Atlas and workbench trace foundation. Its graph, API, and metadata/source-span retrieval scope uses the 198 public AHS/GURU metadata rows from `resources/registry/ahs-guru-public-corpus.json`. Registry metadata may create resource, disease-site, document-type, and archive/status navigation records. It does not create clinical recommendations, generated summaries, embeddings, model answers, or full RAG behavior. Generated answers remain disabled.

Raw PDFs from public AHS/GURU URLs are local ignored source archive artifacts under `resources/raw/ahs-guru-public/`. They are not committed to Git and must not be copied into prompts, logs, evidence files, or external model calls. The committed audit path is the manifest and checksum record under `resources/manifests/ahs-guru-public/`: every planned row keeps status fields, checksum data when available, and failure reasons when acquisition fails. The all-public manifest `resources/manifests/ahs-guru-public/manifest-20260616T053200Z.json` accounts for 198 rows with 197 downloaded and 1 failed row, so acquisition is best-effort and manifest-accounted.

Parsing keeps the deterministic 5-document subset selected in `resources/registry/ahs-guru-parse-subset.json` behind the exact-five `--registry` gate. Manifest-driven parse mode is separate and status-accounted; recent derived outputs reported `download_missing=1`, `parse_failed=2`, `parsed=144`, and `partial_text=51`. Source-document and source-span records are shown only when deterministic local parser outputs produce them and safety filters allow exposure. The atlas must not fabricate excerpts, infer clinical claims from metadata, or imply all 198 PDFs have been parsed into usable claims.

The Evidence Atlas UI now uses Sigma.js with Graphology as the default graph model. Its deterministic ForceAtlas and noverlap layout is an implementation detail of the current graph surface. The interface includes a compact inspector, bottom metadata/source-span retrieval terminal, source provenance drawer, offline/local manifest status chips, and a non-mutating evidence-review queue shell. Query results can focus and highlight graph resources, source spans, path/context nodes, and provenance fields. When the graph does not contain source-span nodes, source-span retrieval hits fall back to the parent resource while keeping source-span IDs, stable locators, checksum/status fields, and reviewer metadata visible where available. The interface remains an atlas and provenance browser for guideline exploration, not a patient-facing answer engine.

The workbench trace API is a bounded trace endpoint, not a chatbot endpoint. Advice-like prompts and no-source or no-match traces abstain before gateway execution. Validated source-span traces may invoke only the local dry-run gateway path, and the response remains `abstained_no_answer_text` with command, eval, retrieval, source-selection, gateway, model-class, citation-verifier, warning, and evidence-ID metadata. The current dry-run path is mockable and skippable in CI; a real local runner requires explicit environment configuration and may return unavailable.

Surveillance in this milestone is offline and local only. It compares existing manifest JSON files, reports local archive status changes, and does not crawl live sites, check live reachability, infer practice impact, or run recommendation-impact diff. Evidence-review cards are draft workflow metadata unless backed by validated `source_span_ids`; invalid or unbacked cards are blocked and contain no claim text.

Remaining safeguards are not optional: no PHI, no patient-specific advice, source-span provenance for every clinical claim-like record, and no default external LLM routing. Raw public guideline downloads stay out of normal Git history by default; committed artifacts should be manifests, checksums, schemas, safe fixtures, and bounded derived records.

See [`docs/research/public-guideline-acquisition.md`](./research/public-guideline-acquisition.md), [`docs/research/accuracy-first-acquisition-ingestion-plan.md`](./research/accuracy-first-acquisition-ingestion-plan.md), [`docs/resource-registry.md`](./resource-registry.md), and [`docs/resource-storage-policy.md`](./resource-storage-policy.md).

## Roadmap families after the knowledgebase foundation

The next product families build on the public guideline knowledgebase foundation. They are roadmap items, not capabilities delivered by the current interpretability milestone:

- Surveillance for guideline updates and practice-changing evidence.
- PICO/evidence workflows for scoping, screening, extraction, and evidence tables.
- Recommendation-impact diff for mapping new evidence to affected recommendations.
- Consensus workflow for review packets, votes, conflicts, and decision status.
- Alberta-local overlays for funding, trials, referral pathways, testing access, and implementation context.
- Computable guideline compiler for structured guideline outputs once source spans, review state, and governance are mature.

## Model usage policy

Do not route prompts, documents, or embeddings to external large language model APIs by default. Local, open-weight, or explicitly approved private deployments are the default. Any external routing requires documented approval and a per-use gate. The base policy object sets `external_api_allowed` to `false`; changing it to `true` is a per-use approval, not a default. Current Graph-RAG foundation traces use `local_open_weight_7b` as a model class and dry-run path, not as a hard-coded production model.

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

This runs backend pytest, frontend Vitest, lint, typecheck, Playwright E2E, graph/provenance schema validation, `npm run test:safety`, resource registry validation, real-corpus safety gates, parser/search external-LLM scans, raw PDF ignore checks, and performance smoke coverage. See [`docs/testing-strategy.md`](./testing-strategy.md) for the complete command sequence, including expected-failure fixture diagnostics.

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
