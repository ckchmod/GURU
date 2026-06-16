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
import type { AtlasNodeView } from "./GuidelineGraphCanvas";

export type SigmaCorpusGraphProps = {
  model: CorpusAtlasModel;
  nodeViews: AtlasNodeView[];
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
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
  isClusterAnchor?: boolean;
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
type DragTensionOrigin = { nodeId: string; origin: AtlasLayoutPoint; neighborOrigins: Record<string, AtlasLayoutPoint> };
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
  isClusterAnchor?: boolean;
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const archiveShelfY = 238;
const diseaseNeighborhoodAnchors: AtlasLayoutPoint[] = [
  { x: -130, y: -38 },
  { x: 38, y: -40 },
  { x: 206, y: -36 },
  { x: -298, y: -28 },
  { x: -214, y: 98 },
  { x: -46, y: 105 },
  { x: 124, y: 104 },
  { x: 294, y: 98 },
  { x: -214, y: -168 },
  { x: -46, y: -172 },
  { x: 124, y: -170 },
  { x: 294, y: -164 },
  { x: -382, y: 104 },
  { x: 382, y: 104 },
  { x: -382, y: -158 },
  { x: 382, y: -154 },
  { x: -130, y: 226 },
  { x: 38, y: 232 },
  { x: 206, y: 226 },
  { x: -298, y: 226 }
];

export function SigmaCorpusGraph({
  model,
  nodeViews,
  selectedNodeId,
  hoveredNodeId,
  onNodeSelectAction,
  onNodeHoverAction,
  onZoomLevelChangeAction
}: SigmaCorpusGraphProps) {
  const [draggedPositions, setDraggedPositions] = useState<Record<string, AtlasLayoutPoint>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const atlasLayout = useMemo(() => computeClusteredAtlasLayout(model, nodeViews), [model, nodeViews]);
  const sessionLayout = useMemo(() => ({ ...atlasLayout, ...draggedPositions }), [atlasLayout, draggedPositions]);
  const atlasGraph = useMemo(() => buildSigmaGraph(model, nodeViews, sessionLayout), [sessionLayout, model, nodeViews]);
  const sigmaSettings = useMemo(() => buildSigmaSettings(), []);
  const handleNodePositionsChange = useCallback((positions: Record<string, AtlasLayoutPoint>) => {
    setDraggedPositions((current) => ({ ...current, ...positions }));
  }, []);

  return (
    <div
      className="sigma-atlas-frame"
      data-testid="sigma-corpus-graph"
      data-node-count={model.graph.order}
      data-edge-count={model.graph.size}
      data-layout-mode="semantic-neighborhoods"
      data-label-mode="sparse-focus"
      data-interaction-mode="hover-click-drag"
      data-drag-policy="sigma-node-drag-session-positions-with-neighbor-tension"
      data-tension-policy="edge-weighted-neighbor-pull"
      data-document-layout-policy="centroid-integrated-classification-pockets"
      data-visual-theme="dark-evidence-vault"
      data-node-encoding-policy="color-ring-shape-label-chip"
      data-dragging-node={draggingNodeId ?? "none"}
    >
      <SigmaContainer<SigmaAtlasNodeAttributes, SigmaAtlasEdgeAttributes>
        graph={atlasGraph}
        className="sigma-atlas"
        settings={sigmaSettings}
      >
        <SigmaAtlasRuntime
          selectedNodeId={selectedNodeId}
          hoveredNodeId={hoveredNodeId}
          draggingNodeId={draggingNodeId}
          onNodeSelectAction={onNodeSelectAction}
          onNodeHoverAction={onNodeHoverAction}
          onDraggingNodeChangeAction={setDraggingNodeId}
          onNodePositionsChangeAction={handleNodePositionsChange}
          onZoomLevelChangeAction={onZoomLevelChangeAction}
        />
        <ControlsContainer className="atlas-controls" position="bottom-left">
          <ZoomControl labels={{ zoomIn: "Zoom In", zoomOut: "Zoom Out", reset: "Fit View" }} />
        </ControlsContainer>
      </SigmaContainer>
      <ConstellationOverlay
        nodeViews={nodeViews}
        model={model}
        layout={sessionLayout}
        selectedNodeId={selectedNodeId}
        hoveredNodeId={hoveredNodeId}
        draggingNodeId={draggingNodeId}
        onNodeSelectAction={onNodeSelectAction}
        onNodeHoverAction={onNodeHoverAction}
        onDraggingNodeChangeAction={setDraggingNodeId}
        onNodePositionsChangeAction={handleNodePositionsChange}
      />
      <div className="sigma-interaction-cue" aria-hidden="true">
        <span>Hover</span>
        <span>Click to inspect</span>
        <span>Drag to pin</span>
      </div>
      <ol className="sigma-node-index" aria-label="Rendered Sigma atlas nodes">
        {nodeViews.slice(0, 12).map((node) => (
          <li key={node.id}>{node.title} · {node.type} · {node.aggregateCount || 1}</li>
        ))}
      </ol>
      <p className="sigma-atlas-description" aria-label="Sigma atlas visual policy">
        Deterministic semantic-neighborhood layout with sparse labels, drag affordances, and edge-weighted neighbor tension: disease sites anchor resource neighborhoods, document types sit in compact centroid-integrated classification pockets, and moved connected nodes keep session positions after drag.
      </p>
    </div>
  );
}

function ConstellationOverlay({
  nodeViews,
  model,
  layout,
  selectedNodeId,
  hoveredNodeId,
  draggingNodeId,
  onNodeSelectAction,
  onNodeHoverAction,
  onDraggingNodeChangeAction,
  onNodePositionsChangeAction
}: {
  nodeViews: AtlasNodeView[];
  model: CorpusAtlasModel;
  layout: Record<string, AtlasLayoutPoint>;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  draggingNodeId: string | null;
  onNodeSelectAction: (nodeId: string) => void;
  onNodeHoverAction: (nodeId: string | null) => void;
  onDraggingNodeChangeAction: (nodeId: string | null) => void;
  onNodePositionsChangeAction: (positions: Record<string, AtlasLayoutPoint>) => void;
}) {
  const bounds = useMemo(() => computeLayoutBounds(layout), [layout]);
  const activeNodeId = hoveredNodeId ?? selectedNodeId;
  const activeEdgeNodeId = draggingNodeId ?? activeNodeId;
  const activeEdges = useMemo(() => activeEdgeNodeId ? activeEdgesForNode(model.graphPayload.edges, activeEdgeNodeId) : [], [activeEdgeNodeId, model.graphPayload.edges]);
  const activeNeighborIds = useMemo(() => new Set(activeEdges.flatMap((edge) => [edge.source, edge.target]).filter((nodeId) => nodeId !== activeEdgeNodeId)), [activeEdgeNodeId, activeEdges]);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const overlayDragRef = useRef<string | null>(null);
  const overlayDragOriginRef = useRef<DragTensionOrigin | null>(null);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const draggedNode = overlayDragRef.current;
    if (!draggedNode || !mapRef.current) {
      return;
    }

    event.preventDefault();
    const point = pointFromOverlayPointer(event, mapRef.current, bounds);
    const dragOrigin = overlayDragOriginRef.current;
    onNodePositionsChangeAction(buildTensionPositions(draggedNode, point, dragOrigin, model.graphPayload.edges));
  }, [bounds, model.graphPayload.edges, onNodePositionsChangeAction]);

  const finishOverlayDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const draggedNode = overlayDragRef.current;
    if (!draggedNode) {
      return;
    }

    overlayDragRef.current = null;
    overlayDragOriginRef.current = null;
    onDraggingNodeChangeAction(null);
    onNodeHoverAction(draggedNode);
    if (mapRef.current?.hasPointerCapture(event.pointerId)) {
      mapRef.current.releasePointerCapture(event.pointerId);
    }
  }, [onDraggingNodeChangeAction, onNodeHoverAction]);

  return (
    <div
      ref={mapRef}
      className="sigma-constellation-map"
      data-testid="sigma-constellation-map"
      aria-hidden="true"
      onPointerMove={handlePointerMove}
      onPointerUp={finishOverlayDrag}
      onPointerCancel={finishOverlayDrag}
      onLostPointerCapture={finishOverlayDrag}
    >
      {activeEdges.length > 0 ? (
        <svg className="sigma-relationship-overlay" data-testid="sigma-relationship-overlay" aria-hidden="true">
          {activeEdges.map((edge) => {
            const source = layout[edge.source];
            const target = layout[edge.target];
            if (!source || !target) {
              return null;
            }

            const sourcePosition = toOverlayPosition(source, bounds);
            const targetPosition = toOverlayPosition(target, bounds);
            const labelPosition = {
              left: (sourcePosition.left + targetPosition.left) / 2,
              top: (sourcePosition.top + targetPosition.top) / 2
            };

            return (
              <g key={edge.id ?? `${edge.source}-${edge.target}-${edge.type}`} data-edge-type={edge.type} data-edge-tone={edgeTypeShortLabel(edge.type)} data-active-edge="true">
                <line
                  x1={`${sourcePosition.left}%`}
                  y1={`${sourcePosition.top}%`}
                  x2={`${targetPosition.left}%`}
                  y2={`${targetPosition.top}%`}
                />
                <text x={`${labelPosition.left}%`} y={`${labelPosition.top}%`}>{edgeTypeShortLabel(edge.type)}</text>
              </g>
            );
          })}
        </svg>
      ) : null}
      {nodeViews.map((node) => {
        const point = layout[node.id];
        if (!point) {
          return null;
        }

        const position = toOverlayPosition(point, bounds);
        const isActive = node.id === activeNodeId || node.id === draggingNodeId;
        const isReacting = activeNeighborIds.has(node.id);
        const showLabel = isActive || shouldShowPersistentLabel(node);

        return (
          <span
            key={node.id}
            className={`sigma-constellation-node sigma-constellation-node--${node.kind} sigma-constellation-node--${node.group}`}
            data-active={isActive}
            data-dragging={node.id === draggingNodeId}
            data-reacting={isReacting}
            data-node-id={node.id}
            data-node-kind={node.kind}
            data-node-group={node.group}
            data-node-status={node.provenanceStatus}
            data-node-type={node.type}
            data-layout-x={point.x}
            data-layout-y={point.y}
            style={{ left: `${position.left}%`, top: `${position.top}%` }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              overlayDragRef.current = node.id;
              overlayDragOriginRef.current = {
                nodeId: node.id,
                origin: layout[node.id],
                neighborOrigins: neighborOriginsForNode(node.id, layout, model.graphPayload.edges)
              };
              onDraggingNodeChangeAction(node.id);
              onNodeHoverAction(node.id);
              onNodeSelectAction(node.id);
              mapRef.current?.setPointerCapture(event.pointerId);
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onNodeSelectAction(node.id);
            }}
            onPointerEnter={() => onNodeHoverAction(node.id)}
            onPointerLeave={() => {
              if (!overlayDragRef.current) {
                onNodeHoverAction(null);
              }
            }}
          >
            {showLabel ? (
              <span className="sigma-constellation-label">
                <span className="sigma-constellation-label__chip">{nodeVisualLabel(node)}</span>
                <span>{truncateLabel(node.title)}</span>
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

function SigmaAtlasRuntime({
  selectedNodeId,
  hoveredNodeId,
  draggingNodeId,
  onNodeSelectAction,
  onNodeHoverAction,
  onDraggingNodeChangeAction,
  onNodePositionsChangeAction,
  onZoomLevelChangeAction
}: Omit<SigmaCorpusGraphProps, "model" | "nodeViews"> & {
  draggingNodeId: string | null;
  onDraggingNodeChangeAction: (nodeId: string | null) => void;
  onNodePositionsChangeAction: (positions: Record<string, AtlasLayoutPoint>) => void;
}) {
  const sigma = useSigma<SigmaAtlasNodeAttributes, SigmaAtlasEdgeAttributes>();
  const registerEvents = useRegisterEvents();
  const setSettings = useSetSettings<SigmaAtlasNodeAttributes, SigmaAtlasEdgeAttributes>();
  const camera = useCamera({ duration: 260, factor: 1.45 });
  const draggedNodeRef = useRef<string | null>(null);
  const wasDraggedRef = useRef(false);
  const dragOriginRef = useRef<DragTensionOrigin | null>(null);

  const finishDragging = useCallback(() => {
    const draggedNode = draggedNodeRef.current;
    if (!draggedNode) {
      return;
    }

    const graph = sigma.getGraph();
    const changedPositions: Record<string, AtlasLayoutPoint> = {};
    if (graph.hasNode(draggedNode)) {
      const node = graph.getNodeAttributes(draggedNode);
      graph.setNodeAttribute(draggedNode, "isDragging", false);
      graph.setNodeAttribute(draggedNode, "highlighted", true);
      changedPositions[draggedNode] = roundPoint({ x: node.x, y: node.y });
      graph.neighbors(draggedNode).forEach((neighborId) => {
        if (!graph.hasNode(neighborId)) {
          return;
        }
        const neighbor = graph.getNodeAttributes(neighborId);
        graph.setNodeAttribute(neighborId, "highlighted", true);
        changedPositions[neighborId] = roundPoint({ x: neighbor.x, y: neighbor.y });
      });
    }
    onNodePositionsChangeAction(changedPositions);
    sigma.setCustomBBox(null);
    sigma.refresh();
    draggedNodeRef.current = null;
    dragOriginRef.current = null;
    wasDraggedRef.current = false;
    onDraggingNodeChangeAction(null);
  }, [onDraggingNodeChangeAction, onNodePositionsChangeAction, sigma]);

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
          const node = graph.getNodeAttributes(event.node);
          dragOriginRef.current = {
            nodeId: event.node,
            origin: { x: node.x, y: node.y },
            neighborOrigins: graph.neighbors(event.node).reduce<Record<string, AtlasLayoutPoint>>((origins, neighborId) => {
              const neighbor = graph.getNodeAttributes(neighborId);
              origins[neighborId] = { x: neighbor.x, y: neighbor.y };
              return origins;
            }, {})
          };
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
        applyGraphTension(graph, draggedNode, roundPoint(position), dragOriginRef.current);
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
        if (!wasDraggedRef.current) {
          onNodeSelectAction(event.node);
        }
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
      nodeReducer: (nodeId, data) => {
        const nextData = { ...data };
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
        if (!activeNodeId || !graph.hasNode(activeNodeId)) {
          return nextData;
        }

        const isActiveEdge = graph.extremities(edgeId).includes(activeNodeId);
        nextData.hidden = !isActiveEdge;
        if (isActiveEdge) {
          nextData.color = toActiveSigmaEdgeColor(data.edgeType);
          nextData.size = 2.2;
        }
        return nextData;
      }
    });
    sigma.refresh();
  }, [draggingNodeId, hoveredNodeId, selectedNodeId, setSettings, sigma]);

  useEffect(() => {
    if (!draggingNodeId && selectedNodeId && sigma.getGraph().hasNode(selectedNodeId)) {
      const node = sigma.getGraph().getNodeAttributes(selectedNodeId);
      camera.goto({ x: node.x, y: node.y, ratio: node.kind === "resource" ? 0.78 : 0.92 }, { duration: 320 });
    }
  }, [camera, draggingNodeId, selectedNodeId, sigma]);

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

function computeClusteredAtlasLayout(model: CorpusAtlasModel, nodeViews: AtlasNodeView[]): Record<string, AtlasLayoutPoint> {
  const layout: Record<string, AtlasLayoutPoint> = {};
  const nodeById = new Map(nodeViews.map((node) => [node.id, node]));
  const diseaseClusters = nodeViews
    .filter((node) => node.group === "diseaseSites")
    .sort((left, right) => right.aggregateCount - left.aggregateCount || left.title.localeCompare(right.title));
  const documentClusters = nodeViews
    .filter((node) => node.group === "documents")
    .sort((left, right) => right.aggregateCount - left.aggregateCount || left.title.localeCompare(right.title));
  const archiveClusters = nodeViews
    .filter((node) => node.group === "archive")
    .sort((left, right) => right.aggregateCount - left.aggregateCount || left.title.localeCompare(right.title));
  const resourcesByDiseaseCluster = new Map<string, string[]>();
  const resourcesByDocumentCluster = new Map<string, string[]>();

  diseaseClusters.forEach((node, index) => {
    layout[node.id] = diseaseNeighborhoodAnchor(index, node.id);
  });

  model.graphPayload.edges
    .filter((edge) => edge.type === "resource_to_disease_site" && nodeById.get(edge.source)?.kind === "resource")
    .sort((left, right) => left.source.localeCompare(right.source))
    .forEach((edge) => {
      const resources = resourcesByDiseaseCluster.get(edge.target) ?? [];
      resources.push(edge.source);
      resourcesByDiseaseCluster.set(edge.target, resources);
    });

  model.graphPayload.edges
    .filter((edge) => edge.type === "resource_to_document_type" && nodeById.get(edge.source)?.kind === "resource")
    .sort((left, right) => left.source.localeCompare(right.source))
    .forEach((edge) => {
      const resources = resourcesByDocumentCluster.get(edge.target) ?? [];
      resources.push(edge.source);
      resourcesByDocumentCluster.set(edge.target, resources);
    });

  resourcesByDiseaseCluster.forEach((resources, diseaseClusterId) => {
    const anchor = layout[diseaseClusterId] ?? { x: 0, y: 0 };
    resources.sort((left, right) => left.localeCompare(right));
    resources.forEach((resourceId, index) => {
      layout[resourceId] = resourceNeighborhoodPoint(resourceId, anchor, index, resources.length);
    });
  });

  documentClusters.forEach((node, index) => {
    const resources = resourcesByDocumentCluster.get(node.id) ?? [];
    const centroid = centroidForResources(resources, layout);
    layout[node.id] = documentTypeAnchor(index, documentClusters.length, centroid);
  });

  archiveClusters.forEach((node, index) => {
    layout[node.id] = archiveStatusAnchor(index, archiveClusters.length);
  });

  nodeViews.forEach((node, index) => {
    if (!layout[node.id]) {
      layout[node.id] = fallbackAnchor(node.id, index);
    }
  });

  return layout;
}

function computeLayoutBounds(layout: Record<string, AtlasLayoutPoint>) {
  const points = Object.values(layout);
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));

  return { minX, maxX, minY, maxY };
}

function toOverlayPosition(point: AtlasLayoutPoint, bounds: { minX: number; maxX: number; minY: number; maxY: number }) {
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);

  return {
    left: 13 + ((point.x - bounds.minX) / width) * 74,
    top: 12 + ((point.y - bounds.minY) / height) * 76
  };
}

function pointFromOverlayPointer(
  event: React.PointerEvent,
  element: HTMLElement,
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
): AtlasLayoutPoint {
  const rect = element.getBoundingClientRect();
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);
  const leftPercent = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
  const topPercent = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 100;
  const xRatio = clamp((leftPercent - 13) / 74, 0, 1);
  const yRatio = clamp((topPercent - 12) / 76, 0, 1);

  return roundPoint({
    x: bounds.minX + xRatio * width,
    y: bounds.minY + yRatio * height
  });
}

function diseaseNeighborhoodAnchor(index: number, nodeId: string): AtlasLayoutPoint {
  const baseAnchor = diseaseNeighborhoodAnchors[index] ?? fallbackAnchor(nodeId, index);
  const unit = seededUnit(`disease-neighborhood:${nodeId}`) - 0.5;

  return roundPoint({
    x: baseAnchor.x + unit * 14,
    y: baseAnchor.y - unit * 10
  });
}

function documentTypeAnchor(index: number, total: number, resourceCentroid: AtlasLayoutPoint | null): AtlasLayoutPoint {
  const compactScale = total > 4 ? 0.86 : 1;
  const column = index % 3;
  const row = Math.floor(index / 3);
  const pocketX = ((column - 1) * 70 + (row % 2) * 22) * compactScale;
  const pocketY = 24 + row * 38 + (column === 1 ? -12 : 8);
  const centroidX = resourceCentroid ? clamp(resourceCentroid.x, -250, 250) : 0;
  const centroidY = resourceCentroid ? clamp(resourceCentroid.y, -110, 150) : 0;

  return roundPoint({
    x: clamp(centroidX * 0.58 + pocketX, -300, 300),
    y: clamp(centroidY * 0.5 + pocketY, -92, 172)
  });
}

function archiveStatusAnchor(index: number, total: number): AtlasLayoutPoint {
  return roundPoint({
    x: 300 + (index - (total - 1) / 2) * 56,
    y: archiveShelfY + (index % 2) * 22
  });
}

function resourceNeighborhoodPoint(resourceId: string, anchor: AtlasLayoutPoint, index: number, total: number): AtlasLayoutPoint {
  const unit = seededUnit(resourceId);
  const angle = index * GOLDEN_ANGLE + unit * Math.PI * 0.62;
  const neighborhoodRadius = Math.min(64, 27 + Math.sqrt(Math.max(total, 1)) * 6.4);
  const radius = 11 + Math.sqrt(index + 1) * 6.8 + unit * 4;
  const boundedRadius = Math.min(radius, neighborhoodRadius);

  return roundPoint({
    x: anchor.x + Math.cos(angle) * boundedRadius + (unit - 0.5) * 7,
    y: anchor.y + Math.sin(angle) * boundedRadius * 0.68 + (0.5 - unit) * 5
  });
}

function centroidForResources(resourceIds: string[], layout: Record<string, AtlasLayoutPoint>): AtlasLayoutPoint | null {
  const points = resourceIds.map((resourceId) => layout[resourceId]).filter((point): point is AtlasLayoutPoint => Boolean(point));
  if (points.length === 0) {
    return null;
  }

  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function fallbackAnchor(nodeId: string, index: number): AtlasLayoutPoint {
  const unit = seededUnit(nodeId);
  const angle = index * GOLDEN_ANGLE;
  const radius = 180 + unit * 80;

  return roundPoint({
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * 0.78
  });
}

function activeEdgesForNode(edges: AtlasEdgeView[], nodeId: string) {
  return edges
    .filter((edge) => edge.source === nodeId || edge.target === nodeId)
    .sort((left, right) => `${left.type}:${left.source}:${left.target}`.localeCompare(`${right.type}:${right.source}:${right.target}`));
}

function neighborOriginsForNode(nodeId: string, layout: Record<string, AtlasLayoutPoint>, edges: AtlasEdgeView[]) {
  return activeEdgesForNode(edges, nodeId).reduce<Record<string, AtlasLayoutPoint>>((origins, edge) => {
    const neighborId = edge.source === nodeId ? edge.target : edge.source;
    const point = layout[neighborId];
    if (point) {
      origins[neighborId] = point;
    }
    return origins;
  }, {});
}

function buildTensionPositions(
  draggedNodeId: string,
  point: AtlasLayoutPoint,
  origin: DragTensionOrigin | null,
  edges: AtlasEdgeView[]
) {
  const positions: Record<string, AtlasLayoutPoint> = { [draggedNodeId]: point };
  if (!origin || origin.nodeId !== draggedNodeId) {
    return positions;
  }

  const delta = { x: point.x - origin.origin.x, y: point.y - origin.origin.y };
  activeEdgesForNode(edges, draggedNodeId).forEach((edge) => {
    const neighborId = edge.source === draggedNodeId ? edge.target : edge.source;
    const neighborOrigin = origin.neighborOrigins[neighborId];
    if (!neighborOrigin) {
      return;
    }

    const weight = edgeTensionWeight(edge.type);
    positions[neighborId] = roundPoint({
      x: neighborOrigin.x + delta.x * weight,
      y: neighborOrigin.y + delta.y * weight
    });
  });

  return positions;
}

function applyGraphTension(graph: SigmaAtlasGraph, draggedNodeId: string, point: AtlasLayoutPoint, origin: DragTensionOrigin | null) {
  const positions = buildGraphTensionPositions(graph, draggedNodeId, point, origin);
  Object.entries(positions).forEach(([nodeId, position]) => {
    if (!graph.hasNode(nodeId)) {
      return;
    }
    graph.setNodeAttribute(nodeId, "x", position.x);
    graph.setNodeAttribute(nodeId, "y", position.y);
    if (nodeId !== draggedNodeId) {
      graph.setNodeAttribute(nodeId, "highlighted", true);
    }
  });
}

function buildGraphTensionPositions(graph: SigmaAtlasGraph, draggedNodeId: string, point: AtlasLayoutPoint, origin: DragTensionOrigin | null) {
  const positions: Record<string, AtlasLayoutPoint> = { [draggedNodeId]: point };
  if (!origin || origin.nodeId !== draggedNodeId) {
    return positions;
  }

  const delta = { x: point.x - origin.origin.x, y: point.y - origin.origin.y };
  graph.edges(draggedNodeId).forEach((edgeId) => {
    const [source, target] = graph.extremities(edgeId);
    const neighborId = source === draggedNodeId ? target : source;
    const neighborOrigin = origin.neighborOrigins[neighborId];
    if (!neighborOrigin) {
      return;
    }

    const edge = graph.getEdgeAttributes(edgeId);
    const weight = edgeTensionWeight(edge.edgeType);
    positions[neighborId] = roundPoint({
      x: neighborOrigin.x + delta.x * weight,
      y: neighborOrigin.y + delta.y * weight
    });
  });

  return positions;
}

function edgeTensionWeight(edgeType: string) {
  if (edgeType === "resource_to_source_span") {
    return 0.36;
  }
  if (edgeType === "resource_to_disease_site") {
    return 0.3;
  }
  if (edgeType === "resource_to_document_type") {
    return 0.22;
  }
  if (edgeType === "resource_to_archive_status") {
    return 0.16;
  }
  return 0.2;
}

function edgeTypeShortLabel(edgeType: string) {
  if (edgeType === "resource_to_disease_site") {
    return "site";
  }
  if (edgeType === "resource_to_document_type") {
    return "type";
  }
  if (edgeType === "resource_to_archive_status") {
    return "archive";
  }
  if (edgeType === "resource_to_source_span") {
    return "span";
  }
  return "link";
}

function shouldShowPersistentLabel(node: AtlasNodeView) {
  if (node.kind === "resource") {
    return false;
  }

  return node.kind === "archive" || node.aggregateCount >= 8;
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
    context.arc(node.x, node.y, node.size + (node.isDragging ? 8 : 5.4), 0, Math.PI * 2);
    context.strokeStyle = withAlpha(readAtlasColorToken("--color-ink"), node.isDragging ? 0.72 : 0.54);
    context.lineWidth = node.isDragging ? 2.2 : 1.4;
    context.stroke();
  }

  context.beginPath();
  context.arc(node.x, node.y, node.size, 0, Math.PI * 2);
  context.fillStyle = node.color ?? readAtlasColorToken("--color-cyan");
  context.shadowColor = node.color ?? readAtlasColorToken("--color-cyan");
  context.shadowBlur = node.isDragging ? 18 : node.highlighted ? 12 : node.isClusterAnchor ? 9 : 5;
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = node.isDragging || node.highlighted ? readAtlasColorToken("--color-ink") : withAlpha(readAtlasColorToken("--color-ink"), 0.42);
  context.lineWidth = node.isDragging ? 2.2 : node.highlighted ? 1.7 : node.isClusterAnchor ? 1.35 : 0.9;
  context.stroke();
  drawNodeEncodingMark(context, node);
  if (!node.isClusterAnchor || node.isDragging) {
    context.beginPath();
    context.arc(node.x, node.y, node.size + 3.2, 0, Math.PI * 2);
    context.strokeStyle = withAlpha(node.color ?? readAtlasColorToken("--color-cyan"), node.isDragging ? 0.64 : node.highlighted ? 0.5 : 0.2);
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

export function truncateLabel(label: string, maxGraphemes = 44) {
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

function nodeVisualLabel(node: AtlasNodeView) {
  if (node.kind === "resource") {
    return "resource";
  }
  if (node.group === "documents") {
    return "doc type";
  }
  if (node.kind === "archive") {
    return "archive";
  }
  if (node.kind === "sourceSpan") {
    return "span";
  }
  return "site";
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

function seededUnit(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
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
