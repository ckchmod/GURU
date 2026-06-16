# GURU

A local-first guideline knowledge graph and evidence atlas for source-backed cancer guideline exploration.

## What this is

GURU treats guideline resources as a structured knowledge graph: resources, disease sites, document types, archive states, source spans, review metadata, and future claim-like records are nodes and edges with provenance, not loose text. The current buildout is a graph-first Evidence Atlas for guideline exploration. It uses the 198-row public AHS/GURU corpus manifest for graph, API, retrieval, and archive-status browsing, while source-backed interpretation appears only where validated local source spans exist.

## What this is not

- Not a generic chatbot or generated-answer RAG system.
- Not a full 198-PDF parser or generated-answer system.
- Not a generated clinical summary system. Generated answers remain disabled.
- Not a source of patient-specific treatment advice.
- Not a source of approved clinical recommendations.
- Not a repository for PHI, real patient records, or raw public guideline downloads in normal Git history.
- Not a default consumer of external LLM APIs.
- Not a replacement for expert methodologists, working groups, or approval chains.

## Current scaffold

- **`apps/web`**: Next.js frontend with an Evidence Atlas IDE using Sigma.js and Graphology as the default real-corpus graph, plus a compact inspector, trust/provenance drawer, offline status chips, non-mutating review queue shell, and bottom metadata/source-span retrieval terminal.
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

Public AHS/GURU resources may be used for the real corpus atlas: the 198 metadata rows support graph, API, retrieval metadata scope, local archive status, and Evidence Atlas browsing. This is best-effort and manifest-accounted, not a guarantee that all 198 public rows were downloaded, parsed, or converted into source-backed interpretation. Raw PDFs live only as ignored local source archive artifacts under `resources/raw/ahs-guru-public/`; they stay out of normal Git history by default.

The committed audit path is manifest and checksum data under `resources/manifests/ahs-guru-public/`. The current all-public acquisition manifest is `resources/manifests/ahs-guru-public/manifest-20260616T053200Z.json`: 198 rows are accounted for, 197 downloaded, and 1 failed row is retained with its failure reason rather than hidden or counted as parsed coverage.

Only validated local source spans can back graph-linked retrieval and interpretation. The parser keeps an exact-five `--registry` gate and a separate manifest-driven parse mode; neither should be described as guaranteed all-198 parsed coverage. Recent manifest parse output accounted for download and parse states, including `download_missing=1`, `parse_failed=2`, `parsed=144`, and `partial_text=51`, while public API exposure stays bounded by safety and provenance filters.

The Evidence Atlas UI uses Sigma.js and Graphology by default. Its deterministic ForceAtlas and noverlap layout is an implementation detail of the current graph surface, not a clinical feature claim. The delivered retrieval terminal is retrieval, provenance, and trace evidence only: query results can focus and highlight graph resources, source spans, path/context nodes, and provenance fields. When the graph does not contain a source-span node, source-span hits fall back to the parent resource while keeping source-span IDs, stable locators, checksum/status fields, and reviewer metadata visible where available.

The non-mutating evidence-review shell is draft workflow metadata only unless a card is backed by validated `source_span_ids`; blocked or unbacked cards carry no claim text.

Surveillance in this milestone is an offline/local manifest scaffold. It compares committed local manifest files and surfaces archive status chips; it does not crawl live sources, check live reachability, infer practice impact, or run recommendation-impact diff.

Generated answers remain disabled. The current product is a graph-linked retrieval and provenance surface for guideline exploration, source-backed only where validated source spans exist.

The remaining safeguards are no PHI, no patient-specific advice, no clinical claim without a source span, and no default external LLM routing.

Roadmap families after the knowledgebase foundation, not delivered in this milestone:

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
