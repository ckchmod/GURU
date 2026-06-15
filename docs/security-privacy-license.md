# Security, Privacy, and Licensing Gates

This document defines the compliance gates that every resource must pass before it is stored, processed, or referenced by the CCA GURU Guideline Graph Workbench. It is an engineering policy, not legal advice. When in doubt, escalate to a human reviewer with appropriate authority.

## Scope

These gates apply to all resources that enter the repository, registry, prompts, evaluation harness, or any derived artifact, including:

- Public AHS, CCA, and GURU documents.
- Internal GURU documents and draft guidelines.
- External guideline bodies (e.g., NCCN, ASCO, ESMO, SIGN, NICE).
- Licensed databases, journals, and abstract services.
- Trial registries and clinical-study reporting systems.
- Privacy, regulatory, and legislative resources.
- Computable standards, terminologies, and value sets (e.g., SNOMED CT, LOINC, ICD-O, HL7 FHIR, CQL).

## Clinical safety boundaries

### No PHI

No protected health information, patient identifiers, or patient-specific data may enter code, fixtures, logs, prompts, evaluations, resource archives, evidence files, or commit messages. This includes synthetic data that resembles real patient records. Use only explicitly approved synthetic vignettes for tests and evaluation.

### No patient-specific advice

The project builds tools that support guideline maintenance and exploration. Agents and components must not generate patient-specific treatment advice, dosing recommendations, or diagnostic conclusions.

### No clinical claims without source spans

Every clinical statement, guideline summary, recommendation draft, or extraction must include a source span: document identifier, section, and quoted text or stable locator. No source means no claim. Draft status is not approved status.

## Licensing and allowed-use gates

### Public URL does not grant rights

A public URL does not imply any right to embed, summarize, redistribute, commercially reuse, or create derivative works from the referenced material. Each resource must be evaluated on its own terms of use, license, and access conditions.

### Derivative processing requires allowed-use review

Embeddings, summaries, source spans, graph nodes, extracted fields, and any other transformed representations are derivative processing. They require the same allowed-use review as storing or redistributing the raw resource. The fact that a resource is readable online does not automatically permit processing it through models, indexers, or graph builders.

### Unknown or restrictive license status

If a resource's license or allowed-use terms are unknown, unclear, or more restrictive than the project's intended use, the default gate is:

- **metadata-only or link-only** storage until explicit permission is granted; or
- **Prohibited** if the source explicitly forbids scraping, redistribution, derivative works, or model training.

No embedding, summarization, transformation, or raw archival may proceed until the license is confirmed and recorded in the resource registry.

## Resource category gates

### Public AHS, CCA, and GURU documents

- Verify the document is published for public access.
- Confirm whether AHS/CCA reuse, redistribution, or derivative-use terms apply.
- Prefer link-only or metadata-only until explicit reuse terms are recorded.
- Do not assume that internally authored content is unrestricted for external models or public repositories.

### Internal GURU documents

- Treat as restricted by default.
- Require documented approval from the GURU steward or delegate before any raw archive, embedding, or summarization.
- Store only metadata and access links until approval is recorded.

### External guideline bodies

- Check publisher terms of use, copyright notices, and any member-only access restrictions.
- Many guideline organizations permit personal or internal use but prohibit redistribution, scraping, or commercial use.
- Default to link-only or metadata-only unless the registry records explicit permission or an applicable open license.

### Licensed databases and journals

- Require an active institutional or organizational license.
- Prohibited from raw archival in the repository unless the license explicitly permits it.
- Derivative processing is generally limited to what the license and any subscription terms allow.
- Record license scope, expiration, and permitted uses in the registry.

### Trial registries

- Public registries generally permit linking and citation.
- Bulk download, scraping, or redistribution may be restricted by registry policy.
- Default to link-only and metadata-only; record terms in the registry.

### Privacy, regulatory, and legislative resources

- Statutes, regulations, and agency guidance are often public but may carry redistribution terms.
- Privacy laws and regulatory interpretations may contain sensitive analysis.
- Prefer link-only and cite the authoritative source; archive raw text only when explicitly permitted.

### Computable standards and terminologies

- Each standard has its own license, subscription, or national distribution terms (e.g., SNOMED CT affiliates, LOINC copyright, ICD licensing by WHO/CIHI).
- Do not redistribute code systems, value sets, or mapping files without confirming license terms.
- Link to the authoritative source or use approved APIs; record license conditions in the registry.

## Model usage and external routing gate

### No external LLM API by default

Do not route prompts, documents, or embeddings to external large language model APIs by default. Local, open-weight, or explicitly approved private deployments are the default.

### No restricted content sent externally without approval

No restricted, licensed, internal, or privacy-sensitive content may be sent to an external service without explicit documented approval and a per-use gate. Approval must record the service, the content, the purpose, the reviewer, and the date.

### Per-use gate

Any external routing requires:

1. A documented business or technical justification.
2. Confirmation that the target service's terms and data handling meet project requirements.
3. Approval by a human with authority to accept the risk.
4. Logging of the request, the content class, and the outcome.

## Approval and escalation

- Agents cannot approve restricted-source use.
- When a resource's status is unclear, stop and escalate to a human reviewer.
- Record the decision, the reviewer, the date, and the basis in the resource registry.

## Consequences of non-compliance

A resource that fails any gate in this document must be treated as prohibited or limited to metadata-only / link-only storage until the gate is satisfied. No ingestion, embedding, summarization, graph extraction, or redistribution may proceed until then.

## References

- `AGENTS.md`
- `docs/CONTEXT.md`
- `docs/adr/ADR-0001-project-principles.md`
- `docs/resource-storage-policy.md`
