# Coding Standards

## Purpose

This document defines the engineering conventions for the Guideline Graph Workbench. It applies to all code in `apps/`, `services/`, `packages/`, `scripts/`, and `docs/`.

## Repository layout

Keep directories purposeful and do not create overlapping responsibilities:

- `apps/web/` - Next.js frontend.
- `services/api/` - FastAPI backend.
- `packages/schemas/` or `shared/schemas/` - Shared graph, provenance, and validation schemas.
- `resources/registry/` - Resource metadata and permission records.
- `resources/raw/` - Large or restricted files governed by `docs/resource-storage-policy.md`.
- `docs/` - Engineering documentation.
- `docs/adr/` - Architecture Decision Records.
- `docs/proposal/` - CCA/GURU-facing discovery and proposal artifacts.
- `scripts/` - Validation, migration, and utility scripts.

## File naming

- Name files by their job. One file, one responsibility.
- Use kebab-case for file and directory names: `graph-schema.ts`, `resource-registry.schema.json`.
- Use PascalCase for React components: `GraphCanvas.tsx`.
- Use camelCase for utility modules: `validateNode.ts`.

## Code style

- TypeScript on the frontend, Python on the backend.
- Prefer explicit types and schemas over implicit assumptions.
- Fail fast on invalid input. Return structured errors with machine-readable codes.
- Prefer small, testable functions. Avoid modules that grow beyond 250 lines of pure logic without refactoring.
- Use plain, descriptive names. Avoid abbreviations that are not obvious to a new contributor.

## Error handling

- Return structured errors with a consistent shape: `{ code, message, details }`.
- Do not leak internal stack traces or secrets in error responses.
- Log errors at the appropriate level without including PHI or credentials.

## Logging

- Log tool calls, decisions, and failures for every agent or script run.
- Never log PHI, patient identifiers, or credentials.
- Use structured logging with timestamps and correlation IDs.

## Security and privacy

- No PHI or patient-specific data in code, fixtures, logs, prompts, or evaluations.
- No credentials in source control. Use environment variables or an approved secret manager.
- No default external LLM routing. Model calls must go through the approved gateway with per-use gates.

## Documentation in code

- Comment only the non-obvious. Prefer self-explanatory names.
- Every public function and schema must have a docstring or TSDoc/JSDoc comment.
- Keep comments accurate. Stale comments are worse than no comments.

## Agent coding rules

- Read `AGENTS.md` before changing code.
- Match existing patterns for naming, imports, error handling, and indentation.
- Add or update tests for every behavioral change.
- Run the affected test suite before declaring a change complete.
- Update `docs/` and project memory after significant milestones.

## Provenance in code

- Any code that generates or transforms guideline claims must produce source-span provenance.
- Store provenance as structured metadata, not informal comments.
- Include document identifier, section locator, quoted excerpt or checksum, timestamp, model version, reviewer status, and output status.

## Reviews

- All significant changes must pass automated checks before human review.
- High-impact or compliance-sensitive changes require human approval before commit.
- A change is not complete until the verifier passes and the author can point to the evidence.
