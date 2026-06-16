import { describe, expect, it } from "vitest";
import * as atlasGraphAdapter from "./atlasGraphAdapter";
import { buildAtlasGraph, computeCircularAtlasLayout, type AtlasApiGraphPayload, type AtlasGraph } from "./atlasGraphAdapter";

type ForceAtlasLayoutOptions = {
  seed: string;
  scale: number;
  nodeRadius: number;
};

type ForceAtlasLayoutContract = (graph: AtlasGraph, options: ForceAtlasLayoutOptions) => AtlasGraph;
type CoordinateGuardContract = (graph: AtlasGraph) => void;

const DEFAULT_LAYOUT_SCALE = 120;
const DEFAULT_NODE_RADIUS = 8;
const CONTRACT_SEED = "atlas-force-layout-contract-v1";

const adapterContracts = atlasGraphAdapter as typeof atlasGraphAdapter & {
  computeDeterministicForceAtlasLayout?: ForceAtlasLayoutContract;
  assertFiniteAtlasLayoutCoordinates?: CoordinateGuardContract;
};

describe("atlas graph adapter", () => {
  it("maps an API-shaped graph payload into a stable Graphology graph", () => {
    const payload: AtlasApiGraphPayload = {
      nodes: [
        {
          id: "source-span.alpha",
          type: "source_span",
          label: "Source span alpha",
          source_span_ids: [],
          output_status: "draft",
          resource_id: "resource.alpha"
        },
        {
          id: "resource.alpha",
          type: "resource",
          title: "Public resource alpha",
          source_span_ids: [],
          output_status: "draft",
          resource_id: "resource.alpha"
        }
      ],
      edges: [
        {
          id: "resource-to-source-span",
          source: "resource.alpha",
          target: "source-span.alpha",
          type: "resource_to_source_span"
        }
      ]
    };

    const graph = buildAtlasGraph(payload);

    expect(graph.order).toBe(2);
    expect(graph.size).toBe(1);
    expect(graph.nodes()).toEqual(["resource.alpha", "source-span.alpha"]);
    expect(graph.edges()).toEqual(["resource-to-source-span"]);
    expect(graph.source("resource-to-source-span")).toBe("resource.alpha");
    expect(graph.target("resource-to-source-span")).toBe("source-span.alpha");
    expect(graph.getNodeAttributes("resource.alpha")).toEqual({
      label: "Public resource alpha",
      nodeType: "resource",
      sourceSpanIds: [],
      outputStatus: "draft",
      resourceId: "resource.alpha",
      x: 120,
      y: 0
    });
    expect(graph.getEdgeAttributes("resource-to-source-span")).toEqual({ edgeType: "resource_to_source_span" });
  });

  it("computes jsdom-safe deterministic coordinates without rendering Sigma", () => {
    expect(computeCircularAtlasLayout(["b", "a", "c"])).toEqual({
      a: { x: 120, y: 0 },
      b: { x: -60, y: 103.923 },
      c: { x: -60, y: -103.923 }
    });
  });

  describe("deterministic Sigma/Graphology force-layout contract", () => {
    // Compatibility note: Graphology standard-library docs name the packages as
    // graphology-layout for circular/random initialization, graphology-layout-forceatlas2
    // for ForceAtlas2 assign/inferSettings, and graphology-layout-noverlap for collision cleanup.
    it("keeps an empty graph empty", () => {
      const graph = layoutGraph(graphFixture(0));

      expect(graph.order).toBe(0);
      expect(graph.size).toBe(0);
      expect(graph.nodes()).toEqual([]);
    });

    it("centers a one-node graph with finite coordinates", () => {
      const graph = layoutGraph(graphFixture(1));

      expect(roundedCoordinates(graph)).toEqual({ "node-000": { x: 0, y: 0 } });
      expectFiniteCoordinates(graph);
    });

    it("keeps disconnected graph components finite and separated", () => {
      const graph = layoutGraph({
        nodes: nodeFixture(6),
        edges: [
          edgeFixture("node-000", "node-001"),
          edgeFixture("node-001", "node-002"),
          edgeFixture("node-003", "node-004"),
          edgeFixture("node-004", "node-005")
        ]
      });

      expectFiniteCoordinates(graph);
      expect(uniqueCoordinateCount(graph)).toBe(graph.order);
      expect(componentCentroidDistance(graph, ["node-000", "node-001", "node-002"], ["node-003", "node-004", "node-005"])).toBeGreaterThan(
        DEFAULT_NODE_RADIUS * 4
      );
    });

    it("returns byte-stable coordinates for the same seeded 198-node fixture", () => {
      const firstGraph = layoutGraph(corpusSizedFixture());
      const secondGraph = layoutGraph(corpusSizedFixture());

      expect(roundedCoordinates(firstGraph)).toEqual(roundedCoordinates(secondGraph));
    });

    it("never emits NaN or infinite coordinates for the 198-node corpus-sized fixture", () => {
      const graph = layoutGraph(corpusSizedFixture());

      expectFiniteCoordinates(graph);
    });

    it("settles the 198-node fixture within the default smoothness gate", () => {
      const startedAt = performance.now();
      const graph = layoutGraph(corpusSizedFixture());
      const elapsedMilliseconds = performance.now() - startedAt;

      expect(graph.order).toBe(198);
      expect(elapsedMilliseconds).toBeLessThanOrEqual(3000);
    });

    it("removes all default-scale node-circle overlaps after noverlap cleanup", () => {
      const graph = layoutGraph(corpusSizedFixture());

      expect(countNodeCircleOverlaps(graph, DEFAULT_NODE_RADIUS)).toBe(0);
    });

    it("rejects invalid coordinates before Sigma receives them", () => {
      const graph = buildAtlasGraph(graphFixture(1));
      graph.setNodeAttribute("node-000", "x", Number.NaN);
      const guard = coordinateGuard();

      expect(() => guard(graph)).toThrow(/node-000.*finite coordinate/i);
    });
  });
});

function layoutGraph(payload: AtlasApiGraphPayload) {
  return layoutContract()(buildAtlasGraph(payload), {
    seed: CONTRACT_SEED,
    scale: DEFAULT_LAYOUT_SCALE,
    nodeRadius: DEFAULT_NODE_RADIUS
  });
}

function layoutContract() {
  if (!adapterContracts.computeDeterministicForceAtlasLayout) {
    throw new Error("computeDeterministicForceAtlasLayout is not implemented yet");
  }

  return adapterContracts.computeDeterministicForceAtlasLayout;
}

function coordinateGuard() {
  if (!adapterContracts.assertFiniteAtlasLayoutCoordinates) {
    throw new Error("assertFiniteAtlasLayoutCoordinates is not implemented yet");
  }

  return adapterContracts.assertFiniteAtlasLayoutCoordinates;
}

function graphFixture(nodeCount: number): AtlasApiGraphPayload {
  return { nodes: nodeFixture(nodeCount), edges: [] };
}

function corpusSizedFixture(): AtlasApiGraphPayload {
  const nodes = nodeFixture(198);
  const edges = nodes.slice(1).map((node, index) => edgeFixture(nodes[index].id, node.id));

  return { nodes, edges };
}

function nodeFixture(nodeCount: number) {
  return Array.from({ length: nodeCount }, (_, index) => ({
    id: `node-${index.toString().padStart(3, "0")}`,
    type: index % 5 === 0 ? "resource" : "source_span",
    label: `Public fixture node ${index.toString().padStart(3, "0")}`,
    source_span_ids: [],
    output_status: "draft"
  }));
}

function edgeFixture(source: string, target: string) {
  return {
    id: `${source}-to-${target}`,
    source,
    target,
    type: "fixture_edge"
  };
}

function expectFiniteCoordinates(graph: AtlasGraph) {
  for (const nodeId of graph.nodes()) {
    const { x, y } = graph.getNodeAttributes(nodeId);

    expect(Number.isFinite(x), `${nodeId} x must be finite, got ${x}`).toBe(true);
    expect(Number.isFinite(y), `${nodeId} y must be finite, got ${y}`).toBe(true);
  }
}

function roundedCoordinates(graph: AtlasGraph): Record<string, { x: number; y: number }> {
  return Object.fromEntries(
    graph.nodes().map((nodeId) => {
      const { x, y } = graph.getNodeAttributes(nodeId);
      return [nodeId, { x: roundForContract(x), y: roundForContract(y) }];
    })
  );
}

function uniqueCoordinateCount(graph: AtlasGraph) {
  return new Set(Object.values(roundedCoordinates(graph)).map(({ x, y }) => `${x}:${y}`)).size;
}

function componentCentroidDistance(graph: AtlasGraph, firstNodeIds: string[], secondNodeIds: string[]) {
  const firstCentroid = centroid(graph, firstNodeIds);
  const secondCentroid = centroid(graph, secondNodeIds);

  return distance(firstCentroid, secondCentroid);
}

function centroid(graph: AtlasGraph, nodeIds: string[]) {
  const total = nodeIds.reduce(
    (sum, nodeId) => {
      const { x, y } = graph.getNodeAttributes(nodeId);
      return { x: sum.x + x, y: sum.y + y };
    },
    { x: 0, y: 0 }
  );

  return { x: total.x / nodeIds.length, y: total.y / nodeIds.length };
}

function countNodeCircleOverlaps(graph: AtlasGraph, nodeRadius: number) {
  const nodeIds = graph.nodes();
  let overlapCount = 0;

  for (let leftIndex = 0; leftIndex < nodeIds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < nodeIds.length; rightIndex += 1) {
      const leftAttributes = graph.getNodeAttributes(nodeIds[leftIndex]);
      const rightAttributes = graph.getNodeAttributes(nodeIds[rightIndex]);

      if (distance(leftAttributes, rightAttributes) < nodeRadius * 2) {
        overlapCount += 1;
      }
    }
  }

  return overlapCount;
}

function distance(left: { x: number; y: number }, right: { x: number; y: number }) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function roundForContract(value: number) {
  return Number(value.toFixed(4));
}
