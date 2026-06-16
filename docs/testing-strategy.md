# Testing Strategy

## Goal

Maintain a full test baseline from the start. Every significant milestone must pass the affected tests before commit. Tests protect the project from regressions in graph logic, provenance handling, resource governance, interpretability scope, and clinical safety boundaries.

## Test levels

### 1. Unit tests

- Backend: pytest for Python services in `services/api/`.
- Frontend: Vitest for TypeScript utilities and React components in `apps/web/`.
- Shared schemas: pytest or Vitest for validation logic in `packages/schemas/` and `services/api/tests/test_graph_schema_validation.py`.

### 2. Integration tests

- FastAPI endpoint tests with an in-memory or test database.
- Graph/provenance schema validation tests against synthetic graph fixtures.
- Resource registry validation tests against sample registry rows.
- Model gateway tests that confirm no external routing without an explicit gate.

### 3. End-to-end tests

- Playwright for critical frontend flows, including the Sigma/Graphology atlas graph, compact inspector, metadata/source-span retrieval terminal, graph highlight/focus/path coupling, source-span parent fallback, and performance smoke checks.
- Smoke tests for the full stack startup.

### 4. Governance and compliance tests

- Resource registry validation against `docs/resource-registry.schema.json`.
- Grep assertions for PHI, secrets, and restricted file patterns.
- Provenance metadata checks on generated graph nodes.
- Git status checks to confirm no raw large files or credentials are staged.
- Documentation grep checks for generated answers disabled, source-backed graph-linked retrieval, best-effort manifest-accounted acquisition, offline/local surveillance, source-span parent fallback, and draft/non-claim evidence-review wording.
- Documentation grep checks that overclaiming phrases are absent or explicitly scoped as disabled, excluded, blocked, local-only, or future-roadmap work.

## Commands

### Full baseline sequence

Run the full baseline from a clean checkout. The sequence uses only existing
manifests (`package-lock.json`, `services/api/requirements.txt`) and local
fixtures; it does not require secrets, external model endpoints, databases, or
real clinical resources.

```bash
# Install frontend dependencies
npm ci

# Install backend dependencies
python -m pip install -r services/api/requirements.txt

# Backend tests
npm run test:api

# Frontend unit tests
npm run test:web

# Frontend lint and typecheck
npm run lint:web
npm run typecheck:web

# Install Playwright Chromium browsers (skip if already installed)
npx playwright install --with-deps chromium

# Frontend end-to-end smoke tests
npm run test:e2e:web

# Graph/provenance schema validation (valid synthetic graph)
npm run test:schemas

# Safety, real-corpus, placeholder, parser/search LLM, raw-PDF, and performance smoke gates
npm run test:safety

# Graph/provenance schema validation (expected failure: missing source spans)
npm run test:schemas:invalid || true

# Resource registry validation, real registry must pass
python scripts/validate-resource-registry.py

# Resource registry fixture diagnostics (contains intentional failures)
python scripts/validate-resource-registry.py tests/fixtures/resource-registry || true
```

The real registry validation must pass. The fixture directory contains both
valid metadata-only/link-only rows and intentionally invalid rows (missing
`allowed_use`, missing `license_status`, duplicate checksum drift); running it
is useful for manual verification of validator behavior but is not a required
passing gate.

For convenience the root `package.json` also exposes:

```bash
npm run test:baseline     # all passing gates in one command (does not install browsers)
npm run test:api          # pytest services/api
npm run test:web          # vitest run in apps/web
npm run test:e2e:web      # Playwright tests in apps/web
npm run lint:web          # eslint in apps/web
npm run typecheck:web     # tsc --noEmit in apps/web
npm run test:schemas      # valid graph fixture
npm run test:safety       # real corpus safety gates, parser/search LLM scans, raw PDF ignore checks, performance smoke coverage
npm run test:schemas:invalid  # invalid graph fixture (expected to fail)
```

### Development helpers

```bash
# Backend development server
npm run dev:api

# Backend health smoke, with the API server running on 127.0.0.1:8000
npm run smoke:api

# Frontend development server
npm run dev:web
```

### Docs-only GURU identity and interpretability checks

For docs-only tasks that synchronize GURU identity and current Evidence Atlas language, do not run browser tests unless UI behavior changed. Use focused read and grep checks over the changed docs instead. The checks should prove that these statements are present:

- Generated answers remain disabled.
- Graph-linked retrieval is retrieval, provenance, and trace evidence only, source-backed where validated source spans exist.
- All-public acquisition is best-effort and manifest-accounted, not guaranteed all-198 parsed coverage.
- Surveillance is an offline/local manifest scaffold only.
- Retrieval query results can focus and highlight graph resources, source spans, path/context nodes, and provenance fields.
- Source-span retrieval hits fall back to the parent resource when the graph lacks source-span nodes.
- The evidence-review shell is draft/non-claim unless source-span-backed.

The same docs-only check should search for overclaims such as full RAG answers, generated clinical summaries, recommendation-impact diff, guaranteed all-198 parsing, approved recommendations, patient-specific advice, live surveillance, crawler behavior, or clinical inference. Matches are acceptable only when the surrounding text says the capability is disabled, excluded, blocked, local-only, or future-roadmap work.

## Test data

- Use synthetic vignettes only.
- No PHI or real patient data.
- Every test fixture that represents a guideline claim must include a fake source span with document identifier, section, and quoted excerpt.

## Pre-commit requirement

Run tests for every affected module before committing. The milestone protocol is:

**update docs/memory → run tests → commit → push only if remote configured**

## Continuous integration

`.github/workflows/ci.yml` runs the full baseline on every pull request and push
to `main`/`master`. The workflow:

- Uses `actions/setup-node` and `actions/setup-python` with dependency caching.
- Installs Node packages with `npm ci` and Python packages from
  `services/api/requirements.txt`.
- Installs Playwright Chromium browsers with `npx playwright install --with-deps chromium`.
- Runs backend pytest, frontend Vitest, lint, typecheck, Playwright smoke tests,
  graph/provenance schema validation, and resource registry validation.
- Requires no secrets, no external model APIs, no databases, and no real
  clinical resource access. All fixtures are synthetic.

## Evidence

Every task must produce evidence in the requested evidence directory, such as `.omo/evidence/task-{N}-{slug}.{ext}` for OMO tasks or `.agent-artifacts/evidence/task-{N}-{slug}.{ext}` for agent-artifact tasks. Evidence files are not a replacement for tests; they document the verification steps that were run.
