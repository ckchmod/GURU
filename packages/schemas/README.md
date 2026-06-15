# Graph and Provenance Seed Schemas

This directory contains the seed data model for the CCA GURU Guideline Graph Workbench.

## Files

- `graph-provenance-schema.json` — JSON Schema (draft-07) for graph documents containing guideline nodes, edges, and source-span provenance.
- `index.ts` — TypeScript types mirroring the JSON Schema.

## Core rule: no source span, no claim

Every clinical statement, guideline summary, recommendation draft, or extraction must be anchored to at least one `SourceSpan`. The schema enforces this for claim-like node types:

- `Recommendation`
- `Citation`
- `EvidenceItem`
- `FundingRule`
- `ReviewDecision`
- `ModelTrace`

A `Recommendation` node with an empty or missing `source_span_ids` array fails validation.

## Source-span provenance fields

Each `SourceSpan` records:

- `source_document_id` — stable document identifier.
- `access_date` — when the source was accessed.
- `stable_locator` — section, paragraph, or fragment locator.
- `quoted_span` — exact quoted text.
- `excerpt_checksum` — SHA-256 checksum of the quoted excerpt.
- `prompt_or_model_version` — model or prompt used for generation.
- `reviewer` / `review_status` — human reviewer and status.
- `timestamp` / `output_status` — when the span was produced and its lifecycle status.

## Seed node types

- `Guideline` — top-level guideline document.
- `GuidelineVersion` — a published or draft version of a guideline.
- `Recommendation` — a guideline recommendation (requires source spans).
- `PICOQuestion` — structured PICO question.
- `SourceDocument` — external or internal source document.
- `SourceSpan` — anchored excerpt from a source document.
- `Citation` — bibliographic or inline citation (requires source spans).
- `EvidenceItem` — extracted evidence claim (requires source spans).
- `FundingRule` — funding or reimbursement rule (requires source spans).
- `WorkflowTask` — triage, review, extraction, or update task.
- `ReviewDecision` — editorial or methodological decision (requires source spans).
- `ModelTrace` — model generation trace with input/output digest (requires source spans).

## Validation

```bash
# Validate a graph document
python scripts/validate-graph-schemas.py tests/fixtures/graph-provenance/synthetic-graph.json

# A recommendation missing source spans must fail
python scripts/validate-graph-schemas.py tests/fixtures/graph-provenance/recommendation-missing-source-span.json
```

These commands are also available from the repository root:

```bash
npm run test:schemas
```

## No enterprise graph dependency

This seed model is explicit and lightweight. It does not require Neo4j or any other enterprise graph database. A future implementation may persist these nodes and edges in any store that respects the schema.

## Synthetic fixtures only

All sample data in `tests/fixtures/graph-provenance/` is synthetic and non-clinical. No real guideline recommendations, patient data, or PHI are included.
