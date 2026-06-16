import { describe, expect, it, vi } from "vitest";
import { buildCorpusAtlasModel, searchCorpus, type CorpusGraphPayload, type CorpusResourcesResponse, type CorpusSourceSpansResponse } from "../../lib/corpusAtlas";

const resourceId = "ahs-guru-breast-br005-adjuvant-rt-invasive-breast";
const responseStateVocabulary = {
  metadata_only: "Registry metadata exists, but no local parsed artifact is exposed.",
  downloaded_unparsed: "A local raw archive state is recorded, but parser output is not available.",
  parsed: "A parsed or partial-text parser artifact is available for the bounded subset.",
  download_failed: "Download or expected raw-file availability failed before parsing.",
  parse_failed: "Parser execution failed or produced no usable technical extraction."
};

const resourcesPayload: CorpusResourcesResponse = {
  resources: [
    {
      resource_id: resourceId,
      title: "Adjuvant Radiotherapy for Invasive Breast Cancer",
      disease_site: "breast",
      resource_type: "guideline",
      document_type: "guideline",
      document_status: "unknown",
      url: "https://www.albertahealthservices.ca/assets/info/hp/cancer/if-hp-cancer-guide-br005-adjuvant-rt-invasive-breast.pdf",
      archive_status: "metadata-only",
      parse_status: "not-parsed",
      response_state: "metadata_only",
      raw_pdf_exposed: false
    }
  ],
  count: 1,
  total_count: 198,
  response_state_vocabulary: responseStateVocabulary
};

const graphPayload: CorpusGraphPayload = {
  nodes: [
    {
      id: `resource.${resourceId}`,
      type: "resource",
      title: "Adjuvant Radiotherapy for Invasive Breast Cancer",
      resource_id: resourceId,
      disease_site: "breast",
      document_type: "guideline",
      archive_status: "metadata-only",
      parse_status: "not-parsed",
      response_state: "metadata_only"
    },
    { id: "disease-site.breast", type: "disease_site_cluster", label: "breast" }
  ],
  edges: [
    { id: "resource-to-site", source: `resource.${resourceId}`, target: "disease-site.breast", type: "resource_to_disease_site" }
  ],
  metadata: {
    resource_node_count: 198,
    disease_site_cluster_count: 19,
    document_type_cluster_count: 6,
    archive_status_cluster_count: 1,
    source_span_coverage_count: 5,
    source_span_node_count: 0,
    source_span_coverage_note: "Source-span coverage is limited to the five-row parsed subset."
  }
};

const sourceSpansPayload: CorpusSourceSpansResponse = {
  source_spans: [
    {
      span_id: "source-span.local-test",
      resource_id: resourceId,
      document_id: "source-document.local-test",
      stable_locator: "page:1;span:1",
      excerpt: "Local deterministic parsed excerpt for search coverage.",
      checksum_sha256: "0".repeat(64),
      output_status: "draft"
    }
  ],
  count: 1,
  coverage_count: 5,
  coverage_resource_ids: [resourceId, "second", "third", "fourth", "fifth"],
  coverage_note: "Only the five-row parsed subset is eligible for source-span coverage."
};

describe("corpus atlas client and adapters", () => {
  it("maps Task 7 API shapes to Graphology and compact inspector models", () => {
    const model = buildCorpusAtlasModel(resourcesPayload, graphPayload, sourceSpansPayload);

    expect(model.graph.order).toBe(2);
    expect(model.graph.size).toBe(1);
    expect(model.resources).toEqual([
      expect.objectContaining({
        id: resourceId,
        title: "Adjuvant Radiotherapy for Invasive Breast Cancer",
        sourceSpanCount: 1
      })
    ]);
    expect(model.compactNodes.map((node) => node.label)).toContain("Adjuvant Radiotherapy for Invasive Breast Cancer");
    expect(model.sourceSpanCoverage.count).toBe(5);
  });

  it("maps search responses without model-authored output", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          query: "adjuvant radiotherapy",
          metadata_results: resourcesPayload.resources,
          source_span_results: sourceSpansPayload.source_spans,
          metadata_result_count: 1,
          source_span_result_count: 1,
          source_span_coverage_count: 5,
          source_span_coverage_note: "Search checks parsed source-span excerpts only when present.",
          total_resource_count: 198,
          model_routing: "none-local-deterministic-search-only"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const results = await searchCorpus("adjuvant radiotherapy");

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/knowledgebase/corpus/search?q=adjuvant+radiotherapy", { signal: undefined });
    expect(results.metadataResults).toContainEqual(expect.objectContaining({
      id: resourceId,
      resourceId,
      title: "Adjuvant Radiotherapy for Invasive Breast Cancer",
      resultType: "metadata",
      locator: "breast / guideline",
      parseStatus: "not-parsed"
    }));
    expect(results.sourceSpanResults).toContainEqual({
      id: "source-span.local-test",
      title: resourceId,
      resultType: "source_span",
      locator: "page:1;span:1",
      spanId: "source-span.local-test",
      resourceId,
      documentId: "source-document.local-test",
      stableLocator: "page:1;span:1",
      excerpt: "Local deterministic parsed excerpt for search coverage.",
      checksumSha256: "0".repeat(64),
      outputStatus: "draft"
    });
    expect(results.metadataResultCount).toBe(1);
    expect(results.sourceSpanResultCount).toBe(1);
    expect(results.totalResourceCount).toBe(198);
    expect(results.modelRouting).toBe("none-local-deterministic-search-only");
  });
});
