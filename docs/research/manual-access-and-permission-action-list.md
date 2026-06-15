# Manual Access and Restricted Source Action List

## Purpose

This action list names the human steps needed for internal GURU material, historical update packages, evidence tables, search strategies, excluded-study reasons, and licensed external sources that are not part of the public AHS/GURU prototype corpus.

The public AHS/GURU corpus from `https://www.albertahealthservices.ca/cancer/page1731.aspx` is covered by the current public guideline knowledgebase buildout. Public AHS/GURU resources may be used for prototype download manifests, parsing, source-document records, source spans, graph-ready records, backend API responses, and Evidence Atlas browsing. The safeguards still apply: no PHI, no patient-specific advice, source-span provenance for clinical claim-like records, and no default external LLM routing.

## Immediate User Actions

1. **Keep the public AHS source page as the prototype anchor**
   - Use this canonical page for the public AHS/GURU Cancer Guidelines corpus: `https://www.albertahealthservices.ca/cancer/page1731.aspx`.
   - Current status: catalogued in `docs/research/ahs-guideline-corpus-catalogue.md` and `resources/registry/ahs-guru-public-corpus.json`.
   - Prototype storage and derived-record paths live in [`docs/research/public-guideline-acquisition.md`](./public-guideline-acquisition.md).

2. **Contact GURU for internal or non-public material**
   - The public catalogue includes `GURU@ahs.ca` as `mailto:GURU@ahs.ca`.
   - Use that contact only to identify the correct GURU steward for internal process packs, historical update materials, evidence tables, search strategies, or future deployment questions.

3. **Request the internal GURU process pack**
   - Request the current GURU Guideline Methodology Handbook and templates.
   - Request the detailed literature-search process document.
   - Request the annual Provincial Tumour Team meeting and administration manual, including timelines, agendas, and task procedures.
   - Request conflict-of-interest process materials and templates.
   - Request consensus survey examples, Delphi outputs, voting records, and agreement records where available.
   - Request publication, versioning, archive, and update-communication procedures.
   - Treat every internal item as restricted until a GURU steward or delegate says how it may be handled. Metadata-only cataloguing is the default.

4. **Request historical update materials**
   - Ask for two historical guideline update projects with final approved versions, intermediate drafts, redlines, reviewer comments, decision memos, and related artifacts.
   - Ask GURU to choose projects that are safe for evaluation and do not contain PHI, patient identifiers, or patient-specific examples.
   - Ask for the handling terms for viewing, metadata cataloguing, raw archive, parsing, source-span creation, graph derivation, evaluation use, and deployment separately. If any category is denied, record the narrower allowed use.

5. **Request evidence tables, search strategies, and excluded-study reasons**
   - Request evidence tables that support selected guidelines.
   - Request the search strategies that produced those evidence tables, including databases, dates, search strings, filters, and update cadence where GURU can share them.
   - Request excluded-study reasons and screening decisions where available.
   - These materials are derivative and methods-sensitive. Store only metadata until written terms describe how raw archival and derivative processing may happen.

6. **Request one upcoming pilot topic**
   - Ask GURU to identify one upcoming guideline update topic suitable for a bounded prospective pilot.
   - Keep the pilot observational or assistive until a separate pilot agreement covers roles, review, storage, derivative artifacts, display, and publication boundaries.
   - Do not start a non-public pilot by ingesting documents. Start by updating registry rows and handling notes.

7. **Review licensed and subscription sources**
   - Existing registry categories include licensed or subscription resources such as external guideline bodies, evidence APIs, databases, journals, abstract services, and computable standards.
   - Human or institutional access is required before viewing or processing subscription sources. A personal login, public landing page, or citation does not settle raw archival, scraping, embedding, summarization, graph derivation, redistribution, or commercial use.
   - Record licence scope, expiration, permitted uses, and storage limits before any source is processed.

## Restricted Source Questions to Ask

For each non-public or licensed resource class, ask the owner to answer these questions in writing.

- May Novara and the project team store an exact raw copy locally?
- May the raw copy be stored in controlled object storage for approved users?
- May the content be parsed into normalized text, tables, and layout metadata?
- May short quoted source spans and excerpt checksums be stored for provenance?
- May graph nodes and edges be derived from the content?
- May approved excerpts, source locators, review status, and graph-derived records appear in the workbench UI?
- May the material be used for evaluation, benchmarking, extraction QA, or historical replay?
- May any derivative artifact be used in commercial development, licensing, or deployment?
- Are there restrictions on redistribution, public display, external services, model processing, retention period, user access, or deletion?
- Who is the named reviewer or authority for the handling record?

## Registry Updates Required Before Restricted Data Work

No restricted-source ingestion task may start until the relevant registry rows are updated with:

- `permission_status` set from written evidence, never by assumption.
- `allowed_use` values that match the written permission.
- `local_storage_decision` chosen from `link-only`, `metadata-only`, `local raw archive`, `Git LFS`, `object storage`, or `prohibited`.
- `checksum_sha256` for any retained raw file, or the empty-string hash when nothing is retained.
- Notes naming the reviewer, review date, handling basis, storage limits, derivative limits, and next step.

Rows for restricted sources that remain `metadata-only` or `link-only` cannot produce raw archives, normalized text, source spans, embeddings, summaries, extracted fields, graph nodes, model traces, or UI excerpts.

## Safeguards That Stay in Force

- No PHI, real patient identifiers, patient-specific examples, or PHI-like synthetic data may enter code, fixtures, logs, prompts, evaluations, raw archives, evidence files, graph data, or commit messages.
- The workbench does not generate patient-specific treatment advice, dosing recommendations, diagnostic conclusions, or approved clinical recommendations.
- No clinical statement, guideline summary, recommendation draft, extraction, evidence item, funding rule, review decision, or model trace may exist without a source span when the schema requires one.
- No raw restricted-source storage happens before registry handling and storage checks pass.
- No derivative artifacts are allowed for restricted-source rows marked `metadata-only` or `link-only`.
- No external LLM API routing is allowed by default. Restricted or licensed content needs documented approval and a per-use gate before any external service sees it.

## First Recommended Manual Sequence

1. Keep the public `page1731.aspx` corpus tied to the public guideline knowledgebase buildout and [`docs/research/public-guideline-acquisition.md`](./public-guideline-acquisition.md).
2. Use `GURU@ahs.ca` only if it is the right intake route for internal GURU materials or future deployment questions.
3. Request the internal GURU process pack from the proposal package.
4. Ask GURU to nominate one small disease-site subset for a non-public pilot only if the public prototype does not answer the evaluation question.
5. Update registry rows from the written response before any restricted raw archive, checksum, parser, source-span, graph, review, or UI work begins.

## References

- [`docs/research/ahs-guideline-corpus-catalogue.md`](./ahs-guideline-corpus-catalogue.md)
- [`docs/research/ahs-guru-public-corpus-permission-request-template.md`](./ahs-guru-public-corpus-permission-request-template.md)
- [`resources/registry/ahs-guru-public-corpus.json`](../../resources/registry/ahs-guru-public-corpus.json)
- [`docs/proposal/resource-request-package.md`](../proposal/resource-request-package.md)
- [`docs/resource-registry.md`](../resource-registry.md)
- [`docs/resource-storage-policy.md`](../resource-storage-policy.md)
- [`docs/security-privacy-license.md`](../security-privacy-license.md)
