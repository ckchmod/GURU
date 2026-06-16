import circular from "graphology-layout/circular";
import forceAtlas2 from "graphology-layout-forceatlas2";
import noverlap from "graphology-layout-noverlap";
import type { AtlasGraph } from "./atlasGraphAdapter";

export type AtlasForceLayoutOptions = {
  seed: string;
  scale: number;
  nodeRadius: number;
};

export type AtlasForceLayoutMetrics = {
  nodeCount: number;
  edgeCount: number;
  iterations: number;
  overlapCount: number;
  settled: boolean;
  seed: string;
};

const FORCE_ATLAS_ITERATIONS = 120;
const NOVERLAP_ITERATIONS = 600;
const FINAL_COLLISION_PASSES = 80;
const COORDINATE_PRECISION = 4;

export function computeDeterministicForceAtlasLayout(graph: AtlasGraph, options: AtlasForceLayoutOptions): AtlasGraph {
  const nodeIds = sortedNodeIds(graph);

  if (nodeIds.length === 0) {
    return assignLayoutMetrics(graph, options.seed, 0, 0, true);
  }

  if (nodeIds.length === 1) {
    const nodeId = nodeIds[0];
    graph.setNodeAttribute(nodeId, "x", 0);
    graph.setNodeAttribute(nodeId, "y", 0);
    assignNodeLayoutMetadata(graph, nodeId, options.nodeRadius, clusterForNode(graph, nodeId));
    return assignLayoutMetrics(graph, options.seed, FORCE_ATLAS_ITERATIONS, 0, true);
  }

  initializeCircularSeededLayout(graph, nodeIds, options);
  assignRadiusMetadata(graph, nodeIds, options.nodeRadius);

  forceAtlas2.assign(graph, {
    iterations: FORCE_ATLAS_ITERATIONS,
    settings: {
      ...forceAtlas2.inferSettings(graph),
      adjustSizes: false,
      barnesHutOptimize: graph.order > 100,
      gravity: 0.08,
      scalingRatio: Math.max(2, options.scale / 12),
      slowDown: 8,
      strongGravityMode: false
    }
  });

  assertFiniteAtlasLayoutCoordinates(graph);
  normalizeLayoutScale(graph, nodeIds, options.scale);
  noverlap.assign(graph, {
    maxIterations: NOVERLAP_ITERATIONS,
    inputReducer: (_nodeId, attributes) => ({
      x: attributes.x,
      y: attributes.y,
      size: options.nodeRadius
    }),
    settings: {
      expansion: 1.25,
      gridSize: Math.max(1, Math.ceil(Math.sqrt(graph.order))),
      margin: 1,
      ratio: 2,
      speed: 2
    }
  });
  resolveRemainingOverlaps(graph, nodeIds, options.nodeRadius, options.seed);
  roundLayoutCoordinates(graph, nodeIds);
  assertFiniteAtlasLayoutCoordinates(graph);

  const overlapCount = countNodeCircleOverlaps(graph, nodeIds, options.nodeRadius);
  return assignLayoutMetrics(graph, options.seed, FORCE_ATLAS_ITERATIONS, overlapCount, overlapCount === 0);
}

export function assertFiniteAtlasLayoutCoordinates(graph: AtlasGraph): void {
  for (const nodeId of graph.nodes()) {
    const { x, y } = graph.getNodeAttributes(nodeId);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`${nodeId} must have finite coordinate values before Sigma rendering; got x=${x}, y=${y}`);
    }
  }
}

function initializeCircularSeededLayout(graph: AtlasGraph, nodeIds: string[], options: AtlasForceLayoutOptions) {
  circular.assign(graph, { center: 0, scale: options.scale });
  const rotation = seededUnit(`${options.seed}:rotation`) * Math.PI * 2;

  nodeIds.forEach((nodeId, index) => {
    const attributes = graph.getNodeAttributes(nodeId);
    const jitter = (seededUnit(`${options.seed}:${nodeId}:jitter`) - 0.5) * Math.max(1, options.scale * 0.05);
    const angle = rotation + (index * Math.PI * 2) / nodeIds.length;
    const baseRadius = Math.hypot(attributes.x, attributes.y) || options.scale;

    graph.setNodeAttribute(nodeId, "x", roundCoordinate(Math.cos(angle) * (baseRadius + jitter)));
    graph.setNodeAttribute(nodeId, "y", roundCoordinate(Math.sin(angle) * (baseRadius + jitter)));
  });
}

function assignRadiusMetadata(graph: AtlasGraph, nodeIds: string[], nodeRadius: number) {
  nodeIds.forEach((nodeId) => assignNodeLayoutMetadata(graph, nodeId, nodeRadius, clusterForNode(graph, nodeId)));
}

function assignNodeLayoutMetadata(graph: AtlasGraph, nodeId: string, radius: number, cluster: string) {
  graph.setNodeAttribute(nodeId, "radius", radius);
  graph.setNodeAttribute(nodeId, "cluster", cluster);
}

function normalizeLayoutScale(graph: AtlasGraph, nodeIds: string[], scale: number) {
  const centroid = nodeIds.reduce(
    (sum, nodeId) => {
      const { x, y } = graph.getNodeAttributes(nodeId);
      return { x: sum.x + x, y: sum.y + y };
    },
    { x: 0, y: 0 }
  );
  centroid.x /= nodeIds.length;
  centroid.y /= nodeIds.length;

  const maxDistance = Math.max(
    ...nodeIds.map((nodeId) => {
      const { x, y } = graph.getNodeAttributes(nodeId);
      return Math.hypot(x - centroid.x, y - centroid.y);
    }),
    1
  );
  const ratio = scale / maxDistance;

  nodeIds.forEach((nodeId) => {
    const { x, y } = graph.getNodeAttributes(nodeId);
    graph.setNodeAttribute(nodeId, "x", (x - centroid.x) * ratio);
    graph.setNodeAttribute(nodeId, "y", (y - centroid.y) * ratio);
  });
}

function resolveRemainingOverlaps(graph: AtlasGraph, nodeIds: string[], nodeRadius: number, seed: string) {
  const minimumDistance = nodeRadius * 2;

  for (let pass = 0; pass < FINAL_COLLISION_PASSES; pass += 1) {
    let moved = false;

    for (let leftIndex = 0; leftIndex < nodeIds.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < nodeIds.length; rightIndex += 1) {
        const leftId = nodeIds[leftIndex];
        const rightId = nodeIds[rightIndex];
        const left = graph.getNodeAttributes(leftId);
        const right = graph.getNodeAttributes(rightId);
        const deltaX = right.x - left.x;
        const deltaY = right.y - left.y;
        const distance = Math.hypot(deltaX, deltaY);

        if (distance >= minimumDistance) {
          continue;
        }

        const fallbackAngle = seededUnit(`${seed}:${leftId}:${rightId}:collision`) * Math.PI * 2;
        const unitX = distance > 0 ? deltaX / distance : Math.cos(fallbackAngle);
        const unitY = distance > 0 ? deltaY / distance : Math.sin(fallbackAngle);
        const push = (minimumDistance - distance + 0.02) / 2;

        graph.setNodeAttribute(leftId, "x", left.x - unitX * push);
        graph.setNodeAttribute(leftId, "y", left.y - unitY * push);
        graph.setNodeAttribute(rightId, "x", right.x + unitX * push);
        graph.setNodeAttribute(rightId, "y", right.y + unitY * push);
        moved = true;
      }
    }

    if (!moved) {
      return;
    }
  }
}

function roundLayoutCoordinates(graph: AtlasGraph, nodeIds: string[]) {
  nodeIds.forEach((nodeId) => {
    const { x, y } = graph.getNodeAttributes(nodeId);
    graph.setNodeAttribute(nodeId, "x", roundCoordinate(x));
    graph.setNodeAttribute(nodeId, "y", roundCoordinate(y));
  });
}

function countNodeCircleOverlaps(graph: AtlasGraph, nodeIds: string[], nodeRadius: number) {
  let overlapCount = 0;
  const minimumDistance = nodeRadius * 2;

  for (let leftIndex = 0; leftIndex < nodeIds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < nodeIds.length; rightIndex += 1) {
      const left = graph.getNodeAttributes(nodeIds[leftIndex]);
      const right = graph.getNodeAttributes(nodeIds[rightIndex]);
      if (Math.hypot(left.x - right.x, left.y - right.y) < minimumDistance) {
        overlapCount += 1;
      }
    }
  }

  return overlapCount;
}

function assignLayoutMetrics(graph: AtlasGraph, seed: string, iterations: number, overlapCount: number, settled: boolean): AtlasGraph {
  const metrics: AtlasForceLayoutMetrics = {
    nodeCount: graph.order,
    edgeCount: graph.size,
    iterations,
    overlapCount,
    settled,
    seed
  };

  graph.setAttribute("layoutMetrics", metrics);
  graph.setAttribute("layoutSeed", seed);
  graph.setAttribute("layoutIterations", iterations);
  graph.setAttribute("layoutOverlapCount", overlapCount);
  graph.setAttribute("layoutSettled", settled);

  return graph;
}

function sortedNodeIds(graph: AtlasGraph) {
  return graph.nodes().sort((left, right) => left.localeCompare(right));
}

function clusterForNode(graph: AtlasGraph, nodeId: string) {
  const attributes = graph.getNodeAttributes(nodeId);
  return attributes.resourceId ?? attributes.nodeType;
}

function seededUnit(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967296;
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(COORDINATE_PRECISION));
}
