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

type SyntheticNodeDefinition = EvidenceNodeData & {
  id: string;
  position: { x: number; y: number };
};

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
    type: "Permission marker",
    kind: "provenance",
    group: "provenance",
    priority: "normal",
    position: { x: -330, y: 205 },
    summary: "Marks that future resources require registry permission rows.",
    sourcePlaceholder: "SYNTH-REGISTRY-022 · metadata-only placeholder",
    provenanceStatus: "Permission pending placeholder",
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
  const [zoomLevel, setZoomLevel] = useState(0.72);

  const nodeTypes = useMemo(() => ({ evidenceNode: EvidenceAtlasNode }), []);
  const detailMode = zoomLevel >= 1.05 ? "semantic" : "map";

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node<EvidenceNodeData>) => {
    setSelectedNode(node);
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
        <aside className="atlas-sidebar" aria-label="Atlas navigation layers">
          <div className="sidebar-section">
            <p className="eyebrow">Vault</p>
            <h2>Evidence Atlas</h2>
            <span className="sidebar-caption">Synthetic graph vault</span>
          </div>
          <nav className="atlas-nav" aria-label="Synthetic graph layers">
            <button type="button" data-active="true">Graph map</button>
            <button type="button">Source spans</button>
            <button type="button">Review queue</button>
            <button type="button">Model traces</button>
          </nav>
          <div className="sidebar-section sidebar-section--compact">
            <p className="eyebrow">Layer status</p>
            <ul className="layer-list">
              <li><span className="layer-dot layer-dot--cyan" /> {syntheticNodes.length} synthetic nodes</li>
              <li><span className="layer-dot layer-dot--gold" /> {syntheticEdges.length} provenance edges</li>
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
            <strong>synthetic-atlas.graph</strong>
            <small>{detailMode === "semantic" ? "detail labels visible" : "map labels sparse"} · zoom {Math.round(zoomLevel * 100)}%</small>
          </div>

          <GraphSettingsPanel zoomLevel={zoomLevel} />
          {hoveredNode ? <NodeHoverCard node={hoveredNode} /> : null}
          <NodeInspector node={selectedNode} />
        </div>
      </div>
      <footer className="evidence-console" aria-label="Evidence trace console">
        <span>trace: synthetic-atlas.graph loaded</span>
        <span>36-node dense map</span>
        <span>zoom reveals semantic labels</span>
        <span>source-span placeholders visible</span>
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
        <span>Search files...</span>
        <input type="search" value="synthetic group" readOnly aria-label="Filter synthetic graph nodes" />
      </label>
      <div className="toggle-list" aria-label="Graph filter toggles">
        <label><input type="checkbox" checked readOnly /> Tags</label>
        <label><input type="checkbox" checked readOnly /> Attachments</label>
        <label><input type="checkbox" readOnly /> Existing files only</label>
        <label><input type="checkbox" checked readOnly /> Orphans</label>
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

function NodeInspector({ node }: { node: Node<EvidenceNodeData> | null }) {
  if (!node) {
    return (
      <aside className="node-inspector node-inspector--empty" data-testid="node-inspector" aria-label="Node inspector">
        <p className="eyebrow">Inspector</p>
        <h2>No node selected</h2>
        <p>Select any synthetic graph node to inspect provenance placeholder fields.</p>
      </aside>
    );
  }

  return (
    <aside className="node-inspector" data-testid="node-inspector" aria-label={`Inspector for ${node.data.title}`}>
      <p className="eyebrow">Selected node</p>
      <h2>{node.data.title}</h2>
      <dl>
        <div>
          <dt>Type</dt>
          <dd>{node.data.type}</dd>
        </div>
        <div>
          <dt>Summary</dt>
          <dd>{node.data.summary}</dd>
        </div>
        <div>
          <dt>Source placeholder</dt>
          <dd>{node.data.sourcePlaceholder}</dd>
        </div>
        <div>
          <dt>Provenance status</dt>
          <dd>{node.data.provenanceStatus}</dd>
        </div>
        <div>
          <dt>Reviewer status</dt>
          <dd>{node.data.reviewerStatus}</dd>
        </div>
        <div>
          <dt>Synthetic warning</dt>
          <dd>No patient data, no treatment advice, and no approved clinical claim.</dd>
        </div>
      </dl>
    </aside>
  );
}
