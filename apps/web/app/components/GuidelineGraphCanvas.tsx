"use client";

import React from "react";
import { useCallback, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  Handle,
  MiniMap,
  Node,
  NodeProps,
  OnMove,
  OnSelectionChangeParams,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState
} from "@xyflow/react";

type EvidenceNodeKind = "charter" | "question" | "evidence" | "decision" | "provenance" | "trace";
type EvidenceNodeGroup = "scope" | "questions" | "packets" | "provenance" | "review" | "models";
type DetailPriority = "high" | "normal";

type EvidenceNodeData = {
  title: string;
  type: string;
  kind: EvidenceNodeKind;
  group: EvidenceNodeGroup;
  priority: DetailPriority;
  summary: string;
  sourcePlaceholder: string;
  provenanceStatus: string;
  reviewerStatus: string;
};

type AtlasResource = {
  resource_id: string;
  title: string;
  disease_site: string;
  document_type: string;
  url: string;
  data_source: string;
  status: string;
};

type SourceDocumentRecord = {
  record_type: "source_document";
  resource_id: string;
  document_id: string;
  title: string;
  access_date: string;
  access_path: string;
  input_path: string;
  source_checksum_sha256: string;
  parser_version: string;
  extraction_timestamp: string;
  status: string;
};

type SourceSpanRecord = {
  record_type: "source_span";
  span_id: string;
  resource_id: string;
  document_id: string;
  source_document_id: string;
  access_date: string;
  stable_locator: string;
  quoted_text: string;
  quoted_span: string;
  excerpt_checksum: string;
  checksum_sha256: string;
  extraction_timestamp: string;
  timestamp: string;
  status: string;
  output_status: string;
};

type GraphReadyRecord = {
  record_type: "knowledgebase_record";
  record_id: string;
  resource_id: string;
  source_document_id: string;
  title: string;
  summary: string;
  source_span_ids: string[];
  output_status: string;
  model_version: string;
};

type KnowledgebaseFixture = {
  resources: AtlasResource[];
  sourceDocuments: Record<string, SourceDocumentRecord>;
  sourceSpans: Record<string, SourceSpanRecord>;
  graphRecords: Record<string, GraphReadyRecord>;
};

type SyntheticNodeDefinition = EvidenceNodeData & {
  id: string;
  position: { x: number; y: number };
};

const resourceFixture: AtlasResource[] = [
  {
    resource_id: "ahs-guru-breast-br005-adjuvant-rt-invasive-breast",
    title: "Adjuvant Radiotherapy for Invasive Breast Cancer",
    disease_site: "breast",
    document_type: "guideline",
    url: "https://www.albertahealthservices.ca/assets/info/hp/cancer/if-hp-cancer-guide-br005-adjuvant-rt-invasive-breast.pdf",
    data_source: "local_pilot_registry_fixture",
    status: "draft"
  },
  {
    resource_id: "ahs-guru-central-nervous-system-cns014-management-of-brain-metastases",
    title: "Brain Metastases",
    disease_site: "central-nervous-system",
    document_type: "guideline",
    url: "https://www.albertahealthservices.ca/assets/info/hp/cancer/if-hp-cancer-guide-cns014-management-of-brain-metastases.pdf",
    data_source: "local_pilot_registry_fixture",
    status: "draft"
  }
];

const safeSpanText = [
  "This synthetic paragraph describes a document maintenance workflow. It contains no patient-specific facts or clinical advice.",
  "Each derived record in this fixture keeps a stable locator, quoted text, and checksum so tests can verify provenance plumbing.",
  "The fixture remains generic and non-clinical. It exists only to exercise parser boundaries for source documents and source spans."
];

function safeIdPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_.:-]+/g, "-").replace(/-+/g, "-").replace(/^[-_.:]+|[-_.:]+$/g, "") || "record";
}

function buildKnowledgebaseFixture(resources: AtlasResource[]): KnowledgebaseFixture {
  const sourceDocuments: KnowledgebaseFixture["sourceDocuments"] = {};
  const sourceSpans: KnowledgebaseFixture["sourceSpans"] = {};
  const graphRecords: KnowledgebaseFixture["graphRecords"] = {};

  resources.forEach((resource) => {
    const resourceIdPart = safeIdPart(resource.resource_id);
    const document_id = `source-document.${resourceIdPart}.synthetic-guideline-note.abc123fixture`;
    const source_span_ids = safeSpanText.map((_text, index) => `${document_id}.p${String(index + 1).padStart(4, "0")}`.replace("source-document.", "source-span.source-document."));

    sourceDocuments[document_id] = {
      record_type: "source_document",
      resource_id: resource.resource_id,
      document_id,
      title: `Synthetic source-document fixture for ${resource.title}`,
      access_date: "2026-06-15",
      access_path: "tests/fixtures/source-documents/synthetic-guideline-note.txt",
      input_path: "tests/fixtures/source-documents/synthetic-guideline-note.txt",
      source_checksum_sha256: "sha256-local-synthetic-fixture",
      parser_version: "source-document-parser-skeleton-v1",
      extraction_timestamp: "2026-06-15T12:00:00Z",
      status: "draft"
    };

    source_span_ids.forEach((span_id, index) => {
      sourceSpans[span_id] = {
        record_type: "source_span",
        span_id,
        resource_id: resource.resource_id,
        document_id,
        source_document_id: document_id,
        access_date: "2026-06-15",
        stable_locator: `section:${index === 0 ? "synthetic-workbench-note" : "provenance-checks"};paragraph:${index + 1}`,
        quoted_text: safeSpanText[index],
        quoted_span: safeSpanText[index],
        excerpt_checksum: `sha256-span-${resourceIdPart}-${index + 1}`,
        checksum_sha256: `sha256-span-${resourceIdPart}-${index + 1}`,
        extraction_timestamp: "2026-06-15T12:00:00Z",
        timestamp: "2026-06-15T12:00:00Z",
        status: "draft",
        output_status: "draft"
      };
    });

    graphRecords[`knowledgebase-record.${resource.resource_id}`] = {
      record_type: "knowledgebase_record",
      record_id: `knowledgebase-record.${resource.resource_id}`,
      resource_id: resource.resource_id,
      source_document_id: document_id,
      title: resource.title,
      summary: "Local synthetic fixture record for testing provenance plumbing only.",
      source_span_ids,
      output_status: "draft",
      model_version: "none-local-fixture-only"
    };
  });

  return { resources, sourceDocuments, sourceSpans, graphRecords };
}

const knowledgebaseFixture = buildKnowledgebaseFixture(resourceFixture);

const syntheticNodeDefinitions: SyntheticNodeDefinition[] = [
  {
    id: "charter",
    title: "Synthetic Review Charter",
    type: "Workflow anchor",
    kind: "charter",
    group: "scope",
    priority: "high",
    position: { x: -360, y: -80 },
    summary: "Defines a mock update scope for interface testing without clinical recommendations.",
    sourcePlaceholder: "SYNTH-CHARTER-001 · section placeholder",
    provenanceStatus: "Draft placeholder",
    reviewerStatus: "Unreviewed synthetic fixture"
  },
  {
    id: "scope-frame",
    title: "Scope Frame",
    type: "Planning marker",
    kind: "charter",
    group: "scope",
    priority: "normal",
    position: { x: -500, y: 20 },
    summary: "Synthetic boundary marker for graph navigation tests.",
    sourcePlaceholder: "SYNTH-SCOPE-006 · locator placeholder",
    provenanceStatus: "Boundary placeholder",
    reviewerStatus: "Design QA only"
  },
  {
    id: "intake-slot",
    title: "Intake Slot",
    type: "Queue marker",
    kind: "charter",
    group: "scope",
    priority: "normal",
    position: { x: -460, y: -180 },
    summary: "Represents a synthetic intake position for future source packets.",
    sourcePlaceholder: "SYNTH-INTAKE-007 · registry placeholder",
    provenanceStatus: "Metadata-only placeholder",
    reviewerStatus: "Synthetic only"
  },
  {
    id: "guardrail",
    title: "Safety Guardrail",
    type: "Policy marker",
    kind: "provenance",
    group: "scope",
    priority: "high",
    position: { x: -270, y: 90 },
    summary: "Marks no-PHI and no patient-specific-advice boundaries for the prototype.",
    sourcePlaceholder: "SYNTH-SAFETY-008 · policy placeholder",
    provenanceStatus: "Required boundary visible",
    reviewerStatus: "Governance placeholder"
  },
  {
    id: "question",
    title: "Mock Review Question",
    type: "Question node",
    kind: "question",
    group: "questions",
    priority: "high",
    position: { x: -70, y: -190 },
    summary: "Represents a non-clinical question slot used to test graph navigation and focus states.",
    sourcePlaceholder: "SYNTH-QUESTION-002 · locator pending",
    provenanceStatus: "Needs source span before real use",
    reviewerStatus: "Design QA only"
  },
  {
    id: "population-token",
    title: "Population Token",
    type: "Question facet",
    kind: "question",
    group: "questions",
    priority: "normal",
    position: { x: -170, y: -310 },
    summary: "Synthetic facet node with no patient-specific content.",
    sourcePlaceholder: "SYNTH-FACET-009 · placeholder",
    provenanceStatus: "Facet placeholder",
    reviewerStatus: "No clinical assertion"
  },
  {
    id: "comparison-token",
    title: "Comparison Token",
    type: "Question facet",
    kind: "question",
    group: "questions",
    priority: "normal",
    position: { x: 40, y: -315 },
    summary: "Synthetic comparison marker for dense graph layout testing.",
    sourcePlaceholder: "SYNTH-FACET-010 · placeholder",
    provenanceStatus: "Facet placeholder",
    reviewerStatus: "Synthetic only"
  },
  {
    id: "outcome-token",
    title: "Outcome Token",
    type: "Question facet",
    kind: "question",
    group: "questions",
    priority: "normal",
    position: { x: 80, y: -120 },
    summary: "Non-clinical outcome-slot marker for interaction testing.",
    sourcePlaceholder: "SYNTH-FACET-011 · placeholder",
    provenanceStatus: "Facet placeholder",
    reviewerStatus: "Synthetic fixture"
  },
  {
    id: "eligibility-check",
    title: "Eligibility Check",
    type: "Screening marker",
    kind: "question",
    group: "questions",
    priority: "normal",
    position: { x: -150, y: -55 },
    summary: "Mock screening checkpoint for graph semantics only.",
    sourcePlaceholder: "SYNTH-SCREEN-012 · placeholder",
    provenanceStatus: "Screening placeholder",
    reviewerStatus: "Unreviewed synthetic fixture"
  },
  {
    id: "evidence",
    title: "Synthetic Evidence Packet",
    type: "Evidence item",
    kind: "evidence",
    group: "packets",
    priority: "high",
    position: { x: 260, y: -90 },
    summary: "A fabricated packet marker for testing source-span affordances and edge labels.",
    sourcePlaceholder: "SYNTH-EVIDENCE-003 · checksum placeholder",
    provenanceStatus: "Checksum placeholder only",
    reviewerStatus: "No clinical assertion"
  },
  {
    id: "packet-alpha",
    title: "Packet Alpha",
    type: "Evidence packet",
    kind: "evidence",
    group: "packets",
    priority: "normal",
    position: { x: 205, y: -245 },
    summary: "Synthetic packet stub used only for graph density.",
    sourcePlaceholder: "SYNTH-PACKET-013 · checksum placeholder",
    provenanceStatus: "Checksum placeholder",
    reviewerStatus: "Synthetic only"
  },
  {
    id: "packet-beta",
    title: "Packet Beta",
    type: "Evidence packet",
    kind: "evidence",
    group: "packets",
    priority: "normal",
    position: { x: 390, y: -210 },
    summary: "Synthetic packet stub with source-span placeholder metadata.",
    sourcePlaceholder: "SYNTH-PACKET-014 · checksum placeholder",
    provenanceStatus: "Checksum placeholder",
    reviewerStatus: "No clinical assertion"
  },
  {
    id: "packet-gamma",
    title: "Packet Gamma",
    type: "Evidence packet",
    kind: "evidence",
    group: "packets",
    priority: "normal",
    position: { x: 450, y: -20 },
    summary: "Fabricated packet marker for cluster testing.",
    sourcePlaceholder: "SYNTH-PACKET-015 · checksum placeholder",
    provenanceStatus: "Checksum placeholder",
    reviewerStatus: "Synthetic fixture"
  },
  {
    id: "packet-delta",
    title: "Packet Delta",
    type: "Evidence packet",
    kind: "evidence",
    group: "packets",
    priority: "normal",
    position: { x: 245, y: 70 },
    summary: "Synthetic graph-density packet marker.",
    sourcePlaceholder: "SYNTH-PACKET-016 · checksum placeholder",
    provenanceStatus: "Checksum placeholder",
    reviewerStatus: "Unreviewed synthetic fixture"
  },
  {
    id: "abstract-slot",
    title: "Abstract Slot",
    type: "Extraction marker",
    kind: "evidence",
    group: "packets",
    priority: "normal",
    position: { x: 570, y: -140 },
    summary: "Placeholder for future extraction fields without real content.",
    sourcePlaceholder: "SYNTH-ABSTRACT-017 · excerpt placeholder",
    provenanceStatus: "Excerpt placeholder",
    reviewerStatus: "Synthetic only"
  },
  {
    id: "quality-slot",
    title: "Quality Slot",
    type: "Appraisal marker",
    kind: "evidence",
    group: "packets",
    priority: "normal",
    position: { x: 610, y: 40 },
    summary: "Mock appraisal position for graph interaction tests.",
    sourcePlaceholder: "SYNTH-QUALITY-018 · placeholder",
    provenanceStatus: "Appraisal placeholder",
    reviewerStatus: "Design QA only"
  },
  {
    id: "provenance",
    title: "Source Span Ledger Slot",
    type: "Provenance node",
    kind: "provenance",
    group: "provenance",
    priority: "high",
    position: { x: -120, y: 250 },
    summary: "A placeholder for document identifier, stable locator, quote, reviewer, and status metadata.",
    sourcePlaceholder: "SYNTH-SPAN-005 · quoted excerpt placeholder",
    provenanceStatus: "Required for any future claim",
    reviewerStatus: "Not approved"
  },
  {
    id: "span-a",
    title: "Span A",
    type: "Source span",
    kind: "provenance",
    group: "provenance",
    priority: "normal",
    position: { x: -260, y: 330 },
    summary: "Synthetic quoted-span placeholder without clinical content.",
    sourcePlaceholder: "SYNTH-SPAN-019 · quote placeholder",
    provenanceStatus: "Quote placeholder",
    reviewerStatus: "Needs human review"
  },
  {
    id: "span-b",
    title: "Span B",
    type: "Source span",
    kind: "provenance",
    group: "provenance",
    priority: "normal",
    position: { x: -50, y: 390 },
    summary: "Synthetic span marker for edge-density checks.",
    sourcePlaceholder: "SYNTH-SPAN-020 · quote placeholder",
    provenanceStatus: "Quote placeholder",
    reviewerStatus: "Draft status"
  },
  {
    id: "span-c",
    title: "Span C",
    type: "Source span",
    kind: "provenance",
    group: "provenance",
    priority: "normal",
    position: { x: 120, y: 300 },
    summary: "Synthetic locator marker for future checksum-backed excerpts.",
    sourcePlaceholder: "SYNTH-SPAN-021 · locator placeholder",
    provenanceStatus: "Locator placeholder",
    reviewerStatus: "Synthetic fixture"
  },
  {
    id: "registry-link",
    title: "Registry Link",
    type: "Metadata marker",
    kind: "provenance",
    group: "provenance",
    priority: "normal",
    position: { x: -330, y: 205 },
    summary: "Marks that resources stay anchored to metadata registry rows.",
    sourcePlaceholder: "SYNTH-REGISTRY-022 · metadata-only placeholder",
    provenanceStatus: "Metadata linked placeholder",
    reviewerStatus: "Governance placeholder"
  },
  {
    id: "decision",
    title: "Example Review Decision",
    type: "Decision node",
    kind: "decision",
    group: "review",
    priority: "high",
    position: { x: 300, y: 245 },
    summary: "Shows how a future reviewer decision may be inspected without generating advice.",
    sourcePlaceholder: "SYNTH-DECISION-004 · source span required",
    provenanceStatus: "Under-review placeholder",
    reviewerStatus: "Synthetic reviewer label"
  },
  {
    id: "triage-slot",
    title: "Triage Slot",
    type: "Review marker",
    kind: "decision",
    group: "review",
    priority: "normal",
    position: { x: 180, y: 190 },
    summary: "Synthetic review queue marker for detail reveal testing.",
    sourcePlaceholder: "SYNTH-TRIAGE-023 · review placeholder",
    provenanceStatus: "Review placeholder",
    reviewerStatus: "Unreviewed synthetic fixture"
  },
  {
    id: "consensus-slot",
    title: "Consensus Slot",
    type: "Review marker",
    kind: "decision",
    group: "review",
    priority: "normal",
    position: { x: 430, y: 185 },
    summary: "Mock consensus-position marker with no recommendation text.",
    sourcePlaceholder: "SYNTH-CONSENSUS-024 · placeholder",
    provenanceStatus: "Consensus placeholder",
    reviewerStatus: "Synthetic only"
  },
  {
    id: "approval-slot",
    title: "Approval Slot",
    type: "Review marker",
    kind: "decision",
    group: "review",
    priority: "normal",
    position: { x: 540, y: 315 },
    summary: "Prototype status marker for future bounded review workflows.",
    sourcePlaceholder: "SYNTH-APPROVAL-025 · placeholder",
    provenanceStatus: "Not approved placeholder",
    reviewerStatus: "Human review required"
  },
  {
    id: "revision-slot",
    title: "Revision Slot",
    type: "Review marker",
    kind: "decision",
    group: "review",
    priority: "normal",
    position: { x: 210, y: 365 },
    summary: "Synthetic revision-loop marker for canvas behavior only.",
    sourcePlaceholder: "SYNTH-REVISION-026 · placeholder",
    provenanceStatus: "Revision placeholder",
    reviewerStatus: "Design QA only"
  },
  {
    id: "model-trace",
    title: "Model Trace Stub",
    type: "Trace node",
    kind: "trace",
    group: "models",
    priority: "high",
    position: { x: -30, y: 20 },
    summary: "Synthetic local-first model trace placeholder; no external routing is implied.",
    sourcePlaceholder: "SYNTH-TRACE-027 · prompt/version placeholder",
    provenanceStatus: "Trace placeholder",
    reviewerStatus: "No model output approved"
  },
  {
    id: "prompt-slot",
    title: "Prompt Slot",
    type: "Trace marker",
    kind: "trace",
    group: "models",
    priority: "normal",
    position: { x: -30, y: 110 },
    summary: "Placeholder for prompt metadata in a future approved workflow.",
    sourcePlaceholder: "SYNTH-PROMPT-028 · version placeholder",
    provenanceStatus: "Version placeholder",
    reviewerStatus: "Synthetic only"
  },
  {
    id: "cache-slot",
    title: "Cache Slot",
    type: "Trace marker",
    kind: "trace",
    group: "models",
    priority: "normal",
    position: { x: 90, y: 80 },
    summary: "Synthetic cache marker for local-first gateway affordances.",
    sourcePlaceholder: "SYNTH-CACHE-029 · ledger placeholder",
    provenanceStatus: "Ledger placeholder",
    reviewerStatus: "Synthetic fixture"
  },
  {
    id: "quota-slot",
    title: "Quota Slot",
    type: "Trace marker",
    kind: "trace",
    group: "models",
    priority: "normal",
    position: { x: -135, y: 110 },
    summary: "Synthetic quota marker for bounded-agent policy testing.",
    sourcePlaceholder: "SYNTH-QUOTA-030 · ledger placeholder",
    provenanceStatus: "Ledger placeholder",
    reviewerStatus: "Governance placeholder"
  },
  {
    id: "audit-event",
    title: "Audit Event",
    type: "Trace marker",
    kind: "trace",
    group: "models",
    priority: "normal",
    position: { x: 35, y: -55 },
    summary: "Synthetic audit event marker for provenance visibility.",
    sourcePlaceholder: "SYNTH-AUDIT-031 · event placeholder",
    provenanceStatus: "Event placeholder",
    reviewerStatus: "Not approved"
  },
  {
    id: "review-note-a",
    title: "Review Note A",
    type: "Annotation marker",
    kind: "decision",
    group: "review",
    priority: "normal",
    position: { x: 650, y: 210 },
    summary: "Synthetic annotation node used to create Obsidian-like graph density.",
    sourcePlaceholder: "SYNTH-NOTE-032 · annotation placeholder",
    provenanceStatus: "Annotation placeholder",
    reviewerStatus: "Design QA only"
  },
  {
    id: "review-note-b",
    title: "Review Note B",
    type: "Annotation marker",
    kind: "decision",
    group: "review",
    priority: "normal",
    position: { x: 625, y: 430 },
    summary: "Synthetic annotation node used to test sparse labels.",
    sourcePlaceholder: "SYNTH-NOTE-033 · annotation placeholder",
    provenanceStatus: "Annotation placeholder",
    reviewerStatus: "Synthetic fixture"
  },
  {
    id: "source-index-a",
    title: "Source Index A",
    type: "Index marker",
    kind: "provenance",
    group: "provenance",
    priority: "normal",
    position: { x: -445, y: 300 },
    summary: "Metadata-only index marker for resource governance affordances.",
    sourcePlaceholder: "SYNTH-INDEX-034 · metadata placeholder",
    provenanceStatus: "Metadata-only placeholder",
    reviewerStatus: "Governance placeholder"
  },
  {
    id: "method-note-a",
    title: "Method Note A",
    type: "Method marker",
    kind: "question",
    group: "questions",
    priority: "normal",
    position: { x: 130, y: -255 },
    summary: "Synthetic method note for visual graph density only.",
    sourcePlaceholder: "SYNTH-METHOD-035 · placeholder",
    provenanceStatus: "Method placeholder",
    reviewerStatus: "Synthetic only"
  },
  {
    id: "method-note-b",
    title: "Method Note B",
    type: "Method marker",
    kind: "question",
    group: "questions",
    priority: "normal",
    position: { x: -255, y: -250 },
    summary: "Synthetic method note with no real guideline claim.",
    sourcePlaceholder: "SYNTH-METHOD-036 · placeholder",
    provenanceStatus: "Method placeholder",
    reviewerStatus: "Design QA only"
  }
];

const syntheticNodes: Node<EvidenceNodeData>[] = syntheticNodeDefinitions.map(({ id, position, ...data }) => ({
  id,
  type: "evidenceNode",
  position,
  data
}));

function edge(id: string, source: string, target: string, animated = false): Edge {
  return { id, source, target, type: "straight", animated, className: "atlas-edge" };
}

const syntheticEdges: Edge[] = [
  edge("charter-question", "charter", "question", true),
  edge("charter-scope", "charter", "scope-frame"),
  edge("charter-guardrail", "charter", "guardrail"),
  edge("scope-intake", "scope-frame", "intake-slot"),
  edge("scope-registry", "scope-frame", "registry-link"),
  edge("question-population", "question", "population-token"),
  edge("question-comparison", "question", "comparison-token"),
  edge("question-outcome", "question", "outcome-token"),
  edge("question-eligibility", "question", "eligibility-check"),
  edge("question-method-a", "question", "method-note-a"),
  edge("question-method-b", "question", "method-note-b"),
  edge("question-evidence", "question", "evidence", true),
  edge("population-method-b", "population-token", "method-note-b"),
  edge("comparison-method-a", "comparison-token", "method-note-a"),
  edge("outcome-evidence", "outcome-token", "evidence"),
  edge("eligibility-evidence", "eligibility-check", "evidence"),
  edge("evidence-alpha", "evidence", "packet-alpha"),
  edge("evidence-beta", "evidence", "packet-beta"),
  edge("evidence-gamma", "evidence", "packet-gamma"),
  edge("evidence-delta", "evidence", "packet-delta"),
  edge("evidence-abstract", "evidence", "abstract-slot"),
  edge("evidence-quality", "evidence", "quality-slot"),
  edge("alpha-beta", "packet-alpha", "packet-beta"),
  edge("beta-gamma", "packet-beta", "packet-gamma"),
  edge("gamma-quality", "packet-gamma", "quality-slot"),
  edge("delta-quality", "packet-delta", "quality-slot"),
  edge("evidence-decision", "evidence", "decision", true),
  edge("packet-delta-triage", "packet-delta", "triage-slot"),
  edge("quality-consensus", "quality-slot", "consensus-slot"),
  edge("decision-triage", "triage-slot", "decision"),
  edge("decision-consensus", "decision", "consensus-slot"),
  edge("decision-approval", "decision", "approval-slot"),
  edge("decision-revision", "decision", "revision-slot"),
  edge("review-note-a", "consensus-slot", "review-note-a"),
  edge("review-note-b", "approval-slot", "review-note-b"),
  edge("provenance-charter", "provenance", "charter"),
  edge("provenance-decision", "provenance", "decision", true),
  edge("provenance-span-a", "provenance", "span-a"),
  edge("provenance-span-b", "provenance", "span-b"),
  edge("provenance-span-c", "provenance", "span-c"),
  edge("span-a-registry", "span-a", "registry-link"),
  edge("span-b-evidence", "span-b", "evidence"),
  edge("span-c-decision", "span-c", "decision"),
  edge("source-index-registry", "source-index-a", "registry-link"),
  edge("source-index-span-a", "source-index-a", "span-a"),
  edge("model-trace-question", "model-trace", "question"),
  edge("model-trace-evidence", "model-trace", "evidence"),
  edge("model-trace-prompt", "model-trace", "prompt-slot"),
  edge("model-trace-cache", "model-trace", "cache-slot"),
  edge("model-trace-quota", "model-trace", "quota-slot"),
  edge("model-trace-audit", "model-trace", "audit-event"),
  edge("audit-provenance", "audit-event", "provenance"),
  edge("guardrail-quota", "guardrail", "quota-slot"),
  edge("guardrail-audit", "guardrail", "audit-event")
];

const groupLabels: Record<EvidenceNodeGroup, string> = {
  scope: "Scope",
  questions: "Questions",
  packets: "Packets",
  provenance: "Provenance",
  review: "Review",
  models: "Traces"
};

const nodeTypeLabels: Record<EvidenceNodeKind, string> = {
  charter: "Atlas index",
  question: "Review lens",
  evidence: "Evidence packet",
  decision: "Decision dock",
  provenance: "Source ledger",
  trace: "Model trace"
};

function EvidenceAtlasNode({ data, selected }: NodeProps<Node<EvidenceNodeData>>) {
  return (
    <button
      className={`atlas-node atlas-node--${data.kind}`}
      type="button"
      data-selected={selected}
      data-priority={data.priority}
      data-group={data.group}
      aria-label={`${data.title}, ${data.type}. ${data.summary}`}
    >
      <Handle className="atlas-node__handle" type="target" position={Position.Left} />
      <span className="atlas-node__dot" aria-hidden="true" />
      <span className="atlas-node__label">{data.title}</span>
      <span className="atlas-node__meta">{nodeTypeLabels[data.kind]} · {groupLabels[data.group]}</span>
      <span className="atlas-node__provenance">{data.provenanceStatus}</span>
      <Handle className="atlas-node__handle" type="source" position={Position.Right} />
    </button>
  );
}

export function GuidelineGraphCanvas() {
  const [nodes, , onNodesChange] = useNodesState(syntheticNodes);
  const [edges, , onEdgesChange] = useEdgesState(syntheticEdges);
  const [hoveredNode, setHoveredNode] = useState<Node<EvidenceNodeData> | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node<EvidenceNodeData> | null>(syntheticNodes[0]);
  const [selectedResourceId, setSelectedResourceId] = useState(knowledgebaseFixture.resources[0].resource_id);
  const [activeSpanId, setActiveSpanId] = useState(
    knowledgebaseFixture.graphRecords[`knowledgebase-record.${knowledgebaseFixture.resources[0].resource_id}`].source_span_ids[0]
  );
  const [zoomLevel, setZoomLevel] = useState(0.72);

  const nodeTypes = useMemo(() => ({ evidenceNode: EvidenceAtlasNode }), []);
  const detailMode = zoomLevel >= 1.05 ? "semantic" : "map";
  const selectedResource = knowledgebaseFixture.resources.find((resource) => resource.resource_id === selectedResourceId) ?? knowledgebaseFixture.resources[0];
  const graphRecord = knowledgebaseFixture.graphRecords[`knowledgebase-record.${selectedResource.resource_id}`];
  const sourceDocument = knowledgebaseFixture.sourceDocuments[graphRecord.source_document_id];
  const sourceSpans = graphRecord.source_span_ids.map((spanId) => knowledgebaseFixture.sourceSpans[spanId]);
  const activeSpan = knowledgebaseFixture.sourceSpans[activeSpanId] ?? sourceSpans[0];
  const topicCounts = useMemo(() => {
    return knowledgebaseFixture.resources.reduce<Record<string, number>>((counts, resource) => {
      counts[resource.disease_site] = (counts[resource.disease_site] ?? 0) + 1;
      return counts;
    }, {});
  }, []);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node<EvidenceNodeData>) => {
    setSelectedNode(node);
  }, []);

  const handleResourceSelect = useCallback((resourceId: string) => {
    const nextRecord = knowledgebaseFixture.graphRecords[`knowledgebase-record.${resourceId}`];
    setSelectedResourceId(resourceId);
    setActiveSpanId(nextRecord.source_span_ids[0]);
    setSelectedNode(syntheticNodes.find((node) => node.id === "provenance") ?? syntheticNodes[0]);
  }, []);

  const handleKeyboardSelect = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    setSelectedNode((current) => current ?? syntheticNodes[0]);
  }, []);

  const handleSelectionChange = useCallback((selection: OnSelectionChangeParams) => {
    if (selection.nodes.length > 0) {
      setSelectedNode(selection.nodes[0] as Node<EvidenceNodeData>);
    }
  }, []);

  const handleMove = useCallback<OnMove>((_event, viewport) => {
    setZoomLevel(Number(viewport.zoom.toFixed(2)));
  }, []);

  return (
    <section className="graph-workbench" aria-label="Synthetic guideline graph prototype">
      <div className="graph-layout">
        <aside className="atlas-sidebar" aria-label="Atlas resource and topic navigation">
          <div className="sidebar-section">
            <p className="eyebrow">Vault</p>
            <h2>Evidence Atlas</h2>
            <span className="sidebar-caption">Graph-first knowledgebase IDE</span>
          </div>
          <nav className="atlas-nav" aria-label="Knowledgebase resources">
            {knowledgebaseFixture.resources.map((resource) => (
              <button
                key={resource.resource_id}
                type="button"
                data-active={resource.resource_id === selectedResource.resource_id}
                aria-pressed={resource.resource_id === selectedResource.resource_id}
                onClick={() => handleResourceSelect(resource.resource_id)}
              >
                <span>{resource.title}</span>
                <small>{resource.disease_site} · {resource.document_type}</small>
              </button>
            ))}
          </nav>
          <nav className="atlas-topic-nav" aria-label="Knowledgebase topics">
            <p className="eyebrow">Topics</p>
            {Object.entries(topicCounts).map(([topic, count]) => (
              <span key={topic}>{topic} · {count}</span>
            ))}
          </nav>
          <div className="sidebar-section sidebar-section--compact">
            <p className="eyebrow">Layer status</p>
            <ul className="layer-list">
              <li><span className="layer-dot layer-dot--cyan" /> {syntheticNodes.length} synthetic nodes</li>
              <li><span className="layer-dot layer-dot--gold" /> {graphRecord.source_span_ids.length} source spans</li>
              <li><span className="layer-dot layer-dot--red" /> No clinical advice</li>
            </ul>
          </div>
        </aside>

        <div
          className="graph-canvas"
          data-testid="guideline-graph-canvas"
          data-detail={detailMode}
          tabIndex={0}
          role="application"
          aria-label="Interactive synthetic guideline graph. Use mouse, trackpad, or controls to pan and zoom. Zoom in to reveal node labels and provenance details."
          onKeyDown={handleKeyboardSelect}
        >
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              onNodeMouseEnter={(_event, node) => setHoveredNode(node)}
              onNodeMouseLeave={() => setHoveredNode(null)}
              onPaneClick={() => setSelectedNode(null)}
              onSelectionChange={handleSelectionChange}
              onMove={handleMove}
              fitView
              fitViewOptions={{ padding: 0.18 }}
              minZoom={0.28}
              maxZoom={2.4}
              proOptions={{ hideAttribution: true }}
              defaultEdgeOptions={{ className: "atlas-edge" }}
            >
              <Background color="var(--color-grid)" gap={32} size={1.1} variant={BackgroundVariant.Dots} />
              <Controls className="atlas-controls" showInteractive={false} />
              <MiniMap className="atlas-minimap" nodeStrokeWidth={3} pannable zoomable />
            </ReactFlow>
          </ReactFlowProvider>

          <div className="graph-view-title" aria-label="Graph view status">
            <span>Graph view</span>
            <strong>{selectedResource.title}</strong>
            <small>{detailMode === "semantic" ? "detail labels visible" : "map labels sparse"} · {graphRecord.record_type}</small>
          </div>

          <GraphSettingsPanel zoomLevel={zoomLevel} />
          <SourceDocumentPanel
            sourceDocument={sourceDocument}
            sourceSpans={sourceSpans}
            activeSpanId={activeSpan.span_id}
            onSpanSelect={setActiveSpanId}
          />
          {hoveredNode ? <NodeHoverCard node={hoveredNode} /> : null}
        </div>
        <ProvenanceInspector
          node={selectedNode}
          resource={selectedResource}
          graphRecord={graphRecord}
          sourceDocument={sourceDocument}
          activeSpan={activeSpan}
        />
      </div>
      <footer className="evidence-console" aria-label="Evidence trace console" data-testid="atlas-workbench">
        <span>workbench: queued extraction review placeholder</span>
        <span>{selectedResource.resource_id}</span>
        <span>{graphRecord.record_id}</span>
        <span>{activeSpan.span_id}</span>
        <span>no patient data</span>
      </footer>
    </section>
  );
}

function GraphSettingsPanel({ zoomLevel }: { zoomLevel: number }) {
  return (
    <aside className="graph-settings" aria-label="Graph display settings">
      <div className="graph-settings__header">
        <span className="eyebrow">Graph controls</span>
        <strong>Filters</strong>
      </div>
      <label className="filter-field">
        <span>Search resources...</span>
        <input type="search" value="source spans" readOnly aria-label="Filter synthetic graph nodes" />
      </label>
      <div className="toggle-list" aria-label="Graph filter toggles">
        <label><input type="checkbox" checked readOnly /> Metadata</label>
        <label><input type="checkbox" checked readOnly /> Source spans</label>
        <label><input type="checkbox" readOnly /> Approved only</label>
        <label><input type="checkbox" checked readOnly /> Draft nodes</label>
      </div>
      <details open>
        <summary>Groups</summary>
        <ul className="group-list">
          <li><span className="layer-dot layer-dot--cyan" /> Source spans</li>
          <li><span className="layer-dot layer-dot--gold" /> Review workflow</li>
          <li><span className="layer-dot layer-dot--green" /> Evidence packets</li>
          <li><span className="layer-dot layer-dot--red" /> Safety markers</li>
        </ul>
      </details>
      <details open>
        <summary>Display</summary>
        <div className="settings-meter"><span style={{ width: `${Math.min(100, Math.max(18, zoomLevel * 48))}%` }} /> label threshold</div>
        <div className="settings-value">Zoom detail: {zoomLevel >= 1.05 ? "semantic" : "sparse map"}</div>
      </details>
      <details>
        <summary>Forces</summary>
        <div className="settings-value">Center strength · synthetic preview</div>
        <div className="settings-value">Link distance · clustered</div>
      </details>
    </aside>
  );
}

function SourceDocumentPanel({
  sourceDocument,
  sourceSpans,
  activeSpanId,
  onSpanSelect
}: {
  sourceDocument: SourceDocumentRecord;
  sourceSpans: SourceSpanRecord[];
  activeSpanId: string;
  onSpanSelect: (spanId: string) => void;
}) {
  return (
    <aside className="source-document-panel" data-testid="source-document-panel" aria-label="Source document and span browser">
      <div className="source-document-panel__header">
        <span className="eyebrow">Source view</span>
        <strong>{sourceDocument.record_type}</strong>
      </div>
      <dl className="source-document-meta">
        <div>
          <dt>Document ID</dt>
          <dd>{sourceDocument.document_id}</dd>
        </div>
        <div>
          <dt>Parser</dt>
          <dd>{sourceDocument.parser_version}</dd>
        </div>
      </dl>
      <div className="source-span-list" role="list" aria-label="Source spans for selected resource">
        {sourceSpans.map((span) => (
          <button
            key={span.span_id}
            type="button"
            data-active={span.span_id === activeSpanId}
            onClick={() => onSpanSelect(span.span_id)}
          >
            <span>{span.stable_locator}</span>
            <strong>{span.span_id}</strong>
          </button>
        ))}
      </div>
    </aside>
  );
}

function NodeHoverCard({ node }: { node: Node<EvidenceNodeData> }) {
  return (
    <aside className="node-hover-card" data-testid="node-hover-card" aria-live="polite">
      <span>{node.data.type}</span>
      <strong>{node.data.title}</strong>
      <p>{node.data.summary}</p>
      <p>{node.data.sourcePlaceholder}</p>
    </aside>
  );
}

function ProvenanceInspector({
  node,
  resource,
  graphRecord,
  sourceDocument,
  activeSpan
}: {
  node: Node<EvidenceNodeData> | null;
  resource: AtlasResource;
  graphRecord: GraphReadyRecord;
  sourceDocument: SourceDocumentRecord;
  activeSpan: SourceSpanRecord;
}) {
  return (
    <aside
      className="node-inspector"
      data-testid="node-inspector"
      aria-label={node ? `Provenance inspector for ${node.data.title}` : "Provenance inspector"}
    >
      <p className="eyebrow">Provenance inspector</p>
      <h2>{node ? node.data.title : "No graph node selected"}</h2>
      <dl>
        <div>
          <dt>Resource metadata</dt>
          <dd>{resource.title} · {resource.disease_site} · {resource.status}</dd>
        </div>
        <div>
          <dt>Resource ID</dt>
          <dd>{resource.resource_id}</dd>
        </div>
        <div>
          <dt>Graph-ready node</dt>
          <dd>{graphRecord.record_id}</dd>
        </div>
        <div>
          <dt>Model version</dt>
          <dd>{graphRecord.model_version}</dd>
        </div>
        <div>
          <dt>Source document</dt>
          <dd>{sourceDocument.document_id}</dd>
        </div>
        <div>
          <dt>Active source span ID</dt>
          <dd>{activeSpan.span_id}</dd>
        </div>
        <div>
          <dt>Stable locator</dt>
          <dd>{activeSpan.stable_locator}</dd>
        </div>
        <div>
          <dt>Quoted span</dt>
          <dd>{activeSpan.quoted_text}</dd>
        </div>
        <div>
          <dt>Graph source spans</dt>
          <dd>{graphRecord.source_span_ids.join(" · ")}</dd>
        </div>
        {node ? (
          <>
            <div>
              <dt>Selected graph type</dt>
              <dd>{node.data.type}</dd>
            </div>
            <div>
              <dt>Graph summary</dt>
              <dd>{node.data.summary}</dd>
            </div>
            <div>
              <dt>Node provenance status</dt>
              <dd>{node.data.provenanceStatus}</dd>
            </div>
          </>
        ) : null}
        <div>
          <dt>Synthetic warning</dt>
          <dd>No patient data, no clinical advice, and no approved clinical claim.</dd>
        </div>
      </dl>
    </aside>
  );
}
