# Public Guideline Acquisition Layout

This note defines where the public AHS/GURU real corpus atlas keeps downloaded resources and derived records. It covers exactly 198 public metadata rows from the AHS cancer guideline page for graph, API, search, and archive-status metadata scope. It does not change the project safety rules: no PHI, no patient-specific advice, source span provenance for clinical claim-like records, and no default external LLM routing.

The graph/archive vocabulary for the real public corpus atlas is defined in [`docs/real-corpus-graph-archive-contract.md`](../real-corpus-graph-archive-contract.md). Downstream parser, graph projection, API, data-client, UI, search, and safety tasks must use that contract for node classes, edge classes, archive statuses, parse statuses, and metadata provenance fields.

## Storage Paths

| Artifact | Path | Git handling | Purpose |
|---|---|---|---|
| Raw local downloads | `resources/raw/ahs-guru-public/` | Ignored by default through `resources/raw/*` | Local working raw PDFs fetched from public AHS/GURU URLs. |
| Download manifests and checksums | `resources/manifests/ahs-guru-public/` | Trackable | Resource ID, URL, retrieval timestamp, intended raw path, media type, byte size and SHA-256 checksum when downloaded, status fields, and failure reason when not downloaded. |
| Parsed text records | `resources/derived/source-documents/` | Trackable when safe and bounded | Normalized source-document records created from raw or fixture inputs. |
| Source span records | `resources/derived/source-spans/` | Trackable when safe and bounded | Stable locators plus exact quoted text or checksum-backed excerpts for provenance. |
| Graph-ready records | `resources/derived/graph-ready/` | Trackable when safe and bounded | Knowledgebase records that reference `source_span_ids` before any claim-like node is used. |

Raw downloaded files are local working artifacts. For this milestone they are raw PDFs under the ignored `resources/raw/ahs-guru-public/` source archive path. They stay out of normal Git history unless a future policy deliberately allows small safe samples. Manifests, checksum files, schemas, and safe fixtures may be committed because they let later tasks verify acquisition without committing the raw downloads. The committed no-network status artifact `resources/manifests/ahs-guru-public/manifest-20260615T000000Z-no-network-status.json` accounts for all 198 public rows with intended raw paths and explicit not-downloaded status; live acquisition manifests may add byte sizes and SHA-256 checksums for downloaded rows later.

## Acquisition Rules

1. Read the selected resource IDs from a bounded pilot selector, or use `--all-public` to treat exactly 198 rows in `resources/registry/ahs-guru-public-corpus.json` as part of the bounded public prototype archive plan.
2. Download raw PDFs only into `resources/raw/ahs-guru-public/`.
3. Write a manifest under `resources/manifests/ahs-guru-public/` for each acquisition run.
4. Include a manifest row for every planned resource, even when an external download fails.
5. Include byte size and SHA-256 for downloaded rows; include `status` plus `failure_reason` for rows that were not downloaded.
6. Keep downloaded files out of prompts, logs, commits, and external LLM calls.

The prototype may use public AHS/GURU resources for metadata, links, viewing, local raw archive under the ignored raw path, manifests, and bounded parsing/source-span workflows. Inclusion in the 198-row public corpus registry is the authority for this public archive workflow. It does not by itself enable parsed graph derivation for every row: `derive_graph` remains limited to the deterministic 5-document parse subset. This does not allow PHI, patient-specific treatment advice, dosing advice, diagnostic conclusions, or external LLM routing by default.

## Derived Records

Parsed source-document records should identify the resource ID, source URL, access date, source file checksum, parser version, output status, and safe storage path. They may include normalized text only when the fixture or public pilot output is safe to track.

Source span records should identify the source document, stable section or paragraph locator, exact quoted span or checksum-backed excerpt, extraction timestamp, and review status. Use the phrase `source span` in manifests and records so grep checks can find provenance fields consistently.

Source spans and exact excerpts must only appear when deterministic local parser outputs produce them for the 5-document subset. Missing raw files, parser failures, encrypted files, or absent derived files should produce honest status records, not fabricated excerpts.

Graph-ready records must carry `source_span_ids` before they make clinical claim-like statements. If a record can't point to a source span, it remains a draft parsing artifact and must not become a recommendation, citation, evidence item, funding rule, review decision, or model trace.

The Evidence Atlas currently uses Sigma.js plus Graphology for the default real-corpus graph. Its compact inspector and bottom metadata/source-span search shell browse metadata, archive/parse state, and parser-produced source-span records when they exist. They do not provide patient-specific advice, generated model answers, full RAG, or approved clinical recommendations.

## Relationship to Storage Policy

`docs/resource-storage-policy.md` remains the general storage policy. This file is the concrete layout for the current public AHS/GURU prototype work because Task 2 needs exact paths for the downloader, parser, API, and UI tasks that follow.

## Roadmap Fit

This layout supports the next product families after the knowledgebase foundation: surveillance, PICO/evidence workflows, recommendation-impact diff, consensus workflow, Alberta-local overlays, and computable guideline compiler work. Each family must continue to use source spans for clinical claim-like records and must keep the no-PHI, no patient-specific advice, and no default external LLM routing safeguards.
