# ADR-0001: Project Principles

## Status

Accepted

## Context

The CCA GURU Guideline Graph Workbench is a greenfield project that needs a stable foundation before any feature code is written. The project must serve two audiences at once: engineering execution and CCA/GURU-facing discovery/proposal work. It must also satisfy clinical safety, resource licensing, and cost constraints from the first commit.

## Decision

We adopt the following principles as the basis for all subsequent decisions.

### 1. Graph-first product

The primary user experience is a structured guideline graph: recommendations, evidence, citations, and update triage as nodes and edges with provenance. Generic chat or PDF Q&A is not the MVP center.

### 2. Source-span provenance

Every answer, draft, extraction, or derived graph node must carry a source span. No source means no claim. Draft status is not approved status.

### 3. Resource governance before ingestion

A resource registry and permission matrix must exist before any CCA/GURU content is embedded, summarized, transformed, or archived. Unknown or restrictive license status means metadata-only or link-only storage until permission is granted.

### 4. Local-first model policy

Local, open-weight, or explicitly approved private deployments are the default for model usage. External LLM APIs are not the default route.

### 5. Clinical safety boundaries

- No PHI in code, fixtures, logs, prompts, evaluations, or resources.
- No patient-specific treatment advice or diagnostic conclusions.
- No clinical claim without a cited source span.

### 6. Bounded agent workflow

Agents run inside deterministic workflows: explicit plan, approved tools, structured intermediate state, schema/citation/source-permission validation, verifier, human escalation for uncertainty or high impact, approved commit, and logging.

### 7. Milestone protocol

After every significant milestone, follow this exact sequence:

**update docs/memory → run tests → commit → push only if remote configured**

### 8. Separation of concerns

Engineering governance lives in `docs/`, `docs/adr/`, and `AGENTS.md`. CCA/GURU-facing discovery and proposal artifacts live in `docs/proposal/`. The two must not overlap.

## Consequences

- Every task must start by reading `AGENTS.md` and relevant ADRs.
- Every milestone must update docs and memory, run tests, and only push after a remote gate check.
- Every guideline-related output must be provenance-backed before it can be considered approved.
- Resource registry, security policy, and model gateway policy are blockers for ingestion and model integration tasks.
- The frontend must prioritize the graph canvas over chat or generic search surfaces.

## References

- Source conversation, audit and compliance section: every answer/draft/extraction needs source, prompt/model version, reviewer, timestamp, status; draft is not approved.
- Source conversation, agentic loop engineering section: bounded agents inside deterministic workflows with explicit plan, approved tools, structured state, validation, verifier, human escalation, approved commit, and logging.
- `docs/CONTEXT.md`
- `AGENTS.md`
