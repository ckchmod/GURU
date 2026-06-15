# CCA GURU Guideline Graph Workbench

A local-first, graph-centered workbench for maintaining, exploring, and updating cancer care guideline documents. The project starts from the CCA GURU initiative and emphasizes source-span provenance, resource governance, and bounded agent assistance over generic chat or unbounded LLM usage.

## What this is

The workbench treats guidelines as structured graphs: recommendations, evidence, citations, and update triage are nodes and edges with provenance, not loose text. The MVP focuses on a premium interactive graph canvas, a resource registry, and clear governance before any broad guideline-answering surface.

## What this is not

- Not a generic RAG chatbot.
- Not a source of patient-specific treatment advice.
- Not a repository for PHI, real patient records, or raw licensed content without explicit permission.
- Not a default consumer of external LLM APIs.

## Repository layout

```
AGENTS.md                    # Canonical agent rules and milestone protocol
README.md                    # This file
apps/                        # Next.js frontend
services/                    # FastAPI backend
packages/                    # Shared schemas, types, validation
resources/                   # Resource registry and governed raw archives
  registry/                  # Metadata and permission records
  raw/                       # Large or restricted files governed by storage policy
docs/                        # Engineering documentation
  adr/                       # Architecture Decision Records
  proposal/                  # CCA/GURU-facing discovery and proposal artifacts
scripts/                     # Validation, migration, and utility scripts
.github/workflows/           # CI workflows (when added)
```

## Quick navigation

- **Project rules for agents**: [`AGENTS.md`](./AGENTS.md)
- **Why we made these choices**: [`docs/adr/ADR-0001-project-principles.md`](./docs/adr/ADR-0001-project-principles.md)
- **Project context and constraints**: [`docs/CONTEXT.md`](./docs/CONTEXT.md)
- **Coding standards**: [`docs/coding-standards.md`](./docs/coding-standards.md)
- **Testing strategy**: [`docs/testing-strategy.md`](./docs/testing-strategy.md)

## Milestone protocol

After every significant milestone, follow this exact sequence:

**update docs/memory → run tests → commit → push only if remote configured**

See [`AGENTS.md`](./AGENTS.md) for the full protocol.

## Safety boundaries

- No PHI in code, fixtures, logs, prompts, evaluations, or resources.
- No patient-specific treatment advice or diagnostic conclusions.
- No clinical claim without a cited source span.
- No default external LLM routing. Local, open-weight, or explicitly approved private deployments are the default.

## License

License to be determined. All rights reserved until a license is explicitly chosen and committed.
