# Accuracy-First Acquisition and Ingestion Plan

## Purpose and Non-Goals

This plan defines the next phase for moving the AHS/GURU guideline corpus from a preserved metadata catalogue toward a public guideline knowledgebase buildout. The current public catalogue covers links discovered from `https://www.albertahealthservices.ca/cancer/page1731.aspx`, with 198 registry rows in `resources/registry/ahs-guru-public-corpus.json`. Public AHS/GURU resources may be used for the prototype acquisition, parsing, source-span, graph-ready, API, and Evidence Atlas work described in the active buildout plan.

The accuracy rule is simple: exact source materials are preserved separately from every normalized, parsed, ingested, or graph-derived artifact. The raw source is the audit anchor. No parser output, source span, model trace, graph node, review output, or UI view may replace it.

This plan does not create clinical recommendations or patient-specific advice. It also does not allow PHI, PHI-like synthetic records, raw guideline downloads in normal Git history, unsupported clinical claims, or default external LLM routing.

## Data-State Model

The corpus must move through named states. Each state has a separate storage location and an accuracy check.

1. **Metadata catalogue**: Registry rows and research catalogues record titles, URLs, source owners, resource types, disease sites, access dates, licence status, allowed use, local storage decision, and notes. This state is preserved and should not be redone.
2. **Exact raw source archive**: The untouched source file or source export is stored in `resources/raw/ahs-guru-public/` or another governed local working path outside normal Git history. Its checksum is the reference point for every later artifact.
3. **Normalized text and tables**: Parser outputs convert selected raw files into structured text, table representations, page maps, headings, and layout metadata. They are ingested artifacts, not source materials.
4. **Source spans**: Each span ties a small quoted excerpt to a source document identifier, access date, stable locator, excerpt checksum, reviewer status, prompt or model version where relevant, timestamp, and output status.
5. **Graph derivatives**: `Guideline`, `GuidelineVersion`, `Recommendation`, `Citation`, `EvidenceItem`, `FundingRule`, `ReviewDecision`, `ModelTrace`, and related nodes are derived records. Claim-like nodes require `source_span_ids`; no source span means no claim.
6. **Review and evidence outputs**: Reviewer decisions, extraction QA, parser error reports, source-span validation logs, and model traces document what happened. Evidence logs belong under `.agent-artifacts/evidence/` and are not committed.
7. **UI population artifacts**: The frontend receives graph and provenance records, not raw guideline files. It may display source locators, review state, checksums, and bounded safe excerpts when those records pass source-span and safety checks.

Prototype artifacts must keep the exact source separate from parsed text, source spans, graph records, and UI data. No downstream artifact replaces the raw checksum anchor.

## Stage Checks

Each check must pass before the next stage starts.

1. **Public resource selection check**: Read the public corpus registry or bounded pilot selector and record each selected resource ID, URL, access date, and document type.
2. **Raw archive check**: Store raw public downloads only in `resources/raw/ahs-guru-public/` or another governed ignored working path.
3. **Checksum check**: Compute SHA-256 for every retained raw source and write it to a manifest under `resources/manifests/ahs-guru-public/`.
4. **Parser check**: Parser outputs must include the source document identifier, raw checksum, parser name and version, run timestamp, and any parse warnings.
5. **Source-span validation check**: Validate that every quoted span can be traced back to the exact raw source by stable locator and excerpt checksum. Failed locator or checksum checks block downstream graph work.
6. **Reviewer status check**: Source spans, extraction outputs, and claim-like graph nodes stay draft, under-review, approved, or rejected as separate status values. Draft status is not approved status.
7. **Graph publishing check**: Publish graph records to the application layer only when schema validation passes, required `source_span_ids` are present, safety checks pass, and reviewer status supports the target UI state.

## Storage Locations

Exact source materials and derived artifacts must not share the same storage tier by default.

| State | Storage location | Git policy | Buildout rule |
| --- | --- | --- | --- |
| Metadata catalogue | `resources/registry/` and `docs/research/` | Committed | Allowed for current public corpus as link and metadata only |
| Exact raw source archive | `resources/raw/ahs-guru-public/` outside Git tracking | Not committed | Public prototype downloads stay local |
| Normalized text and tables | `resources/derived/source-documents/` or governed ingestion artifact store | Trackable when safe and bounded | Must reference source document ID and checksum |
| Source spans | `resources/derived/source-spans/` or provenance store tied to raw checksum | Trackable when safe and bounded | Must include locator, quoted span or checksum-backed excerpt, and review status |
| Graph derivatives | `resources/derived/graph-ready/`, graph data store, or approved fixture path | Trackable when safe and bounded | Claim-like records require `source_span_ids` |
| Review and evidence logs | `.agent-artifacts/evidence/` | Not committed | Governed by the same source and PHI rules |
| UI population outputs | Application database or approved static artifact path | Safe bounded fixtures or derived records only | Must avoid patient-specific advice and unsupported claims |

Object storage may replace local raw storage when shared access is required and the bucket policy, encryption, retention, access controls, object URI, version, and checksum are documented. Git LFS is not the default for raw public guideline sources.

## Validation

Validation is mandatory at each transition.

- **Registry validation**: Confirm each row has source owner, URL or access path, licence status, allowed use, storage decision, checksum field, and notes.
- **Checksum validation**: Match each retained raw file to its SHA-256 manifest checksum.
- **Source locator validation**: Confirm every span has a stable locator that resolves against the archived source version.
- **Quote and excerpt checksum validation**: Recompute the checksum for each quoted excerpt and compare it with the stored `excerpt_checksum`.
- **Schema validation**: Validate graph files against `packages/schemas/graph-provenance-schema.json`. Claim-like nodes with missing or empty `source_span_ids` fail.
- **Reviewer status validation**: Block approved publication when source spans, graph nodes, or review decisions remain draft, under-review, rejected, or missing reviewer metadata.
- **Safety validation**: Confirm no PHI, patient identifiers, patient-specific advice, dosing recommendation, diagnostic conclusion, or unsupported clinical claim enters code, fixtures, logs, prompts, archives, evidence, graph data, or UI artifacts.
- **Model gateway validation**: Reject model calls unless the policy envelope confirms data sensitivity, budget, approved model class, and `external_api_allowed: false` unless a documented per-use approval says otherwise.

## Pilot Recommendation

Choose a small disease-site subset rather than the full 198-row public corpus. A good pilot should include a few linked resource types from one disease site, for example one guideline, one summary or algorithm if present, and one evidence table if available.

The pilot's success criteria should be accuracy checks, not volume: raw checksum match, parser fidelity, source-span locator pass rate, quote checksum pass rate, schema validation, reviewer acceptance, and correct UI rendering of graph records with source spans.

## Roadmap After Knowledgebase Foundation

The public guideline knowledgebase buildout is the base for six roadmap families:

- Surveillance for new evidence and guideline update signals.
- PICO/evidence workflows for scoping questions, screening, extraction, and evidence tables.
- Recommendation-impact diff to show which recommendations new evidence might affect.
- Consensus workflow for review packets, votes, conflicts, and decision status.
- Alberta-local overlays for funding, trials, referral pathways, testing access, and implementation context.
- Computable guideline compiler for structured outputs after source-span and review controls are mature.

## References

- [`docs/research/ahs-guideline-corpus-catalogue.md`](./ahs-guideline-corpus-catalogue.md)
- [`resources/registry/ahs-guru-public-corpus.json`](../../resources/registry/ahs-guru-public-corpus.json)
- [`docs/resource-registry.md`](../resource-registry.md)
- [`docs/resource-storage-policy.md`](../resource-storage-policy.md)
- [`docs/security-privacy-license.md`](../security-privacy-license.md)
- [`packages/schemas/README.md`](../../packages/schemas/README.md)
- [`docs/model-gateway.md`](../model-gateway.md)
