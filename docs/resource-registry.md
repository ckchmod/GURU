# Resource Registry

This document defines the CCA GURU Guideline Graph Workbench resource registry: the schema, starter files, and the acquisition checklist that Task 5 and later ingestion work will use.

The registry is governed by:

- [`docs/security-privacy-license.md`](./security-privacy-license.md) — compliance gates.
- [`docs/resource-storage-policy.md`](./resource-storage-policy.md) — storage decisions.

## Purpose

Every resource that the workbench stores, references, or processes must have a registry row that records:

- What the resource is and where it lives.
- Who owns or publishes it.
- Its license and allowed-use status.
- Whether permission is required and what its current permission state is.
- How it may be stored locally or in the repository.
- A checksum for any retained raw file.

This task creates the schema and placeholder starter rows only. It does **not** download, crawl, archive, embed, summarize, or transform resources. Task 10 adds executable validation of registry rows.

## Schema

The canonical JSON Schema is [`resource-registry.schema.json`](./resource-registry.schema.json).

### Registry file structure

Each starter registry file is a JSON object with these top-level fields:

| Field | Type | Description |
|---|---|---|
| `registry_version` | string | File format version, semantic versioning. |
| `last_updated` | string (date) | Date the file was last updated. |
| `category` | string | One of the required resource categories. |
| `rows` | array | Resource rows for this category. |

### Required row fields

Every row must contain all of these fields:

| Field | Type | Description |
|---|---|---|
| `resource_id` | string | Stable, URL-safe identifier. |
| `title` | string | Human-readable title. |
| `source_owner` | string | Owning organization or publisher. |
| `source_url_or_access_path` | string | URL, DOI, API endpoint, or internal path. |
| `access_method` | string | How the resource is obtained. |
| `access_date` | string (date) | Date last accessed or verified. |
| `resource_type` | string | Kind of resource. |
| `jurisdiction` | string | Primary jurisdiction. |
| `disease_site` | string | Cancer site or `not-applicable`. |
| `document_status` | string | Lifecycle status. |
| `version_or_date` | string | Version or effective date. |
| `license_status` | string | Known license status. |
| `allowed_use` | array | Permitted uses based on current review. |
| `permission_required` | boolean | Whether explicit permission is required. |
| `permission_status` | string | Current permission state. |
| `local_storage_decision` | string | Storage decision from the storage policy. |
| `checksum_sha256` | string | SHA-256 of retained raw file, or the empty-string hash when nothing is retained. |
| `notes` | string | Provenance, review, escalation, and next-step notes. |

### Enumerated values

`access_method` must be one of: `public_url`, `doi`, `internal_share`, `api`, `subscription_api`, `manual_request`, `email`, `unknown`.

`resource_type` must be one of: `guideline`, `evidence_table`, `algorithm`, `summary`, `letter`, `methodology`, `standard`, `trial_registry`, `regulatory`, `terminology`, `api`, `other`.

`document_status` must be one of: `draft`, `under_review`, `approved`, `archived`, `superseded`, `unknown`.

`license_status` must be one of: `unknown`, `public_domain`, `cc_by`, `cc_by_nc`, `cc_by_sa`, `proprietary`, `subscription`, `government_open`, `restricted`.

`allowed_use` entries must be drawn from: `link`, `view`, `metadata`, `summarize`, `embed`, `redistribute`, `derive_graph`, `commercial`.

`permission_status` must be one of: `pending`, `unknown`, `not_applicable`, `approved`, `denied`.

`local_storage_decision` must be one of the values defined in [`docs/resource-storage-policy.md`](./resource-storage-policy.md):

- `link-only`
- `metadata-only`
- `local raw archive`
- `Git LFS`
- `object storage`
- `prohibited`

## Resource categories

The starter registry covers the categories identified in the plan:

1. **AHS/GURU public corpus** — public Cancer Care Alberta / GURU guideline documents and related assets.
2. **Internal GURU process pack** — internal methodology, templates, meeting materials, and working documents.
3. **Alberta funding/trials/pathways** — Alberta-local operational resources such as drug benefit lists, trial finders, and referral pathways.
4. **Methodology standards** — guideline development and systematic-review methodology references.
5. **Evidence APIs/licensed sources** — abstract databases, journal APIs, and other licensed evidence services.
6. **Privacy/regulatory** — privacy legislation, regulatory guidance, and compliance references.
7. **Computable standards** — terminologies, code systems, and interoperability standards such as SNOMED CT, LOINC, ICD-O, and FHIR.

Starter files live under `resources/registry/` and contain at least one placeholder row per category.

## Conservative defaults

- A public URL does **not** grant embedding, summarization, redistribution, or commercial-use rights.
- Unknown or restrictive licenses default to `metadata-only` or `link-only` until explicit permission is recorded.
- No starter row marks `permission_status` as `approved` unless direct evidence of approval exists.
- `checksum_sha256` uses the SHA-256 of the empty string (`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`) when no raw content is retained.

## Acquisition checklist

Before adding or promoting any resource, complete this checklist and record the outcome in the row notes:

1. **Identify** the resource with a stable `resource_id`, `title`, `source_owner`, and `source_url_or_access_path`.
2. **Classify** the resource by `category`, `resource_type`, `jurisdiction`, and `disease_site`.
3. **Confirm** `version_or_date` and `document_status` against the source.
4. **Review** the license or terms of use:
   - Is the license known and recorded in `license_status`?
   - Does the license permit the intended `allowed_use` values?
5. **Decide** whether `permission_required` is true.
   - If true, record the current `permission_status`.
   - Do not mark `approved` without written evidence of approval.
6. **Choose** the `local_storage_decision` using the decision matrix in [`docs/resource-storage-policy.md`](./resource-storage-policy.md).
7. **Compute** `checksum_sha256` for any retained raw file; use the empty-string hash for link-only or metadata-only rows.
8. **Record** provenance, reviewer, review date, and next steps in `notes`.
9. **Escalate** to a human reviewer if the license or privacy status is unclear.

## Validation scope

This task delivers the schema, documentation, and conservative starter rows. Task 10 adds executable validation scripts that check every registry file against `docs/resource-registry.schema.json`, verify checksums, and confirm permission status before any ingestion, embedding, summarization, or graph extraction.

## Safety and privacy

- Do not include PHI, real patient identifiers, licensed content excerpts, credentials, or raw PDFs in registry files.
- Keep evidence and audit artifacts under `.omo/evidence/` and out of public releases.
- Derivative processing (embeddings, summaries, source spans, graph nodes, extracted fields) requires the same allowed-use review as the underlying resource.

## References

- [`docs/security-privacy-license.md`](./security-privacy-license.md)
- [`docs/resource-storage-policy.md`](./resource-storage-policy.md)
- [`AGENTS.md`](../AGENTS.md)
