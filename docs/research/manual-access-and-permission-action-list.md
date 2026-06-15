# Manual Access and Permission Action List

## Purpose

This action list names the human steps required before any real AHS/GURU guideline content, internal GURU material, historical update package, evidence table, search strategy, excluded-study reason, or licensed external source can be stored or processed by the workbench.

The current public corpus is metadata-only. Do not download, archive, parse, summarize, embed, extract, create source spans from, derive graph nodes from, or populate the UI with real source content until the registry records permission for that exact use.

## Immediate User Actions

1. **Confirm the canonical public AHS source page**
   - Use this canonical page for the public AHS/GURU Cancer Guidelines corpus: `https://www.albertahealthservices.ca/cancer/page1731.aspx`.
   - Current status: catalogued as link and metadata only in `docs/research/ahs-guideline-corpus-catalogue.md` and `resources/registry/ahs-guru-public-corpus.json`.
   - Needed from human reviewer: confirm whether this page and its linked documents may be archived, parsed, transformed into source spans, used to derive graph nodes, displayed in the workbench, and used in commercial deployment.

2. **Contact GURU through the catalogue contact link**
   - The public catalogue includes `GURU@ahs.ca` as `mailto:GURU@ahs.ca`.
   - Use that contact only for an authorized permission request or to identify the correct GURU steward. Do not treat the email link as permission.

3. **Request permission for the public corpus**
   - Ask the authorized AHS/CCA/GURU contact for a written permission matrix covering the public corpus discovered from `page1731.aspx`.
   - The request should name these proposed uses separately: raw archival, local or controlled object storage, parsing, normalized text and table storage, source-span creation, excerpt display, graph derivation, reviewer workflow use, UI population, redistribution limits, and commercial deployment.
   - Record the answer in each affected registry row before any real data work starts.

4. **Request the internal GURU process pack**
   - Request the current GURU Guideline Methodology Handbook and templates.
   - Request the detailed literature-search process document.
   - Request the annual Provincial Tumour Team meeting and administration manual, including timelines, agendas, and task procedures.
   - Request conflict-of-interest process materials and templates.
   - Request consensus survey examples, Delphi outputs, voting records, and agreement records where available.
   - Request publication, versioning, archive, and update-communication procedures.
   - Treat every internal item as restricted until a GURU steward or delegate records approval. Metadata-only cataloguing is the default.

5. **Request historical update materials**
   - Ask for two historical guideline update projects with final approved versions, intermediate drafts, redlines, reviewer comments, decision memos, and related artifacts.
   - Ask GURU to choose projects that are safe for evaluation and do not contain PHI, patient identifiers, or patient-specific examples.
   - Request permission for view, metadata catalogue, raw archive, parsing, source-span creation, graph derivation, evaluation use, and commercial deployment separately. If any category is denied, record the narrower allowed use.

6. **Request evidence tables, search strategies, and excluded-study reasons**
   - Request evidence tables that support selected guidelines.
   - Request the search strategies that produced those evidence tables, including databases, dates, search strings, filters, and update cadence where GURU can share them.
   - Request excluded-study reasons and screening decisions where available.
   - These materials are derivative and methods-sensitive. Store only metadata until written terms allow raw archival and derivative processing.

7. **Request one upcoming pilot topic**
   - Ask GURU to identify one upcoming guideline update topic suitable for a bounded prospective pilot.
   - Keep the pilot observational or assistive until a separate pilot agreement covers roles, review, storage, derivative artifacts, display, and publication boundaries.
   - Do not start the pilot by ingesting documents. Start by updating registry rows and permissions.

8. **Review licensed and subscription sources**
   - Existing registry categories include licensed or subscription resources such as external guideline bodies, evidence APIs, databases, journals, abstract services, and computable standards.
   - Human or institutional access is required before viewing or processing subscription sources. A personal login, public landing page, or citation does not grant raw archival, scraping, embedding, summarization, graph derivation, redistribution, or commercial rights.
   - Record licence scope, expiration, permitted uses, and storage limits before any source is processed.

## Permission Questions to Ask

For each resource class, ask the owner to answer these questions in writing.

- May Novara and the project team store an exact raw copy locally?
- May the raw copy be stored in controlled object storage for approved users?
- May the content be parsed into normalized text, tables, and layout metadata?
- May short quoted source spans and excerpt checksums be stored for provenance?
- May graph nodes and edges be derived from the content?
- May approved excerpts, source locators, review status, and graph-derived records appear in the workbench UI?
- May the material be used for evaluation, benchmarking, extraction QA, or historical replay?
- May any derivative artifact be used in commercial development, licensing, or deployment?
- Are there restrictions on redistribution, public display, external services, model processing, retention period, user access, or deletion?
- Who is the named reviewer or authority for the permission record?

## Registry Updates Required Before Data Work

No ingestion task may start until the relevant registry rows are updated with:

- `permission_status` set from written evidence, never by assumption.
- `allowed_use` values that match the written permission.
- `local_storage_decision` chosen from `link-only`, `metadata-only`, `local raw archive`, `Git LFS`, `object storage`, or `prohibited`.
- `checksum_sha256` for any retained raw file, or the empty-string hash when nothing is retained.
- Notes naming the reviewer, review date, permission basis, storage limits, derivative limits, and next step.

Rows that remain `metadata-only` or `link-only` cannot produce raw archives, normalized text, source spans, embeddings, summaries, extracted fields, graph nodes, model traces, or UI excerpts.

## Safeguards That Stay in Force

- No PHI, real patient identifiers, patient-specific examples, or PHI-like synthetic data may enter code, fixtures, logs, prompts, evaluations, raw archives, evidence files, graph data, or commit messages.
- The workbench does not generate patient-specific treatment advice, dosing recommendations, diagnostic conclusions, or approved clinical recommendations.
- No clinical statement, guideline summary, recommendation draft, extraction, evidence item, funding rule, review decision, or model trace may exist without a source span when the schema requires one.
- No raw source storage happens before permission and storage gates pass.
- No derivative artifacts are allowed for `metadata-only` or `link-only` rows.
- No external LLM API routing is allowed by default. Restricted or licensed content needs documented approval and a per-use gate before any external service sees it.

## First Recommended Manual Sequence

1. Confirm the `page1731.aspx` public corpus owner and the right GURU permission contact.
2. Send the permission matrix request for the public corpus, using `GURU@ahs.ca` only if it is the right intake route.
3. Request the internal GURU process pack from the proposal package.
4. Ask GURU to nominate one small disease-site subset for a permissioned pilot.
5. Update registry rows from the written response before any raw archive, checksum, parser, source-span, graph, review, or UI work begins.

## References

- [`docs/research/ahs-guideline-corpus-catalogue.md`](./ahs-guideline-corpus-catalogue.md)
- [`resources/registry/ahs-guru-public-corpus.json`](../../resources/registry/ahs-guru-public-corpus.json)
- [`docs/proposal/resource-request-package.md`](../proposal/resource-request-package.md)
- [`docs/resource-registry.md`](../resource-registry.md)
- [`docs/resource-storage-policy.md`](../resource-storage-policy.md)
- [`docs/security-privacy-license.md`](../security-privacy-license.md)
