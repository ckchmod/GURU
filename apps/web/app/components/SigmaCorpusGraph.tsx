"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Graph from "graphology";
import { NodeCircleProgram } from "sigma/rendering";
import {
  ControlsContainer,
  SigmaContainer,
  ZoomControl,
  useCamera,
  useRegisterEvents,
  useSetSettings,
  useSigma
} from "@react-sigma/core";
import type { CorpusAtlasModel } from "../../lib/corpusAtlas";
import { buildAtlasGraph, computeDeterministicForceAtlasLayout, type AtlasForceLayoutMetrics } from "../graph/atlasGraphAdapter";
import type { AtlasNodeView, RetrievalGraphEvidenceState } from "./GraphWorkbenchTypes";

export type SigmaCorpusGraphProps = {
  model: CorpusAtlasModel;
  nodeViews: AtlasNodeView[];
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  retrievalEvidence: RetrievalGraphEvidenceState | null;
  onNodeSelectAction: (nodeId: string) => void;
  onNodeHoverAction: (nodeId: string | null) => void;
  onZoomLevelChangeAction: (zoomLevel: number) => void;
};

type SigmaAtlasNodeAttributes = AtlasNodeView & {
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
  forceLabel?: boolean;
  highlighted?: boolean;
  isDragging?: boolean;
  isPinned?: boolean;
  isClusterAnchor?: boolean;
  evidenceRole?: GraphEvidenceRole;
  zIndex?: number;
};

type SigmaAtlasEdgeAttributes = {
  edgeType: string;
  color: string;
  size: number;
  hidden?: boolean;
};

type SigmaAtlasGraph = Graph<SigmaAtlasNodeAttributes, SigmaAtlasEdgeAttributes>;
type AtlasLayoutPoint = { x: number; y: number };
type AtlasEdgeView = CorpusAtlasModel["graphPayload"]["edges"][number];
type AtlasLayoutState = {
  positions: Record<string, AtlasLayoutPoint>;
  metrics: AtlasForceLayoutMetrics;
};
type CanvasLabelNode = {
  label?: string | null;
  x: number;
  y: number;
  size: number;
  color?: string;
  kind?: AtlasNodeView["kind"];
  group?: AtlasNodeView["group"];
  highlighted?: boolean;
  isDragging?: boolean;
  isPinned?: boolean;
  isClusterAnchor?: boolean;
  evidenceRole?: GraphEvidenceRole;
};

type GraphEvidenceRole = "query-hit" | "selected-resource" | "path-context" | "source-span-hit" | "metadata-blocked";

const FORCE_LAYOUT_SEED = "atlas-force-layout-task-4-v1";
const FORCE_LAYOUT_SCALE = 230;
const FORCE_LAYOUT_NODE_RADIUS = 9;

export function SigmaCorpusGraph({
  model,
  nodeViews,
  selectedNodeId,
  hoveredNodeId,
  retrievalEvidence,
  onNodeSelectAction,
  onNodeHoverAction,
  onZoomLevelChangeAction
}: SigmaCorpusGraphProps) {
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [pinnedNodePositions, setPinnedNodePositions] = useState<Record<string, AtlasLayoutPoint>>({});
  const [pinControlsCollapsed, setPinControlsCollapsed] = useState(false);
  const atlasLayout = useMemo(() => computeForceAtlasLayoutState(model, nodeViews), [model, nodeViews]);
  const atlasGraph = useMemo(
    () => buildSigmaGraph(model, nodeViews, atlasLayout.positions),
    [atlasLayout.positions, model, nodeViews]
  );
  const sigmaSettings = useMemo(() => buildSigmaSettings(), []);
  const pinnedNodeIds = useMemo(() => Object.keys(pinnedNodePositions).sort((left, right) => left.localeCompare(right)), [pinnedNodePositions]);
  const selectedPinnedNodeId = selectedNodeId && pinnedNodePositions[selectedNodeId] ? selectedNodeId : pinnedNodeIds[0] ?? null;
  const handleNodePinned = useCallback((nodeId: string, position: AtlasLayoutPoint) => {
    setPinnedNodePositions((current) => ({ ...current, [nodeId]: roundPoint(position) }));
  }, []);
  const handleReleasePinnedNode = useCallback(() => {
    if (!selectedPinnedNodeId) {
      return;
    }

    setPinnedNodePositions((current) => {
      const nextPositions = { ...current };
      delete nextPositions[selectedPinnedNodeId];
      return nextPositions;
    });
  }, [selectedPinnedNodeId]);
  const handleResetPinnedNodes = useCallback(() => setPinnedNodePositions({}), []);

  return (
    <div
      className="sigma-atlas-frame"
      data-testid="sigma-corpus-graph"
      data-node-count={model.graph.order}
      data-edge-count={model.graph.size}
      data-layout-mode="deterministic-force-atlas"
      data-layout-settled={String(atlasLayout.metrics.settled)}
      data-layout-iterations={atlasLayout.metrics.iterations}
      data-layout-overlap-count={atlasLayout.metrics.overlapCount}
      data-layout-seed={atlasLayout.metrics.seed}
      data-label-mode="sparse-focus"
      data-interaction-mode="hover-click-drag"
      data-drag-policy="sigma-node-drag-session-pin-release-reset"
      data-pin-policy="frontend-session-only-no-backend-mutation"
      data-document-layout-policy="force-layout-type-encoded-labels"
      data-visual-theme="dark-evidence-vault"
      data-node-encoding-policy="color-ring-shape-label-chip"
      data-dragging-node={draggingNodeId ?? "none"}
      data-pinned-node-count={pinnedNodeIds.length}
      data-pinned-nodes={pinnedNodeIds.join(",") || "none"}
      data-evidence-selected-query={retrievalEvidence?.query ?? "none"}
      data-highlighted-resource-ids={retrievalEvidence?.highlightedResourceIds.join(",") || "none"}
      data-highlighted-source-span-ids={retrievalEvidence?.highlightedSourceSpanIds.join(",") || "none"}
      data-represented-source-span-node-ids={retrievalEvidence?.representedSourceSpanNodeIds.join(",") || "none"}
      data-graph-focus-node-id={retrievalEvidence?.graphFocusNodeId ?? "none"}
      data-graph-resource-node-id={retrievalEvidence?.graphResourceNodeId ?? "none"}
      data-graph-context-node-ids={retrievalEvidence?.graphContextNodeIds.join(",") || "none"}
      data-graph-path-node-ids={retrievalEvidence?.graphPathNodeIds.join(",") || "none"}
      data-evidence-focus-mode={retrievalEvidence?.focusMode ?? "none"}
      data-evidence-blocked-reason={retrievalEvidence?.blockedReason ?? "none"}
    >
      <SigmaContainer<SigmaAtlasNodeAttributes, SigmaAtlasEdgeAttributes>
        graph={atlasGraph}
        className="sigma-atlas"
        settings={sigmaSettings}
      >
        <SigmaAtlasRuntime
          selectedNodeId={selectedNodeId}
          hoveredNodeId={hoveredNodeId}
          retrievalEvidence={retrievalEvidence}
          draggingNodeId={draggingNodeId}
          onNodeSelectAction={onNodeSelectAction}
          onNodeHoverAction={onNodeHoverAction}
          onDraggingNodeChangeAction={setDraggingNodeId}
          onNodePinnedAction={handleNodePinned}
          onZoomLevelChangeAction={onZoomLevelChangeAction}
        />
        <SigmaPinnedNodeController layout={atlasLayout.positions} pinnedPositions={pinnedNodePositions} />
        <SigmaCameraNodeLayer
          nodeViews={nodeViews}
          edges={model.graphPayload.edges}
          selectedNodeId={selectedNodeId}
          hoveredNodeId={hoveredNodeId}
          retrievalEvidence={retrievalEvidence}
          draggingNodeId={draggingNodeId}
          pinnedNodeIds={pinnedNodeIds}
          onNodeSelectAction={onNodeSelectAction}
          onNodeHoverAction={onNodeHoverAction}
          onDraggingNodeChangeAction={setDraggingNodeId}
          onNodePinnedAction={handleNodePinned}
        />
        <ControlsContainer className="atlas-controls" position="bottom-left">
          <ZoomControl labels={{ zoomIn: "Zoom In", zoomOut: "Zoom Out", reset: "Fit View" }} />
          <section aria-label="Session pin controls" data-collapsed={pinControlsCollapsed ? "true" : "false"}>
            {pinControlsCollapsed ? (
              <button type="button" aria-label="Expand session pins" onClick={() => setPinControlsCollapsed(false)}>
                Pins {pinnedNodeIds.length}
              </button>
            ) : (
              <>
                <span>Session pins: {pinnedNodeIds.length === 0 ? "none" : `${pinnedNodeIds.length} pinned`}</span>
                <button type="button" onClick={() => setPinControlsCollapsed(true)}>
                  Collapse session pins
                </button>
                <button type="button" onClick={handleReleasePinnedNode} disabled={!selectedPinnedNodeId}>
                  Release focus pin
                </button>
                <button type="button" onClick={handleResetPinnedNodes} disabled={pinnedNodeIds.length === 0}>
                  Reset session pins
                </button>
              </>
            )}
          </section>
        </ControlsContainer>
      </SigmaContainer>
      <ol className="sigma-node-index" aria-label="Rendered Sigma atlas nodes">
        {nodeViews.slice(0, 12).map((node) => (
          <li key={node.id}>{node.title} · {node.type} · {node.aggregateCount || 1}</li>
        ))}
      </ol>
      <p className="sigma-atlas-description" aria-label="Sigma atlas visual policy">
        Deterministic ForceAtlas layout with sparse labels, smooth Sigma camera focus, and frontend-only session pinning: resource, disease, document, archive, and source-span meaning remains visible through color, labels, inspector state, and release/reset pin controls without mutating backend data.
      </p>
    </div>
  );
}

function SigmaAtlasRuntime({
  selectedNodeId,
  hoveredNodeId,
  retrievalEvidence,
  draggingNodeId,
  onNodeSelectAction,
  onNodeHoverAction,
  onDraggingNodeChangeAction,
  onNodePinnedAction,
  onZoomLevelChangeAction
}: Omit<SigmaCorpusGraphProps, "model" | "nodeViews"> & {
  draggingNodeId: string | null;
  onDraggingNodeChangeAction: (nodeId: string | null) => void;
  onNodePinnedAction: (nodeId: string, position: AtlasLayoutPoint) => void;
}) {
  const sigma = useSigma<SigmaAtlasNodeAttributes, SigmaAtlasEdgeAttributes>();
  const registerEvents = useRegisterEvents();
  const setSettings = useSetSettings<SigmaAtlasNodeAttributes, SigmaAtlasEdgeAttributes>();
  const camera = useCamera({ duration: 260, factor: 1.45 });
  const draggedNodeRef = useRef<string | null>(null);
  const wasDraggedRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const evidenceNodeRoles = useMemo(() => buildEvidenceNodeRoles(retrievalEvidence, sigma.getGraph()), [retrievalEvidence, sigma]);
  const evidenceNodeIds = useMemo(() => new Set(evidenceNodeRoles.keys()), [evidenceNodeRoles]);

  const finishDragging = useCallback(() => {
    const draggedNode = draggedNodeRef.current;
    if (!draggedNode) {
      return;
    }

    const graph = sigma.getGraph();
    if (graph.hasNode(draggedNode)) {
      const node = graph.getNodeAttributes(draggedNode);
      graph.setNodeAttribute(draggedNode, "isDragging", false);
      graph.setNodeAttribute(draggedNode, "highlighted", true);
      graph.setNodeAttribute(draggedNode, "isPinned", wasDraggedRef.current || node.isPinned);
      if (wasDraggedRef.current) {
        onNodePinnedAction(draggedNode, roundPoint({ x: node.x, y: node.y }));
      }
    }
    suppressNextClickRef.current = wasDraggedRef.current;
    sigma.setCustomBBox(null);
    sigma.refresh();
    draggedNodeRef.current = null;
    wasDraggedRef.current = false;
    onDraggingNodeChangeAction(null);
  }, [onDraggingNodeChangeAction, onNodePinnedAction, sigma]);

  useEffect(() => {
    registerEvents({
      downNode: (event) => {
        draggedNodeRef.current = event.node;
        wasDraggedRef.current = false;
        onDraggingNodeChangeAction(event.node);
        onNodeSelectAction(event.node);
        onNodeHoverAction(event.node);
        const graph = sigma.getGraph();
        if (graph.hasNode(event.node)) {
          graph.setNodeAttribute(event.node, "isDragging", true);
          graph.setNodeAttribute(event.node, "highlighted", true);
        }
        if (!sigma.getCustomBBox()) {
          sigma.setCustomBBox(sigma.getBBox());
        }
        event.preventSigmaDefault();
        event.event.preventSigmaDefault();
        event.event.original.preventDefault();
      },
      moveBody: (event) => {
        const draggedNode = draggedNodeRef.current;
        if (!draggedNode) {
          return;
        }

        const graph = sigma.getGraph();
        if (!graph.hasNode(draggedNode)) {
          finishDragging();
          return;
        }

        const position = sigma.viewportToGraph(event.event);
        const pinnedPosition = roundPoint(position);
        graph.setNodeAttribute(draggedNode, "x", pinnedPosition.x);
        graph.setNodeAttribute(draggedNode, "y", pinnedPosition.y);
        graph.setNodeAttribute(draggedNode, "isPinned", true);
        wasDraggedRef.current = true;
        sigma.refresh();
        event.preventSigmaDefault();
        event.event.preventSigmaDefault();
        event.event.original.preventDefault();
        event.event.original.stopPropagation();
      },
      upNode: finishDragging,
      upStage: finishDragging,
      clickNode: (event) => {
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false;
          return;
        }
        onNodeSelectAction(event.node);
      },
      enterNode: (event) => onNodeHoverAction(event.node),
      leaveNode: () => onNodeHoverAction(null),
      clickStage: () => onNodeHoverAction(null),
      updated: (state) => onZoomLevelChangeAction(Number((1 / Math.max(state.ratio, 0.01)).toFixed(2)))
    });
  }, [finishDragging, onDraggingNodeChangeAction, onNodeHoverAction, onNodeSelectAction, onZoomLevelChangeAction, registerEvents, sigma]);

  useEffect(() => {
    const activeNodeId = draggingNodeId ?? hoveredNodeId ?? selectedNodeId;
    setSettings({
      defaultNodeType: "circle",
      nodeProgramClasses: { circle: NodeCircleProgram },
      nodeReducer: (nodeId, data) => {
        const nextData = { ...data };
        const evidenceRole = evidenceNodeRoles.get(nodeId);
        nextData.evidenceRole = evidenceRole;
        if (nodeId === draggingNodeId) {
          nextData.isDragging = true;
          nextData.highlighted = true;
          nextData.forceLabel = true;
          nextData.zIndex = 4;
          nextData.size = data.size * 1.9;
          return nextData;
        }

        if (!activeNodeId) {
          return nextData;
        }

        const graph = sigma.getGraph();
        const activeNode = graph.hasNode(activeNodeId) ? graph.getNodeAttributes(activeNodeId) : null;
        const isActive = nodeId === activeNodeId;
        const isNeighbor = graph.hasNode(activeNodeId) && graph.neighbors(activeNodeId).includes(nodeId);
        if (isActive || isNeighbor) {
          nextData.highlighted = true;
          nextData.forceLabel = isActive || activeNode?.kind === "resource" || data.kind !== "resource";
          nextData.zIndex = isActive ? 3 : 2;
          nextData.size = isActive ? data.size * 1.7 : data.size * 1.18;
          if (evidenceRole) {
            nextData.color = toEvidenceNodeColor(evidenceRole, data.color);
          }
          return nextData;
        }

        if (evidenceRole) {
          nextData.highlighted = true;
          nextData.forceLabel = evidenceRole !== "query-hit" || data.kind !== "resource";
          nextData.zIndex = evidenceRole === "selected-resource" || evidenceRole === "source-span-hit" ? 2 : 1;
          nextData.size = data.size * evidenceNodeSizeFactor(evidenceRole);
          nextData.color = toEvidenceNodeColor(evidenceRole, data.color);
          return nextData;
        }

        nextData.color = readAtlasColorToken("--color-faint");
        nextData.highlighted = false;
        nextData.zIndex = 0;
        return nextData;
      },
      edgeReducer: (edgeId, data) => {
        const nextData = { ...data };
        const graph = sigma.getGraph();
        const [source, target] = graph.extremities(edgeId);
        const isEvidenceEdge = evidenceNodeIds.has(source) && evidenceNodeIds.has(target);
        if (!activeNodeId || !graph.hasNode(activeNodeId)) {
          if (isEvidenceEdge) {
            nextData.color = toActiveSigmaEdgeColor(data.edgeType);
            nextData.size = 1.8;
          }
          return nextData;
        }

        const isActiveEdge = source === activeNodeId || target === activeNodeId;
        nextData.hidden = !(isActiveEdge || isEvidenceEdge);
        if (isActiveEdge || isEvidenceEdge) {
          nextData.color = toActiveSigmaEdgeColor(data.edgeType);
          nextData.size = isActiveEdge ? 2.2 : 1.8;
        }
        return nextData;
      }
    });
    sigma.refresh();
  }, [draggingNodeId, evidenceNodeIds, evidenceNodeRoles, hoveredNodeId, selectedNodeId, setSettings, sigma]);

  useEffect(() => {
    if (!draggingNodeId && selectedNodeId && sigma.getGraph().hasNode(selectedNodeId)) {
      const node = sigma.getGraph().getNodeAttributes(selectedNodeId);
      const displayData = sigma.getNodeDisplayData(selectedNodeId);
      if (!displayData) {
        return;
      }
      camera.goto({ x: displayData.x, y: displayData.y, ratio: node.kind === "resource" ? 0.78 : 0.92 }, { duration: 420 });
    }
  }, [camera, draggingNodeId, selectedNodeId, sigma]);

  return null;
}

type CameraNodeSnapshot = {
  id: string;
  title: string;
  kind: AtlasNodeView["kind"];
  group: AtlasNodeView["group"];
  provenanceStatus: string;
  type: string;
  layoutX: number;
  layoutY: number;
  viewportX: number;
  viewportY: number;
  viewportSize: number;
  coordinateSource: "display" | "graph";
  active: boolean;
  reacting: boolean;
  dragging: boolean;
  pinned: boolean;
  evidenceRole: GraphEvidenceRole | "none";
  queryHit: boolean;
  pathContext: boolean;
  sourceSpanHit: boolean;
  metadataBlocked: boolean;
};
type StagePanState = { previousX: number; previousY: number };

function SigmaCameraNodeLayer({
  nodeViews,
  edges,
  selectedNodeId,
  hoveredNodeId,
  retrievalEvidence,
  draggingNodeId,
  pinnedNodeIds,
  onNodeSelectAction,
  onNodeHoverAction,
  onDraggingNodeChangeAction,
  onNodePinnedAction
}: {
  nodeViews: AtlasNodeView[];
  edges: AtlasEdgeView[];
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  retrievalEvidence: RetrievalGraphEvidenceState | null;
  draggingNodeId: string | null;
  pinnedNodeIds: string[];
  onNodeSelectAction: (nodeId: string) => void;
  onNodeHoverAction: (nodeId: string | null) => void;
  onDraggingNodeChangeAction: (nodeId: string | null) => void;
  onNodePinnedAction: (nodeId: string, position: AtlasLayoutPoint) => void;
}) {
  const sigma = useSigma<SigmaAtlasNodeAttributes, SigmaAtlasEdgeAttributes>();
  const [nodes, setNodes] = useState<CameraNodeSnapshot[]>([]);
  const probeDragRef = useRef<{ nodeId: string; moved: boolean } | null>(null);
  const stagePanRef = useRef<StagePanState | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const activeNodeId = draggingNodeId ?? hoveredNodeId ?? selectedNodeId;
  const activeNeighborIds = useMemo(() => new Set(edges
    .filter((edge) => activeNodeId && (edge.source === activeNodeId || edge.target === activeNodeId))
    .map((edge) => edge.source === activeNodeId ? edge.target : edge.source)), [activeNodeId, edges]);
  const nodeViewById = useMemo(() => new Map(nodeViews.map((node) => [node.id, node])), [nodeViews]);
  const evidenceNodeRoles = useMemo(() => buildEvidenceNodeRoles(retrievalEvidence, sigma.getGraph()), [retrievalEvidence, sigma]);

  const syncNodes = useCallback(() => {
    const graph = sigma.getGraph();
    const nextNodes: CameraNodeSnapshot[] = [];
    graph.forEachNode((nodeId, attributes) => {
      const nodeView = nodeViewById.get(nodeId);
      if (!nodeView) {
        return;
      }

      const displayData = sigma.getNodeDisplayData(nodeId);
      const viewport = sigma.graphToViewport({ x: attributes.x, y: attributes.y }, { cameraState: sigma.getCamera().getState() });
      const scaledSize = Math.max(10, Math.round(sigma.scaleSize(displayData?.size ?? attributes.size) * 2));
      const evidenceRole = evidenceNodeRoles.get(nodeId) ?? "none";
      nextNodes.push({
        id: nodeId,
        title: nodeView.title,
        kind: nodeView.kind,
        group: nodeView.group,
        provenanceStatus: nodeView.provenanceStatus,
        type: nodeView.type,
        layoutX: attributes.x,
        layoutY: attributes.y,
        viewportX: viewport.x,
        viewportY: viewport.y,
        viewportSize: scaledSize,
        coordinateSource: "graph",
        active: nodeId === activeNodeId,
        reacting: activeNeighborIds.has(nodeId),
        dragging: nodeId === draggingNodeId,
        pinned: Boolean(attributes.isPinned),
        evidenceRole,
        queryHit: evidenceRole === "query-hit" || evidenceRole === "selected-resource" || evidenceRole === "metadata-blocked",
        pathContext: evidenceRole === "path-context" || evidenceRole === "selected-resource" || evidenceRole === "source-span-hit",
        sourceSpanHit: evidenceRole === "source-span-hit",
        metadataBlocked: evidenceRole === "metadata-blocked"
      });
    });
    setNodes(nextNodes.sort((left, right) => left.id.localeCompare(right.id)));
  }, [activeNeighborIds, activeNodeId, draggingNodeId, evidenceNodeRoles, nodeViewById, sigma]);

  const scheduleSyncNodes = useCallback(() => {
    if (syncTimerRef.current !== null) {
      return;
    }

    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null;
      syncNodes();
    }, 80);
  }, [syncNodes]);

  useEffect(() => {
    syncNodes();
    const camera = sigma.getCamera();
    sigma.on("afterRender", scheduleSyncNodes);
    sigma.on("resize", syncNodes);
    camera.on("updated", scheduleSyncNodes);

    return () => {
      sigma.off("afterRender", scheduleSyncNodes);
      sigma.off("resize", syncNodes);
      camera.off("updated", scheduleSyncNodes);
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [pinnedNodeIds, scheduleSyncNodes, sigma, syncNodes]);

  const finishProbeDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const dragState = probeDragRef.current;
    if (!dragState) {
      return;
    }

    const graph = sigma.getGraph();
    if (graph.hasNode(dragState.nodeId)) {
      const node = graph.getNodeAttributes(dragState.nodeId);
      graph.setNodeAttribute(dragState.nodeId, "isDragging", false);
      graph.setNodeAttribute(dragState.nodeId, "highlighted", true);
      graph.setNodeAttribute(dragState.nodeId, "isPinned", dragState.moved || node.isPinned);
      if (dragState.moved) {
        onNodePinnedAction(dragState.nodeId, roundPoint({ x: node.x, y: node.y }));
      }
    }

    probeDragRef.current = null;
    onDraggingNodeChangeAction(null);
    onNodeHoverAction(dragState.nodeId);
    sigma.setCustomBBox(null);
    sigma.refresh();
    scheduleSyncNodes();
    releasePointer(event.currentTarget, event.pointerId);
  }, [onDraggingNodeChangeAction, onNodeHoverAction, onNodePinnedAction, scheduleSyncNodes, sigma]);

  const handleProbePointerDown = useCallback((nodeId: string, event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const graph = sigma.getGraph();
    if (!graph.hasNode(nodeId)) {
      return;
    }

    probeDragRef.current = { nodeId, moved: false };
    graph.setNodeAttribute(nodeId, "isDragging", true);
    graph.setNodeAttribute(nodeId, "highlighted", true);
    if (!sigma.getCustomBBox()) {
      sigma.setCustomBBox(sigma.getBBox());
    }
    onDraggingNodeChangeAction(nodeId);
    onNodeSelectAction(nodeId);
    onNodeHoverAction(nodeId);
    capturePointer(event.currentTarget, event.pointerId);
    sigma.refresh();
    scheduleSyncNodes();
  }, [onDraggingNodeChangeAction, onNodeHoverAction, onNodeSelectAction, scheduleSyncNodes, sigma]);

  const handleProbePointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const dragState = probeDragRef.current;
    if (!dragState) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const graph = sigma.getGraph();
    if (!graph.hasNode(dragState.nodeId)) {
      finishProbeDrag(event);
      return;
    }

    const position = sigma.viewportToGraph({ x: event.clientX, y: event.clientY });
    const pinnedPosition = roundPoint(position);
    graph.setNodeAttribute(dragState.nodeId, "x", pinnedPosition.x);
    graph.setNodeAttribute(dragState.nodeId, "y", pinnedPosition.y);
    graph.setNodeAttribute(dragState.nodeId, "isPinned", true);
    dragState.moved = true;
    sigma.refresh();
    scheduleSyncNodes();
  }, [finishProbeDrag, scheduleSyncNodes, sigma]);

  const handleStagePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();
    stagePanRef.current = { previousX: event.clientX, previousY: event.clientY };
    capturePointer(event.currentTarget, event.pointerId);
  }, []);

  const handleStagePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const panState = stagePanRef.current;
    if (!panState || event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();
    const previousGraphPoint = sigma.viewportToFramedGraph({ x: panState.previousX, y: panState.previousY });
    const currentGraphPoint = sigma.viewportToFramedGraph({ x: event.clientX, y: event.clientY });
    const camera = sigma.getCamera();
    const cameraState = camera.getState();
    camera.setState({
      ...cameraState,
      x: cameraState.x + previousGraphPoint.x - currentGraphPoint.x,
      y: cameraState.y + previousGraphPoint.y - currentGraphPoint.y
    });
    stagePanRef.current = { previousX: event.clientX, previousY: event.clientY };
    sigma.refresh();
    syncNodes();
  }, [sigma, syncNodes]);

  const finishStagePan = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!stagePanRef.current) {
      return;
    }

    stagePanRef.current = null;
    releasePointer(event.currentTarget, event.pointerId);
  }, []);

  const handleStageWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (event.deltaY < 0) {
      sigma.getCamera().animatedZoom({ duration: 120, factor: 1.35 });
    } else {
      sigma.getCamera().animatedUnzoom({ duration: 120, factor: 1.35 });
    }
    window.setTimeout(syncNodes, 130);
  }, [sigma, syncNodes]);

  return (
    <div
      className="sigma-camera-node-layer"
      data-testid="sigma-camera-node-layer"
      aria-hidden="true"
      onPointerDown={handleStagePointerDown}
      onPointerMove={handleStagePointerMove}
      onPointerUp={finishStagePan}
      onPointerCancel={finishStagePan}
      onLostPointerCapture={finishStagePan}
      onWheel={handleStageWheel}
      style={{ pointerEvents: "auto" }}
    >
      {nodes.map((node) => (
        <span
          key={node.id}
          className="sigma-camera-node-probe"
          data-active={node.active}
          data-dragging={node.dragging}
          data-pinned={node.pinned}
          data-reacting={node.reacting}
          data-evidence-role={node.evidenceRole}
          data-query-hit={node.queryHit}
          data-path-context={node.pathContext}
          data-source-span-hit={node.sourceSpanHit}
          data-metadata-blocked={node.metadataBlocked}
          data-node-id={node.id}
          data-node-kind={node.kind}
          data-node-group={node.group}
          data-node-status={node.provenanceStatus}
          data-node-type={node.type}
          data-layout-x={node.layoutX}
          data-layout-y={node.layoutY}
          data-viewport-x={node.viewportX}
          data-viewport-y={node.viewportY}
          data-viewport-size={node.viewportSize}
          data-coordinate-source={node.coordinateSource}
          title={node.title}
          onPointerDown={(event) => handleProbePointerDown(node.id, event)}
          onPointerMove={handleProbePointerMove}
          onPointerUp={finishProbeDrag}
          onPointerCancel={finishProbeDrag}
          onLostPointerCapture={finishProbeDrag}
          onPointerEnter={() => onNodeHoverAction(node.id)}
          onPointerLeave={() => {
            if (!probeDragRef.current) {
              onNodeHoverAction(null);
            }
          }}
          style={{
            left: `${node.viewportX}px`,
            top: `${node.viewportY}px`,
            width: `${node.viewportSize}px`,
            height: `${node.viewportSize}px`,
            cursor: node.dragging ? "grabbing" : "grab",
            pointerEvents: "auto"
          }}
        />
      ))}
    </div>
  );
}

function SigmaPinnedNodeController({
  layout,
  pinnedPositions
}: {
  layout: Record<string, AtlasLayoutPoint>;
  pinnedPositions: Record<string, AtlasLayoutPoint>;
}) {
  const sigma = useSigma<SigmaAtlasNodeAttributes, SigmaAtlasEdgeAttributes>();

  useEffect(() => {
    const graph = sigma.getGraph();
    Object.entries(layout).forEach(([nodeId, defaultPosition]) => {
      if (!graph.hasNode(nodeId)) {
        return;
      }

      const pinnedPosition = pinnedPositions[nodeId];
      const nextPosition = pinnedPosition ?? defaultPosition;
      graph.setNodeAttribute(nodeId, "x", nextPosition.x);
      graph.setNodeAttribute(nodeId, "y", nextPosition.y);
      graph.setNodeAttribute(nodeId, "isPinned", Boolean(pinnedPosition));
      graph.setNodeAttribute(nodeId, "isDragging", false);
    });
    sigma.refresh();
  }, [layout, pinnedPositions, sigma]);

  return null;
}

function buildSigmaGraph(model: CorpusAtlasModel, nodeViews: AtlasNodeView[], layout: Record<string, AtlasLayoutPoint>): SigmaAtlasGraph {
  const graph = new Graph<SigmaAtlasNodeAttributes, SigmaAtlasEdgeAttributes>({ multi: true, type: "directed" });
  const nodeViewById = new Map(nodeViews.map((node) => [node.id, node]));
  const edgeKeyCounts = new Map<string, number>();

  nodeViews.forEach((node) => {
    const attributes = model.graph.getNodeAttributes(node.id);
    const position = layout[node.id] ?? { x: attributes.x, y: attributes.y };
    graph.addNode(node.id, {
      ...node,
      type: "circle",
      label: node.title,
      x: position.x,
      y: position.y,
      size: toSigmaNodeSize(node),
      color: toSigmaNodeColor(node),
      forceLabel: shouldShowPersistentLabel(node),
      isPinned: false,
      isClusterAnchor: node.kind !== "resource",
      zIndex: node.kind === "resource" ? 0 : 1
    });
  });

  [...model.graphPayload.edges]
    .sort((left, right) => edgeSortKey(left).localeCompare(edgeSortKey(right)))
    .forEach((edge) => {
      if (!nodeViewById.has(edge.source) || !nodeViewById.has(edge.target)) {
        return;
      }

      graph.addDirectedEdgeWithKey(stableSigmaEdgeKey(edge, edgeKeyCounts), edge.source, edge.target, {
        edgeType: edge.type,
        color: toSigmaEdgeColor(edge.type),
        size: 0.86
      });
    });

  return graph;
}

function computeForceAtlasLayoutState(model: CorpusAtlasModel, nodeViews: AtlasNodeView[]): AtlasLayoutState {
  const layoutGraph = computeDeterministicForceAtlasLayout(buildAtlasGraph(model.graphPayload), {
    seed: FORCE_LAYOUT_SEED,
    scale: FORCE_LAYOUT_SCALE,
    nodeRadius: FORCE_LAYOUT_NODE_RADIUS
  });
  const positions: Record<string, AtlasLayoutPoint> = {};

  nodeViews.forEach((node) => {
    if (!layoutGraph.hasNode(node.id)) {
      return;
    }
    const attributes = layoutGraph.getNodeAttributes(node.id);
    positions[node.id] = roundPoint({ x: attributes.x, y: attributes.y });
  });

  return {
    positions,
    metrics: layoutGraph.getAttribute("layoutMetrics") as AtlasForceLayoutMetrics
  };
}

function toSigmaNodeSize(node: AtlasNodeView) {
  if (node.kind === "resource") {
    return 5.8;
  }
  if (node.group === "documents") {
    return Math.min(12.5, 6.8 + Math.sqrt(Math.max(node.aggregateCount, 1)) * 0.72);
  }
  if (node.kind === "archive") {
    return 9.4;
  }
  return Math.min(17, 8.6 + Math.sqrt(Math.max(node.aggregateCount, 1)));
}

function toSigmaNodeColor(node: AtlasNodeView) {
  if (node.kind === "resource") {
    return readAtlasColorToken("--color-cyan");
  }
  if (node.group === "documents") {
    return readAtlasColorToken("--color-green");
  }
  if (node.kind === "archive") {
    return readAtlasColorToken("--color-violet");
  }
  if (node.kind === "sourceSpan") {
    return readAtlasColorToken("--color-red");
  }
  return readAtlasColorToken("--color-gold");
}

function toSigmaEdgeColor(edgeType: string) {
  if (edgeType === "resource_to_source_span") {
    return withAlpha(readAtlasColorToken("--color-red"), 0.34);
  }
  if (edgeType === "resource_to_document_type") {
    return withAlpha(readAtlasColorToken("--color-green"), 0.28);
  }
  if (edgeType === "resource_to_archive_status") {
    return withAlpha(readAtlasColorToken("--color-violet"), 0.3);
  }
  return readAtlasColorToken("--color-line-strong");
}

function toActiveSigmaEdgeColor(edgeType: string) {
  if (edgeType === "resource_to_archive_status") {
    return readAtlasColorToken("--color-violet");
  }
  if (edgeType === "resource_to_document_type") {
    return readAtlasColorToken("--color-green");
  }
  if (edgeType === "resource_to_source_span") {
    return readAtlasColorToken("--color-red");
  }
  return readAtlasColorToken("--color-edge-label");
}

function buildEvidenceNodeRoles(evidence: RetrievalGraphEvidenceState | null, graph: SigmaAtlasGraph) {
  const roles = new Map<string, GraphEvidenceRole>();
  if (!evidence) {
    return roles;
  }

  const setRole = (nodeId: string | null | undefined, role: GraphEvidenceRole) => {
    if (nodeId && graph.hasNode(nodeId)) {
      roles.set(nodeId, role);
    }
  };

  evidence.highlightedResourceIds.forEach((resourceId) => {
    const resourceNodeId = `resource.${resourceId}`;
    setRole(resourceNodeId, "query-hit");
    graph.forEachNode((nodeId, attributes) => {
      if (attributes.resourceId === resourceId && !roles.has(nodeId)) {
        roles.set(nodeId, "query-hit");
      }
    });
  });
  evidence.graphContextNodeIds.forEach((nodeId) => setRole(nodeId, "path-context"));
  evidence.graphPathNodeIds.forEach((nodeId) => setRole(nodeId, "path-context"));
  evidence.representedSourceSpanNodeIds.forEach((nodeId) => setRole(nodeId, "source-span-hit"));
  setRole(evidence.graphResourceNodeId, evidence.focusMode === "metadata-only-blocked" ? "metadata-blocked" : "selected-resource");
  setRole(evidence.graphFocusNodeId, evidence.focusMode === "source-span-node" ? "source-span-hit" : evidence.focusMode === "metadata-only-blocked" ? "metadata-blocked" : "selected-resource");

  return roles;
}

function toEvidenceNodeColor(role: GraphEvidenceRole, fallbackColor: string) {
  if (role === "source-span-hit") {
    return readAtlasColorToken("--color-red");
  }
  if (role === "metadata-blocked") {
    return readAtlasColorToken("--color-gold");
  }
  if (role === "path-context") {
    return readAtlasColorToken("--color-edge-label");
  }
  if (role === "selected-resource") {
    return readAtlasColorToken("--color-cyan");
  }
  return fallbackColor;
}

function evidenceNodeSizeFactor(role: GraphEvidenceRole) {
  if (role === "selected-resource" || role === "source-span-hit") {
    return 1.48;
  }
  if (role === "metadata-blocked") {
    return 1.34;
  }
  if (role === "path-context") {
    return 1.14;
  }
  return 1.1;
}

function buildSigmaSettings() {
  return {
    allowInvalidContainer: true,
    defaultNodeType: "circle",
    nodeProgramClasses: { circle: NodeCircleProgram },
    defaultEdgeType: "line",
    enableEdgeEvents: false,
    hideEdgesOnMove: true,
    hideLabelsOnMove: true,
    labelRenderedSizeThreshold: 9,
    labelDensity: 0.085,
    labelGridCellSize: 112,
    labelFont: "JetBrains Mono",
    labelWeight: "700",
    labelSize: 11,
    labelColor: { color: readAtlasColorToken("--color-edge-label") },
    defaultDrawNode: drawAtlasNode,
    defaultDrawNodeLabel: drawAtlasNodeLabel,
    defaultDrawNodeHover: drawAtlasNodeHover,
    zIndex: true,
    stagePadding: 64
  };
}

function shouldShowPersistentLabel(node: AtlasNodeView) {
  if (node.kind === "resource") {
    return false;
  }

  return node.kind === "archive" || node.aggregateCount >= 8;
}

function capturePointer(element: HTMLElement, pointerId: number) {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    return;
  }
}

function releasePointer(element: HTMLElement, pointerId: number) {
  if (typeof element.hasPointerCapture !== "function" || typeof element.releasePointerCapture !== "function") {
    return;
  }

  try {
    if (element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
  } catch {
    return;
  }
}

function drawAtlasNode(context: CanvasRenderingContext2D, node: CanvasLabelNode) {
  context.save();
  if (node.isClusterAnchor) {
    context.beginPath();
    context.arc(node.x, node.y, node.size + 9, 0, Math.PI * 2);
    context.fillStyle = withAlpha(node.color ?? readAtlasColorToken("--color-gold"), node.highlighted ? 0.18 : 0.08);
    context.fill();
  }

  if (node.highlighted || node.isDragging) {
    context.beginPath();
    context.arc(node.x, node.y, node.size + (node.isDragging ? 8 : node.isPinned ? 6.4 : 5.4), 0, Math.PI * 2);
    context.strokeStyle = withAlpha(readAtlasColorToken("--color-ink"), node.isDragging ? 0.72 : node.isPinned ? 0.62 : 0.54);
    context.lineWidth = node.isDragging ? 2.2 : 1.4;
    context.stroke();
  }

  context.beginPath();
  context.arc(node.x, node.y, node.size, 0, Math.PI * 2);
  context.fillStyle = node.color ?? readAtlasColorToken("--color-cyan");
  context.shadowColor = node.color ?? readAtlasColorToken("--color-cyan");
  context.shadowBlur = node.isDragging ? 18 : node.isPinned ? 14 : node.highlighted ? 12 : node.isClusterAnchor ? 9 : 5;
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = node.isDragging || node.highlighted ? readAtlasColorToken("--color-ink") : withAlpha(readAtlasColorToken("--color-ink"), 0.42);
  context.lineWidth = node.isDragging ? 2.2 : node.highlighted ? 1.7 : node.isClusterAnchor ? 1.35 : 0.9;
  context.stroke();
  drawNodeEncodingMark(context, node);
  if (!node.isClusterAnchor || node.isDragging || node.isPinned) {
    context.beginPath();
    context.arc(node.x, node.y, node.size + 3.2, 0, Math.PI * 2);
    context.strokeStyle = withAlpha(node.color ?? readAtlasColorToken("--color-cyan"), node.isDragging ? 0.64 : node.isPinned ? 0.58 : node.highlighted ? 0.5 : 0.2);
    context.lineWidth = node.isDragging || node.highlighted ? 1.45 : 0.8;
    context.stroke();
  }
  context.restore();
}

function drawAtlasNodeHover(context: CanvasRenderingContext2D, node: CanvasLabelNode, settings: { labelSize: number; labelFont: string; labelWeight: string }) {
  context.save();
  context.beginPath();
  context.arc(node.x, node.y, node.size + 7.6, 0, Math.PI * 2);
  context.fillStyle = withAlpha(node.color ?? readAtlasColorToken("--color-cyan"), 0.14);
  context.fill();
  context.strokeStyle = readAtlasColorToken("--color-ink");
  context.lineWidth = 1.7;
  context.stroke();
  context.restore();
  drawAtlasNodeLabel(context, node, settings);
}

function drawNodeEncodingMark(context: CanvasRenderingContext2D, node: CanvasLabelNode) {
  const markColor = node.kind === "resource" ? withAlpha(readAtlasColorToken("--color-bg"), 0.72) : withAlpha(readAtlasColorToken("--color-ink"), 0.72);
  context.save();
  context.strokeStyle = markColor;
  context.fillStyle = markColor;
  context.lineWidth = Math.max(0.8, node.size * 0.12);

  if (node.kind === "archive") {
    const markSize = Math.max(3.4, node.size * 0.54);
    roundedRect(context, node.x - markSize / 2, node.y - markSize / 2, markSize, markSize, Math.max(1.2, markSize * 0.18));
    context.stroke();
  } else if (node.kind === "sourceSpan") {
    const markSize = Math.max(3.8, node.size * 0.58);
    context.beginPath();
    context.moveTo(node.x, node.y - markSize / 2);
    context.lineTo(node.x + markSize / 2, node.y);
    context.lineTo(node.x, node.y + markSize / 2);
    context.lineTo(node.x - markSize / 2, node.y);
    context.closePath();
    context.stroke();
  } else if (node.isClusterAnchor || node.kind === "cluster") {
    const markWidth = Math.max(4.2, node.size * 0.7);
    context.beginPath();
    context.moveTo(node.x - markWidth / 2, node.y);
    context.lineTo(node.x + markWidth / 2, node.y);
    context.stroke();
  } else {
    context.beginPath();
    context.arc(node.x, node.y, Math.max(1.3, node.size * 0.22), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawAtlasNodeLabel(context: CanvasRenderingContext2D, node: CanvasLabelNode, settings: { labelSize: number; labelFont: string; labelWeight: string }) {
  const label = truncateLabel(node.label ?? "");
  if (!label) {
    return;
  }

  const fontSize = settings.labelSize ?? 11;
  context.save();
  context.font = `${settings.labelWeight ?? 700} ${fontSize}px ${settings.labelFont ?? "JetBrains Mono"}`;
  const labelWidth = context.measureText(label).width;
  const paddingX = 8;
  const paddingY = 4;
  const x = node.x + node.size + 7;
  const y = node.y - fontSize / 2 - paddingY;
  const width = labelWidth + paddingX * 2;
  const height = fontSize + paddingY * 2;

  roundedRect(context, x, y, width, height, 6);
  context.fillStyle = "rgba(7, 10, 11, 0.88)";
  context.fill();
  context.strokeStyle = "rgba(125, 229, 223, 0.24)";
  context.lineWidth = 1;
  context.stroke();
  context.fillStyle = readAtlasColorToken("--color-edge-label");
  context.fillText(label, x + paddingX, y + paddingY + fontSize - 2);
  context.restore();
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

export function truncateLabel(label: string, maxGraphemes = 32) {
  const graphemes = segmentGraphemes(label);
  if (graphemes.length <= maxGraphemes) {
    return label;
  }

  return `${graphemes.slice(0, Math.max(maxGraphemes - 3, 1)).join("")}...`;
}

function segmentGraphemes(label: string) {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(label), (segment) => segment.segment);
  }

  return Array.from(label);
}

function withAlpha(color: string, alpha: number) {
  if (color.startsWith("#") && color.length === 7) {
    const red = Number.parseInt(color.slice(1, 3), 16);
    const green = Number.parseInt(color.slice(3, 5), 16);
    const blue = Number.parseInt(color.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  return color;
}

function roundPoint(point: AtlasLayoutPoint): AtlasLayoutPoint {
  return {
    x: Number(point.x.toFixed(3)),
    y: Number(point.y.toFixed(3))
  };
}

function stableSigmaEdgeKey(edge: { id?: string; source: string; target: string; type: string }, edgeKeyCounts: Map<string, number>) {
  const baseKey = edge.id ?? edgeSortKey(edge);
  const count = edgeKeyCounts.get(baseKey) ?? 0;
  edgeKeyCounts.set(baseKey, count + 1);

  return count === 0 ? baseKey : `${baseKey}:${count + 1}`;
}

function edgeSortKey(edge: { id?: string; source: string; target: string; type: string }) {
  return edge.id ?? `${edge.source}->${edge.target}:${edge.type}`;
}

function readAtlasColorToken(tokenName: string) {
  if (typeof window === "undefined") {
    return tokenFallbacks[tokenName] ?? "#e8eee7";
  }

  const tokenValue = window.getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
  return tokenValue || tokenFallbacks[tokenName] || "#e8eee7";
}

const tokenFallbacks: Record<string, string> = {
  "--color-ink": "#e8eee7",
  "--color-faint": "#5f6d68",
  "--color-cyan": "#7de5df",
  "--color-gold": "#d5b56a",
  "--color-red": "#c87567",
  "--color-green": "#9bd17f",
  "--color-violet": "#a897ff",
  "--color-bg": "#070909",
  "--color-edge-label": "#cfe9df",
  "--color-line-strong": "rgba(166, 208, 190, 0.32)"
};
