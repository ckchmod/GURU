"CCA GURU is open to collaborating on cancer guideline development using AI/LLM tools. Interested to explore this? (Last I heard, OttoSR is advancing quickly into this space, but there's no reason you can't do better!)"

Our company Novara has been approached with the following. above

First,  we need to gather every single, all possible resources we would need. 

So second, in the future, either we build some RAG, or nano GPT or Karpathy second brain, whatever may be useful for CCA GURU. I don't know what the best thing to do is I need deciding on how to approach this. So I would need help on deciding this as well. We are trying to build something great/competitive, not something that can be easily vibe coded, obvious

https://www.albertahealthservices.ca/cancer/page1731.aspx

## My read

Yes, Novara should explore this, but **not as “let’s build a RAG chatbot over cancer PDFs.”** That would be easy to copy.

The stronger opportunity is to build a **guideline-development operating system** for CCA GURU: evidence surveillance, systematic-review acceleration, evidence-table generation, recommendation drafting support, consensus workflow, guideline versioning, Alberta-local funding/context overlays, and eventually computable guideline outputs.

GURU’s own process makes this clear. Their handbook says GURU supports development, implementation, and evaluation of CPGs, clinical pathways, follow-up letters, and supporting materials for Cancer Care Alberta, and coordinates annual multidisciplinary meetings for each Provincial Tumour Team. It also says GURU supports **13 Provincial Tumour Teams** across Alberta. ([Alberta Health Services][1]) Their average CPG development timeline is **18–24 months**, with a workflow involving PICO scoping, systematic review, evidence tables, recommendation drafting, provincial review, consensus, approval, publication, and maintenance. ([Alberta Health Services][1])

The pitch should be: **Novara can help CCA GURU compress and govern the cancer guideline lifecycle, not merely retrieve answers from guidelines.**

---

## 1. Resource universe to gather first

Think of this as a **resource registry + permissions matrix**. Every resource should be tracked by source owner, access method, licence/permissions, update cadence, evidence type, cancer site, date/version, and whether it is approved, draft, archived, or superseded.

### A. CCA / GURU internal source-of-truth resources

These are the most important, because they create the proprietary advantage.

You need all public and internal GURU materials:

| Resource                                                                           | Why it matters                                                                                                                                                  |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All current GURU guideline PDFs                                                    | Baseline approved recommendations.                                                                                                                              |
| All evidence tables                                                                | Needed to reconstruct recommendation provenance.                                                                                                                |
| All algorithms, pathways, summaries, physician letters, patient letters            | GURU does more than guidelines; implementation assets are central.                                                                                              |
| GURU Guideline Methodology Handbook                                                | Defines the current workflow, roles, rating system, consensus model, and update process.                                                                        |
| Detailed literature-search process document                                        | The handbook says a detailed process document describing resources used for literature search is available from GURU on request. ([Alberta Health Services][1]) |
| Annual Provincial Tumour Team meeting manuals, agendas, minutes, decisions         | The handbook says a detailed manual for annual PTT meeting timelines/admin tasks is available from GURU on request. ([Alberta Health Services][1])              |
| Draft guideline templates and style guides                                         | Needed for faithful AI drafting.                                                                                                                                |
| Evidence-table templates                                                           | Needed for extraction and structured outputs.                                                                                                                   |
| COI forms and COI management rules                                                 | GURU requires contributors to disclose conflicts using standard ICMJE forms and describes COI handling in final documents. ([Alberta Health Services][1])       |
| Consensus survey templates and historical Delphi outputs                           | Needed to automate review cycles.                                                                                                                               |
| Historical guideline versions and archived documents                               | Needed for change detection and retrospective benchmarking.                                                                                                     |
| Historical search strategies, inclusion/exclusion criteria, excluded-study reasons | Needed to validate AI screening and update triage.                                                                                                              |
| Working group comments and redlines                                                | Goldmine for learning what experts accept/reject.                                                                                                               |
| Prior “full update / partial update / no update / archived” decisions              | GURU already uses these update categories; they are ideal labels for an AI update-triage model. ([Alberta Health Services][1])                                  |
| Tumour Team membership, roles, approval chains                                     | Needed for workflow routing and governance.                                                                                                                     |

Important licensing point: GURU’s handbook says CPGs and supporting documents are publicly shared under a Creative Commons licence for **non-commercial** copy/distribution with attribution, no adaptation, and other terms. ([Alberta Health Services][1]) Since Novara is a company, this cannot be treated as “free to ingest and commercialize.” You need explicit collaboration/permission terms from CCA/GURU before using, adapting, embedding, or redistributing their content.

### B. Public CCA/GURU guideline corpus

The AHS GURU page already contains a large disease-site corpus: transplant/BMT, breast, CNS, cutaneous, GI, GU, gynecologic, head and neck, hematology/lymphoma, lung, neuroendocrine, palliative/supportive care, pediatric oncology, special topics, sarcoma, symptom management, and thyroid. ([Alberta Health Services][2])

This public corpus should be crawled into a structured register with:

| Metadata field                                              | Why                                                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Title                                                       | Identification.                                                                    |
| Disease site / tumour team                                  | Routing and retrieval.                                                             |
| Document type                                               | Guideline, evidence table, algorithm, summary, patient letter, physician letter.   |
| Version / effective date / last reviewed date               | Currency.                                                                          |
| Page count / sections / recommendations                     | Parsing and downstream chunking.                                                   |
| Recommendation statements                                   | Core knowledge object.                                                             |
| Level of evidence and strength grade                        | GURU uses levels I–V and recommendation grades A–E. ([Alberta Health Services][1]) |
| Drug names, biomarkers, staging terms, tests, interventions | Ontology mapping.                                                                  |
| Local funding constraints                                   | Alberta-local differentiation.                                                     |
| Cited studies and guidelines                                | Evidence graph.                                                                    |
| Related CCA implementation assets                           | Pathways, letters, summaries, algorithms.                                          |

### C. Alberta-local operational and funding resources

This is where Novara can beat generic systematic-review tools.

| Resource                                                                  | Why                                                                                                                                            |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Outpatient Cancer Drug Benefit Program Master List                        | GURU states cancer drugs in guidelines are funded according to this program unless stated otherwise. ([Alberta Health Services][2])            |
| Alberta Cancer Clinical Trials / ACCT trial finder                        | The trial finder is updated monthly and aims to capture most active recruiting cancer trials in Alberta. ([Alberta Cancer Clinical Trials][3]) |
| Alberta Referral Pathways                                                 | Connects guideline recommendations to actual care pathways.                                                                                    |
| Local molecular/pathology testing availability                            | Critical for precision oncology recommendations.                                                                                               |
| Local formulary, exceptional access, compassionate access, drug shortages | Determines implementability.                                                                                                                   |
| Local radiation, surgical, systemic therapy protocols                     | Needed for pathway-level outputs.                                                                                                              |
| Alberta Cancer Registry / real-world outcomes data                        | Later-stage evaluation and guideline uptake analytics.                                                                                         |
| Local EMR/oncology information system exports, if permitted               | For implementation and adoption monitoring.                                                                                                    |
| Quality improvement audits and chart audits                               | GURU already lists chart audits/QI projects as implementation strategies. ([Alberta Health Services][1])                                       |

### D. External cancer guideline corpora

You need these for adaptation, comparison, and gap analysis.

| Source family                      | Examples                                                                                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Oncology societies                 | ASCO, ESMO, NCCN, ASTRO, SSO, ASH, MASCC.                                                                                                    |
| Canadian guideline bodies          | Ontario Health / Cancer Care Ontario PEBC, BC Cancer, Saskatchewan Cancer Agency, Cancer Care Manitoba, Canadian Partnership Against Cancer. |
| International HTA/guideline bodies | NICE, ECRI Guidelines Trust, WHO, SIGN.                                                                                                      |
| Patient-facing guideline resources | Canadian Cancer Society, ASCO patient materials, NCCN patient guidelines where licensed.                                                     |

ASCO is already relevant competitively: ASCO has an **AI-powered Guidelines Assistant** for members, developed with Google Cloud. ([ASCO][4]) ESMO openly publishes its guideline methodology. ([ESMO][5]) Ontario Health’s PEBC is a major Canadian cancer guideline program, with handbook, conflict-of-interest policy, assessment/review protocol, and guideline development process resources. ([Cancer Care Ontario][6])

NCCN must be handled carefully. NCCN content has permission/licensing constraints; their disclaimer says organizations wanting to use, copy, or distribute NCCN content should use the NCCN permissions process. ([JNCCN 360][7])

### E. Systematic review and evidence databases

You need both search sources and full-text access.

| Resource type                  | Examples                                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Bibliographic databases        | MEDLINE/PubMed, Embase, Cochrane CENTRAL, CINAHL, PsycINFO for supportive care, Web of Science/Scopus depending on licence. |
| Systematic-review databases    | Cochrane Database of Systematic Reviews, Epistemonikos.                                                                     |
| Trial registries               | ClinicalTrials.gov, WHO ICTRP, EU Clinical Trials Register, ISRCTN.                                                         |
| Preprints                      | medRxiv, bioRxiv, SSRN where appropriate and clearly marked as non-peer-reviewed.                                           |
| Conference abstracts           | ASCO, ESMO, ASTRO, ASH, SABCS, AACR.                                                                                        |
| Retraction / integrity sources | Retraction Watch, PubPeer, journal expressions of concern.                                                                  |
| DOI / metadata APIs            | Crossref, OpenAlex, PubMed E-utilities, Europe PMC, Unpaywall.                                                              |
| Full-text access               | Institutional library subscriptions, publisher APIs, document-delivery workflow.                                            |

The Cochrane Handbook remains a core methods source; it covers planning, searching, selecting studies, data collection, risk of bias, statistical analysis, GRADE, interpreting results, and specialized topics such as adverse effects, equity, economics, and patient-reported outcomes. ([Cochrane][8])

### F. Guideline-methodology standards

These are not optional; they become the quality-control checklist for the product.

| Standard / framework                                | Use                                                                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| GRADE / GRADE Evidence-to-Decision                  | Certainty of evidence and recommendation formation. GRADE says its framework helps panels move from evidence to recommendations. ([GRADEpro][9]) |
| PRISMA 2020                                         | Reporting systematic reviews; includes checklist, expanded checklist, abstract checklist, and flow diagrams. ([PRISMA statement][10])            |
| Cochrane Handbook                                   | Systematic-review methods.                                                                                                                       |
| AGREE II                                            | Appraisal of methodological quality of clinical practice guidelines; 23 items across six domains. ([NCCMT][11])                                  |
| RIGHT Statement                                     | Reporting tool for practice guidelines; 22 essential reporting items. ([Right Statement][12])                                                    |
| NAM/IOM “Clinical Practice Guidelines We Can Trust” | Trustworthy guideline standards: transparency, COI, systematic-review foundation, evidence grading, external review, updating. ([PubMed][13])    |
| GIN COI principles                                  | Disclosure and management of conflicts in guidelines. ([PubMed][14])                                                                             |
| NICE guideline manual                               | Benchmark for mature guideline-development/update methods. ([NICE][15])                                                                          |
| ASCO / ESMO / PEBC methods                          | Oncology-specific methodology benchmarks.                                                                                                        |

### G. Regulatory, privacy, and clinical-safety resources

Start with a **non-patient-specific guideline development tool** to reduce regulatory burden. Once the system gives patient-specific recommendations or integrates into care workflows, regulatory and privacy obligations become much more serious.

| Area                | Resource                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Canadian SaMD rules | Health Canada’s SaMD guidance clarifies how software fits into the medical-device framework. ([Canada][16])                           |
| ML medical devices  | Health Canada’s 2026 ML-enabled medical device guidance applies to Class II–IV MLMD submissions. ([Canada][17])                       |
| CDS regulation      | FDA’s CDS software guidance clarifies when CDS may fall within or outside device oversight. ([U.S. Food and Drug Administration][18]) |
| Alberta privacy     | Alberta’s Health Information Act governs access, collection, use, and disclosure of health information. ([Alberta.ca][19])            |
| Security            | ISO 27001/SOC 2 controls, audit logging, encryption, access control, data residency, vendor risk review.                              |
| Clinical safety     | Human-in-the-loop review, safety case, abstention behaviour, incident review, version lock, auditability.                             |

### H. Interoperability and computable-guideline standards

This is the long-term defensible layer.

| Standard                                            | Why                                                                                                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| HL7 FHIR Clinical Practice Guidelines / CPG-on-FHIR | Supports standards-based computable representations of clinical care guidelines. ([FHIR Builder][20])                                                |
| CDS Hooks                                           | Provides a hook-based pattern for invoking decision support inside clinician workflows. ([CDS Hooks][21])                                            |
| SMART on FHIR                                       | Lets apps launch inside or outside EHR workflows and connect to FHIR data. ([FHIR Builder][22])                                                      |
| OMOP CDM / OMOP Oncology                            | Useful for real-world evidence and oncology data standardization; OHDSI describes OMOP CDM as an open standard for observational data. ([OHDSI][23]) |
| Terminologies                                       | SNOMED CT, LOINC, ICD-10-CA, ICD-O, AJCC TNM, NCIt, RxNorm/ATC, HGVS, HPO.                                                                           |

---

## 2. What Novara should build

### Do not build “nanoGPT” or train a model from scratch

That would be the wrong first move. Cancer guideline development does not need a tiny language model trained from scratch. It needs **trusted evidence handling, provenance, workflow, structured data, and governance**. Training from scratch creates cost, validation burden, and worse medical reliability.

### Do not rely on pure RAG either

A basic RAG system can answer: “What does the current CCA guideline say about X?”

That is useful, but it is not enough. GURU’s real workload is:

1. identify topics;
2. formulate PICO questions;
3. search guidelines and primary evidence;
4. screen studies;
5. build evidence tables;
6. rate evidence quality;
7. draft recommendations;
8. grade recommendation strength;
9. run expert/patient/stakeholder review;
10. handle consensus;
11. publish;
12. monitor for updates;
13. decide full update, partial update, no update, or archive.

GURU’s handbook explicitly describes this lifecycle. ([Alberta Health Services][1])

### Build a guideline lifecycle platform

The winning architecture is:

**RAG + structured evidence graph + agentic review workflows + human-in-the-loop governance + computable guideline outputs.**

A simple name for it:

> **Guideline Intelligence Workbench for CCA GURU**

Core modules:

| Module                                    | What it does                                                                                                                       | Why it is defensible                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Resource registry                         | Crawls/indexes all CCA, GURU, Alberta, external guideline, evidence, funding, trial, and regulatory resources.                     | Creates source-of-truth discipline.     |
| Guideline-aware RAG                       | Answers questions only from approved guidelines, with citation, date, version, and confidence.                                     | Useful baseline, but not the moat.      |
| Evidence surveillance agent               | Monitors PubMed, Embase, Cochrane, trial registries, conferences, Health Canada, CDA-AMC/pCODR, ASCO/ESMO/NCCN/PEBC updates.       | Finds practice-changing evidence early. |
| PICO builder                              | Helps working groups formulate PICO/PICOTS questions and scope.                                                                    | Aligns with GURU’s process.             |
| Screening workbench                       | Title/abstract/full-text screening with inclusion/exclusion rationale and human adjudication.                                      | Direct time saver.                      |
| Extraction workbench                      | Extracts trial design, population, interventions, comparators, outcomes, adverse events, subgroup results, limitations.            | Produces evidence tables.               |
| Risk-of-bias / evidence quality assistant | Supports RoB, certainty, and GURU evidence-level mapping.                                                                          | Quality-control layer.                  |
| Recommendation drafting assistant         | Drafts recommendation language, rationale, implementation considerations, local context, and uncertainty notes.                    | Helps but does not replace experts.     |
| Guideline diff engine                     | Compares old vs new evidence/guidelines and flags impacted recommendations.                                                        | Major differentiator.                   |
| Consensus workflow                        | Routes drafts to working group, PTT, patient reps, operational leads; tracks comments, agreement, COI, and approvals.              | Mirrors GURU’s real process.            |
| Alberta-local overlay                     | Adds drug funding, referral, trial availability, testing availability, and implementation constraints.                             | Generic AI tools will not have this.    |
| Computable guideline compiler             | Converts approved recommendations into decision graphs, pathways, test cases, and eventually FHIR/CDS artifacts.                   | Harder to vibe-code; high moat.         |
| Evaluation dashboard                      | Tracks recall, extraction accuracy, citation fidelity, time saved, update latency, AGREE/RIGHT completeness, clinician acceptance. | Makes the system credible.              |

---

## 3. How to beat or out-position OttoSR

OttoSR is real competition for the systematic-review layer. Its public site says it supports evidence synthesis from thousands of citations, has human-in-the-loop review, claims peer-reviewed performance, searches metadata for over 500 million research articles, screens abstracts/full texts, supports multilingual review, and integrates Retraction Watch. ([otto-SR][24]) Nature also covered the 2025 otto-SR work but cautioned that, although LLMs can accelerate systematic reviews, a fully automated system is still some way off. ([Nature][25])

So the move is **not** “let’s build a cheaper OttoSR clone.”

The move is:

> Use systematic-review automation as one layer, then build the cancer-guideline-specific system around it.

Novara can do better for CCA GURU by focusing on things OttoSR likely does not fully own:

1. **Alberta-local cancer context**: funded drugs, local eligibility, referral pathways, trials, testing access, implementation constraints.
2. **Guideline update triage**: “Does this new evidence require full update, partial update, no update, or archive?”
3. **Recommendation-impact mapping**: “Which specific recommendation, pathway, algorithm, patient letter, and drug-funding note changes because of this study?”
4. **Consensus workflow**: working group review, PTT review, Delphi-style feedback, COI tracking, approval, publication.
5. **Computable oncology pathways**: structured pathway graphs, executable test cases, eventual FHIR/CDS Hooks/SMART-on-FHIR integration.
6. **Historical GURU learning set**: previous updates, evidence tables, comments, decisions, and final language become a proprietary evaluation and training corpus.
7. **Approved vs draft content separation**: clinicians can query approved guidelines, while methodologists can work with draft/internal evidence separately.
8. **Safety and auditability**: every generated statement tied to source, page, evidence grade, version, reviewer, and approval state.

If OttoSR is excellent, Novara can still win by **integrating or benchmarking against it** for systematic-review tasks while owning the higher-value guideline lifecycle layer.

---

## 4. Recommended first product strategy

### Phase 0: discovery and resource access

Ask CCA GURU for a structured resource package:

1. the current GURU handbook and all templates;
2. the internal detailed literature-search process document;
3. the annual PTT meeting/admin manual;
4. a complete export of current and archived guideline documents;
5. evidence tables, search strategies, and excluded-study reasons;
6. two historical guideline update projects with all intermediate artifacts;
7. one upcoming guideline update topic;
8. COI process/templates;
9. consensus survey examples;
10. publication/versioning process;
11. drug funding and local implementation data sources;
12. permission terms for ingestion, adaptation, commercial development, and deployment.

### Phase 1: build the resource registry and approved-guideline RAG

Deliverable: a secure, cited, versioned CCA GURU knowledge base.

Capabilities:

* search all approved GURU guideline documents;
* answer with citations and document version/date;
* detect outdated or archived material;
* separate approved public content from internal draft content;
* produce a resource inventory spreadsheet/database.

This is necessary, but not the endpoint.

### Phase 2: retrospective update benchmark

Pick two historical guideline updates:

* one fast-moving systemic therapy area, such as lung cancer driver mutation guidance;
* one supportive-care or surveillance topic, where evidence and implementation issues differ.

Run the system as if it were in the past:

* Can it find the same new evidence GURU found?
* Does it find additional relevant evidence?
* Can it classify included/excluded studies correctly?
* Can it extract evidence-table fields accurately?
* Can it predict whether the guideline needed full update, partial update, no update, or archive?
* Can experts trust the source trace?

This creates a benchmark that is more convincing than a demo chatbot.

### Phase 3: evidence-table and recommendation-drafting workbench

Build a UI for methodologists:

* upload/import citations;
* screen with AI suggestions;
* adjudicate disagreements;
* extract structured trial data;
* generate evidence tables;
* map evidence to GURU’s levels I–V and recommendation grades A–E;
* draft recommendation language;
* export to Word/PDF/template format;
* show every source and uncertainty.

### Phase 4: guideline-diff and evidence-surveillance engine

This is the “great/competitive” feature.

For each guideline, maintain watchers:

* new RCTs;
* meta-analyses;
* drug approvals;
* CDA-AMC/pCODR reimbursement recommendations;
* Health Canada NOCs;
* ASCO/ESMO/NCCN/PEBC updates;
* trial results;
* retractions;
* safety warnings.

Then produce:

> “This new evidence may affect Recommendation 4.2 in the metastatic colorectal cancer guideline, the panitumumab/cetuximab toxicity resource, and the funded-drug note. Suggested action: partial update. Reason: new phase III evidence in population X; current recommendation cites older trial Y.”

### Phase 5: computable guideline compiler

Only after the evidence lifecycle works.

Take selected approved algorithms and convert them into:

* decision graphs;
* pathway nodes;
* eligibility criteria;
* contraindication checks;
* implementation notes;
* test patient vignettes;
* FHIR/CPG-on-FHIR artifacts where appropriate;
* CDS Hooks/SMART-on-FHIR integration later.

This should remain non-autonomous and clinician-facing only after strong validation.

---

## 5. Technical architecture

Use a model-agnostic architecture.

### Core layers

1. **Document ingestion**

   * PDFs, Word docs, HTML pages, tables, algorithms, letters.
   * OCR only where needed.
   * Extract title, version, date, recommendations, tables, citations, appendices.

2. **Evidence graph**

   * Nodes: guideline, recommendation, study, outcome, drug, biomarker, cancer site, stage, population, intervention, comparator, adverse event, funding rule, trial.
   * Edges: “supports,” “contradicts,” “updates,” “cites,” “supersedes,” “applies to,” “funded under,” “requires test.”

3. **Hybrid retrieval**

   * Keyword + vector retrieval + reranking.
   * Return exact source passages.
   * Prefer structured recommendation nodes over raw chunks.

4. **Agentic workflows**

   * Search strategy generation.
   * Screening.
   * Full-text review.
   * Extraction.
   * Evidence grading support.
   * Drafting.
   * Diffing.
   * Update triage.

5. **Human review**

   * Methodologist must approve screening/extraction.
   * Working group must approve recommendations.
   * Tumour Team Lead/Executive approval remains unchanged.

6. **Audit and compliance**

   * Every answer, draft, and extraction has source, prompt/model version, reviewer, timestamp, and status.
   * No source = no claim.
   * Draft ≠ approved.

7. **Evaluation harness**

   * Retrospective update benchmarks.
   * Gold-labeled screening sets.
   * Expert-adjudicated extraction sets.
   * Guideline QA test bank.
   * Clinical vignettes for computable pathways.
   * Red-team hallucination tests.

### Model choices

Use foundation models through secure APIs or private deployment. Fine-tune only after you have task-specific labels.

| Technique                     | Recommendation                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------- |
| Pure RAG                      | Required baseline, not enough.                                                  |
| Fine-tuning                   | Useful later for screening, extraction, tagging, and style consistency.         |
| Training nanoGPT/from scratch | Not recommended for product.                                                    |
| “Second brain”                | Useful internally for meeting notes and decision memory, not enough as product. |
| Knowledge graph               | Strongly recommended.                                                           |
| Agentic workflow              | Strongly recommended, but bounded and auditable.                                |
| Rules engine                  | Essential for computable pathways and guideline logic.                          |

---

## 6. What the first pilot should be

I would propose a **12-week pilot**.

### Pilot goal

Show CCA GURU that Novara can reduce methodologist burden and improve update awareness without compromising rigour.

### Pilot scope

Two guideline topics:

1. **one fast-moving systemic therapy guideline**;
2. **one supportive care / surveillance / symptom management guideline**.

### Pilot outputs

By week 12:

1. resource registry for selected guideline areas;
2. approved-guideline Q&A with citations;
3. evidence surveillance dashboard;
4. AI-assisted screening workflow;
5. AI-generated evidence table draft;
6. recommendation-impact diff;
7. update-triage memo: full update vs partial update vs no update;
8. expert review interface;
9. evaluation report comparing AI output to historical GURU decisions.

### Pilot metrics

| Metric                         | Why                                                     |
| ------------------------------ | ------------------------------------------------------- |
| Recall of included studies     | Missing important evidence is the biggest failure mode. |
| Exclusion rationale accuracy   | Needed for auditability.                                |
| Data-extraction field accuracy | Evidence tables must be reliable.                       |
| Citation fidelity              | Every claim must trace to source.                       |
| Time saved                     | Business value.                                         |
| Expert acceptance rate         | Product-market fit.                                     |
| Recommendation-impact accuracy | Core differentiation.                                   |
| AGREE II / RIGHT completeness  | Guideline quality alignment.                            |

---

## 7. Immediate positioning to CCA GURU

I would respond with something like:

> Novara would be very interested. We would not frame this as a generic chatbot over guidelines. The bigger opportunity is a governed, human-in-the-loop guideline-development workbench: evidence surveillance, systematic-review acceleration, evidence-table generation, recommendation-update triage, consensus workflow, and eventually computable guideline pathways.
>
> To scope this responsibly, we would like to start by mapping GURU’s current resource universe, permissions, methodology, templates, evidence tables, historical updates, and approval workflow. Then we can run a retrospective pilot on one or two prior guideline updates to quantify recall, extraction accuracy, update-triage quality, citation fidelity, and methodologist time saved.
>
> Our goal would be to strengthen GURU’s existing process, not replace expert judgment.

---

## Bottom-line recommendation

Novara should pursue this, but the product should be:

> **A cancer guideline lifecycle platform for GURU, powered by LLMs, evidence graphs, structured review workflows, and human governance.**

Not:

> “ChatGPT for cancer guidelines.”

Not:

> “nanoGPT trained on PDFs.”

Not:

> “a Karpathy-style second brain.”

The moat is not the model. The moat is **CCA-specific evidence provenance, historical decision data, Alberta-local implementation context, expert workflow integration, update surveillance, and computable guideline structure**.

[1]: https://www.albertahealthservices.ca/assets/info/hp/cancer/if-hp-cancer-guide-utilization-handbook.pdf?utm_source=chatgpt.com "GURU Handbook"
[2]: https://www.albertahealthservices.ca/cancer/page1731.aspx?utm_source=chatgpt.com "Cancer Guidelines | Alberta Health Services"
[3]: https://albertacancerclinicaltrials.ca/patients/find-a-clinical-trial/?utm_source=chatgpt.com "Find a Clinical Trial"
[4]: https://www.asco.org/guidelines?utm_source=chatgpt.com "Guidelines - ASCO"
[5]: https://www.esmo.org/guidelines/esmo-guidelines-methodology?utm_source=chatgpt.com "ESMO Guidelines Methodology"
[6]: https://www.cancercareontario.ca/en/cancer-care-ontario/programs/data-research/evidence-based-care?utm_source=chatgpt.com "Program in Evidence-Based Care"
[7]: https://jnccn360.org/disclaimer/?utm_source=chatgpt.com "Disclaimer"
[8]: https://www.cochrane.org/authors/handbooks-and-manuals/handbook?utm_source=chatgpt.com "Cochrane Handbook for Systematic Reviews of Interventions"
[9]: https://gradepro.org/handbook/?utm_source=chatgpt.com "GRADE handbook"
[10]: https://www.prisma-statement.org/prisma-2020?utm_source=chatgpt.com "PRISMA 2020 statement"
[11]: https://www.nccmt.ca/registry/view/eng/100.html?utm_source=chatgpt.com "Appraisal of Guidelines for Research & Evaluation (AGREE ..."
[12]: https://www.right-statement.org/?utm_source=chatgpt.com "Reporting Items for Practice Guidelines in Healthcare (RIGHT)"
[13]: https://pubmed.ncbi.nlm.nih.gov/24983061/?utm_source=chatgpt.com "Clinical Practice Guidelines We Can Trust"
[14]: https://pubmed.ncbi.nlm.nih.gov/26436619/?utm_source=chatgpt.com "Guidelines International Network: Principles for Disclosure ..."
[15]: https://www.nice.org.uk/process/pmg20?utm_source=chatgpt.com "Developing NICE guidelines: the manual | Guidance"
[16]: https://www.canada.ca/en/health-canada/services/drugs-health-products/medical-devices/application-information/guidance-documents/software-medical-device-guidance-document.html?utm_source=chatgpt.com "Guidance Document: Software as a Medical Device (SaMD)"
[17]: https://www.canada.ca/en/health-canada/services/drugs-health-products/medical-devices/application-information/guidance-documents/pre-market-guidance-machine-learning-enabled-medical-devices.html?utm_source=chatgpt.com "Pre-market guidance for machine learning-enabled ..."
[18]: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software?utm_source=chatgpt.com "Clinical Decision Support Software - Guidance"
[19]: https://www.alberta.ca/health-information-act?utm_source=chatgpt.com "Health Information Act"
[20]: https://build.fhir.org/ig/HL7/cqf-recommendations/?utm_source=chatgpt.com "CHF Example Implementation Guide - Clinical Practice ..."
[21]: https://cds-hooks.hl7.org/?utm_source=chatgpt.com "Home - CDS Hooks v2.0.1 - HL7.org"
[22]: https://build.fhir.org/ig/HL7/smart-app-launch/app-launch.html?utm_source=chatgpt.com "Launch and Authorization - SMART App Launch v2.2.0"
[23]: https://www.ohdsi.org/data-standardization/?utm_source=chatgpt.com "Standardized Data: The OMOP Common Data Model"
[24]: https://ottosr.com/?utm_source=chatgpt.com "otto-SR"
[25]: https://www.nature.com/articles/d41586-025-01942-y?utm_source=chatgpt.com "AI slashes time to produce gold-standard medical reviews — but sceptics urge caution"

I like your suggestions. So are you thinking of a platform where, maybe you have graph in the middle, LLM interafce in the lower third or quarter like terminal in IDEs and maybe division by topic on the left? And give technical details. What LLM is appropriate, what training is required? Are thinking like a harness? agentic loop engineering? 

Yes — I would design it almost exactly that way, but with one important correction:

> The **graph is not just a visualization**. The graph is the product’s central data model.
> The LLM is an interface, operator, drafter, and analyst attached to that graph.

So the experience should feel less like “chat with a folder of PDFs” and more like **Cursor / VS Code for cancer guideline development**, where the “codebase” is a living evidence-and-recommendation graph.

---

# 1. Product shape: “Guideline IDE”

The best metaphor is an **IDE for guideline teams**.

## Main layout

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Guideline: Lung / NSCLC / Systemic Therapy     Version: 2025.3  Status: Draft │
├───────────────┬───────────────────────────────────────────────┬──────────────┤
│ LEFT NAV      │ CENTER: EVIDENCE / RECOMMENDATION GRAPH        │ RIGHT PANEL  │
│               │                                               │              │
│ Tumour Teams  │    [PICO]──answers──>[Recommendation]          │ Selected node│
│ Guidelines    │        │                  │                    │ Source spans │
│ PICO Bank     │        │                  ├──supported by────┐ │ Evidence tbl │
│ Surveillance  │        │                  │                  │ │ Version diff │
│ Updates       │        ▼                  ▼                  │ │ Review state │
│ Evidence Sets │    [Study]──reports──>[Outcome Result]       │ │ COI / votes  │
│ Consensus     │        │                  │                  │ │ Actions      │
│ Tasks         │        └──compared to──>[Comparator]          │ │              │
│               │                                               │              │
├───────────────┴───────────────────────────────────────────────┴──────────────┤
│ LOWER PANEL: LLM WORKBENCH / TERMINAL / AGENT TRACE                          │
│ /ask-approved  /impact-scan  /draft-update-memo  /extract-table  /run-evals  │
│                                                                              │
│ Copilot answer, proposed graph changes, citations, agent steps, warnings      │
└──────────────────────────────────────────────────────────────────────────────┘
```

The left side is **topic/workflow navigation**. The center is the **graph/canvas**. The right side is the **inspector** for a selected node. The bottom is the **LLM workbench**, more like an IDE terminal than a chatbot.

The system should have explicit modes:

| Mode                          | Purpose                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Approved Guideline Mode**   | Only answer from approved GURU guideline content. No draft or speculative literature.                   |
| **Evidence Development Mode** | Work with citations, abstracts, full texts, evidence tables, PICO questions, and draft recommendations. |
| **Update Surveillance Mode**  | Monitor new evidence and flag impacted recommendations.                                                 |
| **Consensus Mode**            | Route draft recommendations to working groups / PTTs / reviewers.                                       |
| **Audit Mode**                | Show why the system said something, which sources were used, what was excluded, and who approved what.  |

CCA GURU already coordinates cancer guideline development with the thirteen Alberta Provincial Tumour Teams, and AHS describes these guidelines as evidence-informed recommendations based on literature review and tumour-team consensus; the AHS page also notes that cancer drugs in the guidelines are funded according to the Outpatient Cancer Drug Benefit Program unless otherwise stated. That means local funding, consensus, and provincial implementation context need to be first-class product objects, not afterthoughts. ([Alberta Health Services][1])

---

# 2. The core architecture

The system should be **graph-first, retrieval-backed, agent-assisted**.

```text
External + internal sources
        │
        ▼
Document ingestion + parsing
        │
        ├── raw source archive
        ├── parsed document store
        ├── citation / table / recommendation extractor
        └── ontology + entity linker
        │
        ▼
Canonical evidence graph
        │
        ├── graph database / graph tables
        ├── vector index
        ├── keyword search index
        ├── source-span store
        └── workflow / audit ledger
        │
        ▼
Tool layer
        │
        ├── search_guidelines()
        ├── retrieve_recommendation()
        ├── search_literature()
        ├── screen_citation()
        ├── extract_trial_data()
        ├── compare_guidelines()
        ├── map_evidence_to_recommendation()
        ├── draft_update_memo()
        ├── create_consensus_task()
        └── run_eval_suite()
        │
        ▼
LLM router + agent harness
        │
        ▼
Guideline IDE interface
```

The LLM should never directly “know” the answer by memory. It should use tools to retrieve approved content, evidence, graph nodes, source spans, and workflow state.

---

# 3. The graph data model

I would use **three connected graphs**, even if they are stored in one database.

## A. Guideline knowledge graph

This represents the clinical guideline world.

Core node types:

| Node                 | Example                                          |
| -------------------- | ------------------------------------------------ |
| `TumourTeam`         | Lung, Breast, GI, GU                             |
| `Guideline`          | Advanced NSCLC systemic therapy guideline        |
| `GuidelineVersion`   | NSCLC systemic therapy v2025.3                   |
| `Recommendation`     | “For patients with X, consider Y…”               |
| `PICOQuestion`       | Population / intervention / comparator / outcome |
| `PopulationCriteria` | Stage IV, EGFR-mutated, post-platinum            |
| `Intervention`       | Osimertinib, pembrolizumab, radiation            |
| `Comparator`         | Standard chemotherapy                            |
| `Outcome`            | OS, PFS, ORR, toxicity, QoL                      |
| `Biomarker`          | EGFR, ALK, PD-L1, MSI-H                          |
| `DiagnosticTest`     | NGS panel, IHC, FISH                             |
| `FundingRule`        | Alberta coverage / eligibility                   |
| `ClinicalTrial`      | Active Alberta trial                             |
| `AlgorithmStep`      | Pathway decision node                            |

Important edges:

| Edge                 | Meaning                                              |
| -------------------- | ---------------------------------------------------- |
| `HAS_RECOMMENDATION` | Guideline version contains recommendation            |
| `ANSWERS_PICO`       | Recommendation answers a PICO question               |
| `SUPPORTED_BY`       | Recommendation supported by study/evidence           |
| `CONTRADICTED_BY`    | New evidence conflicts with current recommendation   |
| `REQUIRES_TEST`      | Treatment requires biomarker or diagnostic test      |
| `USES_DRUG`          | Recommendation involves drug/intervention            |
| `FUNDED_UNDER`       | Treatment maps to funding rule                       |
| `SUPERSEDES`         | Version/recommendation replaces older one            |
| `IMPACTED_BY`        | New study/guideline update may affect recommendation |
| `APPROVED_BY`        | Working group / PTT / executive approval             |

## B. Evidence provenance graph

This is the trust layer.

Core node types:

| Node                   | Example                                         |
| ---------------------- | ----------------------------------------------- |
| `SourceDocument`       | PDF guideline, journal article, abstract, table |
| `SourceSpan`           | Page 12, paragraph 3; table row; figure caption |
| `Citation`             | DOI / PMID / trial registry ID                  |
| `Study`                | Phase III RCT, meta-analysis, cohort            |
| `EvidenceTableRow`     | Extracted PICO/outcome row                      |
| `RiskOfBiasAssessment` | RoB / certainty assessment                      |
| `ExtractionClaim`      | “Median PFS was X months”                       |

Every generated statement must trace back to a `SourceSpan`.

This is what separates a serious clinical system from a chatbot.

## C. Workflow / consensus graph

This is the “GURU process” layer.

Core nodes:

| Node                 | Example                                            |
| -------------------- | -------------------------------------------------- |
| `UpdateProject`      | 2026 NSCLC update                                  |
| `Task`               | Screen 500 abstracts                               |
| `Reviewer`           | Methodologist, oncologist, pharmacist, patient rep |
| `ConflictOfInterest` | Declared COI                                       |
| `Vote`               | Agree / disagree / abstain                         |
| `Comment`            | Reviewer feedback                                  |
| `Decision`           | Full update / partial update / no update / archive |
| `ApprovalEvent`      | PTT approval, executive signoff                    |
| `PublicationEvent`   | Published to AHS site                              |

This layer is highly defensible because it mirrors how CCA GURU actually works.

---

# 4. Recommendation node schema

A recommendation should not just be text. It should be a structured object.

Example:

```json
{
  "recommendation_id": "CCA-LUNG-NSCLC-SYS-REC-0042",
  "guideline_id": "CCA-LUNG-NSCLC-SYSTEMIC",
  "version": "2025.3",
  "status": "approved",
  "tumour_team": "lung",
  "clinical_context": {
    "disease": "non-small cell lung cancer",
    "stage": "advanced/metastatic",
    "line_of_therapy": "first-line",
    "biomarkers": ["EGFR exon 19 deletion", "EGFR L858R"],
    "population_constraints": [
      "adult",
      "ECOG 0-2",
      "no contraindication to targeted therapy"
    ]
  },
  "recommendation_text": "...",
  "strength": "B",
  "evidence_level": "I",
  "supporting_evidence_ids": ["PMID:...", "DOI:..."],
  "source_spans": [
    {
      "document_id": "guideline_pdf_2025_3",
      "page": 14,
      "section": "Recommendations",
      "span_id": "src_88921"
    }
  ],
  "local_context": {
    "funding_status": "funded_if_eligible",
    "funding_source": "Outpatient Cancer Drug Benefit Program",
    "testing_requirement": "EGFR mutation testing"
  },
  "last_reviewed": "2025-10-12",
  "update_watchers": [
    "EGFR advanced NSCLC RCTs",
    "Health Canada approvals",
    "ASCO guideline updates",
    "ESMO guideline updates",
    "Alberta funding changes"
  ]
}
```

The point is that the LLM should not invent these fields. It should help extract, normalize, compare, and draft them — with human approval.

---

# 5. The LLM interface

The lower panel should work like a **command terminal + copilot + trace viewer**.

Example commands:

```text
/ask-approved What is the current CCA recommendation for first-line ALK+ metastatic NSCLC?

/impact-scan guideline=LUNG-NSCLC-SYSTEMIC topic="EGFR exon 20"

/extract-evidence-table source_set=NEW_RCTS_2026 pico=PICO-113

/draft-update-memo rec=CCA-LUNG-NSCLC-SYS-REC-0042

/compare-guidelines rec=REC-0042 sources=ASCO,ESMO,NCCN,PEBC

/show-provenance claim="Drug X improves PFS in population Y"

/run-evals suite=screening_lung_2024
```

The bottom panel should have tabs:

| Tab          | Purpose                                                                    |
| ------------ | -------------------------------------------------------------------------- |
| **Ask**      | Natural-language query.                                                    |
| **Draft**    | Draft recommendation text, rationale, update memos.                        |
| **Extract**  | Evidence extraction into tables.                                           |
| **Trace**    | Every retrieval step, tool call, model call, source used, source rejected. |
| **Tests**    | Evals, regression tests, citation checks.                                  |
| **Warnings** | Missing citations, outdated source, unresolved conflict, low confidence.   |

The agent trace is critical. For this domain, the user should be able to inspect:

```text
Step 1: Retrieved current recommendation REC-0042.
Step 2: Found 17 candidate new studies.
Step 3: Screened 17 studies: 4 include, 8 exclude, 5 uncertain.
Step 4: Extracted PICO fields for 4 included studies.
Step 5: Compared outcomes to current evidence base.
Step 6: Flagged possible partial update.
Step 7: Drafted update memo.
Step 8: Waiting for methodologist review.
```

---

# 6. What LLM is appropriate?

I would **not** choose one model. I would build a **model router**.

Different tasks need different models.

## Recommended model strategy

| Task                               | Model tier                                            |
| ---------------------------------- | ----------------------------------------------------- |
| Complex guideline reasoning        | Frontier reasoning model                              |
| Recommendation drafting            | Frontier reasoning model                              |
| Update-impact analysis             | Frontier reasoning model + verifier                   |
| High-volume abstract screening     | Smaller/cheaper model or trained classifier           |
| Evidence-table extraction          | Smaller model first, frontier verifier for hard cases |
| Citation checking                  | Deterministic code + smaller model                    |
| Literature search-query generation | Frontier or mid-tier model                            |
| Consensus-comment summarization    | Mid-tier model                                        |
| UI autocomplete / tagging          | Small model                                           |
| Regression evaluation judge        | Separate model, calibrated against human labels       |

For the current market, I would start with **GPT-5.5 as the primary reasoning model**, with **GPT-5.4 mini or nano** for high-volume lower-cost tasks. OpenAI’s current model documentation says GPT-5.5 is the recommended starting point for complex reasoning and coding, while GPT-5.4 mini/nano are intended for lower-latency and lower-cost workloads; the same docs list GPT-5.5 with a 1M context window and tool support including functions, web search, file search, and computer use. ([OpenAI Developers][2])

I would also keep the architecture vendor-neutral. Anthropic’s current documentation describes Claude Opus 4.8 as suitable for complex reasoning, long-horizon agentic coding, and high-autonomy work, and points to Claude Fable 5 for highest-available capability. ([Claude Platform][3]) Google’s Gemini documentation emphasizes long-context use cases with models offering 1M+ token context windows, and its grounding docs describe Google Search grounding with citations. ([Google AI for Developers][4])

So my practical recommendation is:

| Role                  | Primary option                        | Backup / verifier                  |
| --------------------- | ------------------------------------- | ---------------------------------- |
| Guideline reasoning   | GPT-5.5                               | Claude Opus / Gemini long-context  |
| High-volume screening | GPT-5.4 mini/nano or local classifier | GPT-5.5 for uncertain cases        |
| Extraction            | GPT-5.4 mini first pass               | GPT-5.5 verifier                   |
| Long PDF comparison   | GPT-5.5 or Gemini long-context        | Retrieval-based chunking preferred |
| Final draft review    | GPT-5.5 + independent verifier        | Human methodologist                |
| Safety/citation audit | Deterministic source checker          | Separate LLM critic                |

Important: long context is useful, but I would **not** rely on dumping giant PDFs into context. Anthropic’s context-window documentation explicitly warns that larger context is not automatically better and that accuracy/recall can degrade as token count grows, a phenomenon it calls “context rot.” ([Claude Platform][5])

So the retrieval strategy should still be:

```text
Filter by guideline/topic/status
        ↓
Graph traversal
        ↓
Hybrid search: keyword + vector
        ↓
Rerank
        ↓
Load only the exact source spans needed
        ↓
LLM answer/draft/extract
        ↓
Citation verifier
```

---

# 7. Is training required?

## Initially: no fine-tuning

For the first strong version, I would not train a model from scratch and I would not start with fine-tuning.

The first version should use:

1. strong frontier models;
2. structured prompts;
3. tool calling;
4. strict output schemas;
5. retrieval;
6. graph grounding;
7. human review;
8. eval harness.

The hard part is not “teach the LLM oncology.” The hard part is **evidence provenance, source fidelity, update impact, local implementation context, and workflow governance**.

## Later: train narrow components

Training becomes useful after you collect task-specific labels.

Train or fine-tune only narrow models for repeatable subtasks:

| Component                    | Training data needed                      | Why useful                                   |
| ---------------------------- | ----------------------------------------- | -------------------------------------------- |
| Citation screener            | Included/excluded historical abstracts    | Reduces screening burden.                    |
| Extraction model             | Gold evidence-table rows                  | Improves structured extraction.              |
| Entity linker                | Drug/biomarker/stage/outcome labels       | Normalizes graph nodes.                      |
| Recommendation-impact ranker | Past updates and affected recommendations | Predicts which recs new evidence may affect. |
| Reranker                     | Query → relevant source-span labels       | Improves retrieval precision.                |
| COI/comment classifier       | Historical review comments                | Helps consensus workflows.                   |
| Update-triage classifier     | Full/partial/no update/archive decisions  | Helps prioritize work.                       |

I would avoid training a generative model to “make recommendations.” That is a clinical governance task. The model can **draft**, but the system should treat recommendations as human-approved artifacts.

A useful training-data target for a serious pilot:

| Dataset                        | Approximate useful starting size                 |
| ------------------------------ | ------------------------------------------------ |
| Screening examples             | 2,000–10,000 citation decisions                  |
| Evidence extraction examples   | 300–1,000 full-text/table examples               |
| Recommendation-impact examples | 100–300 historical recommendation changes        |
| Guideline Q&A evals            | 300–1,000 gold questions                         |
| Citation-faithfulness evals    | 500+ claims with source-span labels              |
| “Should abstain” cases         | 200–500 unsafe / unsupported / ambiguous prompts |

Those numbers are not hard rules, but they give a sense of what “serious” looks like. Ten examples and a clever prompt will demo well; it will not create a competitive clinical product.

---

# 8. Use structured outputs everywhere

The LLM should not return vague prose for internal operations. It should return validated JSON.

OpenAI’s current structured-output documentation says Structured Outputs are available through function calling and JSON-schema response formats, and that Structured Outputs go beyond JSON mode by enforcing schema adherence. ([OpenAI Developers][6])

Example screening output:

```json
{
  "citation_id": "PMID_12345678",
  "decision": "include",
  "confidence": 0.86,
  "pico_match": {
    "population": "metastatic EGFR-mutated NSCLC",
    "intervention": "drug X",
    "comparator": "standard chemotherapy",
    "outcomes": ["PFS", "OS", "grade 3/4 toxicity"]
  },
  "reasons": [
    "Phase III randomized trial",
    "Population matches current guideline scope",
    "Reports clinically relevant survival outcomes"
  ],
  "exclusion_reason": null,
  "requires_human_review": true,
  "source_span_ids": ["abstract_span_17"]
}
```

Example update-impact output:

```json
{
  "new_evidence_id": "STUDY_2026_0041",
  "possibly_impacted_recommendations": [
    {
      "recommendation_id": "CCA-LUNG-NSCLC-SYS-REC-0042",
      "impact_type": "potential_change_to_preferred_regimen",
      "impact_severity": "high",
      "suggested_action": "partial_update",
      "rationale": "New phase III evidence reports improved PFS in a population matching the current recommendation.",
      "evidence_gaps": [
        "Overall survival immature",
        "No Alberta funding assessment yet"
      ],
      "source_span_ids": ["study_0041_results_p3", "current_rec_page14"]
    }
  ],
  "requires_methodologist_review": true
}
```

The graph should only accept proposed changes after validation.

---

# 9. Agentic loop engineering

Yes, I am thinking of a **harness** and **agentic loop engineering**, but not a loose autonomous agent.

The right pattern is:

> **bounded agents inside deterministic workflows**

Not:

> “Let the agent go research cancer guidelines for 45 minutes and come back.”

## The agent loop

```text
Given task
  ↓
Create explicit plan
  ↓
Call approved tools
  ↓
Write structured intermediate state
  ↓
Validate schema + citations + source permissions
  ↓
Run verifier
  ↓
Ask human if uncertain / high impact
  ↓
Commit only approved outputs
  ↓
Log everything
```

OpenAI’s function-calling documentation describes the standard model-tool loop: the application sends available tools, the model requests a tool call, application code executes it, tool outputs are returned to the model, and the model either responds or calls more tools. ([OpenAI Developers][7])

For this product, I would make that loop stricter:

```text
Agent cannot:
- publish a recommendation
- overwrite an approved guideline
- cite a source it did not retrieve
- use draft content in approved-answer mode
- invent evidence grades
- silently ignore conflicting evidence
- answer patient-specific treatment questions as if it were a clinician

Agent can:
- propose graph changes
- draft evidence tables
- draft update memos
- flag impacted recommendations
- summarize reviewer comments
- prepare consensus packets
- ask for human adjudication
```

## Example: update-surveillance agent

```text
Trigger:
  New PubMed/Embase/ASCO/ESMO/Health Canada/funding signal arrives.

Step 1:
  Normalize citation, DOI, PMID, trial ID.

Step 2:
  Extract disease, stage, biomarker, intervention, comparator, outcomes.

Step 3:
  Traverse graph to find candidate impacted recommendations.

Step 4:
  Retrieve current recommendation, source spans, evidence base, and local funding context.

Step 5:
  Compare new evidence against current evidence base.

Step 6:
  Generate structured impact assessment.

Step 7:
  Independent verifier checks:
    - Are the claims supported?
    - Is the PICO match real?
    - Are there missing contradictions?
    - Is the source current?
    - Is the recommendation actually affected?

Step 8:
  If high impact or uncertain, create human-review task.

Step 9:
  Methodologist reviews, edits, approves/rejects.

Step 10:
  Store decision as labeled training/evaluation data.
```

This creates a compounding data advantage.

---

# 10. The harness

The harness is the most important engineering asset.

It should include:

| Harness component        | Purpose                                                                     |
| ------------------------ | --------------------------------------------------------------------------- |
| **Prompt registry**      | Version every prompt, system instruction, tool description, and schema.     |
| **Model registry**       | Track model, vendor, version, context length, temperature, cost.            |
| **Tool registry**        | Define all tools with strict input/output schemas.                          |
| **Trace store**          | Save every model call, tool call, retrieved source, and generated artifact. |
| **Eval datasets**        | Gold-standard tasks from historical GURU work.                              |
| **Regression tests**     | Prevent model/prompt updates from breaking existing behavior.               |
| **Citation verifier**    | Check every generated claim maps to a source span.                          |
| **Graph validator**      | Prevent invalid graph mutations.                                            |
| **Human review queue**   | Route uncertain/high-impact outputs to experts.                             |
| **Cost/latency monitor** | Track whether workflows are economically viable.                            |
| **Audit export**         | Produce defensible logs for clinical governance.                            |

OpenAI’s evals documentation says evaluations are used to test and improve outputs and are especially important when upgrading or trying new models. ([OpenAI Developers][8]) That is exactly the right philosophy here: every model, prompt, retrieval change, schema change, or agent change should go through regression evals before touching production guideline work.

## Eval suites I would build first

| Eval suite                        | Measures                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------- |
| **Guideline Q&A**                 | Does the assistant answer only from approved GURU content?                   |
| **No-answer eval**                | Does it abstain when sources do not support an answer?                       |
| **Citation fidelity**             | Does each claim map to the correct source span?                              |
| **Retrieval recall**              | Are gold sources retrieved in top-k?                                         |
| **Abstract screening**            | Include/exclude accuracy, especially sensitivity.                            |
| **Full-text extraction**          | PICO, outcomes, adverse events, population, trial design.                    |
| **Evidence-table generation**     | Row-level accuracy and completeness.                                         |
| **Recommendation-impact mapping** | Does new evidence map to the correct affected recommendations?               |
| **Update triage**                 | Full update vs partial update vs no update vs archive.                       |
| **Draft quality**                 | Expert-rated clarity, correctness, implementability.                         |
| **Safety**                        | Avoid patient-specific medical advice, unsupported claims, outdated content. |
| **Workflow eval**                 | Did the agent call the right tools in the right order?                       |

For CCA GURU, the killer eval is not “Can it answer questions?” It is:

> Given historical evidence available before a past guideline update, can the system reproduce the same update decision and identify the same affected recommendations?

That would be very hard for a generic vibe-coded RAG app to match.

---

# 11. Retrieval design: not simple RAG

Use **Graph-RAG**, not plain RAG.

Plain RAG:

```text
Question → vector search → chunks → answer
```

Guideline Graph-RAG:

```text
Question
  ↓
Identify mode: approved / draft / research / audit
  ↓
Resolve topic: cancer site, stage, biomarker, treatment line, population
  ↓
Traverse graph:
  relevant guideline → recommendation → evidence → funding → pathways
  ↓
Hybrid retrieval:
  graph filter + BM25 + vector + reranker
  ↓
Load exact source spans
  ↓
Generate answer / draft / extraction
  ↓
Verify every claim
  ↓
Return answer plus graph links
```

The graph allows questions like:

```text
“Which recommendations in lung cancer could be affected by a new positive phase III ALK inhibitor trial?”
```

A normal RAG app will search text. A graph-based system can reason across:

```text
ALK biomarker
  → metastatic NSCLC
  → first-line therapy recommendations
  → current supporting evidence
  → drugs
  → funding rules
  → active pathways
  → patient/physician-facing summaries
  → related algorithms
```

That is the defensible part.

---

# 12. Suggested stack

## Frontend

| Layer           | Recommendation                               |
| --------------- | -------------------------------------------- |
| Web app         | React / Next.js                              |
| Graph canvas    | React Flow, Cytoscape.js, or custom D3 layer |
| Tables          | AG Grid or TanStack Table                    |
| Document viewer | PDF viewer with source-span highlighting     |
| Collaboration   | Comments, assignments, review status         |
| LLM terminal    | Command palette + chat + trace viewer        |

## Backend

| Layer               | Recommendation                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------ |
| API                 | Python FastAPI or TypeScript/NestJS                                                        |
| Workflow engine     | Temporal, Prefect, Dagster, or custom job state machine                                    |
| Relational DB       | Postgres                                                                                   |
| Vector index        | pgvector for MVP; Qdrant/Weaviate/Pinecone if scale requires                               |
| Search              | OpenSearch / Elasticsearch                                                                 |
| Graph store         | Start with Postgres `nodes`/`edges`; move to Neo4j/Neptune if traversal complexity demands |
| Object storage      | S3/Azure Blob/GCS, ideally with Canadian/data-residency options if required                |
| Queue               | Redis/RQ, Celery, Temporal queues, or cloud-native queues                                  |
| Auth                | SSO/SAML/OIDC, RBAC                                                                        |
| Observability       | OpenTelemetry + model/tool trace store                                                     |
| Document processing | PDF parser, OCR fallback, table extractor, citation parser                                 |
| Export              | Word/PDF/HTML + structured JSON/FHIR later                                                 |

## Why I would not start with Neo4j-only

The center of the product should be a graph, but the MVP does not necessarily require a dedicated graph database on day one.

I would start with:

```sql
nodes
edges
source_documents
source_spans
recommendations
evidence_items
workflow_events
model_traces
```

Then add Neo4j or another graph database if queries become complex enough to justify it.

The product advantage is **canonical graph modeling**, not the database brand.

---

# 13. The difficult part: source anchoring

Every parsed document needs durable source spans.

For a PDF:

```json
{
  "source_span_id": "span_99382",
  "document_id": "cca_lung_guideline_2025_pdf",
  "page": 14,
  "bbox": [102, 220, 510, 288],
  "section": "Recommendations",
  "text": "..."
}
```

For an evidence table:

```json
{
  "source_span_id": "etable_row_104",
  "document_id": "evidence_table_nsclc_2025",
  "table": 3,
  "row": 12,
  "columns": {
    "study": "...",
    "population": "...",
    "intervention": "...",
    "outcome": "..."
  }
}
```

The UI should let the user click any generated claim and jump directly to the PDF paragraph, table row, abstract, or study result.

This is non-negotiable.

---

# 14. How I would implement the first serious agent

## Agent: Recommendation Impact Scanner

Purpose:

> Given a new article, abstract, trial result, regulatory approval, funding update, or external guideline update, identify which CCA GURU recommendations might be affected.

Inputs:

```json
{
  "source_type": "journal_article",
  "source_id": "PMID_...",
  "topic_scope": "lung cancer systemic therapy",
  "guideline_ids": ["CCA-LUNG-NSCLC-SYSTEMIC"],
  "mode": "draft_evidence_review"
}
```

Tools:

```text
search_current_guidelines()
get_recommendation_graph()
get_source_spans()
search_existing_evidence_base()
extract_pico()
extract_outcomes()
check_funding_context()
find_related_external_guidelines()
rank_impacted_recommendations()
draft_impact_memo()
run_citation_verifier()
create_human_review_task()
```

Output:

```json
{
  "suggested_action": "partial_update",
  "impacted_recommendations": [
    {
      "recommendation_id": "CCA-LUNG-NSCLC-SYS-REC-0042",
      "impact_score": 0.91,
      "impact_reason": "New phase III RCT in same population and treatment line reports superior PFS.",
      "required_reviews": [
        "medical oncology",
        "pharmacy/funding",
        "methodologist"
      ],
      "source_span_ids": [
        "new_study_results_section",
        "current_guideline_rec_span"
      ]
    }
  ],
  "uncertainties": [
    "OS immature",
    "Funding status not yet available",
    "Subgroup definition differs from current recommendation"
  ],
  "human_review_required": true
}
```

This is the feature I would demo to CCA GURU before anything else.

---

# 15. Human-in-the-loop design

For a clinical guideline system, “human in the loop” should not be a slogan. It should be embedded in the state machine.

## Suggested approval gates

| Stage                   | AI can do                      | Human must do                                  |
| ----------------------- | ------------------------------ | ---------------------------------------------- |
| Source ingestion        | Parse, classify, extract       | Approve source registry rules                  |
| Screening               | Suggest include/exclude        | Adjudicate uncertain/excluded critical studies |
| Evidence extraction     | Draft table rows               | Approve extracted values                       |
| Evidence grading        | Suggest mapping                | Confirm final grade                            |
| Recommendation drafting | Draft language                 | Approve clinical recommendation                |
| Update triage           | Suggest full/partial/no update | Confirm update decision                        |
| Publication             | Generate files                 | Final governance approval                      |
| Approved Q&A            | Answer from approved content   | Review flagged failures / audit logs           |

The system should make it impossible for an LLM to silently move something from draft to approved.

---

# 16. What makes this hard to copy

The moat is not “we used GPT-5.5” or “we have a vector DB.”

The moat is:

1. **GURU-specific historical update data**.
2. **Structured recommendation graph**.
3. **Evidence provenance down to source spans**.
4. **Alberta funding and implementation overlay**.
5. **Update-impact scanner**.
6. **Consensus workflow integration**.
7. **Retrospective benchmark harness**.
8. **Human-reviewed labeled data accumulating over time**.
9. **Computable pathway outputs later**.
10. **Auditability and governance.**

A generic competitor can copy “chat over PDFs.” It is much harder to copy:

```text
new evidence → affected recommendation → evidence table delta →
funding implication → draft update memo → reviewer workflow →
approved graph mutation → computable pathway update
```

---

# 17. Pilot build plan

## Phase 1: Graph + approved guideline copilot

Build:

```text
- Source registry
- GURU document ingestion
- Recommendation extraction
- Source-span anchoring
- Basic graph schema
- Hybrid retrieval
- Approved-only Q&A
- Citation verifier
- Trace logging
- First eval suite
```

Demo:

```text
User asks current guideline questions.
System answers only from approved CCA/GURU docs.
Every sentence has source trace.
Outdated/draft content is blocked.
```

## Phase 2: Evidence workbench

Build:

```text
- PICO objects
- Citation import
- Screening workflow
- Evidence extraction
- Evidence table draft generation
- Human adjudication
- Gold-label capture
```

Demo:

```text
Upload/search 200 citations.
System screens and extracts.
Methodologist reviews.
System learns from decisions.
```

## Phase 3: Impact scanner

Build:

```text
- Surveillance sources
- New evidence normalization
- Recommendation impact mapping
- Update triage
- Draft memo generator
- Verifier model
- Review task creation
```

Demo:

```text
A new RCT appears.
System identifies affected recommendation,
drafts impact memo,
flags evidence gaps,
and creates review task.
```

## Phase 4: Consensus and publication

Build:

```text
- Commenting
- COI tracking
- Voting / agreement workflow
- Version diff
- Publication package export
- Audit report
```

## Phase 5: Computable guideline layer

Later:

```text
- Decision graph compiler
- Eligibility logic
- Test patient vignettes
- FHIR / CDS Hooks / SMART-on-FHIR exploration
```

Do not start here. Earn trust first with guideline development workflows.

---

# 18. My answer to “RAG, nanoGPT, Karpathy second brain, harness, agentic loop?”

## RAG?

Yes, but only as one layer.

Use:

```text
Graph-RAG + hybrid retrieval + source-span verifier
```

Not:

```text
PDF chunks + embeddings + chat box
```

## nanoGPT?

No. Not for the product.

Training a small model from scratch is not the right use of money or time. It will not beat frontier models at medical reasoning, and it will not solve provenance or workflow.

## Karpathy-style second brain?

Partly.

Use the “second brain” idea for:

```text
- project memory
- meeting notes
- reviewer comments
- decision history
- rationale history
- update history
```

But not as the main architecture. The main architecture is a governed evidence graph.

## Harness?

Absolutely yes.

The harness is mandatory. It should run evals, store traces, compare model versions, check citations, and prevent regressions.

## Agentic loop engineering?

Yes, but bounded.

Use agents for:

```text
- surveillance
- screening
- extraction
- update impact
- drafting
- consensus packet generation
```

Do not use open-ended autonomous agents for:

```text
- final clinical recommendations
- approval
- publication
- patient-specific treatment decisions
```

---

# 19. What I would tell the team to build first

Build the following MVP:

> **CCA GURU Guideline Graph Workbench**

With four killer capabilities:

1. **Approved guideline Q&A with source-span citations.**
2. **Visual recommendation/evidence graph.**
3. **AI-assisted evidence-table extraction.**
4. **Recommendation impact scanner for new evidence.**

The fourth is the differentiator.

A simple RAG demo will feel obvious. A visual graph that says:

> “This new trial may affect these three recommendations, this evidence table row, this pathway step, this funding note, and this patient-facing summary — here is the source-backed rationale and review workflow”

is much more compelling.

[1]: https://www.albertahealthservices.ca/info/cancerguidelines.aspx?utm_source=chatgpt.com "Cancer Guidelines"
[2]: https://developers.openai.com/api/docs/models?utm_source=chatgpt.com "Models | OpenAI API"
[3]: https://platform.claude.com/docs/en/about-claude/models/overview?utm_source=chatgpt.com "Models overview - Claude API Docs"
[4]: https://ai.google.dev/gemini-api/docs/long-context?utm_source=chatgpt.com "Long context  |  Gemini API  |  Google AI for Developers"
[5]: https://platform.claude.com/docs/en/build-with-claude/context-windows?utm_source=chatgpt.com "Context windows - Claude API Docs"
[6]: https://developers.openai.com/api/docs/guides/structured-outputs?utm_source=chatgpt.com "Structured model outputs | OpenAI API"
[7]: https://developers.openai.com/api/docs/guides/function-calling?utm_source=chatgpt.com "Function calling | OpenAI API"
[8]: https://developers.openai.com/api/docs/guides/evals?utm_source=chatgpt.com "Working with evals | OpenAI API"

Excellent. one thing i want to mention is that we don't want to get int he business of susbsidizing for other popele's llm use. so it should be lightweight, open weight, or whatever. we're not paying for someone else's model use nor want an overkill. 

Yes. That constraint should become a **core product principle**:

> **Novara should not sell “free AI usage.” Novara should sell the workflow, graph, governance, and evidence infrastructure. LLM compute should be local, capped, metered, or paid directly by the customer.**

That means the architecture changes from:

```text
Novara app → Novara API key → third-party LLM bill → risky margins
```

to:

```text
Novara app → local / customer-owned model runtime → capped compute → no surprise subsidy
```

# 1. Revised position

I would pitch this internally as:

> **Local-first Guideline Graph Workbench**
> An evidence-guideline platform that can run with open-weight models on customer-owned or Novara-dedicated infrastructure, with external frontier APIs disabled by default.

The LLM should be treated like a database or search engine: a replaceable runtime component, not the core business.

The core Novara IP remains:

```text
guideline graph
source-span provenance
evidence workflow
update-impact scanner
evaluation harness
consensus workflow
audit trail
Alberta-local overlays
```

The model is just the “reasoning/extraction worker.”

# 2. Open-weight, not “free forever”

One terminology point matters: **open-weight** and **open-source AI** are not the same thing. The Open Source Initiative distinguishes open weights from full open-source AI; open weights are the learned model parameters, while full open-source AI requires broader freedom to use, study, modify, and share the system, including enough source/data information to understand and recreate it. ([Open Source Initiative][1])

For Novara’s purposes, **open-weight is enough** if the licence allows commercial deployment, fine-tuning where needed, and self-hosted inference. The business requirement is not ideological purity. The business requirement is:

```text
no per-token dependency
no hidden pass-through margin risk
no client data sent to external APIs by default
no dependence on one proprietary vendor
```

# 3. Product pricing / deployment model

To avoid subsidizing other people’s LLM use, I would support three deployment modes.

## Option A: customer-owned deployment

CCA / AHS runs the system in their own cloud or data centre.

```text
CCA pays: GPU, storage, network, backups
Novara charges: software licence + implementation + support
Novara pays: no model inference bill
```

This is the cleanest enterprise/public-health model.

## Option B: Novara-hosted single-tenant deployment

Novara hosts a dedicated environment for CCA, but compute is **explicitly metered and capped**.

```text
Base licence includes:
- platform
- graph
- ingestion
- workflow
- fixed monthly compute allowance

Overage:
- billed as GPU-hours / workload units
- never unlimited
```

No shared giant LLM key. No “all-you-can-eat AI.”

## Option C: BYO external model key for escalation only

For rare hard cases, the platform can allow an external frontier model, but only if:

```text
- CCA provides the API key
- the feature is off by default
- users see a warning
- sensitive/draft/patient data is blocked unless approved
- every call is logged
```

This lets the product say: “We support frontier escalation, but Novara does not pay for it.”

# 4. Add a “subsidy firewall” to the architecture

Every LLM call should go through an internal gateway.

```text
User command
   ↓
Task router
   ↓
Budget / policy gate
   ↓
Cache check
   ↓
Retrieval / graph tools
   ↓
Local model runtime
   ↓
Verifier
   ↓
Trace + cost ledger
```

The gateway should record:

```sql
llm_requests
- tenant_id
- user_id
- task_type
- model_name
- input_tokens
- output_tokens
- retrieved_source_count
- gpu_milliseconds
- cache_hit
- estimated_internal_cost
- billable_status
- approval_required
- created_at
```

Before a high-cost workflow runs, the system should estimate:

```text
This job will screen 3,200 abstracts.
Estimated runtime: 42 GPU-minutes.
Estimated billable compute: X units.
Proceed / schedule batch / reduce scope?
```

That is how Novara avoids accidental subsidy.

# 5. Default local model stack

I would not start with 70B or 120B models. For this product, strong retrieval and a structured graph reduce the need for giant models.

## Recommended MVP model stack

| Layer                    | Default choice                                               | Why                                                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Embeddings               | **BGE-M3**                                                   | Good default for RAG because it supports dense retrieval, sparse retrieval, multi-vector retrieval, multilingual use, and up to 8,192-token inputs. ([Hugging Face][2])                                                                                      |
| Reranking                | **mxbai-rerank-base-v2** or **mxbai-rerank-large-v2**        | Open Apache-2.0 rerankers; base is 0.5B, large is 1.5B, so this layer is cheap and self-hostable. ([Mixedbread][3])                                                                                                                                          |
| Small router/classifier  | **Qwen3.5-2B** or similar                                    | For task routing, document classification, “should answer / should abstain,” and cheap JSON tagging. Qwen3.5-2B is Apache-2.0 and intended for prototyping/task-specific fine-tuning. ([Hugging Face][4])                                                    |
| Main workhorse           | **Qwen3.5-9B**                                               | Good size for local deployment; Apache-2.0; compatible with vLLM, SGLang, KTransformers, and related local-serving stacks. ([Hugging Face][5])                                                                                                               |
| Higher-accuracy worker   | **Mistral Small 3.2 24B**                                    | Apache-2.0, stronger than small models, 128k context, function-calling support, and vLLM support. ([Hugging Face][6])                                                                                                                                        |
| Local reasoning fallback | **gpt-oss-20b** or **DeepSeek-R1 distilled 32B-class model** | Use only for hard impact-analysis or reasoning tasks, not every chat. OpenAI’s gpt-oss-20b/120b are open-weight Apache-2.0 models, and gpt-oss-20b is designed to run locally with about 16GB memory; DeepSeek-R1 is MIT-licensed. ([OpenAI Help Center][7]) |

My practical MVP choice would be:

```text
BGE-M3 embeddings
+ mxbai-rerank-base-v2
+ Qwen3.5-9B as default
+ Mistral Small 3.2 24B for extraction/drafting
+ optional gpt-oss-20b for hard local reasoning
```

I would benchmark DeepSeek-R1-distill models, but I would not make them the default until legal/security/procurement concerns are reviewed.

# 6. Serving stack

For GPU serving, I would use **vLLM** first. vLLM supports high-throughput serving features like PagedAttention, continuous batching, chunked prefill, prefix caching, and many quantization formats, which directly helps reduce inference cost. ([vLLM][8])

For desktop, appliance, or CPU/GPU hybrid deployment, I would support **llama.cpp** or Ollama-style packaging. The llama.cpp project is designed for local inference across a wide range of hardware and supports integer quantization from 1.5-bit through 8-bit, plus CPU/GPU hybrid inference. ([GitHub][9])

Simple deployment split:

```text
Production GPU server:
  vLLM

Small local appliance / demo / offline:
  llama.cpp or Ollama

Batch extraction:
  vLLM job workers

Embeddings:
  local sentence-transformers / FlagEmbedding service

Reranking:
  local reranker service
```

# 7. Hardware profile

I would design for three footprints.

## Footprint 1: demo / development box

```text
1 GPU with 16–24GB VRAM
64–128GB RAM
2–4TB NVMe
Models:
  Qwen3.5-9B
  BGE-M3
  small reranker
  possibly gpt-oss-20b if memory allows
```

Good for demos, low-volume guideline Q&A, source ingestion testing, and interface work.

## Footprint 2: serious pilot appliance

```text
1 GPU with 48GB VRAM, or 2 GPUs with 24GB each
128–256GB RAM
4–8TB NVMe
Models:
  Qwen3.5-9B always on
  Mistral Small 3.2 24B for heavier jobs
  BGE-M3 embeddings
  mxbai reranker
```

This is what I would target for a 12-week CCA GURU pilot.

## Footprint 3: production single-tenant

```text
2–4 GPUs
separate ingestion workers
separate vector/search/graph services
job queue for batch screening/extraction
per-team quotas
audit logging
backup + disaster recovery
```

Still not overkill. This is a controlled workbench, not a consumer chatbot serving millions of users.

# 8. Make most workflows non-LLM

The cost-saving trick is not merely “use smaller models.” The bigger trick is:

> **Do not call an LLM unless the graph/search/code layer already narrowed the task.**

For example, approved guideline Q&A should work like this:

```text
User asks question
  ↓
classify mode: approved-only
  ↓
resolve disease site / stage / treatment / biomarker
  ↓
graph lookup finds candidate recommendations
  ↓
hybrid search retrieves exact source spans
  ↓
reranker orders passages
  ↓
small local LLM writes answer
  ↓
citation verifier checks answer
  ↓
return
```

The model should not search the whole corpus. The graph and retrieval layer should.

# 9. Cost-governed agent loops

Yes, still use agentic loops, but every loop should be bounded.

Bad:

```text
Agent, go research lung cancer guidelines until done.
```

Good:

```text
/impact-scan rec=REC-0042 source_set=NEW_RCTS_2026 max_steps=8 max_gpu_seconds=120
```

Each agent gets:

```json
{
  "max_steps": 8,
  "max_input_tokens_per_step": 12000,
  "max_output_tokens_per_step": 1500,
  "allowed_models": ["qwen3.5-9b", "mistral-small-3.2-24b"],
  "escalation_model": "gpt-oss-20b",
  "requires_human_approval_above_cost": true,
  "can_mutate_graph": false,
  "can_create_proposed_patch": true
}
```

The agent can propose graph changes. It cannot silently commit them.

# 10. Training strategy under this constraint

I would still avoid training a model from scratch.

Training from scratch is exactly the kind of overkill we should avoid.

## Do first

```text
RAG
graph retrieval
structured prompts
JSON schemas
human review
evaluation harness
local open-weight inference
```

## Fine-tune later, narrowly

Only fine-tune small or mid-size models when you have enough labelled CCA/GURU data.

Useful fine-tunes:

| Fine-tune                         |            Model size | Training data                                        |
| --------------------------------- | --------------------: | ---------------------------------------------------- |
| Abstract include/exclude screener |                 2B–9B | Historical screening decisions                       |
| Evidence table extractor          |                9B–24B | Approved evidence table rows                         |
| Recommendation-impact ranker      | classifier / reranker | Past updates and affected recommendations            |
| Guideline style drafter           |           9B–24B LoRA | Final approved recommendation text + rationales      |
| Abstention/safety classifier      |                 2B–9B | Unsupported questions, draft/approved boundary cases |

Do **not** fine-tune a model to “make cancer recommendations.” Fine-tune models to support workflow tasks.

The real clinical authority remains:

```text
source evidence
GURU methodology
human reviewers
PTT consensus
approval workflow
```

# 11. The lightweight architecture

The platform can remain graph-first without being heavy.

```text
Frontend:
  Next.js / React
  graph canvas
  document viewer
  LLM terminal
  review queues

Backend:
  FastAPI or Node/NestJS
  Postgres
  OpenSearch
  pgvector or Qdrant
  object storage
  job queue
  vLLM model server
  reranker service
  embedding service

Graph:
  start with Postgres nodes/edges
  move to Neo4j only if traversal complexity demands it

LLM:
  local model gateway
  no shared third-party API key
  tenant quota enforcement
  cache
  trace log
```

Important: do **not** start with an enterprise knowledge-graph monster. Start with:

```sql
nodes
edges
source_documents
source_spans
recommendations
evidence_items
pico_questions
model_traces
workflow_tasks
review_decisions
```

That is enough.

# 12. The model gateway is mandatory

This is the subsidy-control layer.

```python
class LLMRequestPolicy:
    tenant_id: str
    task_type: str
    allowed_models: list[str]
    max_context_tokens: int
    max_output_tokens: int
    max_gpu_seconds: int
    require_human_approval: bool
    external_api_allowed: bool = False
```

Execution logic:

```text
1. Estimate cost.
2. Check tenant quota.
3. Check task policy.
4. Check whether cached answer/artifact exists.
5. Choose smallest acceptable model.
6. Run local inference.
7. Verify citations/schema.
8. Log usage.
9. Bill or deduct from allowance.
```

The UI should surface this plainly:

```text
Mode: Local
Model: qwen3.5-9b
Estimated compute: low
External API: off
Tenant monthly compute used: 38%
```

# 13. Caching strategy

Caching is a huge part of avoiding LLM waste.

Cache these aggressively:

```text
document parsing
OCR output
source spans
recommendation extraction
embedding vectors
reranked retrieval results
approved guideline answers
evidence table drafts
abstract screening decisions
reviewer-approved corrections
impact-scan intermediate states
```

For approved guideline Q&A, many clinicians and methodologists will ask variants of the same question. Cache at the level of:

```text
normalized question
retrieved recommendations
source spans
answer template
document version
```

Invalidate cache only when the underlying guideline version changes.

# 14. What should use the larger model?

The larger local model should be reserved for expensive/high-value tasks.

Use Qwen3.5-9B or similar for:

```text
basic approved Q&A
document classification
PICO tagging
simple extraction
comment summarization
routing
draft polishing
```

Use Mistral Small 3.2 24B or gpt-oss-20b for:

```text
evidence-table extraction from difficult studies
recommendation-impact analysis
conflicting evidence synthesis
draft update memos
complex PICO matching
long guideline comparisons
```

Avoid large-model use for:

```text
navigation
simple search
known approved recommendations
metadata extraction
format conversion
citation formatting
tasks deterministic code can do
```

# 15. Recommended first benchmark

Before choosing a final model, run a bake-off on CCA/GURU-style tasks.

Candidate models:

```text
Qwen3.5-9B
Mistral Small 3.2 24B
gpt-oss-20b
DeepSeek-R1-Distill-Qwen-32B or similar
```

Benchmark tasks:

```text
100 approved guideline Q&A questions
100 no-answer / abstention questions
200 abstract screening examples
50 full-text evidence extraction examples
25 recommendation-impact examples
25 update-triage examples
```

Measure:

```text
accuracy
citation fidelity
abstention correctness
JSON validity
human edit distance
GPU seconds per task
latency
failure modes
```

Pick the cheapest model that clears the bar. Do not pick the biggest model by default.

# 16. Revised answer to “what LLM is appropriate?”

For this constraint, my answer changes to:

> Start with **Qwen3.5-9B as the default local workhorse**, **Mistral Small 3.2 24B for heavier extraction/drafting**, **BGE-M3 + mxbai-rerank for retrieval quality**, and **gpt-oss-20b or a 32B reasoning model only as an optional local escalation path**.

I would not use a closed frontier API in the default product.

I would not train a model from scratch.

I would not make the user experience “unlimited chat.”

I would build the product so every LLM call is:

```text
local
bounded
logged
cached
quota-controlled
replaceable
source-grounded
```

# 17. Revised architecture diagram

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Guideline Graph Workbench UI                                         │
│ left nav | graph canvas | source inspector | local LLM terminal       │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Task Router                                                          │
│ approved Q&A | extraction | screening | impact scan | drafting        │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Subsidy Firewall / LLM Gateway                                       │
│ quota | cache | policy | model routing | trace | cost ledger          │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
             ┌──────────────────┼──────────────────┐
             ▼                  ▼                  ▼
┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────────┐
│ Graph / SQL       │  │ Search / Vector   │  │ Local Model Runtime      │
│ Postgres nodes    │  │ BGE-M3 + BM25     │  │ vLLM / llama.cpp         │
│ recommendations   │  │ mxbai reranker    │  │ Qwen / Mistral / gpt-oss │
└──────────────────┘  └──────────────────┘  └─────────────────────────┘
             │                  │                  │
             └──────────────────┼──────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Verifier + Audit Layer                                               │
│ citation check | schema check | graph patch review | human approval   │
└──────────────────────────────────────────────────────────────────────┘
```

# 18. Business principle

The contract should say something like:

> Novara provides the platform, implementation, maintenance, evaluation harness, and workflow tooling. AI inference is delivered through customer-owned infrastructure, a dedicated Novara-hosted compute pool with explicit quotas, or customer-provided model/API credentials. Novara does not provide unlimited third-party LLM usage under the base licence.

That is the right posture.

# Bottom line

The best version is **not** an overpowered LLM app.

It is:

```text
small models where possible
mid-size local models where useful
large local reasoning only when justified
no default external APIs
strict quotas
cache everything
graph-first retrieval
human approval
evaluation harness
```

This actually makes the product more defensible. A cheap chatbot can be vibe-coded. A cost-governed, local-first, audited guideline graph workbench cannot.

[1]: https://opensource.org/ai/open-source-ai-definition?utm_source=chatgpt.com "The Open Source AI Definition – 1.0"
[2]: https://huggingface.co/BAAI/bge-m3?utm_source=chatgpt.com "BAAI/bge-m3 · Hugging Face"
[3]: https://www.mixedbread.com/blog/mxbai-rerank-v2?utm_source=chatgpt.com "Baked-in Brilliance: Reranking Meets RL with mxbai-rerank-v2"
[4]: https://huggingface.co/Qwen/Qwen3.5-2B?utm_source=chatgpt.com "Qwen/Qwen3.5-2B · Hugging Face"
[5]: https://huggingface.co/Qwen/Qwen3.5-9B?utm_source=chatgpt.com "Qwen/Qwen3.5-9B · Hugging Face"
[6]: https://huggingface.co/mistralai/Mistral-Small-3.2-24B-Instruct-2506?utm_source=chatgpt.com "mistralai/Mistral-Small-3.2-24B-Instruct-2506 · Hugging Face"
[7]: https://help.openai.com/en/articles/11870455-openai-open-weight-models-gpt-oss?utm_source=chatgpt.com "OpenAI open-weight models (gpt-oss)"
[8]: https://docs.vllm.ai/?utm_source=chatgpt.com "vLLM"
[9]: https://github.com/ggml-org/llama.cpp?utm_source=chatgpt.com "GitHub - ggml-org/llama.cpp: LLM inference in C/C++ · GitHub"

i think some of your suggested models might be outdated. deepseek is at v4 and maybe even more already now

You’re right. My earlier model examples should be treated as **placeholder candidates**, not the final stack. DeepSeek has moved on: **DeepSeek‑V4 Preview is officially live**, with V4‑Pro and V4‑Flash; DeepSeek describes V4‑Pro as **1.6T total / 49B active parameters** and V4‑Flash as **284B total / 13B active parameters**, both with **1M context**. The Hugging Face card also lists DeepSeek‑V4‑Flash under the **MIT licence** and gives local deployment notes. ([DeepSeek API Docs][1])

So I would revise the model strategy this way:

# Revised principle

Do **not** design around one named model.

Design around a **model bench + router**:

```text
Task → cost/latency/quality requirement → allowed local models → eval result → chosen model
```

The product should make model replacement boring. DeepSeek V4 today, something else six months from now.

The durable system is still:

```text
Guideline graph
source-span provenance
retrieval/reranking
workflow state machine
eval harness
LLM gateway
local inference
human review
```

The model lineup is swappable.

# Updated local/open-weight candidate set

I would update the stack like this.

| Role                                   | Current candidates to benchmark                                                              | Notes                                                                                                                                                                                                                                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tiny/router/classifier**             | Qwen3.5 small models, Gemma 4 E2B/E4B, Phi-family small models                               | For routing, metadata tagging, abstention classification, low-risk JSON extraction.                                                                                                                                                                                                          |
| **Default lightweight workhorse**      | Qwen3.5‑9B, Gemma 4 12B, gpt‑oss‑20b                                                         | Good first tier for approved-guideline Q&A, simple extraction, summarization, and comment triage. OpenAI’s gpt‑oss models are open-weight, Apache 2.0, and intended to run locally/on infrastructure you control. ([OpenAI Help Center][2])                                                  |
| **Stronger on-prem worker**            | Qwen3.6‑27B, Qwen3.6‑35B‑A3B, Gemma 4 31B, Mistral Small 4                                   | For evidence-table extraction, difficult PICO matching, recommendation-impact scanning, and drafting update memos. Qwen3.6‑35B‑A3B is Apache 2.0, has 35B total / 3B activated parameters, supports long context, and is compatible with vLLM/SGLang. ([Hugging Face][3])                    |
| **Heavy local reasoning / batch mode** | DeepSeek‑V4‑Flash, DeepSeek‑V4‑Pro, Mistral Medium 3.5, gpt‑oss‑120b, Llama 4 Maverick/Scout | Use only for expensive, high-value tasks. DeepSeek V4 is very interesting, but even V4‑Flash has large total weights, so it is not automatically “lightweight.” Mistral Small 4 is Apache 2.0 but Mistral’s own page describes serious infrastructure requirements. ([DeepSeek API Docs][1]) |
| **Vision/document understanding**      | Qwen3.6 multimodal, Mistral Small 4, Gemma 4, Llama 4                                        | Useful for diagrams, scanned algorithms, pathway flowcharts, tables, and PDFs with visual structure. Gemma 4 comes in multiple sizes including E2B, E4B, 12B, 31B, and 26B‑A4B; Llama 4 Scout/Maverick are multimodal and long-context. ([Google AI for Developers][4])                      |

# Important correction on DeepSeek

DeepSeek V4 should absolutely be in the benchmark. But I would **not** automatically make it the default for Novara/CCA GURU.

Why?

Because “active parameters” are not the same as “cheap to deploy.” A MoE model may activate fewer parameters per token, but the server still needs to store and route through a very large total model. For Novara’s constraint — **no subsidizing LLM usage, no overkill, preferably local/open-weight** — DeepSeek‑V4‑Flash is more plausible than V4‑Pro, but both need hardware/cost validation.

So the corrected stance is:

```text
DeepSeek V4: benchmark for hard reasoning and long-context tasks.
Qwen/Gemma/gpt-oss small-mid models: default daily workers.
Mistral Small 4 / Qwen3.6-35B / Gemma 4 31B: stronger local workers.
DeepSeek V4-Pro: optional heavy batch/escalation tier only.
```

# Revised practical stack for the pilot

For a CCA GURU pilot, I would start with **two or three local tiers**, not one giant model.

## Tier 0: non-LLM first

Most work should be deterministic or retrieval-based:

```text
Postgres graph
OpenSearch/BM25
vector retrieval
reranker
source-span lookup
citation verifier
schema validator
workflow engine
```

No LLM call unless these layers have narrowed the task.

## Tier 1: cheap local model

Use for:

```text
approved-guideline Q&A
short summaries
routing
document classification
PICO field tagging
review-comment summarization
simple JSON extraction
```

Candidates:

```text
Qwen3.5‑9B
Gemma 4 12B
gpt‑oss‑20b
```

## Tier 2: stronger local model

Use for:

```text
evidence-table extraction
recommendation-impact scanning
guideline diffing
draft update memos
conflicting-evidence comparison
complex PICO matching
```

Candidates:

```text
Qwen3.6‑35B‑A3B
Qwen3.6‑27B
Gemma 4 31B
Mistral Small 4, if hardware supports it
```

## Tier 3: heavy batch/escalation model

Use only when:

```text
high-impact recommendation
uncertain evidence conflict
large update triage
retrospective benchmark run
methodologist explicitly requests escalation
```

Candidates:

```text
DeepSeek‑V4‑Flash
DeepSeek‑V4‑Pro
gpt‑oss‑120b
Mistral Medium 3.5
Llama 4 Maverick
```

These should be quota-controlled and probably scheduled as batch jobs.

# The right answer is a bake-off, not a model opinion

For this product, the model-selection process should be:

```text
1. Build 300–500 CCA/GURU-style eval tasks.
2. Run current local/open-weight candidates.
3. Measure quality, citation fidelity, JSON validity, abstention, latency, GPU cost.
4. Pick the cheapest model that clears the bar for each task.
5. Re-run monthly or quarterly as models change.
```

The eval set should include:

```text
100 approved-guideline Q&A questions
100 no-answer / abstention questions
100 abstract screening examples
50 evidence-table extraction examples
25 recommendation-impact mapping tasks
25 update-triage tasks
25 guideline-diff tasks
25 “must cite exact source span” tasks
```

The winning model is not “the newest model.” It is:

```text
cheapest model that passes the clinical-workflow eval with acceptable human-review burden
```

# Updated architecture implication

The LLM gateway becomes even more important.

```text
User task
  ↓
Task classifier
  ↓
Budget/quota gate
  ↓
Cache check
  ↓
Graph + retrieval
  ↓
Model router
  ↓
Local model inference
  ↓
Verifier
  ↓
Human review if needed
  ↓
Audit log
```

Example routing policy:

```json
{
  "task_type": "recommendation_impact_scan",
  "default_model": "qwen3.6-35b-a3b",
  "fallback_models": ["mistral-small-4", "deepseek-v4-flash"],
  "max_steps": 8,
  "max_gpu_seconds": 180,
  "external_api_allowed": false,
  "requires_human_review": true,
  "can_commit_graph_changes": false
}
```

# My corrected recommendation

I would now say:

> Start with **Qwen3.5/Gemma/gpt‑oss‑20b-class models** for cheap daily tasks, benchmark **Qwen3.6‑35B‑A3B / Gemma 4 31B / Mistral Small 4** for serious evidence workflow tasks, and keep **DeepSeek‑V4‑Flash** as the heavy local reasoning candidate. Do not default to DeepSeek‑V4‑Pro unless CCA/GURU has the hardware appetite and the evals prove the extra cost is worth it.

The key is that Novara should not be “the company that picked DeepSeek” or “the company that picked Qwen.” Novara should be the company with the **guideline graph workbench, local inference gateway, model eval harness, and cost-governed clinical workflow**. That way, when DeepSeek V5 or Qwen4 arrives, you swap it into the bench instead of rebuilding the product.

[1]: https://api-docs.deepseek.com/news/news260424?utm_source=chatgpt.com "DeepSeek V4 Preview Release | DeepSeek API Docs"
[2]: https://help.openai.com/en/articles/11870455-openai-open-weight-models-gpt-oss?utm_source=chatgpt.com "OpenAI open-weight models (gpt-oss)"
[3]: https://huggingface.co/Qwen/Qwen3.6-35B-A3B?utm_source=chatgpt.com "Qwen/Qwen3.6-35B-A3B · Hugging Face"
[4]: https://ai.google.dev/gemma/docs/core?utm_source=chatgpt.com "Gemma 4 model overview  |  Google AI for Developers"

