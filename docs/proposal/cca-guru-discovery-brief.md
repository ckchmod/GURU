# CCA GURU Guideline Graph Workbench — Discovery Brief

**Status**: draft proposal  
**Prepared by**: Novara  
**Audience**: CCA GURU leadership, Provincial Tumour Team leads, and guideline methodology stakeholders  
**Purpose**: position a potential collaboration and request the resources needed to scope it responsibly

---

## What Novara proposes to explore

Novara would like to explore a collaboration with CCA GURU to build a **governed, human-in-the-loop guideline lifecycle workbench**, not a generic chatbot over PDFs. The goal is to strengthen how GURU develops, updates, and implements cancer care guidelines, while leaving clinical authority and final decisions with GURU's experts and governance bodies.

The proposed workbench treats guidelines as structured, provenance-backed graphs. Recommendations, evidence items, PICO questions, funding rules, and workflow decisions become linked nodes with source spans and approval states. This lets a methodologist or reviewer click any generated claim and jump to the exact guideline paragraph, evidence table row, or study result that supports it.

This framing comes directly from the source assessment in [`docs/gpt5.5pro_6_15.md`](../../docs/gpt5.5pro_6_15.md). That assessment argues the durable opportunity is a guideline-development operating system, covering evidence surveillance, systematic-review acceleration, evidence-table generation, recommendation drafting support, consensus workflow, versioning, Alberta-local context overlays, and eventually computable guideline outputs.

## What this is not

- It is not "ChatGPT for cancer guidelines."
- It is not a generic RAG chatbot that retrieves chunks from PDFs without provenance.
- It is not a model trained from scratch on guideline text.
- It is not a source of patient-specific treatment advice or dosing recommendations.
- It does not replace GURU methodologists, working groups, Provincial Tumour Teams, or approval chains.

The source assessment explicitly warns against positioning the product as a "nanoGPT trained on PDFs" or a "Karpathy-style second brain." The moat is not the model. The moat is CCA-specific evidence provenance, historical decision data, Alberta-local implementation context, expert workflow integration, update surveillance, and computable guideline structure.

## Guiding principles

1. **Graph-first, retrieval-backed, bounded-agent-assisted.** The graph is the central data model, not just a visualization. The LLM terminal is an operator and drafter attached to that graph.
2. **Source-span provenance for every claim.** No source means no claim. Draft status is not approved status.
3. **Human review at every gate that matters.** The system can propose, draft, and flag. It cannot publish recommendations, overwrite approved guidelines, or move content from draft to approved without human action.
4. **Permission-gated ingestion.** Public URLs do not grant embedding, summarization, redistribution, or commercial use rights. Every resource is catalogued in a registry with license status, allowed use, permission status, and storage decision before any processing begins.
5. **No PHI and no patient-specific advice.** The workbench supports guideline maintenance. It does not process real patient records or give treatment advice for individual patients.
6. **Local-first model gateway.** External LLM APIs are off by default. The default path is local or customer-owned open-weight inference, with quota, cache, trace, and cost-ledger controls.

These principles are encoded in [`AGENTS.md`](../../AGENTS.md), [`docs/CONTEXT.md`](../../docs/CONTEXT.md), [`docs/security-privacy-license.md`](../../docs/security-privacy-license.md), and [`docs/resource-storage-policy.md`](../../docs/resource-storage-policy.md).

## Why a lifecycle workbench instead of a chatbot

GURU's handbook describes an average CPG development timeline of 18–24 months, with a workflow that includes PICO scoping, systematic review, evidence tables, recommendation drafting, provincial review, consensus, approval, publication, and maintenance. The real workload is not "what does the guideline say?" It is:

- identifying topics and formulating PICOs;
- searching and screening studies;
- building evidence tables and rating evidence quality;
- drafting recommendations and grading strength;
- routing drafts through working group, PTT, and stakeholder review;
- tracking conflicts of interest and consensus;
- publishing and versioning; and
- monitoring for updates and deciding full update, partial update, no update, or archive.

A chatbot can answer retrieval questions. A workbench can help GURU compress and govern that full lifecycle.

## Immediate next step: a structured resource request

Before any build phase, Novara needs to map GURU's current resource universe, permissions, methodology, templates, evidence tables, historical updates, and approval workflow. The companion document [`resource-request-package.md`](./resource-request-package.md) lists the specific resources we are asking CCA GURU to make available for discovery scoping.

## Commercial and permission boundaries

This brief is a draft proposal. It does not state or imply that a partnership has been approved, that access has been granted, or that any license terms are already resolved. All permissions for ingestion, adaptation, commercial development, and deployment must be negotiated and recorded separately in the resource registry before any restricted content is processed.

GURU's handbook notes that CPGs and supporting documents are publicly shared under a Creative Commons licence for non-commercial copy/distribution with attribution and other terms. Because Novara is a company, that licence cannot be treated as permission to ingest, embed, summarize, adapt, or commercialize GURU content. Explicit collaboration terms are required.

## Relationship to engineering work

Engineering governance lives in `docs/`, `docs/adr/`, and `AGENTS.md`. This proposal lives in `docs/proposal/` and is kept separate from engineering rules. Task 13 of the implementation plan will reconcile these proposal artifacts with the engineering docs so that both point to the same resource registry and safety principles.

## Sources and references

- [`docs/gpt5.5pro_6_15.md`](../../docs/gpt5.5pro_6_15.md), sections "2. What Novara should build", "4. Recommended first product strategy", and "7. Immediate positioning to CCA GURU"
- [`docs/resource-registry.md`](../../docs/resource-registry.md)
- [`docs/security-privacy-license.md`](../../docs/security-privacy-license.md)
- [`docs/resource-storage-policy.md`](../../docs/resource-storage-policy.md)
- [`AGENTS.md`](../../AGENTS.md)
- [`docs/CONTEXT.md`](../../docs/CONTEXT.md)
