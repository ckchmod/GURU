import { describe, expect, it } from "vitest";
import { buildAtlasGraph, computeCircularAtlasLayout, type AtlasApiGraphPayload } from "./atlasGraphAdapter";

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
});
