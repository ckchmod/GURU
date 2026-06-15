# CCA GURU Resource Request Package

**Status**: draft request for discovery scoping  
**Prepared by**: Novara  
**Audience**: CCA GURU leadership, methodology leads, and information-governance contacts  
**Purpose**: list the resources Novara is asking to access so we can scope a governed guideline lifecycle workbench responsibly

---

## Important caveats

This document is a **request**, not an assertion of access. No partnership, permission, or licence has been approved unless and until CCA GURU or its authorized delegate provides written confirmation.

All requested resources will be catalogued in the project's resource registry. Each entry will record source owner, access path, licence status, allowed use, permission status, and storage decision. Unknown or restrictive licences default to metadata-only or link-only storage until explicit permission is granted. See [`docs/security-privacy-license.md`](../../docs/security-privacy-license.md) and [`docs/resource-storage-policy.md`](../../docs/resource-storage-policy.md).

No protected health information, patient identifiers, or patient-specific examples are requested. The workbench does not generate patient-specific treatment advice.

This request is derived from the Phase 0 discovery list in [`docs/gpt5.5pro_6_15.md`](../../docs/gpt5.5pro_6_15.md), section "4. Recommended first product strategy / Phase 0: discovery and resource access."

---

## Requested resource classes

### 1. GURU handbook and all templates

**What we are asking for**: the current GURU Guideline Methodology Handbook and the full set of templates used to produce CCA guidelines.

**Why it matters**: the handbook defines the current workflow, roles, rating system, consensus model, and update process. Templates are needed so the workbench can produce faithful, structurally consistent drafts and evidence tables. See [`docs/gpt5.5pro_6_15.md`](../../docs/gpt5.5pro_6_15.md), section 1.A.

**Requested permission scope**: view, metadata cataloguing, and, if agreed, ingestion and adaptation for the workbench's internal drafting and extraction tools.

### 2. Detailed literature-search process document

**What we are asking for**: the internal document that describes the resources, databases, search strings, and processes GURU uses for literature searches.

**Why it matters**: the handbook states that a detailed process document is available from GURU on request. It is essential for validating any AI-assisted search strategy or surveillance module against GURU's actual practice.

**Requested permission scope**: view and metadata cataloguing; ingestion only with explicit approval.

### 3. Annual Provincial Tumour Team meeting and admin manual

**What we are asking for**: the manual, agendas, timelines, and administrative procedures for GURU's annual multidisciplinary Provincial Tumour Team meetings.

**Why it matters**: the handbook notes that a detailed manual for annual PTT meeting timelines and admin tasks is available from GURU on request. The workbench's consensus workflow needs to mirror this process.

**Requested permission scope**: view and metadata cataloguing; ingestion only with explicit approval.

### 4. Current and archived guideline document exports

**What we are asking for**: a complete export of current and archived CCA GURU guideline documents, including related algorithms, pathways, summaries, physician letters, and patient letters where available.

**Why it matters**: current guidelines are the baseline approved recommendations. Archived versions support change detection, versioning, and retrospective benchmarking.

**Requested permission scope**: view and metadata cataloguing; ingestion, embedding, summarization, and derivative graph extraction only under an explicit collaboration or licence agreement.

### 5. Evidence tables, search strategies, and excluded-study reasons

**What we are asking for**: evidence tables, the search strategies that produced them, and the reasons studies were excluded from consideration.

**Why it matters**: evidence tables reconstruct recommendation provenance. Search strategies and exclusion reasons validate AI screening and update triage against GURU's historical decisions.

**Requested permission scope**: view and metadata cataloguing; ingestion and derivative processing only with explicit approval.

### 6. Two historical guideline update projects with all intermediate artifacts

**What we are asking for**: two prior guideline update projects, selected to cover different evidence speeds and clinical domains, including intermediate drafts, reviewer comments, redlines, decision memos, and final approved versions.

**Why it matters**: these projects are the strongest possible benchmark. Running the workbench against historical evidence lets Novara measure recall, extraction accuracy, update-triage quality, citation fidelity, and methodologist time saved without touching live guideline work.

**Requested permission scope**: view and metadata cataloguing; ingestion and use as training or evaluation data only with explicit approval.

### 7. One upcoming guideline update topic

**What we are asking for**: one upcoming guideline update topic that GURU has already identified, for a prospective pilot scoping exercise.

**Why it matters**: this gives Novara a concrete, bounded target for a 12-week pilot. It also lets GURU assess whether the workbench's outputs are useful without disrupting an active update project.

**Requested permission scope**: view and metadata cataloguing; participation as an observational or assistive tool only under a separate pilot agreement.

### 8. Conflict-of-interest process and templates

**What we are asking for**: GURU's COI forms, COI management rules, and the workflow for collecting and adjudicating disclosures.

**Why it matters**: the handbook references standard ICMJE forms and describes COI handling in final documents. A governed consensus module must integrate these rules.

**Requested permission scope**: view and metadata cataloguing; ingestion only with explicit approval.

### 9. Consensus survey examples

**What we are asking for**: examples of consensus survey instruments, historical Delphi outputs, and voting or agreement records used by GURU working groups or Provincial Tumour Teams.

**Why it matters**: these examples are needed to design an automated review cycle that matches GURU's actual consensus process.

**Requested permission scope**: view and metadata cataloguing; ingestion only with explicit approval.

### 10. Publication and versioning process

**What we are asking for**: the documented process for publishing guidelines, assigning version numbers or effective dates, archiving superseded versions, and communicating updates.

**Why it matters**: the workbench needs to distinguish approved from draft content and to produce publication-ready packages or version diffs.

**Requested permission scope**: view and metadata cataloguing; integration with publication workflow only under a separate agreement.

### 11. Local funding and implementation data sources

**What we are asking for**: pointers to Alberta-local data sources that affect guideline implementability, including the Outpatient Cancer Drug Benefit Program Master List, Alberta Cancer Clinical Trials trial finder, Alberta Referral Pathways, local molecular and pathology testing availability, local formulary and exceptional access processes, and relevant radiation, surgical, or systemic therapy protocols.

**Why it matters**: this is where Novara can add value beyond generic systematic-review tools. Local funding, trial availability, and pathway constraints need to be first-class objects in the graph.

**Requested permission scope**: view and metadata cataloguing for public sources; ingestion of restricted or subscription data only with explicit approval.

### 12. Explicit permission terms for ingestion, adaptation, commercial development, and deployment

**What we are asking for**: written confirmation from the appropriate CCA/AHS/GURU authority of the permitted uses for each requested resource class, covering:

- ingestion into a local or customer-hosted workbench;
- adaptation, transformation, and production of derivative artifacts such as embeddings, summaries, source spans, and graph nodes;
- commercial development, licensing, and deployment of the workbench software by Novara; and
- any restrictions on redistribution, public display, or integration with external services.

**Why it matters**: public availability of a document does not grant embedding, summarization, redistribution, or commercial use rights. GURU's handbook notes a Creative Commons non-commercial licence for public CPGs. Novara cannot assume broader rights. Every resource must have a recorded permission status before processing begins. See [`docs/security-privacy-license.md`](../../docs/security-privacy-license.md), section "Public URL does not grant rights."

**Requested permission scope**: a written, authority-signed permission matrix to be recorded in the resource registry.

---

## How resources will be governed

Each delivered resource will receive a registry row in the format defined by [`docs/resource-registry.md`](../../docs/resource-registry.md). The row will include:

- resource identifier, title, source owner, and access path;
- licence status and allowed-use list;
- whether permission is required and the current permission status;
- a storage decision such as `link-only`, `metadata-only`, `local raw archive`, `Git LFS`, `object storage`, or `prohibited`; and
- a checksum for any retained raw file.

Until explicit permission is recorded, unknown or restrictive resources will remain `metadata-only` or `link-only`. No embedding, summarization, graph extraction, or redistribution will proceed without an approved registry entry.

## What will not happen during discovery

- No real patient records or protected health information will be requested, stored, or processed.
- No patient-specific treatment advice will be generated.
- No clinical claim will be made without a cited source span.
- No resource will be sent to an external LLM API by default.
- No resource will be treated as approved for ingestion or commercial use until the permission status is explicitly recorded.

## Next step

CCA GURU's response to this package, including any items that cannot be shared and the conditions for sharing others, will shape the scoping and pilot plan. Novara will update the resource registry and this proposal accordingly.

## References

- [`docs/gpt5.5pro_6_15.md`](../../docs/gpt5.5pro_6_15.md), section "4. Recommended first product strategy / Phase 0: discovery and resource access"
- [`docs/resource-registry.md`](../../docs/resource-registry.md)
- [`docs/security-privacy-license.md`](../../docs/security-privacy-license.md)
- [`docs/resource-storage-policy.md`](../../docs/resource-storage-policy.md)
- [`AGENTS.md`](../../AGENTS.md)
- [`docs/CONTEXT.md`](../../docs/CONTEXT.md)
