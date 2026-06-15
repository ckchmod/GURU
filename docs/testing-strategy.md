# Testing Strategy

## Goal

Maintain a full test baseline from the start. Every significant milestone must pass the affected tests before commit. Tests protect the project from regressions in graph logic, provenance handling, resource governance, and clinical safety boundaries.

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

- Playwright for critical frontend flows, including the graph canvas.
- Smoke tests for the full stack startup.

### 4. Governance and compliance tests

- Resource registry validation against `docs/resource-registry.schema.json`.
- Grep assertions for PHI, secrets, and restricted file patterns.
- Provenance metadata checks on generated graph nodes.
- Git status checks to confirm no raw large files or credentials are staged.

## Commands

Run the full baseline once scaffolds are in place:

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
python -m pip install -r services/api/requirements.txt

# Backend development server
npm run dev:api

# Backend tests
npm run test:api

# Backend health smoke, with the API server running on 127.0.0.1:8000
npm run smoke:api

# Frontend development server
npm run dev:web

# Frontend unit tests
npm run test --workspace=apps/web

# Frontend end-to-end tests
npm run test:e2e --workspace=apps/web

# Root aliases for frontend checks
npm run test:web
npm run test:e2e:web

# Graph/provenance schema validation (valid synthetic graph)
python scripts/validate-graph-schemas.py tests/fixtures/graph-provenance/synthetic-graph.json

# Graph/provenance schema validation (expected failure: missing source spans)
python scripts/validate-graph-schemas.py tests/fixtures/graph-provenance/recommendation-missing-source-span.json

# Graph/provenance schema validation via pytest
pytest services/api/tests/test_graph_schema_validation.py -v

# Resource registry validation
python scripts/validate-resource-registry.py
python scripts/validate-resource-registry.py tests/fixtures/resource-registry

# Lint and typecheck
npm run lint --workspace=apps/web
npm run typecheck --workspace=apps/web
```

## Test data

- Use synthetic vignettes only.
- No PHI or real patient data.
- Every test fixture that represents a guideline claim must include a fake source span with document identifier, section, and quoted excerpt.

## Pre-commit requirement

Run tests for every affected module before committing. The milestone protocol is:

**update docs/memory → run tests → commit → push only if remote configured**

## Continuous integration

When CI is added, the pipeline will run the full baseline on every pull request. The pipeline will also run governance checks for PHI, secrets, and restricted files.

## Evidence

Every task must produce evidence in `.omo/evidence/task-{N}-{slug}.{ext}`. Evidence files are not a replacement for tests; they document the verification steps that were run.
