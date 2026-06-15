# CCA GURU Guideline Graph Workbench

A local-first, graph-centered workbench for maintaining, exploring, and updating cancer care guideline documents. The project starts from the CCA GURU initiative and emphasizes source-span provenance, resource governance, and bounded agent assistance over generic chat or unbounded LLM usage.

## What this is

The workbench treats guidelines as structured graphs: recommendations, evidence, citations, and update triage are nodes and edges with provenance, not loose text. The MVP focuses on a premium interactive graph canvas, a resource registry, and clear governance before any broad guideline-answering surface.

## What this is not

- Not a generic RAG chatbot.
- Not a source of patient-specific treatment advice.
- Not a repository for PHI, real patient records, or raw licensed content without explicit permission.
- Not a default consumer of external LLM APIs.
- Not a replacement for expert methodologists, working groups, or approval chains.

## Current scaffold

- **`apps/web`** — Next.js frontend with an Evidence Atlas IDE around a React Flow graph canvas, synthetic fixtures, and smoke-tested E2E coverage.
- **`services/api`** — FastAPI backend with a `/health` endpoint and pytest tests.
- **`packages/schemas`** — Seed graph/provenance JSON Schema and TypeScript types enforcing the "no source span, no claim" rule.
- **`resources/registry/`** — Governed resource registry with 40 metadata/link-only placeholder rows across seven categories.
- **`docs/model-gateway.md`** — Local-first model gateway and subsidy firewall policy; external LLM APIs are off by default.
- **`docs/resource-registry.md`**, **`docs/security-privacy-license.md`**, **`docs/resource-storage-policy.md`** — Resource permission, licensing, and storage gates.
- **`docs/milestone-protocol.md`** — Auditable milestone sequence: update docs/memory → run tests → inspect git status/diff → commit → push only if remote configured.
- **`.github/workflows/ci.yml`** — Secret-free CI running the full baseline on every PR/push.

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
.github/workflows/           # CI workflows
```

## Quick navigation

- **Project rules for agents**: [`AGENTS.md`](./AGENTS.md)
- **Why we made these choices**: [`docs/adr/ADR-0001-project-principles.md`](./docs/adr/ADR-0001-project-principles.md)
- **Project context and constraints**: [`docs/CONTEXT.md`](./docs/CONTEXT.md)
- **Coding standards**: [`docs/coding-standards.md`](./docs/coding-standards.md)
- **Testing strategy and baseline commands**: [`docs/testing-strategy.md`](./docs/testing-strategy.md)
- **Milestone protocol**: [`docs/milestone-protocol.md`](./docs/milestone-protocol.md)
- **Resource registry**: [`docs/resource-registry.md`](./docs/resource-registry.md)
- **Security, privacy, and licensing gates**: [`docs/security-privacy-license.md`](./docs/security-privacy-license.md)
- **Resource storage policy**: [`docs/resource-storage-policy.md`](./docs/resource-storage-policy.md)
- **Local-first model gateway**: [`docs/model-gateway.md`](./docs/model-gateway.md)
- **Graph and provenance schemas**: [`packages/schemas/README.md`](./packages/schemas/README.md)
- **Graph canvas UX direction**: [`docs/graph-canvas-ux.md`](./docs/graph-canvas-ux.md)
- **CCA/GURU discovery brief**: [`docs/proposal/cca-guru-discovery-brief.md`](./docs/proposal/cca-guru-discovery-brief.md)
- **Resource request package**: [`docs/proposal/resource-request-package.md`](./docs/proposal/resource-request-package.md)

## Quick baseline

```bash
npm run test:baseline
```

See [`docs/testing-strategy.md`](./docs/testing-strategy.md) for the full command sequence, including expected-failure fixture diagnostics.

## Milestone protocol

After every significant milestone, follow this exact sequence:

**update docs/memory → run tests → inspect git status/diff → commit → push only if remote configured**

See [`AGENTS.md`](./AGENTS.md) and [`docs/milestone-protocol.md`](./docs/milestone-protocol.md) for the full protocol.

## Safety boundaries

- No PHI in code, fixtures, logs, prompts, evaluations, or resources.
- No patient-specific treatment advice or diagnostic conclusions.
- No clinical claim without a cited source span.
- No default external LLM routing. Local, open-weight, or explicitly approved private deployments are the default.

## License

License to be determined. All rights reserved until a license is explicitly chosen and committed.
