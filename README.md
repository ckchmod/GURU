# CCA GURU Guideline Graph Workbench

A local-first, graph-centered workbench for maintaining, exploring, and updating cancer care guideline documents. The project starts from the CCA GURU initiative and emphasizes source-span provenance, a public guideline knowledgebase buildout, and bounded agent assistance over generic chat or unbounded LLM usage.

## What this is

The workbench treats guidelines as structured graphs: recommendations, evidence, citations, source spans, and update triage are nodes and edges with provenance, not loose text. The current buildout turns exactly 198 public AHS/GURU metadata rows into a real corpus atlas for graph, API, search, and archive-status browsing, with parsing limited to a deterministic 5-document subset.

## What this is not

- Not a generic RAG chatbot.
- Not a full 198-PDF parser or generated-answer system.
- Not a source of patient-specific treatment advice.
- Not a source of approved clinical recommendations.
- Not a repository for PHI, real patient records, or raw public guideline downloads in normal Git history.
- Not a default consumer of external LLM APIs.
- Not a replacement for expert methodologists, working groups, or approval chains.

## Current scaffold

- **`apps/web`**: Next.js frontend with an Evidence Atlas IDE using Sigma.js and Graphology as the default real-corpus graph, plus a compact inspector and bottom metadata/source-span search shell.
- **`services/api`**: FastAPI backend with `/health`, `/knowledgebase/corpus/*` routes, and pytest tests.
- **`packages/schemas`**: Seed graph/provenance JSON Schema and TypeScript types enforcing the "no source span, no claim" rule.
- **`resources/registry/`**: Preserved registry metadata, including exactly 198 public AHS/GURU corpus rows and the deterministic 5-document parse subset.
- **`resources/manifests/ahs-guru-public/`**: Trackable manifest and checksum location for public acquisition runs, including per-row status and failure reasons.
- **`resources/derived/`**: Safe, bounded derived source-document, source-span, and graph-ready records when deterministic local parser outputs pass project safeguards.
- **`docs/model-gateway.md`**: Local-first model gateway and subsidy firewall policy; external LLM APIs are off by default.
- **`docs/research/public-guideline-acquisition.md`**: Concrete layout for public AHS/GURU prototype downloads, manifests, source spans, and graph-ready records.
- **`docs/milestone-protocol.md`**: Auditable milestone sequence: update docs/memory, run tests, inspect git status/diff, commit, push only if remote configured.
- **`.github/workflows/ci.yml`**: Secret-free CI running the full baseline on every PR/push.

## Repository layout

```
AGENTS.md                    # Canonical agent rules and milestone protocol
README.md                    # This file
apps/                        # Next.js frontend
services/                    # FastAPI backend
packages/                    # Shared schemas, types, validation
resources/                   # Resource registry, manifests, derived records, and ignored raw downloads
  registry/                  # Metadata records and pilot selectors
  manifests/                 # Public acquisition manifests and checksums
  derived/                   # Safe bounded source-document, source-span, and graph-ready records
  raw/                       # Ignored local working downloads governed by storage policy
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
- **Public guideline acquisition layout**: [`docs/research/public-guideline-acquisition.md`](./docs/research/public-guideline-acquisition.md)
- **Security, privacy, and licensing notes**: [`docs/security-privacy-license.md`](./docs/security-privacy-license.md)
- **Resource storage policy**: [`docs/resource-storage-policy.md`](./docs/resource-storage-policy.md)
- **Local-first model gateway**: [`docs/model-gateway.md`](./docs/model-gateway.md)
- **Graph and provenance schemas**: [`packages/schemas/README.md`](./packages/schemas/README.md)
- **Graph canvas UX direction**: [`docs/graph-canvas-ux.md`](./docs/graph-canvas-ux.md)
- **CCA/GURU discovery brief**: [`docs/proposal/cca-guru-discovery-brief.md`](./docs/proposal/cca-guru-discovery-brief.md)
- **Resource request package**: [`docs/proposal/resource-request-package.md`](./docs/proposal/resource-request-package.md)

## Current buildout and roadmap

Public AHS/GURU resources may be used for the real corpus atlas: exactly 198 metadata rows support graph/API/search metadata scope, local archive status, and Evidence Atlas browsing. Raw PDFs live only as ignored local source archive artifacts under `resources/raw/ahs-guru-public/`; they stay out of normal Git history by default.

The committed audit path is manifest and checksum data under `resources/manifests/ahs-guru-public/`. Manifest rows keep planned resource IDs, URLs, retrieval state, byte counts and SHA-256 checksums when available, and failure status fields when archive attempts fail.

Only the deterministic 5-document parse subset is parse-eligible for this milestone. Source spans and exact excerpts are shown only when produced by deterministic local parser outputs. The atlas must not imply that all 198 PDFs were parsed or that metadata rows produce clinical claims.

The Evidence Atlas UI uses Sigma.js and Graphology by default, with a compact inspector and bottom metadata/source-span search shell for corpus navigation.

The remaining safeguards are no PHI, no patient-specific advice, source-span provenance for clinical claim-like records, and no default external LLM routing.

Roadmap families after the knowledgebase foundation:

- Surveillance.
- PICO/evidence workflows.
- Recommendation-impact diff.
- Consensus workflow.
- Alberta-local overlays.
- Computable guideline compiler.

## Quick baseline

```bash
npm run test:baseline
```

See [`docs/testing-strategy.md`](./docs/testing-strategy.md) for the full command sequence, including real-corpus safety gates, raw PDF ignore checks, parser/search external-LLM scans, performance smoke coverage, and expected-failure fixture diagnostics.

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
