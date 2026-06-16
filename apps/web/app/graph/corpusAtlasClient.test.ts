import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCorpusAtlasModel,
  loadCorpusInterpretability,
  searchCorpus,
  type CorpusCoverageStatus,
  type CorpusGraphPayload,
  type CorpusInterpretabilityResponse,
  type CorpusResourcesResponse,
  type CorpusSearchMetadataResource,
  type CorpusSearchSourceSpanResult,
  type CorpusSourceSpansResponse
} from "../../lib/corpusAtlas";

const resourceId = "ahs-guru-breast-br005-adjuvant-rt-invasive-breast";
const parseFailedResourceId = "ahs-guru-lung-lu999-parser-failed-fixture";
const sourceSpanId = "source-span.local-test";
const reviewTaskId = `workflow-task.${resourceId}.${sourceSpanId}.evidence-review`;
const nullPlaceholderReviewTaskId = `${reviewTaskId}.null-placeholder`;
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

const parseFailedResource = {
  resource_id: parseFailedResourceId,
  title: "Parser Failed Local Fixture",
  disease_site: "lung",
  resource_type: "guideline",
  document_type: "guideline",
  document_status: "unknown",
  url: "https://example.invalid/parser-failed.pdf",
  archive_status: "downloaded",
  parse_status: "parse_failed",
  response_state: "parse_failed" as const,
  raw_pdf_exposed: false
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

afterEach(() => {
  vi.restoreAllMocks();
});

function graphFocusMetadata(
  targetResourceId: string,
  coverageStatus: CorpusCoverageStatus,
  sourceSpanIds: string[] = [],
  reviewTaskIds: string[] = []
) {
  const neighborNodeIds = [`disease-site.${targetResourceId === resourceId ? "breast" : "lung"}`, "document-type.guideline"];
  return {
    focus_node_id: `resource.${targetResourceId}`,
    resource_node_id: `resource.${targetResourceId}`,
    neighbor_node_ids: neighborNodeIds,
    edge_types: ["resource_to_disease_site", "resource_to_document_type"],
    source_span_ids: sourceSpanIds,
    review_task_ids: reviewTaskIds,
    coverage_status: coverageStatus,
    interpretability_summary: {
      mode: "deterministic_metadata_and_source_span_lookup",
      coverage_status: coverageStatus,
      source_span_count: sourceSpanIds.length,
      graph_neighbor_count: neighborNodeIds.length,
      model_routing: "none-local-deterministic-search-only" as const
    }
  };
}

function metadataSearchResource(
  coverageStatus: CorpusCoverageStatus,
  sourceSpanIds: string[] = [],
  baseResource = resourcesPayload.resources[0]
): CorpusSearchMetadataResource {
  return {
    ...baseResource,
    ...graphFocusMetadata(baseResource.resource_id, coverageStatus, sourceSpanIds)
  };
}

function sourceSpanSearchResult(): CorpusSearchSourceSpanResult {
  return {
    ...sourceSpansPayload.source_spans[0],
    source_document_id: "source-document.local-test",
    quoted_span: "Local deterministic parsed excerpt for search coverage.",
    excerpt_checksum: "0".repeat(64),
    prompt_or_model_version: "none-local-deterministic-parser",
    reviewer: "unreviewed",
    review_status: "draft",
    timestamp: "2026-06-15T12:00:00Z",
    ...graphFocusMetadata(resourceId, "source_span_ready", [sourceSpanId], [reviewTaskId]),
    focus_resource: metadataSearchResource("source_span_ready", [sourceSpanId])
  };
}

function expectNoGeneratedAnswerFields(value: unknown) {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain("generated_answer");
  expect(serialized).not.toContain("generatedAnswer");
}

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
          metadata_results: [
            metadataSearchResource("metadata_only"),
            metadataSearchResource("parse_failed", [], parseFailedResource)
          ],
          source_span_results: [sourceSpanSearchResult()],
          metadata_result_count: 2,
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
      parseStatus: "not-parsed",
      focusNodeId: `resource.${resourceId}`,
      resourceNodeId: `resource.${resourceId}`,
      neighborNodeIds: ["disease-site.breast", "document-type.guideline"],
      edgeTypes: ["resource_to_disease_site", "resource_to_document_type"],
      sourceSpanIds: [],
      reviewTaskIds: [],
      coverageStatus: "metadata_only",
      interpretabilitySummary: expect.objectContaining({
        coverageStatus: "metadata_only",
        sourceSpanCount: 0,
        graphNeighborCount: 2,
        modelRouting: "none-local-deterministic-search-only"
      })
    }));
    expect(results.metadataResults).toContainEqual(expect.objectContaining({
      id: parseFailedResourceId,
      coverageStatus: "parse_failed",
      responseState: "parse_failed",
      parseStatus: "parse_failed"
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
      outputStatus: "draft",
      focusNodeId: `resource.${resourceId}`,
      resourceNodeId: `resource.${resourceId}`,
      neighborNodeIds: ["disease-site.breast", "document-type.guideline"],
      edgeTypes: ["resource_to_disease_site", "resource_to_document_type"],
      sourceSpanIds: [sourceSpanId],
      reviewTaskIds: [reviewTaskId],
      coverageStatus: "source_span_ready",
      interpretabilitySummary: {
        mode: "deterministic_metadata_and_source_span_lookup",
        coverageStatus: "source_span_ready",
        sourceSpanCount: 1,
        graphNeighborCount: 2,
        modelRouting: "none-local-deterministic-search-only"
      }
    });
    expect(results.metadataResultCount).toBe(2);
    expect(results.sourceSpanResultCount).toBe(1);
    expect(results.totalResourceCount).toBe(198);
    expect(results.modelRouting).toBe("none-local-deterministic-search-only");
    expectNoGeneratedAnswerFields(results);
  });

  it("loads interpretability responses with review queue and local surveillance status", async () => {
    const interpretabilityPayload: CorpusInterpretabilityResponse = {
      resource: metadataSearchResource("source_span_ready", [sourceSpanId]),
      graph_neighborhood: {
        focus_node_id: `resource.${resourceId}`,
        resource_node_id: `resource.${resourceId}`,
        neighbor_node_ids: ["disease-site.breast", "document-type.guideline"],
        edge_types: ["resource_to_disease_site", "resource_to_document_type"],
        neighbor_nodes: [{ id: "disease-site.breast", type: "disease_site_cluster", label: "breast" }],
        edges: [{ id: "resource-to-site", source: `resource.${resourceId}`, target: "disease-site.breast", type: "resource_to_disease_site" }]
      },
      source_spans: sourceSpansPayload.source_spans,
      surveillance_status: {
        mode: "local_manifest_status_only",
        status: "not_evaluated_for_live_changes",
        review_status: "unreviewed",
        resource_count: 1,
        changed_count: 0,
        unchanged_count: 1,
        needs_review_count: 0,
        summary_counts: { unchanged: 1 },
        resource_statuses: [
          {
            resource_id: resourceId,
            change_state: "unchanged",
            review_status: "no_change",
            previous_status: "downloaded",
            current_status: "downloaded",
            previous_checksum_sha256: "1".repeat(64),
            current_checksum_sha256: "1".repeat(64)
          }
        ]
      },
      review_queue_items: [
        {
          review_task_id: reviewTaskId,
          resource_id: resourceId,
          source_span_ids: [sourceSpanId],
          pico_placeholder: {
            population: "placeholder population label",
            intervention: null,
            comparator: null,
            outcome: null
          },
          review_status: "draft",
          staleness_status: "not_evaluated_local",
          allowed_actions: ["inspect_source", "mark_needs_review_local", "link_source_local"]
        },
        {
          review_task_id: nullPlaceholderReviewTaskId,
          resource_id: resourceId,
          source_span_ids: [sourceSpanId],
          pico_placeholder: {
            population: null,
            intervention: null,
            comparator: null,
            outcome: null
          },
          review_status: "draft",
          staleness_status: "not_evaluated_local",
          allowed_actions: ["inspect_source", "mark_needs_review_local", "link_source_local"]
        }
      ],
      review_task_ids: [reviewTaskId, nullPlaceholderReviewTaskId],
      review_queue_contract: {
        source_of_truth: "validated_loaded_source_spans",
        invalid_unbacked_items: "metadata_only_excluded_from_production_queue"
      },
      coverage_status: "source_span_ready",
      coverage_status_vocabulary: [
        "checksum_mismatch",
        "download_failed",
        "metadata_only",
        "parse_failed",
        "partial_source_span",
        "source_span_ready"
      ],
      model_routing: "none-local-deterministic-search-only"
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(interpretabilityPayload), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    const model = await loadCorpusInterpretability(resourceId);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `/api/knowledgebase/corpus/interpretability?resource_id=${resourceId}`,
      { signal: undefined }
    );
    expect(model.resource).toEqual(expect.objectContaining({
      id: resourceId,
      focusNodeId: `resource.${resourceId}`,
      coverageStatus: "source_span_ready",
      sourceSpanCount: 1
    }));
    expect(model.graphNeighborhood).toEqual(expect.objectContaining({
      focusNodeId: `resource.${resourceId}`,
      resourceNodeId: `resource.${resourceId}`,
      neighborNodeIds: ["disease-site.breast", "document-type.guideline"],
      edgeTypes: ["resource_to_disease_site", "resource_to_document_type"]
    }));
    expect(model.surveillanceStatus).toEqual({
      mode: "local_manifest_status_only",
      status: "not_evaluated_for_live_changes",
      reviewStatus: "unreviewed",
      resourceCount: 1,
      changedCount: 0,
      unchangedCount: 1,
      needsReviewCount: 0,
      summaryCounts: { unchanged: 1 },
      resourceStatuses: [
        {
          resourceId,
          changeState: "unchanged",
          reviewStatus: "no_change",
          previousStatus: "downloaded",
          currentStatus: "downloaded",
          previousChecksumSha256: "1".repeat(64),
          currentChecksumSha256: "1".repeat(64)
        }
      ]
    });
    expect(model.reviewQueueItems).toEqual([
      {
        reviewTaskId,
        resourceId,
        sourceSpanIds: [sourceSpanId],
        picoPlaceholder: {
          population: "placeholder population label",
          intervention: null,
          comparator: null,
          outcome: null
        },
        reviewStatus: "draft",
        stalenessStatus: "not_evaluated_local",
        allowedActions: ["inspect_source", "mark_needs_review_local", "link_source_local"]
      },
      {
        reviewTaskId: nullPlaceholderReviewTaskId,
        resourceId,
        sourceSpanIds: [sourceSpanId],
        picoPlaceholder: {
          population: null,
          intervention: null,
          comparator: null,
          outcome: null
        },
        reviewStatus: "draft",
        stalenessStatus: "not_evaluated_local",
        allowedActions: ["inspect_source", "mark_needs_review_local", "link_source_local"]
      }
    ]);
    expect(model.coverageStatusVocabulary).toEqual([
      "checksum_mismatch",
      "download_failed",
      "metadata_only",
      "parse_failed",
      "partial_source_span",
      "source_span_ready"
    ]);
    expect(model.modelRouting).toBe("none-local-deterministic-search-only");
    expectNoGeneratedAnswerFields(model);
  });
});
