# Resource Storage Policy

This document defines the storage decisions available to the CCA GURU Guideline Graph Workbench resource registry. It gives Task 5 and later ingestion work a clear, deterministic mapping from a resource's compliance status to how it may be kept.

## Storage decision categories

Every resource is assigned exactly one storage decision in the registry. The decision is derived from the security, privacy, and licensing gates in `docs/security-privacy-license.md`.

### link-only

- The registry stores only a stable URL, DOI, or other persistent locator.
- No title, abstract, excerpt, or metadata beyond the locator is retained in the registry or repository.
- Use when license or privacy status is unknown or when the source explicitly allows linking only.
- Retrieval is deferred to the user's own access or institutional subscription.

### metadata-only

- The registry stores descriptive metadata such as title, authors, publisher, date, version, identifier, access date, and license status.
- No raw content, full text, abstract, figure, table, or extracted field is stored in the repository.
- Use when the resource is public but its license does not clearly permit archival or derivative processing.
- Embeddings, summaries, graph nodes, and extracted fields are not allowed under this decision.

### local raw archive

- The raw resource file is stored on the local workstation or server, outside the Git repository, under `resources/raw/` or an equivalent governed path.
- Use only when the license and privacy review explicitly permit local retention.
- Access is controlled by the host environment. The registry records the local path, checksum, and permission record.
- This decision does not authorize redistribution, embedding, or summarization unless those uses are separately approved.
- For the current bounded public AHS/GURU prototype, selected public pilot files may use `local raw archive` only under ignored `resources/raw/ahs-guru-public/`, with manifests/checksums trackable and derived records kept draft with source-span provenance.

### Git LFS

- Large or binary files are tracked with Git Large File Storage and stored in the LFS backend.
- Use only for resources that are explicitly licensed for repository storage and are too large for normal Git tracking.
- The registry must record the license, checksum, and LFS pointer.
- Prohibited for PHI, restricted internal documents, or resources whose license forbids redistribution.

### object storage

- Raw or processed files are stored in an external object store (e.g., S3-compatible, Azure Blob, GCS) with access controls and audit logging.
- Use when local storage is insufficient or when shared access is required by approved users.
- Requires documented bucket policy, encryption, retention, and access controls.
- The registry records the object URI, version, checksum, and permission record.

### prohibited

- The resource may not be stored, embedded, summarized, transformed, or redistributed in any form.
- Use when the source forbids reuse, when PHI is present, when the license is incompatible, or when the risk cannot be resolved.
- The registry may still record that the resource was evaluated and why it was marked prohibited.

## Decision matrix

| Resource situation | Default decision | Allowed next step |
|---|---|---|
| Unknown license or terms | metadata-only or link-only | Escalate for allowed-use review |
| Restrictive license that forbids archival/derivatives | prohibited | Request explicit permission |
| Public with clear non-commercial/internal-use terms | metadata-only or link-only | Request explicit permission for more |
| Selected public AHS/GURU prototype pilot row | local raw archive | Keep raw files out of Git; allow bounded draft source spans and graph-ready records only |
| Explicitly approved for local retention | local raw archive | Record permission in registry |
| Explicitly approved for repository storage, large file | Git LFS | Record permission and LFS pointer |
| Explicitly approved for shared/cloud storage | object storage | Record permission and bucket policy |
| Contains PHI or patient identifiers | prohibited | Do not store; escalate |
| Internal GURU document without approval | metadata-only or link-only | Obtain documented approval |
| Licensed database or journal under subscription | metadata-only or link-only | Confirm license scope before any raw archive |

## Derived artifacts

Embeddings, summaries, source spans, graph nodes, extracted fields, and similar artifacts are derivative processing. Their storage decision follows the underlying resource:

- If the raw resource is link-only or metadata-only, no derivative artifact may be stored without separate allowed-use review.
- If the raw resource is prohibited, all derivative processing is prohibited.
- If the raw resource is approved for local raw archive, Git LFS, or object storage, derivative artifacts may be stored only when the approval explicitly covers that processing.
- For the current selected public AHS/GURU prototype pilot rows, `derive_graph` covers bounded draft source spans and draft graph-ready records only. It does not authorize approved clinical recommendations, patient-specific advice, redistribution, commercial use, external LLM routing, or derivative processing for internal, restricted, licensed, subscription, or non-public sources.

## Registry requirements

Every stored or referenced resource must have a registry row containing at least:

- Resource identifier and locator.
- License or terms-of-use status.
- Storage decision.
- Permission record or escalation reference.
- Checksum for any raw file.
- Reviewer and review timestamp.
- Status: draft, under-review, or approved.

## Transitions

A resource may move from a more restrictive decision to a less restrictive one only after:

1. The licensing or privacy question is resolved.
2. The approval is documented in the registry.
3. A verifier confirms the decision matches the recorded permission.

Moving from a less restrictive decision to a more restrictive one may happen immediately when new information reveals a compliance issue.

## Storage hygiene

- Do not store raw resources in the Git-tracked source tree unless they are small, explicitly licensed, and approved.
- Do not store PHI, credentials, or model artifacts in any storage tier.
- Keep evidence and audit logs under `.agent-artifacts/evidence/` and out of any public release.
- Periodically review local raw archives and object storage against current registry permissions.

## References

- `AGENTS.md`
- `docs/CONTEXT.md`
- `docs/adr/ADR-0001-project-principles.md`
- `docs/security-privacy-license.md`
