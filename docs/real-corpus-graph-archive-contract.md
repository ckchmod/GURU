# Real Corpus Graph Archive Contract

This contract defines the graph and archive vocabulary for the real public corpus atlas. It applies to the 198 public AHS/GURU metadata rows preserved in `resources/registry/ahs-guru-public-corpus.json` and to the selected public rows used by the bounded prototype path. It is schema-adjacent guidance for parser, graph projection, API, data-client, UI, search, and safety tasks; it does not create clinical guideline outputs.

The contract preserves the project rules from `AGENTS.md`, `docs/CONTEXT.md`, and `packages/schemas/README.md`: no PHI, no patient-specific advice, no default external LLM routing, and no clinical claim without source-span provenance.

## Scope

The real public corpus atlas graph for this milestone is metadata-first. The graph may represent resource inventory, disease-site grouping, document-type grouping, archive state, parser state, checksums, and source-span anchors for parsed resources. It must not represent clinical assertions, recommendations, evidence conclusions, funding eligibility, review decisions, or model outputs.

The graph scope is exactly 198 public AHS/GURU metadata rows. Registry metadata alone may create only the node and edge classes listed below. A registry row is not a source span, and it is not evidence for a clinical claim.

## Node Classes

Downstream tasks must use these node classes for this milestone:

| Node class | Required meaning | Creation rule |
|---|---|---|
| `resource` | One public AHS/GURU registry row from the 198-row metadata scope. | Create from registry metadata only when the row has a stable `resource_id`. |
| `disease_site_cluster` | A grouping node for the normalized `disease_site` value on public corpus rows. | Create from registry metadata only; do not infer disease biology or treatment content. |
| `document_type_cluster` | A grouping node for the normalized `resource_type` or document-type label used by the atlas. | Create from registry metadata only; do not infer internal document sections. |
| `archive_status` | A status node describing the local archive and parser outcome vocabulary attached to resources. | Create from acquisition, manifest, checksum, or parser state, not from clinical text interpretation. |
| `source_span` | A provenance anchor for parsed subset records only. | Create only after a parser emits a bounded source span record with a stable locator and quoted span or checksum-backed excerpt. |

No other node class is in scope for this milestone. Claim-like clinical node classes such as `Recommendation`, `EvidenceItem`, `FundingRule`, `Citation`, `ReviewDecision`, and `ModelTrace` must not be emitted from registry metadata alone.

## Edge Classes

Downstream tasks must use these edge classes for this milestone:

| Edge class | Source | Target | Meaning |
|---|---|---|---|
| `resource_to_disease_site` | `resource` | `disease_site_cluster` | Connects a registry row to its recorded `disease_site`. |
| `resource_to_document_type` | `resource` | `document_type_cluster` | Connects a registry row to its recorded document type or `resource_type`. |
| `resource_to_archive_status` | `resource` | `archive_status` | Connects a resource to the current archive and parse state for the local public prototype. |
| `resource_to_source_span` | `resource` | `source_span` | Connects a parsed resource to source spans emitted for the parsed subset only. |

The edge set is intentionally narrow. It supports atlas navigation and provenance inspection without promoting metadata into clinical graph content.

## Provenance Metadata

Every `resource`, `archive_status`, and parsed-subset `source_span` projection must carry or reference these metadata fields when available from the registry, manifest, checksum, or parser record:

| Field | Source of truth | Contract |
|---|---|---|
| `resource_id` | Registry row | Stable join key across registry, manifests, parser records, graph projection, API, and UI. |
| `source_url_or_access_path` | Registry row | Public URL or access path used for acquisition planning and traceability. |
| `access_date` | Registry row or acquisition manifest | Date the source URL or local access path was checked or acquired. |
| `resource_type` | Registry row | Resource kind from the registry schema. |
| `disease_site` | Registry row | Recorded disease-site grouping label; not a clinical assertion. |
| `document_status` | Registry row | Publication or lifecycle status from the registry row. |
| `license_status` | Registry row | License or terms-of-use status. |
| `allowed_use` | Registry row | Current allowed-use list for the public prototype path. |
| `local_storage_decision` | Registry row and storage policy | Storage decision such as `local raw archive`, `metadata-only`, or `link-only`. |
| `checksum_sha256` | Registry row or manifest | SHA-256 for retained raw content, or the empty-string hash when no content is retained. |
| `archive_status` | Manifest or acquisition record | Current raw-file archive state for the resource. |
| `parse_status` | Parser record | Current parser outcome for the resource. |

These fields are provenance for inventory and processing state. They are not evidence for clinical claims and must not be transformed into recommendations, evidence statements, funding rules, review decisions, or model traces.

## Archive And Parse Status Vocabulary

Use `archive_status` for the raw-file acquisition state and `parse_status` for the text-extraction state. Downstream tasks may display the two values together, but they must keep the fields separate.

### `archive_status`

| Value | Meaning |
|---|---|
| `metadata_only` | The resource is represented by registry metadata only. No local raw file is present. |
| `downloaded` | A local raw file exists under the approved ignored raw path and has a recorded checksum. |
| `download_missing` | The resource was selected or expected for acquisition, but no local raw file is available. |
| `encrypted` | A local file exists but is encrypted or otherwise inaccessible to the parser. |
| `checksum_mismatch` | A local file exists but does not match its recorded `checksum_sha256`. |

### `parse_status`

| Value | Meaning |
|---|---|
| `parsed` | The parser emitted a bounded source-document record and may emit `source_span` records for the parsed subset. |
| `download_missing` | Parsing could not run because the raw file is unavailable. |
| `encrypted` | Parsing could not run because the file is encrypted or blocked. |
| `empty_text` | Parsing completed but produced no usable text. |
| `partial_text` | Parsing produced bounded text with known gaps. Any source spans must retain locators and checksums for the extracted subset only. |
| `parse_failed` | Parsing failed before emitting a valid parsed record. |

No status value grants permission to publish clinical content. `parsed` means the parser produced a technical artifact; it does not mean the resource has approved clinical claims.

## Safety Guardrails

No clinical claim-like nodes may be emitted from registry metadata alone. In this milestone, registry metadata may support `resource`, `disease_site_cluster`, `document_type_cluster`, and status projections only.

`source_span` nodes are allowed only for the parsed subset and only as provenance anchors. A `source_span` alone does not create a valid recommendation, evidence item, funding rule, citation, review decision, or model trace.

The contract does not authorize raw PDF text, guideline excerpts, summaries, recommendations, patient-specific advice, dosing advice, diagnostic conclusions, PHI-like content, external LLM routing, redistribution, commercial use, or production clinical use.

## Downstream Acceptance Checks

Parser, graph projection, API, data-client, UI, search, and safety tasks should prove compliance with grep or schema checks that cover:

- The exact node classes: `resource`, `disease_site_cluster`, `document_type_cluster`, `archive_status`, and `source_span`.
- The exact edge classes: `resource_to_disease_site`, `resource_to_document_type`, `resource_to_archive_status`, and `resource_to_source_span`.
- The processing vocabulary: `parsed`, `download_missing`, `encrypted`, `empty_text`, `partial_text`, and `parse_failed`.
- The guardrail phrase: no clinical claim-like nodes may be emitted from registry metadata alone.
