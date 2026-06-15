# Agent Rules of Engagement

This file is the canonical source for how agents work in this repository. Rules here override any generic instruction. Engineering execution rules live here; discovery and proposal content lives under `docs/proposal/`.

## Safety Boundaries

### No PHI

No protected health information, patient identifiers, or patient-specific data may enter code, fixtures, logs, prompts, evaluations, resource archives, evidence files, or commit messages. This includes synthetic data that resembles real patient records. Use only explicitly approved synthetic vignettes for tests and evaluation.

### No Patient-Specific Advice

The project builds tools that support guideline maintenance and exploration. Agents must not generate patient-specific treatment advice, dosing recommendations, or diagnostic conclusions.

### No Clinical Claims Without Source Spans

Every clinical statement, guideline summary, recommendation draft, or extraction must include a source span: document identifier, section, and quoted text or stable locator. No source means no claim. Draft status is not approved status.

### No Default External LLM Routing

Do not route prompts, documents, or embeddings to external large language model APIs by default. Local, open-weight, or explicitly approved private deployments are the default. Any external routing requires documented approval and a per-use gate.

## Source-Span Provenance

Every answer, draft, extraction, or derived graph node must carry provenance metadata:

- Source document identifier and access date.
- Stable section or paragraph locator.
- Exact quoted span or checksum-backed excerpt.
- Prompt or model version used for generation.
- Reviewer and review status.
- Timestamp and output status: draft, under-review, or approved.

The graph schema enforces `source_span_ids` on claim-like node types: `Recommendation`, `Citation`, `EvidenceItem`, `FundingRule`, `ReviewDecision`, and `ModelTrace`.

See [`packages/schemas/README.md`](./packages/schemas/README.md) and [`docs/CONTEXT.md`](./docs/CONTEXT.md).

## Model Gateway

No external LLM API is allowed by default. The base policy object sets `external_api_allowed` to `false`; changing it to `true` is a per-use approval, not a configuration default. Every model call passes through a gateway that checks budget, quota, cache, task sensitivity, and approval before execution.

See [`docs/model-gateway.md`](./docs/model-gateway.md).

## Milestone Protocol

At the end of every significant milestone, follow this sequence exactly:

1. Update docs and project memory.
2. Run the affected tests.
3. Inspect `git status` and `git diff`.
4. Commit the milestone with a clear, scoped, conventional message.
5. Push only if `git remote get-url origin` succeeds.

Short form: **update docs/memory → run tests → inspect git status/diff → commit → push only if remote configured**.

A milestone is significant when it changes architecture, adds a feature, modifies public interfaces, alters compliance boundaries, or completes a planned task.

If `origin` is missing, stop after commit and report `REMOTE_URL_REQUIRED`. Never fabricate a remote or push without a real origin URL.

See [`docs/milestone-protocol.md`](./docs/milestone-protocol.md).

## Bounded Agent Workflow

Agents operate inside deterministic workflows, not open-ended autonomy. The loop is:

1. Receive an explicit plan approved by the human or by a prior task definition.
2. Call only approved tools.
3. Write structured intermediate state at each step.
4. Validate schema and citations.
5. Run a verifier before marking work complete.
6. Ask a human when uncertain or when the impact is high.
7. Commit only approved outputs.
8. Log everything, including tool calls, decisions, and failures.

Agents cannot publish recommendations, commit without passing tests, or push without an explicit remote gate check.

## Codebase Hygiene

- Keep directories purposeful. Do not leave temporary files, scratch notebooks, or duplicate context files in the repo.
- Place engineering docs under `docs/` and `docs/adr/`. Place discovery and proposal artifacts under `docs/proposal/`.
- Name files by their job. Do not create files with overlapping responsibilities.
- Update `docs/` and project memory after each significant milestone with concrete findings, not generic summaries.
- Add executable checks for rules whenever possible: file existence tests, grep assertions, schema validation scripts, or smoke tests.

## Commit and Push Safety

- Run tests before committing.
- Write a concise commit message in the repository style.
- Stage only intended files; never stage secrets, PHI, raw large files, model artifacts, `.agent-artifacts/evidence/**`, `.agent-artifacts/plans/**`, `.agent-artifacts/boulder.json`, caches, `node_modules/`, `.next/`, Playwright output, Python caches, or local runtime state.
- Check `git status` and `git diff` before committing.
- Check that a remote is configured before pushing. If no remote is configured, stop after commit and report `REMOTE_URL_REQUIRED`.
- Do not force-push or amend commits unless explicitly requested.

## Test Baseline

Run the affected tests before every commit. The full local baseline is:

```bash
npm run test:baseline
```

See [`docs/testing-strategy.md`](./docs/testing-strategy.md) for the complete command sequence.
