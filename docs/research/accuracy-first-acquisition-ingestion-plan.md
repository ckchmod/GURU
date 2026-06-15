# Accuracy-First Acquisition and Ingestion Plan

## Purpose and Non-Goals

This plan defines the next phase for moving the AHS/GURU guideline corpus from a metadata catalogue toward governed acquisition and ingestion. The current public catalogue covers links discovered from `https://www.albertahealthservices.ca/cancer/page1731.aspx`, with 198 registry rows in `resources/registry/ahs-guru-public-corpus.json`. Those rows remain permission-pending, `metadata-only`, and limited to `allowed_use: ["link", "metadata"]` until written permission changes the registry.

The accuracy rule is simple: exact source materials are preserved separately from every normalized, parsed, ingested, or graph-derived artifact. The raw source is the audit anchor. No parser output, source span, model trace, graph node, review output, or UI view may replace it.

This plan does not authorize downloading, crawling, storing, summarizing, embedding, extracting, or ingesting real guideline content. It does not mark any permission as approved, create graph nodes from real clinical content, or produce clinical recommendations. All real data work starts only after the resource registry records the allowed use, storage decision, reviewer, date, and permission basis.

## Data-State Model

The corpus must move through named states. Each state has a separate storage location and a separate permission check.

1. **Metadata catalogue**: Registry rows and research catalogues record titles, URLs, source owners, resource types, disease sites, access dates, licence status, permission status, allowed use, local storage decision, and notes. For the current AHS/GURU public corpus, this is the only approved state.
2. **Exact raw source archive**: The untouched source file or source export is stored only after permission allows raw retention. It lives outside normal Git history or in approved controlled object storage. Its checksum is the reference point for every later artifact.
3. **Normalized text and tables**: Parser outputs convert approved raw files into structured text, table representations, page maps, headings, and layout metadata. They are ingested artifacts, not source materials.
4. **Source spans**: Each span ties a small quoted excerpt to a source document identifier, access date, stable locator, excerpt checksum, reviewer status, prompt or model version where relevant, timestamp, and output status.
5. **Graph derivatives**: `Guideline`, `GuidelineVersion`, `Recommendation`, `Citation`, `EvidenceItem`, `FundingRule`, `ReviewDecision`, `ModelTrace`, and related nodes are derived records. Claim-like nodes require `source_span_ids`; no source span means no claim.
6. **Review and evidence outputs**: Reviewer decisions, extraction QA, parser error reports, source-span validation logs, and model traces document what happened. Evidence logs belong under `.omo/evidence/` and are not committed.
7. **UI population artifacts**: The frontend receives approved graph and provenance records, not raw guideline files. It may display source locators, review state, checksums, and approved excerpts only when the registry permits that use.

Rows with `local_storage_decision: "metadata-only"` or `local_storage_decision: "link-only"` stop at the metadata catalogue. They cannot produce raw archives, normalized text, source spans, embeddings, summaries, extracted fields, graph nodes, or UI excerpts.

## Stage Gates

Each gate must pass before the next stage starts.

1. **Permission gate**: Confirm the registry row has `permission_status: "approved"` for the intended action. The row must name the allowed uses, for example `view`, `summarize`, `embed`, `derive_graph`, `redistribute`, or `commercial`, and must record the reviewer, date, and written basis. Agents cannot approve this gate.
2. **Raw archive gate**: Store the exact approved source in a governed raw location only when permission allows retention. If permission is limited to viewing, linking, or metadata, do not store the raw file.
3. **Checksum gate**: Compute SHA-256 for every retained raw source and record it in the registry. Keep the empty-string hash only for rows where nothing is retained.
4. **Parser gate**: Parse only approved raw sources. Parser outputs must include the source document identifier, raw checksum, parser name and version, run timestamp, and any parse warnings.
5. **Source-span validation gate**: Validate that every quoted span can be traced back to the exact raw source by stable locator and excerpt checksum. Failed locator or checksum checks block downstream graph work.
6. **Reviewer approval gate**: A human reviewer approves or rejects source spans, extraction outputs, and claim-like graph nodes before they become approved evidence. Draft and under-review outputs remain clearly marked.
7. **Graph publishing gate**: Publish graph records to the application layer only when schema validation passes, required `source_span_ids` are present, permission covers derivative use, and reviewer status supports the target UI state.

## Storage Locations

Exact source materials and derived artifacts must not share the same storage tier by default.

| State | Storage location | Git policy | Permission rule |
| --- | --- | --- | --- |
| Metadata catalogue | `resources/registry/` and `docs/research/` | Committed | Allowed for current public corpus as link and metadata only |
| Exact raw source archive | `resources/raw/` outside Git tracking or controlled object storage | Not committed unless separately approved for Git LFS | Requires explicit raw-retention permission |
| Normalized text and tables | Governed ingestion artifact store | Not committed by default | Requires derivative-processing permission |
| Source spans | Provenance store tied to raw checksum | Not committed unless approved and redacted as needed | Requires excerpt and derivative permission |
| Graph derivatives | Graph data store or approved fixture path | Real clinical graph content not committed by default | Requires graph-derivation permission |
| Review and evidence logs | `.omo/evidence/` | Not committed | Governed by the same source and PHI rules |
| UI population outputs | Application database or approved static artifact path | Synthetic fixtures only in Git unless approved | Requires display and derivative permission |

Object storage may replace local raw storage when shared access is required and the bucket policy, encryption, retention, access controls, object URI, version, checksum, and permission record are documented. Git LFS is not the default for raw clinical sources; it is allowed only when the resource is explicitly licensed for repository storage.

## Validation

Validation is mandatory at each transition.

- **Registry validation**: Confirm each row has source owner, URL or access path, licence status, allowed use, permission status, storage decision, checksum field, and notes. No permission may be marked approved without written evidence.
- **Checksum validation**: Match each retained raw file to its SHA-256 registry checksum. For metadata-only and link-only rows, keep the empty-string hash and verify that no raw path exists.
- **Source locator validation**: Confirm every span has a stable locator that resolves against the archived source version.
- **Quote and excerpt checksum validation**: Recompute the checksum for each quoted excerpt and compare it with the stored `excerpt_checksum`.
- **Schema validation**: Validate graph files against `packages/schemas/graph-provenance-schema.json`. Claim-like nodes with missing or empty `source_span_ids` fail.
- **Reviewer status validation**: Block approved publication when source spans, graph nodes, or review decisions remain draft, under-review, rejected, or missing reviewer metadata.
- **Safety validation**: Confirm no PHI, patient identifiers, patient-specific advice, dosing recommendation, diagnostic conclusion, or unsupported clinical claim enters code, fixtures, logs, prompts, archives, evidence, graph data, or UI artifacts.
- **Model gateway validation**: Reject model calls unless the policy envelope confirms source-permission clearance, data sensitivity, budget, approved model class, and `external_api_allowed: false` unless a documented per-use approval says otherwise.

## First Pilot Recommendation

After permission is recorded, choose a small disease-site subset rather than the full 198-row public corpus. A good pilot should include a few linked resource types from one disease site, for example one guideline, one summary or algorithm if present, and one evidence table if permission covers each item.

The pilot starts only after the registry records approval for raw archival and derivative processing for the selected rows. Its success criteria should be accuracy checks, not volume: raw checksum match, parser fidelity, source-span locator pass rate, quote checksum pass rate, schema validation, reviewer acceptance, and correct UI rendering of approved graph records. If permission covers only metadata or links, the pilot remains a catalogue and workflow rehearsal with no raw archive, no parsing, no source spans, no graph derivatives, and no UI population from real content.

## References

- [`docs/research/ahs-guideline-corpus-catalogue.md`](./ahs-guideline-corpus-catalogue.md)
- [`resources/registry/ahs-guru-public-corpus.json`](../../resources/registry/ahs-guru-public-corpus.json)
- [`docs/resource-registry.md`](../resource-registry.md)
- [`docs/resource-storage-policy.md`](../resource-storage-policy.md)
- [`docs/security-privacy-license.md`](../security-privacy-license.md)
- [`packages/schemas/README.md`](../../packages/schemas/README.md)
- [`docs/model-gateway.md`](../model-gateway.md)
