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
  Position,
  ReactFlow,
  ReactFlowProvider,
  OnSelectionChangeParams,
  useEdgesState,
  useNodesState
} from "@xyflow/react";

type EvidenceNodeKind = "charter" | "question" | "evidence" | "decision" | "provenance";

type EvidenceNodeData = {
  title: string;
  type: string;
  kind: EvidenceNodeKind;
  summary: string;
  sourcePlaceholder: string;
  provenanceStatus: string;
  reviewerStatus: string;
};

const syntheticNodes: Node<EvidenceNodeData>[] = [
  {
    id: "charter",
    type: "evidenceNode",
    position: { x: -220, y: 10 },
    data: {
      title: "Synthetic Review Charter",
      type: "Workflow anchor",
      kind: "charter",
      summary: "Defines a mock update scope for interface testing without clinical recommendations.",
      sourcePlaceholder: "SYNTH-CHARTER-001 · section placeholder",
      provenanceStatus: "Draft placeholder",
      reviewerStatus: "Unreviewed synthetic fixture"
    }
  },
  {
    id: "question",
    type: "evidenceNode",
    position: { x: 150, y: -110 },
    data: {
      title: "Mock Review Question",
      type: "Question node",
      kind: "question",
      summary: "Represents a non-clinical question slot used to test graph navigation and focus states.",
      sourcePlaceholder: "SYNTH-QUESTION-002 · locator pending",
      provenanceStatus: "Needs source span before real use",
      reviewerStatus: "Design QA only"
    }
  },
  {
    id: "evidence",
    type: "evidenceNode",
    position: { x: 500, y: 20 },
    data: {
      title: "Synthetic Evidence Packet",
      type: "Evidence item",
      kind: "evidence",
      summary: "A fabricated packet marker for testing source-span affordances and edge labels.",
      sourcePlaceholder: "SYNTH-EVIDENCE-003 · checksum placeholder",
      provenanceStatus: "Checksum placeholder only",
      reviewerStatus: "No clinical assertion"
    }
  },
  {
    id: "decision",
    type: "evidenceNode",
    position: { x: 190, y: 190 },
    data: {
      title: "Example Review Decision",
      type: "Decision node",
      kind: "decision",
      summary: "Shows how a future reviewer decision may be inspected without generating advice.",
      sourcePlaceholder: "SYNTH-DECISION-004 · source span required",
      provenanceStatus: "Under-review placeholder",
      reviewerStatus: "Synthetic reviewer label"
    }
  },
  {
    id: "provenance",
    type: "evidenceNode",
    position: { x: -95, y: 250 },
    data: {
      title: "Source Span Ledger Slot",
      type: "Provenance node",
      kind: "provenance",
      summary: "A placeholder for document identifier, stable locator, quote, reviewer, and status metadata.",
      sourcePlaceholder: "SYNTH-SPAN-005 · quoted excerpt placeholder",
      provenanceStatus: "Required for any future claim",
      reviewerStatus: "Not approved"
    }
  }
];

const syntheticEdges: Edge[] = [
  { id: "charter-question", source: "charter", target: "question", label: "scopes", type: "smoothstep", animated: true },
  { id: "question-evidence", source: "question", target: "evidence", label: "queries", type: "smoothstep", animated: true },
  { id: "evidence-decision", source: "evidence", target: "decision", label: "informs", type: "smoothstep" },
  { id: "provenance-charter", source: "provenance", target: "charter", label: "anchors", type: "smoothstep" },
  { id: "provenance-decision", source: "provenance", target: "decision", label: "requires", type: "smoothstep", animated: true }
];

const nodeTypeLabels: Record<EvidenceNodeKind, string> = {
  charter: "Atlas index",
  question: "Review lens",
  evidence: "Evidence packet",
  decision: "Decision dock",
  provenance: "Source ledger"
};

function EvidenceAtlasNode({ data, selected }: NodeProps<Node<EvidenceNodeData>>) {
  return (
    <button className={`atlas-node atlas-node--${data.kind}`} type="button" data-selected={selected} aria-label={`${data.title}, ${data.type}`}>
      <Handle className="atlas-node__handle" type="target" position={Position.Left} />
      <span className="atlas-node__kicker">{nodeTypeLabels[data.kind]}</span>
      <strong>{data.title}</strong>
      <span className="atlas-node__summary">{data.summary}</span>
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

  const nodeTypes = useMemo(() => ({ evidenceNode: EvidenceAtlasNode }), []);

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

  return (
    <section className="graph-workbench" aria-label="Synthetic guideline graph prototype">
      <div className="graph-layout">
        <aside className="atlas-sidebar" aria-label="Atlas navigation layers">
          <div className="sidebar-section">
            <p className="eyebrow">Vault</p>
            <h2>Evidence Atlas</h2>
            <span className="sidebar-caption">Synthetic workspace</span>
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
              <li><span className="layer-dot layer-dot--cyan" /> 5 synthetic nodes</li>
              <li><span className="layer-dot layer-dot--gold" /> 5 provenance edges</li>
              <li><span className="layer-dot layer-dot--red" /> No clinical advice</li>
            </ul>
          </div>
        </aside>

        <div
          className="graph-canvas"
          data-testid="guideline-graph-canvas"
          tabIndex={0}
          role="application"
          aria-label="Interactive synthetic guideline graph. Use mouse, trackpad, or controls to pan and zoom. Press Enter to retain selected node."
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
              fitView
              fitViewOptions={{ padding: 0.22 }}
              minZoom={0.35}
              maxZoom={1.8}
              proOptions={{ hideAttribution: true }}
              defaultEdgeOptions={{
                className: "atlas-edge",
                labelStyle: { fill: "var(--color-edge-label)", fontWeight: 700 },
                labelBgStyle: { fill: "var(--color-edge-label-bg)", fillOpacity: 0.88 }
              }}
            >
              <Background color="var(--color-grid)" gap={28} size={1.2} variant={BackgroundVariant.Dots} />
              <Controls className="atlas-controls" showInteractive={false} />
              <MiniMap className="atlas-minimap" nodeStrokeWidth={4} pannable zoomable />
            </ReactFlow>
          </ReactFlowProvider>

          {hoveredNode ? <NodeHoverCard node={hoveredNode} /> : null}
        </div>

        <NodeInspector node={selectedNode} />
      </div>
      <footer className="evidence-console" aria-label="Evidence trace console">
        <span>trace: synthetic-atlas.graph loaded</span>
        <span>hover summaries enabled</span>
        <span>source-span placeholders visible</span>
        <span>no patient data</span>
      </footer>
    </section>
  );
}

function NodeHoverCard({ node }: { node: Node<EvidenceNodeData> }) {
  return (
    <aside className="node-hover-card" data-testid="node-hover-card" aria-live="polite">
      <span>{node.data.type}</span>
      <strong>{node.data.title}</strong>
      <p>{node.data.summary}</p>
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
      </dl>
    </aside>
  );
}
