# Project Context

## Purpose

The CCA GURU Guideline Graph Workbench is a local-first tool for maintaining and exploring cancer care guideline documents as structured, provenance-backed graphs. It supports guideline authors, methodologists, and reviewers by surfacing recommendations, evidence links, update triage, and source spans in a designed interactive canvas.

## Product principle

Graph-first, retrieval-backed, bounded-agent-assisted guideline lifecycle platform. The center of the product is the guideline graph, not a chat interface or a generic PDF question-answering bot.

## Scope boundaries

This MVP covers:

- Project governance, resource registry, and storage policy.
- Next.js frontend and FastAPI backend scaffolds.
- A premium interactive graph canvas prototype using synthetic data.
- Seed graph and provenance schemas with validation scripts.
- A local-first model gateway policy.

This MVP does not cover:

- Production guideline authoring workflows.
- Bulk ingestion or embedding of restricted resources without permission.
- Patient-facing advice or clinical decision support for individual patients.
- Neo4j or enterprise graph platform dependencies unless later justified.

## Clinical safety boundaries

### No PHI

No protected health information, patient identifiers, or patient-specific data may enter code, fixtures, logs, prompts, evaluations, resource archives, or commit messages. This includes synthetic data that resembles real patient records. Use only explicitly approved synthetic vignettes for tests and evaluation.

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

Evaluation harnesses include retrospective benchmarks, gold-labeled screening sets, expert-adjudicated extraction sets, a guideline QA test bank, clinical vignettes, and red-team hallucination tests.

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

## Milestone protocol

At the end of every significant milestone, follow this sequence exactly:

**update docs/memory → run tests → commit → push only if remote configured**

A milestone is significant when it changes architecture, adds a feature, modifies public interfaces, alters compliance boundaries, or completes a planned task.

## Model usage policy

Do not route prompts, documents, or embeddings to external large language model APIs by default. Local, open-weight, or explicitly approved private deployments are the default. Any external routing requires documented approval and a per-use gate.

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
