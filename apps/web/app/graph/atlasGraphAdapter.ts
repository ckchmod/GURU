import Graph from "graphology";

export type AtlasApiNode = {
  id: string;
  type: string;
  label?: string;
  title?: string;
  source_span_ids?: string[];
  output_status?: string;
  resource_id?: string;
};

export type AtlasApiEdge = {
  id?: string;
  source: string;
  target: string;
  type: string;
};

export type AtlasApiGraphPayload = {
  nodes: AtlasApiNode[];
  edges: AtlasApiEdge[];
};

export type AtlasGraphNodeAttributes = {
  label: string;
  nodeType: string;
  sourceSpanIds: string[];
  outputStatus: string;
  resourceId?: string;
  x: number;
  y: number;
};

export type AtlasGraphEdgeAttributes = {
  edgeType: string;
};

export type AtlasGraph = Graph<AtlasGraphNodeAttributes, AtlasGraphEdgeAttributes>;

const DEFAULT_OUTPUT_STATUS = "draft";
const LAYOUT_RADIUS = 120;

export function buildAtlasGraph(payload: AtlasApiGraphPayload): AtlasGraph {
  const graph = new Graph<AtlasGraphNodeAttributes, AtlasGraphEdgeAttributes>({ multi: true, type: "directed" });
  const nodes = [...payload.nodes].sort((left, right) => left.id.localeCompare(right.id));
  const edges = payload.edges
    .map((edge) => edge)
    .sort((left, right) => edgeSortKey(left).localeCompare(edgeSortKey(right)));
  const layout = computeCircularAtlasLayout(nodes.map((node) => node.id));
  const edgeKeyCounts = new Map<string, number>();

  for (const node of nodes) {
    const position = layout[node.id];

    graph.addNode(node.id, {
      label: node.label ?? node.title ?? node.id,
      nodeType: node.type,
      sourceSpanIds: [...(node.source_span_ids ?? [])].sort(),
      outputStatus: node.output_status ?? DEFAULT_OUTPUT_STATUS,
      resourceId: node.resource_id,
      x: position.x,
      y: position.y
    });
  }

  for (const edge of edges) {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) {
      continue;
    }

    graph.addDirectedEdgeWithKey(stableEdgeKey(edge, edgeKeyCounts), edge.source, edge.target, {
      edgeType: edge.type
    });
  }

  return graph;
}

export function computeCircularAtlasLayout(nodeIds: string[]): Record<string, { x: number; y: number }> {
  const sortedIds = [...nodeIds].sort((left, right) => left.localeCompare(right));
  const layout: Record<string, { x: number; y: number }> = {};

  if (sortedIds.length === 0) {
    return layout;
  }

  if (sortedIds.length === 1) {
    layout[sortedIds[0]] = { x: 0, y: 0 };
    return layout;
  }

  sortedIds.forEach((nodeId, index) => {
    const angle = (2 * Math.PI * index) / sortedIds.length;

    layout[nodeId] = {
      x: roundCoordinate(Math.cos(angle) * LAYOUT_RADIUS),
      y: roundCoordinate(Math.sin(angle) * LAYOUT_RADIUS)
    };
  });

  return layout;
}

function stableEdgeKey(edge: AtlasApiEdge, edgeKeyCounts: Map<string, number>) {
  const baseKey = edge.id ?? edgeSortKey(edge);
  const count = edgeKeyCounts.get(baseKey) ?? 0;
  edgeKeyCounts.set(baseKey, count + 1);

  return count === 0 ? baseKey : `${baseKey}:${count + 1}`;
}

function edgeSortKey(edge: AtlasApiEdge) {
  return edge.id ?? `${edge.source}->${edge.target}:${edge.type}`;
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(4));
}
