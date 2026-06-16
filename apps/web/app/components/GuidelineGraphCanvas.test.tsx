import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sigma/rendering", () => ({
  NodeCircleProgram: class NodeCircleProgram {}
}));

vi.mock("@react-sigma/core", async () => {
  const ReactModule = await import("react");
  const MockSigmaContainer = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="mock-sigma-container" className={className}>{children}</div>
  );
  const MockControlsContainer = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  );
  const MockZoomControl = ({ labels = {} }: { labels?: { zoomIn?: string; zoomOut?: string; reset?: string } }) => (
    <>
      <button type="button">{labels.zoomIn ?? "Zoom In"}</button>
      <button type="button">{labels.zoomOut ?? "Zoom Out"}</button>
      <button type="button">{labels.reset ?? "Fit View"}</button>
    </>
  );

  return {
    ControlsContainer: MockControlsContainer,
    SigmaContainer: MockSigmaContainer,
    ZoomControl: MockZoomControl,
    useCamera: () => ({ gotoNode: vi.fn(), reset: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), goto: vi.fn() }),
    useRegisterEvents: () => vi.fn(),
    useSetSettings: () => vi.fn(),
    useSigma: () => ({
      getGraph: () => ({
        extremities: () => [],
        getNodeAttributes: () => ({ x: 0, y: 0, kind: "resource" }),
        hasNode: () => true,
        neighbors: () => []
      }),
      refresh: vi.fn()
    }),
    __esModule: true,
    default: ReactModule
  };
});

import { GuidelineGraphCanvas } from "./GuidelineGraphCanvas";
import Home from "../page";

const breastResourceId = "ahs-guru-breast-br005-adjuvant-rt-invasive-breast";
const brainResourceId = "ahs-guru-central-nervous-system-cns014-management-of-brain-metastases";
const responseStateVocabulary = {
  metadata_only: "Registry metadata exists, but no local parsed artifact is exposed.",
  downloaded_unparsed: "A local raw archive state is recorded, but parser output is not available.",
  parsed: "A parsed or partial-text parser artifact is available for the bounded subset.",
  download_failed: "Download or expected raw-file availability failed before parsing.",
  parse_failed: "Parser execution failed or produced no usable technical extraction."
};

const resourcesPayload = {
  resources: [
    {
      resource_id: breastResourceId,
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
    },
    {
      resource_id: brainResourceId,
      title: "Brain Metastases",
      disease_site: "central-nervous-system",
      resource_type: "guideline",
      document_type: "guideline",
      document_status: "unknown",
      url: "https://www.albertahealthservices.ca/assets/info/hp/cancer/if-hp-cancer-guide-cns014-management-of-brain-metastases.pdf",
      archive_status: "metadata-only",
      parse_status: "not-parsed",
      response_state: "metadata_only",
      raw_pdf_exposed: false
    }
  ],
  count: 2,
  total_count: 198,
  response_state_vocabulary: responseStateVocabulary
};

const graphPayload = {
  nodes: [
    {
      id: `resource.${breastResourceId}`,
      type: "resource",
      label: "Adjuvant Radiotherapy for Invasive Breast Cancer",
      title: "Adjuvant Radiotherapy for Invasive Breast Cancer",
      resource_id: breastResourceId,
      disease_site: "breast",
      document_type: "guideline",
      archive_status: "metadata-only",
      parse_status: "not-parsed",
      response_state: "metadata_only"
    },
    {
      id: `resource.${brainResourceId}`,
      type: "resource",
      label: "Brain Metastases",
      title: "Brain Metastases",
      resource_id: brainResourceId,
      disease_site: "central-nervous-system",
      document_type: "guideline",
      archive_status: "metadata-only",
      parse_status: "not-parsed",
      response_state: "metadata_only"
    },
    { id: "disease-site.breast", type: "disease_site_cluster", label: "breast" },
    { id: "disease-site.central-nervous-system", type: "disease_site_cluster", label: "central-nervous-system" },
    { id: "document-type.guideline", type: "document_type_cluster", label: "guideline" },
    { id: "archive-status.metadata-only.not-parsed", type: "archive_status", label: "metadata-only:not-parsed" }
  ],
  edges: [
    { id: "breast-to-site", source: `resource.${breastResourceId}`, target: "disease-site.breast", type: "resource_to_disease_site" },
    { id: "brain-to-site", source: `resource.${brainResourceId}`, target: "disease-site.central-nervous-system", type: "resource_to_disease_site" },
    { id: "breast-to-document", source: `resource.${breastResourceId}`, target: "document-type.guideline", type: "resource_to_document_type" },
    { id: "brain-to-document", source: `resource.${brainResourceId}`, target: "document-type.guideline", type: "resource_to_document_type" },
    { id: "breast-to-archive", source: `resource.${breastResourceId}`, target: "archive-status.metadata-only.not-parsed", type: "resource_to_archive_status" },
    { id: "brain-to-archive", source: `resource.${brainResourceId}`, target: "archive-status.metadata-only.not-parsed", type: "resource_to_archive_status" }
  ],
  metadata: {
    resource_node_count: 198,
    disease_site_cluster_count: 19,
    document_type_cluster_count: 6,
    archive_status_cluster_count: 1,
    source_span_coverage_count: 5,
    source_span_node_count: 0,
    source_span_coverage_note: "Source-span coverage is limited to the five-row parsed subset and depends on derived parser outputs."
  }
};

const sourceSpansPayload = {
  source_spans: [],
  count: 0,
  coverage_count: 5,
  coverage_resource_ids: [breastResourceId, brainResourceId, "third-public-resource", "fourth-public-resource", "fifth-public-resource"],
  coverage_note: "Only the five-row parsed subset is eligible for source-span coverage; absent derived files mean no source-span records are reported."
};

const sourceSpanSearchResult = {
  span_id: "source-span.local-test",
  resource_id: breastResourceId,
  document_id: "source-document.local-test",
  stable_locator: "page:1;span:1",
  excerpt: "Local deterministic parsed excerpt for search coverage.",
  checksum_sha256: "0".repeat(64),
  output_status: "draft"
};

describe("GuidelineGraphCanvas", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the API-backed public corpus graph canvas and default inspector", async () => {
    mockCorpusFetch();

    render(<GuidelineGraphCanvas />);

    expect(screen.getByText("Loading corpus atlas")).toBeVisible();
    expect(await screen.findByText(/Public corpus metadata loaded from the local API/)).toBeVisible();
    expect(screen.getAllByText("Adjuvant Radiotherapy for Invasive Breast Cancer").length).toBeGreaterThan(0);
    expect(screen.getByTestId("guideline-graph-canvas")).toBeVisible();
    expect(await screen.findByTestId("sigma-corpus-graph")).toHaveAttribute("data-node-count", "6");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-layout-mode", "semantic-neighborhoods");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-label-mode", "sparse-focus");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-interaction-mode", "hover-click-drag");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-drag-policy", "sigma-node-drag-session-positions-with-neighbor-tension");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-tension-policy", "edge-weighted-neighbor-pull");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-document-layout-policy", "centroid-integrated-classification-pockets");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-dragging-node", "none");
    expect(screen.getByTestId("sigma-constellation-map")).toBeInTheDocument();
    expect(screen.getByTestId("sigma-relationship-overlay")).toBeInTheDocument();
    expect(screen.getByLabelText("Sigma atlas visual policy")).toHaveTextContent("drag affordances");
    expect(screen.getByLabelText("Sigma atlas visual policy")).toHaveTextContent("edge-weighted neighbor tension");
    expect(screen.getByLabelText("Sigma atlas visual policy")).toHaveTextContent("centroid-integrated classification pockets");
    expect(screen.getByLabelText("Graph purpose and edge semantics")).toHaveTextContent("maps each public resource to the metadata buckets");
    expect(screen.getByLabelText("Graph purpose and edge semantics")).toHaveTextContent("site");
    expect(screen.getByLabelText("Graph purpose and edge semantics")).toHaveTextContent("archive");
    const documentNode = document.querySelector('[data-node-id="document-type.guideline"]');
    expect(documentNode).not.toBeNull();
    expect(Number(documentNode?.getAttribute("data-layout-y"))).toBeGreaterThan(-130);
    expect(await screen.findByTestId("mock-sigma-container")).toBeVisible();
    expect(screen.getByTestId("atlas-workbench")).toHaveTextContent("198 public resources");
    expect(screen.getByTestId("source-document-panel")).toHaveTextContent("5 parsed-subset coverage");
    expect(screen.getByTestId("source-document-panel")).toHaveTextContent("No source-span records are available");
    expect(screen.getByTestId("compact-inspector-summary")).toHaveTextContent("Selected graph node");
    expect(screen.getByTestId("compact-inspector-summary")).toHaveTextContent("Source availability");
    expect(screen.getByTestId("compact-inspector-summary")).not.toHaveTextContent(breastResourceId);
    expect(screen.getByTestId("resource-identifier-details")).not.toHaveAttribute("open");
    expect(screen.getByTestId("source-span-details")).not.toHaveAttribute("open");
    expect(screen.getByText("No clinical advice")).toBeVisible();
    expect(document.querySelector(".ide-window-controls")).toBeNull();
    expect(document.body).not.toHaveTextContent(/Synthetic|Packet Alpha|Model Trace Stub|Evidence Hub|Mock|Demo|Placeholder/);
  });

  it("renders Sigma navigation controls and Graphology-backed corpus counts", async () => {
    mockCorpusFetch();

    render(<GuidelineGraphCanvas />);

    expect(await screen.findByRole("button", { name: "Zoom In" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Zoom Out" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Fit View" })).toBeVisible();
    expect(screen.getByTestId("node-inspector")).toHaveTextContent("6 nodes · 6 edges");
    expect(screen.getByRole("searchbox", { name: "Search public corpus graph nodes" })).toBeVisible();
    expect(screen.getByRole("contentinfo", { name: "Corpus search workbench" })).toHaveTextContent("Model answers disabled until retrieval/source-span verification is implemented.");
  });

  it("renders the workspace shell without decorative window control dots", async () => {
    mockCorpusFetch();

    render(<Home />);

    expect(await screen.findByTestId("app-shell")).toBeVisible();
    expect(document.querySelector(".ide-window-controls")).toBeNull();
    expect(screen.getByLabelText("Current workspace path")).toHaveTextContent("GURU/public-corpus-atlas.graph");
  });

  it("searches and focuses the real breast resource from the API graph payload", async () => {
    mockCorpusFetch();

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    fireEvent.click(screen.getByRole("button", { name: /Brain Metastases/i }));
    expect(screen.getByTestId("node-inspector")).toHaveTextContent(brainResourceId);

    const searchbox = screen.getByRole("searchbox", { name: "Search public corpus graph nodes" });
    fireEvent.change(searchbox, {
      target: { value: "Adjuvant Radiotherapy for Invasive Breast Cancer" }
    });
    expect(fireEvent.keyDown(searchbox, { key: "Enter", code: "Enter" })).toBe(true);
    const graphSearchForm = searchbox.closest("form");
    expect(graphSearchForm).not.toBeNull();
    fireEvent.submit(graphSearchForm as HTMLFormElement);

    expect(screen.getByTestId("node-inspector")).toHaveTextContent(breastResourceId);
    expect(screen.getByTestId("node-inspector")).toHaveTextContent("Adjuvant Radiotherapy for Invasive Breast Cancer");
    expect(screen.getByTestId("source-document-panel")).toHaveTextContent("Adjuvant Radiotherapy for Invasive Breast Cancer");
    expect(screen.getByTestId("atlas-workbench")).toHaveTextContent(breastResourceId);
  });

  it("clicking a visible search result uses the same resource selection path", async () => {
    mockCorpusFetch();

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    fireEvent.click(screen.getByRole("button", { name: /Brain Metastases/i }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search public corpus graph nodes" }), {
      target: { value: "Adjuvant Radiotherapy for Invasive Breast Cancer" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Adjuvant Radiotherapy for Invasive Breast Cancer Public resource/i }));

    expect(screen.getByTestId("node-inspector")).toHaveTextContent(breastResourceId);
    expect(screen.getByTestId("node-inspector")).toHaveTextContent("Adjuvant Radiotherapy for Invasive Breast Cancer");
    expect(screen.getByTestId("source-document-panel")).toHaveTextContent("Adjuvant Radiotherapy for Invasive Breast Cancer");
    expect(screen.getByTestId("atlas-workbench")).toHaveTextContent(breastResourceId);
  });

  it("selects a disease-site cluster and shows its real aggregate count", async () => {
    mockCorpusFetch();

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    fireEvent.click(screen.getByRole("button", { name: "breast · 1" }));

    expect(screen.getByTestId("node-inspector")).toHaveTextContent("breast");
    expect(screen.getByTestId("node-inspector")).toHaveTextContent("1 public resources");
    expect(screen.queryByTestId("resource-identifier-details")).toBeNull();
    expect(screen.getByTestId("compact-inspector-summary")).not.toHaveTextContent(breastResourceId);
  });

  it("switches selected resource metadata without local fixture source spans", async () => {
    mockCorpusFetch();

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    fireEvent.click(screen.getByRole("button", { name: /Brain Metastases/i }));

    expect(screen.getByTestId("node-inspector")).toHaveTextContent(brainResourceId);
    expect(screen.getByTestId("node-inspector")).toHaveTextContent("central-nervous-system");
    expect(screen.getByTestId("source-document-panel")).toHaveTextContent("Brain Metastases");
    expect(screen.getByTestId("atlas-workbench")).toHaveTextContent(brainResourceId);
  });

  it("searches all public metadata from the bottom workbench and focuses a graph resource", async () => {
    mockCorpusFetch();

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    fireEvent.click(screen.getByRole("button", { name: /Brain Metastases/i }));
    expect(screen.getByTestId("node-inspector")).toHaveTextContent(brainResourceId);

    const workbench = screen.getByTestId("atlas-workbench");
    fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
      target: { value: "Adjuvant Radiotherapy for Invasive Breast Cancer" }
    });
    fireEvent.submit(within(workbench).getByRole("search", { name: "Search public corpus metadata and source spans" }));

    expect(await within(workbench).findByText("Metadata results")).toBeVisible();
    expect(within(workbench).getByText("Source span results")).toBeVisible();
    expect(within(workbench).getByText("No source-span records returned for this query. Search is scoped to the five-document parsed subset when derived source-span records exist.")).toBeVisible();
    fireEvent.click(within(workbench).getByRole("button", { name: /Adjuvant Radiotherapy for Invasive Breast Cancer/i }));

    await waitFor(() => expect(screen.getByTestId("node-inspector")).toHaveTextContent(breastResourceId));
    expect(screen.getByTestId("source-document-panel")).toHaveTextContent("Adjuvant Radiotherapy for Invasive Breast Cancer");
    expect(workbench).toHaveTextContent("none-local-deterministic-search-only");
    expect(workbench).toHaveTextContent("Model answers disabled until retrieval/source-span verification is implemented.");
  });

  it("groups source-span results with bounded excerpt and provenance-like status", async () => {
    mockCorpusFetch();

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    const workbench = screen.getByTestId("atlas-workbench");
    fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
      target: { value: "deterministic parsed excerpt" }
    });
    fireEvent.submit(within(workbench).getByRole("search", { name: "Search public corpus metadata and source spans" }));

    expect(await within(workbench).findByText("Source span results")).toBeVisible();
    expect(workbench).toHaveTextContent("page:1;span:1");
    expect(workbench).toHaveTextContent("Local deterministic parsed excerpt for search coverage.");
    expect(workbench).toHaveTextContent("source status: draft");
    expect(workbench).toHaveTextContent("parse status: not-parsed");
    expect(workbench).toHaveTextContent("Adjuvant Radiotherapy for Invasive Breast Cancer");
  });

  it("renders a safe empty workbench state for nonsense queries without fake chat or advice", async () => {
    mockCorpusFetch();

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    const workbench = screen.getByTestId("atlas-workbench");
    fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
      target: { value: "zzzz-no-such-guideline" }
    });
    fireEvent.submit(within(workbench).getByRole("search", { name: "Search public corpus metadata and source spans" }));

    expect(await within(workbench).findByText("No results for this query in public metadata or parsed source spans.")).toBeVisible();
    expect(workbench).not.toHaveTextContent(/no evidence/i);
    expect(document.body).not.toHaveTextContent(/chat transcript|assistant response|generated answer|external llm/i);
    expect(document.body).not.toHaveTextContent(/Synthetic|Packet Alpha|Model Trace Stub|Evidence Hub|Mock|Demo|Placeholder/);
  });

  it("represents API unavailable state safely", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("connection refused"));

    render(<GuidelineGraphCanvas />);

    expect(await screen.findByText("Corpus API unavailable")).toBeVisible();
    expect(screen.getAllByText(/Model answers disabled until retrieval\/source-span verification is implemented/).length).toBeGreaterThan(0);
    expect(screen.getByTestId("node-inspector")).toHaveTextContent("error");
  });

  it("represents empty API state safely", async () => {
    mockCorpusFetch({
      resources: { ...resourcesPayload, resources: [], count: 0 },
      graph: { ...graphPayload, nodes: [], edges: [] }
    });

    render(<GuidelineGraphCanvas />);

    expect(await screen.findByText("No atlas resources returned")).toBeVisible();
    expect(screen.getByTestId("source-document-panel")).toHaveTextContent("5 parsed-subset coverage");
    expect(screen.getByTestId("node-inspector")).toHaveTextContent("empty");
  });
});

function mockCorpusFetch(overrides: { resources?: unknown; graph?: unknown; sourceSpans?: unknown } = {}) {
  const payloads: Record<string, unknown> = {
    "/api/knowledgebase/corpus/resources": overrides.resources ?? resourcesPayload,
    "/api/knowledgebase/corpus/graph": overrides.graph ?? graphPayload,
    "/api/knowledgebase/corpus/source-spans": overrides.sourceSpans ?? sourceSpansPayload
  };

  vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
    const url = input.toString();
    const parsedUrl = new URL(url, "http://localhost");
    const payload = parsedUrl.pathname === "/api/knowledgebase/corpus/search"
      ? buildSearchPayload(parsedUrl.searchParams.get("q") ?? "")
      : payloads[parsedUrl.pathname];

    if (!payload) {
      return Promise.resolve(new Response(JSON.stringify({ detail: "not found" }), { status: 404 }));
    }

    return Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } }));
  });
}

function buildSearchPayload(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const metadataResults = resourcesPayload.resources.filter((resource) => (
    `${resource.title} ${resource.resource_id} ${resource.disease_site} ${resource.document_type} ${resource.resource_type}`.toLowerCase().includes(normalizedQuery)
  ));
  const sourceSpanResults = normalizedQuery.includes("deterministic parsed excerpt") ? [sourceSpanSearchResult] : [];

  return {
    query,
    metadata_results: normalizedQuery ? metadataResults : [],
    source_span_results: sourceSpanResults,
    metadata_result_count: normalizedQuery ? metadataResults.length : 0,
    source_span_result_count: sourceSpanResults.length,
    source_span_coverage_count: 5,
    source_span_coverage_note: "Search checks metadata for all 198 resources and parsed source-span excerpts only for the five-row parsed subset when derived outputs are present.",
    total_resource_count: 198,
    model_routing: "none-local-deterministic-search-only"
  };
}
