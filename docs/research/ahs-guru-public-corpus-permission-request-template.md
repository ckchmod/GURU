# AHS/GURU Public Corpus Permission Request Template

**Status**: draft request template

**Prepared by**: Novara

**Audience**: authorized AHS, CCA, or GURU information-governance and guideline-program contacts

**Purpose**: request written allowed-use decisions for the public AHS/GURU cancer guideline corpus catalogued from `https://www.albertahealthservices.ca/cancer/page1731.aspx`

## Email draft

Subject: Permission request for governed use of public AHS/GURU cancer guideline corpus

Hello,

Novara is building a local-first guideline graph workbench to support guideline maintenance, provenance review, and evidence navigation for cancer care guideline teams. We have catalogued the public AHS/GURU cancer guideline links discoverable from the AHS cancer guidelines page at `https://www.albertahealthservices.ca/cancer/page1731.aspx`.

At this stage, we have recorded only link and metadata information. We have not downloaded, archived, parsed, summarized, embedded, extracted, or displayed any guideline content in the workbench.

We are requesting written guidance from the authorized AHS, CCA, or GURU steward on which uses are permitted for this public corpus and which uses require a separate agreement. We will record the response in our resource registry before any raw storage or derivative processing starts.

Could you please confirm the permitted uses for the public corpus, or direct us to the correct contact for this decision?

## Corpus covered by this request

- Public source page: `https://www.albertahealthservices.ca/cancer/page1731.aspx`
- Catalogue date: 2026-06-15
- Current project status: metadata-only registry rows with `allowed_use: ["link", "metadata"]`
- Current catalogue size: 196 public links discovered from the source page, with 198 AHS/GURU public corpus registry rows
- Resource types currently catalogued: guidelines, evidence tables, algorithms, summaries, letters, and other public linked assets

## Permission matrix requested

Please mark each use as permitted, denied, or requiring a separate agreement. If limits apply, please include the limits, reviewer, effective date, and any required wording or attribution.

| Proposed use | Requested decision | Notes or restrictions |
| --- | --- | --- |
| Link to the public resource pages and PDFs | Permitted / denied / separate agreement | |
| Store descriptive metadata such as title, URL, owner, disease site, resource type, and access date | Permitted / denied / separate agreement | |
| Store exact raw copies in controlled local or object storage for authorized project users | Permitted / denied / separate agreement | |
| Parse approved raw copies into normalized text, tables, headings, and layout metadata | Permitted / denied / separate agreement | |
| Store short quoted source spans and excerpt checksums for provenance review | Permitted / denied / separate agreement | |
| Derive graph nodes and edges from approved content, including guideline, recommendation, citation, evidence, and review-status records | Permitted / denied / separate agreement | |
| Display approved excerpts, source locators, checksum metadata, review state, and graph-derived records in a restricted workbench UI | Permitted / denied / separate agreement | |
| Use approved content and derivatives for extraction QA, benchmark evaluation, and historical replay | Permitted / denied / separate agreement | |
| Use approved content and derivatives in commercial development, licensing, or customer-hosted deployment of the workbench | Permitted / denied / separate agreement | |
| Process approved content with local or private models | Permitted / denied / separate agreement | |
| Process approved content with external model APIs or external services | Permitted / denied / separate agreement | |
| Redistribute raw content, derived text, excerpts, embeddings, graph exports, or UI screenshots outside authorized users | Permitted / denied / separate agreement | |

## Safeguards Novara will apply

- No protected health information, patient identifiers, or patient-specific examples will be requested, stored, or processed.
- The workbench will not generate patient-specific treatment advice, dosing recommendations, or diagnostic conclusions.
- Public availability of a document will not be treated as permission for archival, summarization, embedding, graph derivation, redistribution, or commercial use.
- Exact source materials, when approved for retention, will remain separate from parsed text, source spans, graph derivatives, and UI artifacts.
- No clinical statement or claim-like graph record will be treated as approved without a source span and reviewer status.
- External model API routing is off by default and would require explicit per-use approval.
- Any denied or unclear resource class will remain metadata-only or link-only.

## Information requested in the response

For the permission record, please include:

- Name and role of the approving authority or decision contact.
- Date of decision.
- Resource scope covered by the decision.
- Permitted uses and denied uses.
- Storage, retention, attribution, redistribution, user-access, publication, external-service, and commercial-use restrictions.
- Whether a separate agreement, data-sharing arrangement, or institutional review is required before any proposed use can begin.

## Project registry update after response

After receiving written guidance, Novara will update the affected rows in `resources/registry/ahs-guru-public-corpus.json` before any data work starts. Rows will remain metadata-only unless the written response supports broader use.

Registry fields affected by the response include:

- `permission_status`
- `allowed_use`
- `local_storage_decision`
- `checksum_sha256`, if raw retention is approved and files are stored
- `notes`, including reviewer, date, permission basis, storage limits, derivative limits, and next step

## Related internal references

- [`docs/research/ahs-guideline-corpus-catalogue.md`](./ahs-guideline-corpus-catalogue.md)
- [`docs/research/manual-access-and-permission-action-list.md`](./manual-access-and-permission-action-list.md)
- [`docs/research/accuracy-first-acquisition-ingestion-plan.md`](./accuracy-first-acquisition-ingestion-plan.md)
- [`docs/resource-registry.md`](../resource-registry.md)
- [`docs/resource-storage-policy.md`](../resource-storage-policy.md)
- [`docs/security-privacy-license.md`](../security-privacy-license.md)
