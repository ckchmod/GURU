# Public Guideline Acquisition Layout

This note defines where the public AHS/GURU knowledgebase prototype keeps downloaded resources and derived records. It covers public resources from the AHS cancer guideline page used by the current public guideline knowledgebase buildout. It does not change the project safety rules: no PHI, no patient-specific advice, source span provenance for clinical claim-like records, and no default external LLM routing.

## Storage Paths

| Artifact | Path | Git handling | Purpose |
|---|---|---|---|
| Raw local downloads | `resources/raw/ahs-guru-public/` | Ignored by default through `resources/raw/*` | Local working files fetched from public AHS/GURU URLs. |
| Download manifests and checksums | `resources/manifests/ahs-guru-public/` | Trackable | Resource ID, URL, access date, file name, media type, byte size, and SHA-256 checksum. |
| Parsed text records | `resources/derived/source-documents/` | Trackable when safe and bounded | Normalized source-document records created from raw or fixture inputs. |
| Source span records | `resources/derived/source-spans/` | Trackable when safe and bounded | Stable locators plus exact quoted text or checksum-backed excerpts for provenance. |
| Graph-ready records | `resources/derived/graph-ready/` | Trackable when safe and bounded | Knowledgebase records that reference `source_span_ids` before any claim-like node is used. |

Raw downloaded files are local working artifacts. They stay out of normal Git history unless a future policy deliberately allows small safe samples. Manifests, checksum files, schemas, and safe fixtures may be committed because they let later tasks verify acquisition without committing the raw downloads.

## Acquisition Rules

1. Read the selected resource IDs from the public corpus registry or a bounded pilot selector.
2. Download raw files only into `resources/raw/ahs-guru-public/`.
3. Write a manifest under `resources/manifests/ahs-guru-public/` for each acquisition run.
4. Include a SHA-256 checksum for each raw file in the manifest.
5. Keep downloaded files out of prompts, logs, commits, and external LLM calls.

The prototype may use public AHS/GURU resources for download, parsing, source-document creation, source span extraction, and graph-ready record generation. This does not allow PHI, patient-specific treatment advice, dosing advice, diagnostic conclusions, or external LLM routing by default.

## Derived Records

Parsed source-document records should identify the resource ID, source URL, access date, source file checksum, parser version, output status, and safe storage path. They may include normalized text only when the fixture or public pilot output is safe to track.

Source span records should identify the source document, stable section or paragraph locator, exact quoted span or checksum-backed excerpt, extraction timestamp, and review status. Use the phrase `source span` in manifests and records so grep checks can find provenance fields consistently.

Graph-ready records must carry `source_span_ids` before they make clinical claim-like statements. If a record can't point to a source span, it remains a draft parsing artifact and must not become a recommendation, citation, evidence item, funding rule, review decision, or model trace.

## Relationship to Storage Policy

`docs/resource-storage-policy.md` remains the general storage policy. This file is the concrete layout for the current public AHS/GURU prototype work because Task 2 needs exact paths for the downloader, parser, API, and UI tasks that follow.

## Roadmap Fit

This layout supports the next product families after the knowledgebase foundation: surveillance, PICO/evidence workflows, recommendation-impact diff, consensus workflow, Alberta-local overlays, and computable guideline compiler work. Each family must continue to use source spans for clinical claim-like records and must keep the no-PHI, no patient-specific advice, and no default external LLM routing safeguards.
