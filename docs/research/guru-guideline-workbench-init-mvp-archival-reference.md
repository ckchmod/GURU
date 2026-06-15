# GURU Guideline Workbench Init MVP Archival Reference

Status: archival/reference only. This is not an active execution plan.

This note recreates the historical role of the deleted OMO MVP plan for `guru-guideline-workbench-init-mvp`. It gives future work a stable reference point without reopening finished setup work. The metadata work is preserved and should not be redone.

## Original Start

The project started from `docs/gpt5.5pro_6_15.md`, which framed the opportunity as a CCA/GURU guideline lifecycle platform rather than a generic RAG chatbot over cancer PDFs. The proposed product direction was a graph-first workbench for guideline development: resource registry, guideline-aware retrieval, evidence surveillance, PICO support, screening and extraction workflows, recommendation drafting support, consensus tracking, local Alberta context, and eventual computable guideline outputs.

The first useful move was not model training or a chatbot. It was source discipline: gather the resource universe, track ownership and access, keep provenance attached to every derived claim, and build a workbench that supports expert review instead of replacing it.

## Preserved Metadata Work

Metadata work is preserved in the current repository and active buildout plan.

Preserved facts:

- `resources/registry/` contains 235 registry rows total.
- `resources/registry/ahs-guru-public-corpus.json` contains 198 AHS/GURU public corpus metadata rows.
- `docs/research/ahs-guideline-corpus-catalogue.md` records the public AHS/GURU catalogue evidence as metadata only, with no raw PDFs, page bodies, guideline excerpts, clinical recommendations, summaries, embeddings, or graph derivatives retained.
- The public corpus catalogue was accessed on 2026-06-15 and records 196 public AHS/GURU index resources discovered from page links, with 198 registry rows present after normalization.

Do not recreate the deleted `.omo/plans/guru-guideline-workbench-init-mvp.md` as an active boulder. Do not reset registry row status, recrawl completed link metadata, or redo the public corpus catalogue as part of this archival note.

## Completed Scaffold

The completed scaffold now gives the next milestone a working base:

- Evidence Atlas scaffold in `apps/web`, built as a Next.js frontend around a React Flow graph canvas and synthetic fixtures.
- FastAPI health API in `services/api`, including the `/health` endpoint and pytest coverage.
- Graph/provenance schema in `packages/schemas`, with JSON Schema and TypeScript types enforcing source-span requirements on claim-like records.
- Validators for schema and registry checks.
- CI baseline in `.github/workflows/ci.yml`, intended to run the local project baseline without secrets.
- Model gateway policy in `docs/model-gateway.md`, keeping external LLM APIs off by default.

That scaffold is the current foundation. The active plan should extend it into a public guideline knowledgebase prototype instead of repeating setup already completed by the MVP wave.

## Governance Snapshot

The current governance stance is updated from the deleted MVP plan. Older access-control workflow language from AGENTS.md was removed by user direction and should not be brought back into active docs.

The hard safety boundaries remain:

- No PHI in code, fixtures, logs, prompts, resources, evidence, or commits.
- No patient-specific advice, dosing recommendations, or diagnostic conclusions.
- Source-span provenance is required for clinical claim-like records, including recommendations, citations, evidence items, funding rules, review decisions, and model traces.
- No default external LLM routing for prompts, documents, or embeddings.

The documentation has since been synchronized so the active milestone is the public guideline knowledgebase buildout. Public AHS/GURU resources may be used for prototype acquisition, parsing, source spans, graph-ready records, backend API work, and Evidence Atlas browsing while the hard safety boundaries remain in force.

## Relationship To Active Plan

The active plan is `.omo/plans/guru-guideline-knowledgebase-buildout.md`. Its first task is:

`- [ ] 1. Recreate archival MVP reference without redoing completed metadata`

This document satisfies that task by preserving historical context only. It is not an active execution plan, not a replacement for the current buildout plan, and not an instruction to rebuild the completed MVP metadata layer.

The roadmap families that follow the knowledgebase foundation are surveillance, PICO/evidence workflows, recommendation-impact diff, consensus workflow, Alberta-local overlays, and computable guideline compiler work.
