# AHS/GURU Public Corpus Stewardship Note

**Status**: superseded for the current prototype.

**Prepared by**: Novara.

**Audience**: project team members working on the public guideline knowledgebase buildout.

## Current Direction

The public AHS/GURU corpus catalogued from `https://www.albertahealthservices.ca/cancer/page1731.aspx` may be used for the current public guideline knowledgebase prototype. That prototype includes local raw downloads, manifests, checksums, parsing, source-document records, source spans, graph-ready records, backend API responses, and Evidence Atlas browsing.

This file no longer acts as an active request template for the public corpus. It remains only to explain that older request-template language was superseded by the active buildout plan and the public acquisition layout.

## Safeguards

- No PHI, patient identifiers, or PHI-like synthetic records in code, fixtures, logs, prompts, evaluations, raw archives, evidence files, graph data, or commit messages.
- No patient-specific treatment advice, dosing recommendations, diagnostic conclusions, or approved clinical recommendations.
- Source-span provenance for every clinical claim-like record, including recommendations, citations, evidence items, funding rules, review decisions, and model traces.
- No default external LLM routing for documents, prompts, or embeddings.
- Raw public guideline downloads stay out of normal Git history by default.

## When To Contact A Steward

Contact AHS, CCA, or GURU stewards for internal GURU material, historical update packages, evidence tables, search strategies, excluded-study reasons, licensed external sources, deployment terms, or other non-public material. Those requests belong in the restricted-source workflow described by [`docs/research/manual-access-and-permission-action-list.md`](./manual-access-and-permission-action-list.md), not in the public prototype path.

## Related References

- [`docs/research/ahs-guideline-corpus-catalogue.md`](./ahs-guideline-corpus-catalogue.md)
- [`docs/research/public-guideline-acquisition.md`](./public-guideline-acquisition.md)
- [`docs/research/accuracy-first-acquisition-ingestion-plan.md`](./accuracy-first-acquisition-ingestion-plan.md)
- [`docs/CONTEXT.md`](../CONTEXT.md)
- [`docs/resource-storage-policy.md`](../resource-storage-policy.md)
- [`docs/model-gateway.md`](../model-gateway.md)
