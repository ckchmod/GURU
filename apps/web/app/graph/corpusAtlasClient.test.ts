import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCorpusAtlasModel,
  loadCorpusConversationTurn,
  loadCorpusExplainSelection,
  loadCorpusInterpretability,
  loadCorpusWorkbenchTrace,
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
  const forbiddenFields = new Set([
    "answer_text",
    "raw_model_output",
    "output_text",
    "generated_answer",
    "generatedAnswer",
    "clinical_summary",
    "suggested_treatment",
    "dosing",
    "diagnosis"
  ]);
  const visited = new Set<unknown>();
  const visit = (candidate: unknown) => {
    if (candidate === null || typeof candidate !== "object" || visited.has(candidate)) {
      return;
    }
    visited.add(candidate);
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    Object.entries(candidate as Record<string, unknown>).forEach(([key, nestedValue]) => {
      expect(forbiddenFields.has(key)).toBe(false);
      visit(nestedValue);
    });
  };

  visit(value);
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
    expect(results.sourceSpanResults[0]).toEqual(expect.objectContaining({
      sourceDocumentId: "source-document.local-test",
      quotedSpan: "Local deterministic parsed excerpt for search coverage.",
      excerptChecksum: "0".repeat(64),
      promptOrModelVersion: "none-local-deterministic-parser",
      reviewer: "unreviewed",
      reviewStatus: "draft",
      timestamp: "2026-06-15T12:00:00Z",
      focusResource: expect.objectContaining({
        resourceId,
        focusNodeId: `resource.${resourceId}`,
        sourceSpanIds: [sourceSpanId],
        coverageStatus: "source_span_ready"
      })
    }));
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
          review_status: "draft",
          staleness_status: "not_evaluated_local",
          allowed_actions: ["inspect_source", "mark_needs_review_local", "link_source_local"]
        },
        {
          review_task_id: nullPlaceholderReviewTaskId,
          resource_id: resourceId,
          source_span_ids: [sourceSpanId],
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
        reviewStatus: "draft",
        stalenessStatus: "not_evaluated_local",
        allowedActions: ["inspect_source", "mark_needs_review_local", "link_source_local"]
      },
      {
        reviewTaskId: nullPlaceholderReviewTaskId,
        resourceId,
        sourceSpanIds: [sourceSpanId],
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

  it("loads Task 6 workbench traces without adapting them into answer output", async () => {
    const tracePayload = {
      command_label: "run-evals:corpus-workbench-trace",
      query: "deterministic parsed excerpt",
      retrieval_steps: [
        { step_id: "command", status: "received", command_label: "run-evals:corpus-workbench-trace" },
        { step_id: "retrieval", status: "completed", metadata_result_count: 0, source_span_result_count: 1, warning_labels: [], abstained: false },
        { step_id: "source_selection", status: "completed", source_span_ids_used: [sourceSpanId], rejected_count: 0 },
        { step_id: "model_gateway", status: "executed", model_class: "local_open_weight_7b", external_api_used: false }
      ],
      source_ids_used: [
        {
          source_span_id: sourceSpanId,
          resource_id: resourceId,
          source_document_id: "source-document.local-test",
          stable_locator: "page:1;span:1",
          status: "used",
          evidence_id: sourceSpanId
        }
      ],
      source_ids_rejected: [],
      gateway_decision: {
        allowed: true,
        outcome: "executed",
        reason_code: null,
        policy_request_id: "policy-request-local-test",
        external_api_used: false
      },
      model_class: "local_open_weight_7b",
      model_trace: {
        model_class: "local_open_weight_7b",
        provider_kind: "local",
        trace_status: "abstained",
        runner_status: "dry_run_completed",
        policy_request_id: "policy-request-local-test",
        citation_verifier_status: "pass",
        abstention_status: "abstained_no_answer_text",
        source_span_ids: [sourceSpanId],
        output_tokens: 0,
        gpu_seconds: 0
      },
      cost_ledger_entry: { external_api_used: false },
      citation_verifier_status: "pass",
      warnings: [],
      abstained: true,
      abstention_status: "abstained_no_answer_text",
      evidence_ids: [sourceSpanId],
      no_claim: true,
      model_routing: "none-local-deterministic-search-only"
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(tracePayload), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    const trace = await loadCorpusWorkbenchTrace("deterministic parsed excerpt");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/knowledgebase/corpus/workbench/trace?q=deterministic+parsed+excerpt",
      { signal: undefined }
    );
    expect(trace).toEqual(tracePayload);
    expect(trace.abstention_status).toBe("abstained_no_answer_text");
    expect(trace.no_claim).toBe(true);
    expectNoGeneratedAnswerFields(trace);
  });

  it("posts Explain Selection identifiers and preserves trace-only metadata", async () => {
    const tracePayload = {
      command_label: "explain-selection",
      selected_node_id: sourceSpanId,
      selected_node_type: "SourceSpan",
      resource_id: resourceId,
      source_span_ids: [sourceSpanId],
      context_digest: `sha256:${"1".repeat(64)}`,
      output_digest: `sha256:${"2".repeat(64)}`,
      gateway_decision: {
        allowed: true,
        outcome: "executed",
        reason_code: null,
        policy_request_id: "policy-request-explain-selection-local-test",
        external_api_used: false
      },
      model_class: "local_open_weight_7b",
      model_trace: {
        model_class: "local_open_weight_7b",
        provider_kind: "local",
        trace_status: "abstained",
        runner_status: "dry_run_completed",
        policy_request_id: "policy-request-explain-selection-local-test",
        gateway_outcome: "executed",
        gateway_reason_code: null,
        citation_verifier_status: "pass",
        abstention_status: "abstained_no_answer_text",
        input_digest: `sha256:${"3".repeat(64)}`,
        output_digest: `sha256:${"2".repeat(64)}`,
        source_span_ids: [sourceSpanId],
        input_tokens: 1,
        output_tokens: 0,
        gpu_seconds: 0,
        raw_output_included: false,
        input_summary: {
          source_span_contexts: [
            {
              source_span_id: sourceSpanId,
              excerpt_digest: `sha256:${"4".repeat(64)}`,
              source_document_id: "source-document.local-test",
              stable_locator: "page:1;span:1"
            }
          ]
        }
      },
      runner_status: "dry_run_completed",
      raw_output_included: false,
      cost_ledger_entry: { external_api_used: false, outcome: "executed" },
      source_ids_used: [
        {
          source_span_id: sourceSpanId,
          resource_id: resourceId,
          source_document_id: "source-document.local-test",
          stable_locator: "page:1;span:1",
          status: "used",
          evidence_id: sourceSpanId
        }
      ],
      source_ids_rejected: [],
      warnings: [],
      evidence_ids: [sourceSpanId],
      no_claim: true,
      model_routing: "none-local-deterministic-search-only"
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(tracePayload), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    const trace = await loadCorpusExplainSelection({
      source_span_id: sourceSpanId,
      selected_node_id: `source-span.${sourceSpanId}`,
      resource_id: resourceId,
      command_metadata: { invocation_surface: "graph-workbench", selection_kind: "source-span" }
    });

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/knowledgebase/corpus/workbench/explain-selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_span_id: sourceSpanId,
        selected_node_id: `source-span.${sourceSpanId}`,
        resource_id: resourceId,
        command_metadata: { invocation_surface: "graph-workbench", selection_kind: "source-span" }
      }),
      signal: undefined
    });
    const [, requestInit] = vi.mocked(globalThis.fetch).mock.calls[0];
    const requestBody = JSON.parse(String(requestInit?.body));
    expect(requestBody).toEqual({
      source_span_id: sourceSpanId,
      selected_node_id: `source-span.${sourceSpanId}`,
      resource_id: resourceId,
      command_metadata: { invocation_surface: "graph-workbench", selection_kind: "source-span" }
    });
    expect(requestBody).not.toHaveProperty("prompt");
    expect(requestBody).not.toHaveProperty("chat_prompt");
    expect(requestBody).not.toHaveProperty("message");
    expect(requestBody).not.toHaveProperty("messages");
    expect(requestBody).not.toHaveProperty("query");
    expect(requestBody).not.toHaveProperty("q");
    expect(trace).toEqual(tracePayload);
    expect(trace.command_label).toBe("explain-selection");
    expect(trace.no_claim).toBe(true);
    expect(trace.raw_output_included).toBe(false);
    expect(trace.gateway_decision.external_api_used).toBe(false);
    expect(trace.source_span_ids).toEqual([sourceSpanId]);
    expect(trace.context_digest).toMatch(/^sha256:/);
    expect(trace.output_digest).toMatch(/^sha256:/);
    expect(trace.runner_status).toBe("dry_run_completed");
    expect(trace.evidence_ids).toEqual([sourceSpanId]);
    expectNoGeneratedAnswerFields(trace);
  });

  it("selected_context_required refuses draft answers without source-span context", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        status: "refused",
        reason_code: "selected_context_required",
        answer_fragments: [],
        citations: [],
        graph_links: [],
        safety_notice: "Select one source-backed context before asking.",
        gateway_decision: {
          allowed: false,
          outcome: "blocked_before_gateway",
          reason_code: "selected_context_required",
          policy_request_id: "policy-request-conversation-turn-local-test",
          external_api_used: false
        },
        evidence_ids: [],
        raw_output_included: false,
        persistence: { stored: false, transcript_persisted: false },
        model_routing: "none-local-deterministic-search-only"
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    const response = await loadCorpusConversationTurn({ question: "Summarize the selected source context.", turn_id: "turn-client-no-context" });

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/knowledgebase/corpus/workbench/conversation-turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Summarize the selected source context.", turn_id: "turn-client-no-context" }),
      signal: undefined
    });
    expect(response.status).toBe("refused");
    expect(response.reason_code).toBe("selected_context_required");
    expect(response.answer_fragments).toEqual([]);
    expect(response.citations).toEqual([]);
    expect(response.graph_links).toEqual([]);
    expect(response.safety_notice).toBe("Select one source-backed context before asking.");
    expect(response.gateway_decision.external_api_used).toBe(false);
    expect(response.evidence_ids).toEqual([]);
    expect(response.raw_output_included).toBe(false);
    expect(response.persistence).toEqual({ stored: false, transcript_persisted: false });
    expectNoGeneratedAnswerFields(response);
  });

  it("draft_answer_citations_required accepts only selected-context cited draft answers", async () => {
    const citedTurnPayload = {
      status: "draft",
      answer_mode: "selected_context_cited_draft",
      answer_fragments: [
        {
          fragment_id: "fragment-1",
          text: "For the selected question, the Page 1 · Span 1 source span states: \"Local deterministic parsed excerpt for search coverage.\" Local gateway trace status: executed.",
          source_span_ids: [sourceSpanId],
          unsupported: false
        }
      ],
      citations: [
        {
          source_span_id: sourceSpanId,
          source_document_id: "source-document.local-test",
          stable_locator: "page:1;span:1",
          display_label: "Page 1 · Span 1",
          quoted_span: "Local deterministic parsed excerpt for search coverage.",
          excerpt_digest: `sha256:${"0".repeat(64)}`,
          answer_fragment_ids: ["fragment-1"]
        }
      ],
      graph_links: [
        {
          resource_id: resourceId,
          selected_node_id: sourceSpanId,
          source_span_id: sourceSpanId,
          highlight_node_ids: [`resource.${resourceId}`, sourceSpanId]
        }
      ],
      safety_notice: "Draft answer for selected source context only; not medical advice.",
      gateway_decision: {
        allowed: true,
        outcome: "executed",
        reason_code: null,
        policy_request_id: "policy-request-conversation-turn-local-test",
        external_api_used: false
      },
      evidence_ids: [sourceSpanId],
      raw_output_included: false,
      persistence: { stored: false, transcript_persisted: false },
      model_routing: "none-local-deterministic-search-only"
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(citedTurnPayload), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    const response = await loadCorpusConversationTurn({
      question: "Summarize the selected source context.",
      turn_id: "turn-client-cited-draft",
      source_span_id: sourceSpanId,
      selected_node_id: sourceSpanId,
      resource_id: resourceId
    });

    const [, requestInit] = vi.mocked(globalThis.fetch).mock.calls[0];
    const requestBody = JSON.parse(String(requestInit?.body));
    expect(requestBody).toEqual({
      question: "Summarize the selected source context.",
      turn_id: "turn-client-cited-draft",
      source_span_id: sourceSpanId,
      selected_node_id: sourceSpanId,
      resource_id: resourceId
    });
    expect(Object.keys(requestBody).filter((key) => key === "source_span_id")).toHaveLength(1);
    expect(requestBody).not.toHaveProperty("messages");
    expect(requestBody).not.toHaveProperty("history");
    expect(requestBody).not.toHaveProperty("transcript");
    expect(requestBody).not.toHaveProperty("chat_prompt");
    expect(requestBody).not.toHaveProperty("global_corpus_chat");
    expect(response).toEqual(citedTurnPayload);
    expect(response.status).toBe("draft");
    expect(response.answer_fragments).toHaveLength(1);
    expect(response.answer_fragments[0].source_span_ids).toEqual([sourceSpanId]);
    expect(response.citations).toHaveLength(1);
    expect(response.citations[0].source_span_id).toBe(sourceSpanId);
    expect(response.citations[0].display_label).toBe("Page 1 · Span 1");
    expect(response.citations[0].quoted_span).toBe("Local deterministic parsed excerpt for search coverage.");
    expect(response.graph_links[0].highlight_node_ids).toContain(`resource.${resourceId}`);
    expect(response.safety_notice).toBe("Draft answer for selected source context only; not medical advice.");
    expect(response.gateway_decision.external_api_used).toBe(false);
    expect(response.evidence_ids).toEqual([sourceSpanId]);
    expect(response.raw_output_included).toBe(false);
    expect(response.persistence.stored).toBe(false);
    expectNoGeneratedAnswerFields(response);
  });

  it("loadCorpusConversationTurn generates a client turn id without transcript fields", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        status: "refused",
        reason_code: "gateway_unavailable",
        answer_fragments: [],
        citations: [],
        graph_links: [],
        safety_notice: "Conversation turn is unavailable without widening selected context.",
        gateway_decision: {
          allowed: false,
          outcome: "unavailable",
          reason_code: "gateway_unavailable",
          policy_request_id: "policy-request-conversation-turn-local-test",
          external_api_used: false
        },
        evidence_ids: [sourceSpanId],
        raw_output_included: false,
        persistence: { stored: false, transcript_persisted: false },
        model_routing: "none-local-deterministic-search-only"
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    await loadCorpusConversationTurn({
      question: "Summarize the selected source context.",
      source_span_id: sourceSpanId
    });

    const [, requestInit] = vi.mocked(globalThis.fetch).mock.calls[0];
    const requestBody = JSON.parse(String(requestInit?.body));
    expect(requestBody.question).toBe("Summarize the selected source context.");
    expect(requestBody.turn_id).toMatch(/^turn-/);
    expect(requestBody.source_span_id).toBe(sourceSpanId);
    expect(requestBody).not.toHaveProperty("messages");
    expect(requestBody).not.toHaveProperty("history");
    expect(requestBody).not.toHaveProperty("transcript");
    expect(requestBody).not.toHaveProperty("session_id");
    expect(requestBody).not.toHaveProperty("global_corpus_chat");
  });

  it("loadCorpusConversationTurn rejects raw output and unsafe clinical response fields", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        status: "draft",
        answer_fragments: [],
        citations: [],
        graph_links: [],
        safety_notice: "Unsafe fixture must be rejected.",
        gateway_decision: {
          allowed: true,
          outcome: "executed",
          reason_code: null,
          policy_request_id: "policy-request-conversation-turn-local-test",
          external_api_used: false
        },
        evidence_ids: [sourceSpanId],
        raw_output_included: true,
        persistence: { stored: false, transcript_persisted: false },
        model_routing: "none-local-deterministic-search-only",
        raw_model_output: "unsafe raw output",
        answer_text: "uncited answer text",
        clinical_summary: "unsafe summary",
        suggested_treatment: "unsafe treatment",
        dosing: "unsafe dosing",
        diagnosis: "unsafe diagnosis"
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    await expect(loadCorpusConversationTurn({
      question: "Summarize the selected source context.",
      turn_id: "turn-client-unsafe-response",
      source_span_id: sourceSpanId
    })).rejects.toThrow(/raw model output|forbidden field/);
  });

  it("loadCorpusConversationTurn rejects missing persistence metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        status: "refused",
        reason_code: "selected_context_required",
        answer_fragments: [],
        citations: [],
        graph_links: [],
        safety_notice: "Select one source-backed context before asking.",
        gateway_decision: {
          allowed: false,
          outcome: "blocked_before_gateway",
          reason_code: "selected_context_required",
          policy_request_id: "policy-request-conversation-turn-local-test",
          external_api_used: false
        },
        evidence_ids: [],
        raw_output_included: false,
        model_routing: "none-local-deterministic-search-only"
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    await expect(loadCorpusConversationTurn({
      question: "Summarize the selected source context.",
      turn_id: "turn-client-missing-persistence"
    })).rejects.toThrow(/persisted answer or transcript state/);
  });

  it("loadCorpusConversationTurn rejects persisted answer or transcript flags", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        status: "refused",
        reason_code: "selected_context_required",
        answer_fragments: [],
        citations: [],
        graph_links: [],
        safety_notice: "Select one source-backed context before asking.",
        gateway_decision: {
          allowed: false,
          outcome: "blocked_before_gateway",
          reason_code: "selected_context_required",
          policy_request_id: "policy-request-conversation-turn-local-test",
          external_api_used: false
        },
        evidence_ids: [],
        raw_output_included: false,
        persistence: { stored: true, transcript_persisted: true },
        model_routing: "none-local-deterministic-search-only"
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    await expect(loadCorpusConversationTurn({
      question: "Summarize the selected source context.",
      turn_id: "turn-client-persisted-response"
    })).rejects.toThrow(/persisted answer or transcript state/);
  });
});
