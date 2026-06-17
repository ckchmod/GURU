import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sigma/rendering", () => ({
  NodeCircleProgram: class NodeCircleProgram {}
}));

vi.mock("@react-sigma/core", async () => {
  const ReactModule = await import("react");
  type MockGraphAttributes = Record<string, unknown> & { x: number; y: number; size: number };
  type MockGraphLike = {
    forEachNode?: (callback: (nodeId: string, attributes: MockGraphAttributes) => void) => void;
    extremities: (edgeId: string) => string[];
    getNodeAttributes: (nodeId: string) => MockGraphAttributes;
    hasNode: (nodeId: string) => boolean;
    neighbors: (nodeId: string) => string[];
  };
  const graphRef: { current: MockGraphLike | null } = { current: null };
  const camera = { on: vi.fn(), off: vi.fn(), getState: () => ({ x: 0, y: 0, angle: 0, ratio: 1 }) };
  const sigmaEvents = { on: vi.fn(), off: vi.fn() };
  const fallbackGraph: MockGraphLike = {
    forEachNode: () => undefined,
    extremities: () => [],
    getNodeAttributes: () => ({ x: 0, y: 0, size: 1, kind: "resource" }),
    hasNode: () => true,
    neighbors: () => []
  };
  const sigmaInstance = {
    ...sigmaEvents,
    framedGraphToViewport: (point: { x: number; y: number }) => ({ x: point.x + 400, y: point.y + 260 }),
    getBBox: () => ({ x: [0, 1], y: [0, 1] }),
    getCamera: () => camera,
    getCustomBBox: () => null,
    getGraph: () => graphRef.current ?? fallbackGraph,
    getNodeDisplayData: (nodeId: string) => {
      const graph = graphRef.current ?? fallbackGraph;
      return graph.hasNode(nodeId) ? graph.getNodeAttributes(nodeId) : undefined;
    },
    graphToViewport: (point: { x: number; y: number }) => ({ x: point.x + 400, y: point.y + 260 }),
    refresh: vi.fn(),
    scaleSize: (size: number) => size,
    setCustomBBox: vi.fn()
  };
  const MockSigmaContainer = ({ children, className, graph }: { children?: React.ReactNode; className?: string; graph?: MockGraphLike }) => {
    graphRef.current = graph ?? null;
    return <div data-testid="mock-sigma-container" className={className}>{children}</div>;
  };
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
    useSigma: () => sigmaInstance,
    __esModule: true,
    default: ReactModule
  };
});

import { GuidelineGraphCanvas } from "./GuidelineGraphCanvas";
import { truncateLabel } from "./SigmaCorpusGraph";
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

const reviewQueueFocusSpan = {
  span_id: "source-span.local-review-card",
  resource_id: breastResourceId,
  document_id: "source-document.local-review-card",
  stable_locator: "page:2;span:4",
  excerpt: "Deterministic source-backed queue excerpt for UI focus.",
  checksum_sha256: "4".repeat(64),
  output_status: "draft"
};

type ReviewQueuePayloadItem = {
  review_task_id: string;
  resource_id: string;
  source_span_ids: string[];
  review_status: string;
  staleness_status: string;
  allowed_actions: string[];
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
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-layout-mode", "deterministic-force-atlas");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-layout-settled", "true");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-layout-iterations", "120");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-layout-overlap-count", "0");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-layout-seed", "atlas-force-layout-task-4-v1");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-label-mode", "sparse-focus");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-interaction-mode", "hover-click-drag");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-drag-policy", "sigma-node-drag-session-pin-release-reset");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-pin-policy", "frontend-session-only-no-backend-mutation");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-document-layout-policy", "force-layout-type-encoded-labels");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-dragging-node", "none");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-pinned-node-count", "0");
    expect(screen.getByRole("button", { name: "Release focus pin" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset session pins" })).toBeDisabled();
    expect(screen.getByTestId("sigma-camera-node-layer")).toBeInTheDocument();
    expect(screen.getByLabelText("Sigma atlas visual policy")).toHaveTextContent("smooth Sigma camera focus");
    expect(screen.getByLabelText("Sigma atlas visual policy")).toHaveTextContent("ForceAtlas layout");
    expect(screen.getByLabelText("Sigma atlas visual policy")).toHaveTextContent("frontend-only session pinning");
    expect(screen.getByLabelText("Graph corpus context")).toHaveTextContent("Resources");
    expect(screen.getByLabelText("Graph corpus context")).toHaveTextContent("Source-span nodes");
    expect(screen.getByLabelText("Graph corpus context")).toHaveTextContent("Selected");
    const documentNode = document.querySelector('[data-node-id="document-type.guideline"]');
    expect(documentNode).not.toBeNull();
    expect(Number.isFinite(Number(documentNode?.getAttribute("data-layout-y")))).toBe(true);
    expect(Number(documentNode?.getAttribute("data-viewport-y"))).toBeGreaterThan(0);
    expect(await screen.findByTestId("mock-sigma-container")).toBeVisible();
    expect(screen.getByTestId("atlas-workbench")).toHaveTextContent("198 public resources");
    expect(screen.getByTestId("source-document-panel")).toHaveTextContent("5 parsed-subset coverage");
    expect(screen.getByTestId("source-document-panel")).toHaveTextContent("No source-span records are available");
    expect(screen.getByTestId("compact-inspector-summary")).toHaveTextContent("Selected graph node");
    expect(screen.getByTestId("compact-inspector-summary")).toHaveTextContent("Source availability");
    expect(screen.getAllByText("changed local archive").length).toBeGreaterThan(0);
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("Offline/local manifest comparison only");
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("needs review 1");
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("Why trust this?");
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("Source coverage");
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("Citations");
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("Graph path");
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("Model/gateway status");
    expect(screen.getByTestId("trust-provenance-drawer")).not.toHaveTextContent(/impact diff|recommendation impact|live surveillance/i);
    expect(screen.getByTestId("compact-inspector-summary")).not.toHaveTextContent(breastResourceId);
    expect(screen.getByTestId("resource-identifier-details")).not.toHaveAttribute("open");
    expect(screen.getByTestId("source-span-details")).not.toHaveAttribute("open");
    expect(screen.getByText("No clinical advice")).toBeVisible();
    expect(document.querySelector(".ide-window-controls")).toBeNull();
    expect(document.querySelector(".sigma-interaction-cue")).toBeNull();
    expect(document.body).not.toHaveTextContent(/Hover|Click to inspect|Drag to pin|detail labels visible|map labels sparse|Zoom detail|Graph filter toggles|⌘K Evidence Atlas/);
    expect(screen.getByTestId("atlas-workbench")).toHaveTextContent("Find source context");
    expect(screen.getByTestId("atlas-workbench")).toHaveTextContent("Selected resource context");
    expect(screen.getByTestId("atlas-workbench")).toHaveTextContent("Graph focus / trust path");
    expect(screen.getByTestId("atlas-workbench")).toHaveTextContent("Source context results");
    expect(screen.getByTestId("atlas-workbench")).toHaveTextContent("Selected-context draft answers are local-gateway bounded, source-span scoped, and not approved guidance.");
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
    expect(screen.getByRole("contentinfo", { name: "Corpus search workbench" })).toHaveTextContent("Selected-context draft answers are local-gateway bounded, source-span scoped, and not approved guidance.");
  });

  it("truncates Sigma labels by grapheme clusters for mixed CJK and emoji labels", () => {
    expect(truncateLabel("에이전트오케스트레이션현황및미래", 8)).toBe("에이전트오...");

    const clinicianEmoji = "🧑‍⚕️";
    const truncatedEmojiLabel = truncateLabel(clinicianEmoji.repeat(12), 8);
    expect(truncatedEmojiLabel).toBe(`${clinicianEmoji.repeat(5)}...`);
    expect(truncatedEmojiLabel).not.toContain("\uFFFD");
  });

  it("renders the workspace shell without decorative window control dots", async () => {
    mockCorpusFetch();

    render(<Home />);

    expect(await screen.findByTestId("app-shell")).toBeVisible();
    expect(document.querySelector(".ide-window-controls")).toBeNull();
    expect(document.body).not.toHaveTextContent("⌘K Evidence Atlas");
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
    expect(screen.getByTestId("atlas-workbench")).toHaveTextContent("Adjuvant Radiotherapy for Invasive Breast Cancer");
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
    expect(screen.getByTestId("atlas-workbench")).toHaveTextContent("Adjuvant Radiotherapy for Invasive Breast Cancer");
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
    expect(screen.getByTestId("atlas-workbench")).toHaveTextContent("Brain Metastases");
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

    expect(await within(workbench).findByText("Metadata retrieval")).toBeVisible();
    expect(within(workbench).getByText("Source-span retrieval")).toBeVisible();
    expect(within(workbench).getByText("No source-span records returned for this query. Search is scoped to the five-document parsed subset when derived source-span records exist.")).toBeVisible();
    fireEvent.click(within(workbench).getByRole("button", { name: /Adjuvant Radiotherapy for Invasive Breast Cancer/i }));

    await waitFor(() => expect(screen.getByTestId("node-inspector")).toHaveTextContent(breastResourceId));
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-selected-query", "Adjuvant Radiotherapy for Invasive Breast Cancer");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-highlighted-resource-ids", breastResourceId);
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-focus-mode", "metadata-only-blocked");
    expect(document.querySelector(`[data-node-id="resource.${breastResourceId}"]`)).toHaveAttribute("data-evidence-role", "metadata-blocked");
    expect(screen.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-graph-focus-node-id", `resource.${breastResourceId}`);
    expect(screen.getByTestId("source-document-panel")).toHaveTextContent("Adjuvant Radiotherapy for Invasive Breast Cancer");
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("Metadata-only, no claim rendered");
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("Metadata-only coverage: source spans are unavailable/not parsed");
    expect(screen.getByTestId("lookup-relationship-trace")).toHaveTextContent("resource");
    expect(screen.getByTestId("lookup-relationship-trace")).toHaveTextContent("disease site");
    expect(screen.getByTestId("lookup-relationship-trace")).toHaveTextContent("document type");
    expect(screen.getByTestId("lookup-relationship-trace")).toHaveTextContent("archive");
    expect(workbench).toHaveTextContent("none-local-deterministic-search-only");
    expect(workbench).toHaveTextContent("Only selected-context cited draft answers are allowed");
  });

  it("provenance panel answers trust questions with concise source-backed copy", async () => {
    mockCorpusFetch();

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    const workbench = screen.getByTestId("atlas-workbench");
    fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
      target: { value: "deterministic parsed excerpt" }
    });
    fireEvent.submit(within(workbench).getByRole("search", { name: "Search public corpus metadata and source spans" }));

    expect(await within(workbench).findByText("Source-span retrieval")).toBeVisible();
    expect(primaryText(workbench)).toContain("Page 1 · Span 1");
    expect(primaryText(workbench)).not.toMatch(/page:1;span:1|source-span\.local-test|source-document\.local-test|0{64}/);
    expect(workbench).toHaveTextContent("Local deterministic parsed excerpt for search coverage.");
    expect(workbench).toHaveTextContent("source status: draft");
    expect(workbench).toHaveTextContent("parse status: not-parsed");
    expect(workbench).toHaveTextContent("Adjuvant Radiotherapy for Invasive Breast Cancer");
    fireEvent.click(within(workbench).getByRole("button", { name: /Local deterministic parsed excerpt/i }));

    await waitFor(() => expect(screen.getByTestId("node-inspector")).toHaveTextContent(breastResourceId));
    expect(primaryText(screen.getByTestId("trust-provenance-drawer"))).toContain("Page 1 · Span 1");
    expect(primaryText(screen.getByTestId("trust-provenance-drawer"))).toContain("Why trust this?Source-backed draft context");
    expect(primaryText(screen.getByTestId("trust-provenance-drawer"))).toContain("Source coverage1 source span");
    expect(primaryText(screen.getByTestId("trust-provenance-drawer"))).toContain("CitationsPage 1 · Span 1");
    expect(primaryText(screen.getByTestId("trust-provenance-drawer"))).toContain("Graph pathresource -> disease site -> document type -> archive -> Page 1 · Span 1 -> review item");
    expect(primaryText(screen.getByTestId("trust-provenance-drawer"))).toContain("Model/gateway statusnone-local-deterministic-search-only");
    expect(primaryText(screen.getByTestId("trust-provenance-drawer"))).not.toMatch(/page:1;span:1|source-span\.local-test|source-document\.local-test|0{64}/);
    expect(screen.getByTestId("lookup-relationship-trace")).toHaveTextContent("Page 1 · Span 1");
    expect(screen.getByTestId("lookup-relationship-trace")).toHaveTextContent("review item");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-focus-mode", "source-span-parent-fallback");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-highlighted-source-span-ids", "source-span.local-test");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-represented-source-span-node-ids", "none");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-graph-focus-node-id", `resource.${breastResourceId}`);
    expect(screen.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-focus-mode", "source-span-parent-fallback");
  });

  it("internal_ids_hidden renders readable labels while retaining explicit metadata details", async () => {
    mockCorpusFetch({ interpretabilitySourceSpans: [reviewQueueFocusSpan] });

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    const workbench = screen.getByTestId("atlas-workbench");
    fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
      target: { value: "deterministic parsed excerpt" }
    });
    fireEvent.submit(within(workbench).getByRole("search", { name: "Search public corpus metadata and source spans" }));
    fireEvent.click(await within(workbench).findByRole("button", { name: /Local deterministic parsed excerpt/i }));

    await waitFor(() => expect(primaryText(screen.getByTestId("trust-provenance-drawer"))).toContain("Page 1 · Span 1"));
    const primarySurface = [
      primaryText(workbench),
      primaryText(screen.getByTestId("trust-provenance-drawer")),
      primaryText(screen.getByTestId("source-document-panel")),
      primaryText(screen.getByTestId("review-queue-section"))
    ].join(" ");
    expect(primarySurface).toContain("Page 1 · Span 1");
    expect(primarySurface).toContain("Page 2 · Span 4");
    expect(primarySurface).toContain("1 source span");
    expect(primarySurface).toContain("1 review task");
    expect(primarySurface).not.toMatch(/workflow-task\.|source-document\.|source-span\.|page:1;span:1|page:2;span:4|sha256:|0{64}|4{64}|resource\.ahs-guru/);

    expect(screen.getByTestId("source-span-details")).toHaveTextContent("source-span.local-test");
    expect(screen.getByTestId("source-span-details")).toHaveTextContent("page:1;span:1");
    expect(screen.getByTestId("source-span-details")).toHaveTextContent("Copy source span ID");
    expect(screen.getByTestId("review-queue-section")).toHaveTextContent("Review metadata details and copy controls");
  });

  it("defines retrieval terminal graph-coupling state for source-span hits", async () => {
    mockCorpusFetch();

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    const workbench = screen.getByTestId("atlas-workbench");
    fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
      target: { value: "deterministic parsed excerpt" }
    });
    fireEvent.submit(within(workbench).getByRole("search", { name: "Search public corpus metadata and source spans" }));

    expect(await within(workbench).findByText("Source-span retrieval")).toBeVisible();
    fireEvent.click(within(workbench).getByRole("button", { name: /Local deterministic parsed excerpt/i }));

    await waitFor(() => expect(primaryText(screen.getByTestId("trust-provenance-drawer"))).toContain("Page 1 · Span 1"));
    expect(workbench).toHaveTextContent("Retrieval terminal state");
    expect(primaryText(workbench)).toContain("Highlighted resources: 1 public resource");
    expect(primaryText(workbench)).toContain("Highlighted source spans: 1 source span");
    expect(primaryText(workbench)).toContain("Selected graph path: Resource -> Page 1 · Span 1 -> 1 review task");
    expect(primaryText(workbench)).toContain("4 path/context nodes");
    expect(workbench).toHaveTextContent("source-span-parent-fallback");
    expect(workbench).toHaveTextContent("Retrieval trace entries: metadata result, source-span result, provenance drawer focus");
    expect(primaryText(screen.getByTestId("trust-provenance-drawer"))).toContain("exact IDs and checksum are in details");
    expect(screen.getByTestId("source-span-details")).toHaveTextContent("source-document.local-test");
    expect(screen.getByTestId("source-span-details")).toHaveTextContent("0".repeat(64));
    expect(screen.getByTestId("trust-provenance-drawer")).not.toHaveTextContent(/clinical answer|recommendation text|treatment advice|dosing|diagnosis/i);
  });

  it("renders the Task 6 workbench trace without exposing generated answer fields", async () => {
    mockCorpusFetch();

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    const workbench = screen.getByTestId("atlas-workbench");
    fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
      target: { value: "deterministic parsed excerpt" }
    });
    fireEvent.submit(within(workbench).getByRole("search", { name: "Search public corpus metadata and source spans" }));

    const traceTerminal = await screen.findByTestId("workbench-trace-terminal");
    expect(traceTerminal).toHaveAttribute("data-command-label", "run-evals:corpus-workbench-trace");
    expect(traceTerminal).toHaveAttribute("data-gateway-outcome", "executed");
    expect(traceTerminal).toHaveAttribute("data-abstention-status", "abstained_no_answer_text");
    expect(traceTerminal).toHaveAttribute("data-citation-verifier-status", "pass");
    expect(traceTerminal).toHaveTextContent("Command label");
    expect(traceTerminal).toHaveTextContent("Retrieval steps");
    expect(traceTerminal).toHaveTextContent("source_selection");
    expect(traceTerminal).toHaveTextContent("Graph focus");
    expect(traceTerminal).toHaveTextContent("Source spans used/rejected");
    expect(traceTerminal).toHaveTextContent("1 used / 0 rejected");
    expect(traceTerminal).toHaveTextContent("Gateway decision");
    expect(traceTerminal).toHaveTextContent("allowed: true");
    expect(traceTerminal).toHaveTextContent("Model class");
    expect(traceTerminal).toHaveTextContent("local_open_weight_7b");
    expect(traceTerminal).toHaveTextContent("Citation verifier status");
    expect(traceTerminal).toHaveTextContent("Warnings");
    expect(traceTerminal).toHaveTextContent("none");
    expect(traceTerminal).toHaveTextContent("Abstention");
    expect(traceTerminal).toHaveTextContent("true · abstained_no_answer_text · no claim: true");
    expect(primaryText(traceTerminal)).toContain("1 source span");
    expect(primaryText(traceTerminal)).not.toMatch(/source-span\.local-test|source-document\.local-test|sha256:/);
    expect(traceTerminal).toHaveTextContent("Only selected-context cited draft answers are allowed");
    expect(traceTerminal).not.toHaveTextContent(/clinical answer|recommendation text|treatment advice|dosing|diagnosis|assistant response|chat transcript/i);
  });

  it("task 8 assistant entrypoint keeps Find source context, selected source action, and Trace details collapsed", async () => {
    const fetchSpy = mockCorpusFetch();

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    const assistantRail = await screen.findByTestId("assistant-rail");
    const assistantPrimaryText = primaryText(assistantRail);
    expect(assistantPrimaryText).toContain("Source Context Assistant");
    expect(assistantPrimaryText).toContain("Find source context");
    expect(assistantPrimaryText).toContain("Ask about selected source");
    expect(assistantPrimaryText).toContain("Select a source-backed graph item to ask.");
    expect(assistantPrimaryText).toContain("Source context results");
    expect(assistantPrimaryText).not.toMatch(/Explain Selection|Graph-RAG retrieval trace|Retrieval query/);
    expect(screen.getByTestId("assistant-trace-details")).not.toHaveAttribute("open");
    expect(screen.getByTestId("assistant-output-trace-details")).not.toHaveAttribute("open");
    expect(within(assistantRail).getByRole("textbox", { name: /ask about selected source/i })).toBeDisabled();
    expect(within(assistantRail).getByRole("button", { name: "Ask about selected source" })).toBeDisabled();

    const workbench = screen.getByTestId("atlas-workbench");
    fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
      target: { value: "deterministic parsed excerpt" }
    });
    fireEvent.click(within(workbench).getByRole("button", { name: "Find source context" }));
    fireEvent.click(await within(workbench).findByRole("button", { name: /Local deterministic parsed excerpt/i }));

    await waitFor(() => expect(within(assistantRail).getByRole("textbox", { name: /ask about selected source/i })).toBeEnabled());
    expect(within(assistantRail).getByRole("button", { name: "Ask about selected source" })).toBeDisabled();
    fireEvent.change(within(assistantRail).getByRole("textbox", { name: /ask about selected source/i }), {
      target: { value: "Summarize this selected source." }
    });
    expect(within(assistantRail).getByRole("button", { name: "Ask about selected source" })).toBeEnabled();
    expect(primaryText(assistantRail)).toContain("Selected source context: Page 1 · Span 1.");
    expect(primaryText(assistantRail)).not.toMatch(/Explain Selection|Graph-RAG retrieval trace|Retrieval query/);

    fireEvent.click(within(screen.getByTestId("assistant-trace-details")).getByText("Trace details"));
    fireEvent.click(within(screen.getByTestId("assistant-trace-details")).getByRole("button", { name: "Run selected-source trace" }));

    const explainTrace = await screen.findByTestId("explain-selection-trace-terminal");
    expect(screen.getByTestId("assistant-output-trace-details")).not.toHaveAttribute("open");
    expect(explainTrace).toHaveAttribute("data-command-label", "explain-selection");
    expect(explainTrace).toHaveTextContent("Selected source trace");
    expect(explainTrace).toHaveTextContent("Selected source spans");
    expect(primaryText(explainTrace)).toContain("1 source span");
    expect(fetchSpy).toHaveBeenCalledWith("/api/knowledgebase/corpus/workbench/explain-selection", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("source-span.local-test")
    }));
  });

  it("runs selected-source trace details for a source-span-backed graph selection as trace-only UI", async () => {
    const fetchSpy = mockCorpusFetch();
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    const workbench = screen.getByTestId("atlas-workbench");
    fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
      target: { value: "deterministic parsed excerpt" }
    });
    fireEvent.submit(within(workbench).getByRole("search", { name: "Search public corpus metadata and source spans" }));
    fireEvent.click(await within(workbench).findByRole("button", { name: /Local deterministic parsed excerpt/i }));

    await waitFor(() => expect(screen.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-highlighted-source-span-ids", "source-span.local-test"));
    expect(workbench).toHaveTextContent("Source-span-backed selection: trace details include digests, gateway outcome, verifier status, warnings, and evidence IDs.");
    fireEvent.click(within(screen.getByTestId("assistant-trace-details")).getByText("Trace details"));
    fireEvent.click(within(screen.getByTestId("assistant-trace-details")).getByRole("button", { name: "Run selected-source trace" }));

    const explainTrace = await screen.findByTestId("explain-selection-trace-terminal");
    expect(explainTrace).toHaveAttribute("data-command-label", "explain-selection");
    expect(explainTrace).toHaveAttribute("data-gateway-outcome", "executed");
    expect(explainTrace).toHaveAttribute("data-runner-status", "dry_run_completed");
    expect(explainTrace).toHaveAttribute("data-citation-verifier-status", "pass");
    expect(explainTrace).toHaveAttribute("data-raw-output-included", "false");
    expect(explainTrace).toHaveTextContent("Selected graph node");
    expect(explainTrace).toHaveTextContent("Selection metadata available in trace details");
    expect(explainTrace).toHaveTextContent("Selected source spans");
    expect(primaryText(explainTrace)).toContain("1 source span");
    expect(explainTrace).toHaveTextContent("Context digest");
    expect(primaryText(explainTrace)).toContain("Digest available in trace details");
    expect(explainTrace).toHaveTextContent("Output digest");
    expect(explainTrace).toHaveTextContent("Gateway outcome");
    expect(explainTrace).toHaveTextContent("Citation/verifier status");
    expect(explainTrace).toHaveTextContent("Warnings");
    expect(explainTrace).toHaveTextContent("none");
    expect(explainTrace).toHaveTextContent("Evidence records");
    expect(primaryText(explainTrace)).toContain("1 evidence record");
    expect(explainTrace).toHaveTextContent("raw_output_included");
    expect(explainTrace).toHaveTextContent("false");
    expect(explainTrace).toHaveTextContent("Only selected-context cited draft answers are allowed");
    expect(fetchSpy).toHaveBeenCalledWith("/api/knowledgebase/corpus/workbench/explain-selection", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("source-span.local-test")
    }));
    expect(primaryText(explainTrace)).not.toMatch(/source-span\.local-test|source-document\.local-test|sha256:|evidence\.explain\.source-span\.local-test/);
    const assistantRail = screen.getByTestId("assistant-rail");
    expect(assistantRail).toHaveAttribute("data-answer-mode", "selected_context_cited_draft");
    expect(within(assistantRail).getByRole("textbox", { name: /ask about selected source/i })).toBeEnabled();
    expect(within(assistantRail).queryByTestId("selected-context-answer")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalledWith("/api/knowledgebase/corpus/workbench/conversation-turn", expect.anything());
    expect(setItemSpy).not.toHaveBeenCalledWith(expect.stringMatching(/prompt|turn|transcript|raw_model_output/i), expect.any(String));
    expect(explainTrace).not.toHaveTextContent(/chat transcript|assistant response|recommendation text|treatment advice|dosing|diagnosis|raw_model_output|raw model output/i);
    expect(document.body).not.toHaveTextContent(/selected-context-answer|chat transcript|assistant response|recommendation text|treatment advice|dosing|diagnosis|raw_model_output|raw model output/i);
  });

  it("renders metadata-only selected-source trace details as a blocked trace without a model answer panel", async () => {
    mockCorpusFetch();

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    const workbench = screen.getByTestId("atlas-workbench");
    fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
      target: { value: "Adjuvant Radiotherapy for Invasive Breast Cancer" }
    });
    fireEvent.submit(within(workbench).getByRole("search", { name: "Search public corpus metadata and source spans" }));
    fireEvent.click(await within(workbench).findByRole("button", { name: /Adjuvant Radiotherapy for Invasive Breast Cancer/i }));

    await waitFor(() => expect(screen.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-focus-mode", "metadata-only-blocked"));
    expect(workbench).toHaveTextContent("Selection lacks validated source-span context; trace details will render a blocked trace only.");
    fireEvent.click(within(screen.getByTestId("assistant-trace-details")).getByText("Trace details"));
    fireEvent.click(within(screen.getByTestId("assistant-trace-details")).getByRole("button", { name: "Run selected-source trace" }));

    const explainTrace = await screen.findByTestId("explain-selection-trace-terminal");
    expect(explainTrace).toHaveAttribute("data-command-label", "explain-selection");
    expect(explainTrace).toHaveAttribute("data-gateway-outcome", "blocked_before_gateway");
    expect(explainTrace).toHaveAttribute("data-runner-status", "not_invoked");
    expect(explainTrace).toHaveAttribute("data-citation-verifier-status", "not_run");
    expect(explainTrace).toHaveAttribute("data-raw-output-included", "false");
    expect(explainTrace).toHaveTextContent("Selected source spans");
    expect(primaryText(explainTrace)).toContain("0 source spans");
    expect(explainTrace).toHaveTextContent("missing_validated_source_span_context");
    expect(explainTrace).toHaveTextContent("Context digest");
    expect(primaryText(explainTrace)).toContain("Digest available in trace details");
    expect(explainTrace).toHaveTextContent("Output digest");
    expect(explainTrace).toHaveTextContent("Evidence records");
    expect(primaryText(explainTrace)).toContain("1 evidence record");
    expect(explainTrace).toHaveTextContent("No source spans used by this explain-selection trace.");
    expect(primaryText(explainTrace)).not.toMatch(/source-span\.local-test|sha256:|evidence\.blocked\./);
    expect(document.body).not.toHaveTextContent(/chat transcript|assistant response|recommendation text|treatment advice|dosing|diagnosis|raw_model_output|raw model output/i);
  });

  it("renders unsupported advice-like trace as an abstained no-answer workbench state", async () => {
    mockCorpusFetch();

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    const workbench = screen.getByTestId("atlas-workbench");
    fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
      target: { value: "what should someone choose for treatment" }
    });
    fireEvent.submit(within(workbench).getByRole("search", { name: "Search public corpus metadata and source spans" }));

    expect(await within(workbench).findByText("No results for this query in public metadata or parsed source spans.")).toBeVisible();
    const traceTerminal = screen.getByTestId("workbench-trace-terminal");
    expect(traceTerminal).toHaveAttribute("data-gateway-outcome", "blocked_before_gateway");
    expect(traceTerminal).toHaveAttribute("data-abstention-status", "abstained_no_model_execution");
    expect(traceTerminal).toHaveAttribute("data-citation-verifier-status", "not_run");
    expect(traceTerminal).toHaveTextContent("unsupported_advice_like_prompt");
    expect(traceTerminal).toHaveTextContent("abstain_advice_like_prompt");
    expect(traceTerminal).toHaveTextContent("No source spans used by this trace.");
    expect(traceTerminal).toHaveTextContent("0 used / 0 rejected");
    expect(traceTerminal).toHaveTextContent("external API used: false");
    expect(traceTerminal).toHaveTextContent("true · abstained_no_model_execution · no claim: true");
    expect(traceTerminal).not.toHaveTextContent(/clinical answer|recommendation text|dosing|diagnosis|assistant response|chat transcript/i);
  });

  it("selected-context cited draft answer renders readable citations without transcript fields", async () => {
    const fetchSpy = mockCorpusFetch();

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    const workbench = screen.getByTestId("atlas-workbench");
    fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
      target: { value: "deterministic parsed excerpt" }
    });
    fireEvent.submit(within(workbench).getByRole("search", { name: "Search public corpus metadata and source spans" }));
    fireEvent.click(await within(workbench).findByRole("button", { name: /Local deterministic parsed excerpt/i }));

    const assistantRail = await screen.findByTestId("assistant-rail");
    expect(assistantRail).toHaveAttribute("data-answer-mode", "selected_context_cited_draft");
    expect(within(assistantRail).getByRole("textbox", { name: /ask about selected source/i })).toBeEnabled();
    fireEvent.change(within(assistantRail).getByRole("textbox", { name: /ask about selected source/i }), {
      target: { value: "Summarize the selected source context." }
    });
    fireEvent.click(within(assistantRail).getByRole("button", { name: "Ask about selected source" }));

    const answer = await within(assistantRail).findByTestId("selected-context-answer");
    expect(answer).toHaveTextContent("Draft answer for selected source context only; not medical advice.");
    expect(answer).toHaveTextContent("Page 1 · Span 1");
    expect(primaryText(answer)).not.toContain("page:1;span:1");
    expect(answer).toHaveTextContent("Local deterministic parsed excerpt for search coverage.");
    expect(primaryText(answer)).not.toMatch(/source-span\.local-test|workflow-task\.|sha256:|0{64}|raw_model_output/i);
    fireEvent.click(within(answer).getByRole("button", { name: /Show citation Page 1 · Span 1/i }));
    expect(answer).toHaveTextContent("Why this draft answer is grounded");
    fireEvent.click(within(answer).getByText("Show citation metadata"));
    expect(within(answer).getByTestId("citation-metadata-details")).toHaveTextContent("page:1;span:1");
    expect(within(answer).getByTestId("citation-metadata-details")).toHaveTextContent("source-span.local-test");
    const conversationCall = fetchSpy.mock.calls.find(([url]) => url.toString() === "/api/knowledgebase/corpus/workbench/conversation-turn");
    expect(conversationCall).toBeDefined();
    const postBody = JSON.parse(String(conversationCall?.[1]?.body ?? "{}"));
    expect(postBody).toMatchObject({
      question: "Summarize the selected source context.",
      source_span_id: "source-span.local-test",
      selected_node_id: `resource.${breastResourceId}`,
      resource_id: breastResourceId
    });
    expect(Object.keys(postBody).sort()).toEqual(["question", "resource_id", "selected_node_id", "source_span_id", "turn_id"]);
    expect(JSON.stringify(postBody)).not.toMatch(/transcript|history|global|corpus_chat|raw_model_output/i);
    expect(document.body).not.toHaveTextContent(/raw_model_output|chat transcript|treatment advice|dosing|diagnosis/i);
  });

  it("citation hover transiently highlights the cited graph source without pinning", async () => {
    const { assistantRail, citationButton } = await renderCitedAnswer();

    fireEvent.pointerEnter(citationButton);

    expect(assistantRail).toHaveAttribute("data-citation-focus-mode", "transient");
    expect(citationButton).toHaveAttribute("data-citation-label", "Page 1 · Span 1");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-selected-query", "Answer citation Page 1 · Span 1");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-highlighted-source-span-ids", "source-span.local-test");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-focus-mode", "source-span-parent-fallback");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-pinned-node-count", "0");

    fireEvent.pointerLeave(citationButton);

    expect(assistantRail).toHaveAttribute("data-citation-focus-mode", "none");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-selected-query", "deterministic parsed excerpt");
  });

  it("citation click pins highlight and opens source view at the cited span", async () => {
    const { assistantRail, answer, citationButton } = await renderCitedAnswer();

    fireEvent.click(screen.getByRole("button", { name: "Close Source View" }));
    expect(screen.queryByTestId("source-document-panel")).toBeNull();

    fireEvent.click(citationButton);

    const sourceView = screen.getByTestId("source-document-panel");
    expect(assistantRail).toHaveAttribute("data-citation-focus-mode", "pinned");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-selected-query", "Answer citation Page 1 · Span 1");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-highlighted-source-span-ids", "source-span.local-test");
    expect(sourceView).toHaveTextContent("Page 1 · Span 1");
    expect(within(sourceView).getByRole("button", { name: /Page 1 · Span 1/i })).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("compact-inspector-summary")).toHaveTextContent("Page 1 · Span 1");
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("Page 1 · Span 1");
    expect(primaryText(answer)).not.toMatch(/source-span\.local-test|page:1;span:1|source-document\.local-test|sha256:/);

    fireEvent.pointerDown(screen.getByTestId("guideline-graph-canvas"), { clientX: 420, clientY: 280, pointerId: 31 });
    expect(assistantRail).toHaveAttribute("data-citation-focus-mode", "pinned");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-selected-query", "Answer citation Page 1 · Span 1");
  });

  it("citation focus gives keyboard users the same transient graph highlight", async () => {
    const { assistantRail, citationButton } = await renderCitedAnswer();

    fireEvent.focus(citationButton);

    expect(assistantRail).toHaveAttribute("data-citation-focus-mode", "transient");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-selected-query", "Answer citation Page 1 · Span 1");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-highlighted-source-span-ids", "source-span.local-test");

    fireEvent.blur(citationButton);

    expect(assistantRail).toHaveAttribute("data-citation-focus-mode", "none");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-selected-query", "deterministic parsed excerpt");
  });

  it("highlight clears on Escape and click-off without erasing selected context answer", async () => {
    const { assistantRail, answer, citationButton } = await renderCitedAnswer();

    fireEvent.pointerEnter(citationButton);
    expect(assistantRail).toHaveAttribute("data-citation-focus-mode", "transient");
    fireEvent.keyDown(window, { key: "Escape" });

    expect(assistantRail).toHaveAttribute("data-citation-focus-mode", "none");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-selected-query", "deterministic parsed excerpt");
    expect(answer).toBeVisible();
    expect(assistantRail).toHaveTextContent("Selected source context: Page 1 · Span 1.");

    fireEvent.pointerEnter(citationButton);
    expect(assistantRail).toHaveAttribute("data-citation-focus-mode", "transient");
    fireEvent.pointerDown(screen.getByTestId("guideline-graph-canvas"), { clientX: 420, clientY: 280, pointerId: 32 });

    expect(assistantRail).toHaveAttribute("data-citation-focus-mode", "none");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-selected-query", "deterministic parsed excerpt");
    expect(within(assistantRail).getByTestId("selected-context-answer")).toBeVisible();
  });

  it("source view keeps readable citation labels while raw citation IDs stay in metadata details", async () => {
    const { answer, citationButton } = await renderCitedAnswer();

    fireEvent.click(citationButton);

    const sourceView = screen.getByTestId("source-document-panel");
    expect(primaryText(sourceView)).toContain("Page 1 · Span 1");
    expect(primaryText(sourceView)).not.toMatch(/source-span\.local-test|source-document\.local-test|page:1;span:1|0{64}/);
    fireEvent.click(within(answer).getByText("Show citation metadata"));
    expect(within(answer).getByTestId("citation-metadata-details")).toHaveTextContent("source-span.local-test");
    expect(within(answer).getByTestId("citation-metadata-details")).toHaveTextContent("page:1;span:1");
  });

  it("selected_context_required and patient advice prompts render refusals without stored transcripts", async () => {
    mockCorpusFetch();
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    const assistantRail = await screen.findByTestId("assistant-rail");
    expect(within(assistantRail).getByRole("textbox", { name: /ask about selected source/i })).toBeDisabled();
    expect(assistantRail).toHaveTextContent("Select a source-backed graph item to ask.");

    const workbench = screen.getByTestId("atlas-workbench");
    fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
      target: { value: "deterministic parsed excerpt" }
    });
    fireEvent.submit(within(workbench).getByRole("search", { name: "Search public corpus metadata and source spans" }));
    fireEvent.click(await within(workbench).findByRole("button", { name: /Local deterministic parsed excerpt/i }));
    fireEvent.change(within(assistantRail).getByRole("textbox", { name: /ask about selected source/i }), {
      target: { value: "what should someone choose for treatment" }
    });
    fireEvent.click(within(assistantRail).getByRole("button", { name: "Ask about selected source" }));

    expect(await within(assistantRail).findByText("I cannot answer patient-specific advice or treatment-choice prompts.")).toBeVisible();
    expect(assistantRail).toHaveAttribute("data-gateway-outcome", "blocked_before_gateway");
    expect(assistantRail).toHaveAttribute("data-raw-output-included", "false");
    expect(setItemSpy).not.toHaveBeenCalledWith(expect.stringMatching(/prompt|turn|transcript|raw_model_output/i), expect.any(String));
    expect(primaryText(document.body)).not.toMatch(/raw_model_output|recommended regimen|dosing|diagnosis/i);
    expect(primaryText(assistantRail)).toContain("not medical advice");
  });

  it("gateway unavailable selected-context answer renders unavailable state without fake fragments", async () => {
    mockCorpusFetch();

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    const workbench = screen.getByTestId("atlas-workbench");
    fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
      target: { value: "deterministic parsed excerpt" }
    });
    fireEvent.submit(within(workbench).getByRole("search", { name: "Search public corpus metadata and source spans" }));
    fireEvent.click(await within(workbench).findByRole("button", { name: /Local deterministic parsed excerpt/i }));

    const assistantRail = await screen.findByTestId("assistant-rail");
    fireEvent.change(within(assistantRail).getByRole("textbox", { name: /ask about selected source/i }), {
      target: { value: "gateway unavailable smoke" }
    });
    fireEvent.click(within(assistantRail).getByRole("button", { name: "Ask about selected source" }));

    expect(await within(assistantRail).findByTestId("selected-context-unavailable")).toHaveTextContent("Generation unavailable for the selected source context.");
    expect(assistantRail).toHaveAttribute("data-gateway-outcome", "gateway_unavailable");
    expect(within(assistantRail).queryByTestId("selected-context-answer")).toBeNull();
    expect(primaryText(assistantRail)).not.toMatch(/fake answer|recommended regimen|dosing|diagnosis/i);
  });

  it("safety gate hides uncited, raw-output, external-routing, and persisted selected-context responses", async () => {
    const unsafeCases = [
      { prompt: "uncited response fixture", expected: /No answer fragments are shown|Corpus conversation draft fragment lacked matching citation support/i },
      { prompt: "raw output fixture", expected: /Corpus conversation turn response included raw model output/i },
      { prompt: "external routing fixture", expected: /Corpus conversation turn response used external API routing/i },
      { prompt: "persisted transcript fixture", expected: /Corpus conversation turn response persisted answer or transcript state/i }
    ];

    for (const unsafeCase of unsafeCases) {
      vi.restoreAllMocks();
      mockCorpusFetch();
      const rendered = render(<GuidelineGraphCanvas />);

      await screen.findByText(/Public corpus metadata loaded from the local API/);
      const workbench = screen.getByTestId("atlas-workbench");
      fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
        target: { value: "deterministic parsed excerpt" }
      });
      fireEvent.submit(within(workbench).getByRole("search", { name: "Search public corpus metadata and source spans" }));
      fireEvent.click(await within(workbench).findByRole("button", { name: /Local deterministic parsed excerpt/i }));

      const assistantRail = await screen.findByTestId("assistant-rail");
      fireEvent.change(within(assistantRail).getByRole("textbox", { name: /ask about selected source/i }), {
        target: { value: unsafeCase.prompt }
      });
      fireEvent.click(within(assistantRail).getByRole("button", { name: "Ask about selected source" }));

      await waitFor(() => expect(within(assistantRail).queryByTestId("selected-context-answer")).toBeNull());
      expect(await within(assistantRail).findByText(unsafeCase.expected)).toBeVisible();
      expect(primaryText(assistantRail)).not.toMatch(/unsafe raw output|uncited answer text|recommended regimen|dosing|diagnosis/i);
      rendered.unmount();
    }
  });

  it("ephemeral selected-context assistant turn is cleared across remount and never writes storage", async () => {
    mockCorpusFetch();
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    const rendered = render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    const workbench = screen.getByTestId("atlas-workbench");
    fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
      target: { value: "deterministic parsed excerpt" }
    });
    fireEvent.submit(within(workbench).getByRole("search", { name: "Search public corpus metadata and source spans" }));
    fireEvent.click(await within(workbench).findByRole("button", { name: /Local deterministic parsed excerpt/i }));
    const assistantRail = await screen.findByTestId("assistant-rail");
    fireEvent.change(within(assistantRail).getByRole("textbox", { name: /ask about selected source/i }), {
      target: { value: "Summarize the selected source context." }
    });
    fireEvent.click(within(assistantRail).getByRole("button", { name: "Ask about selected source" }));
    expect(await within(assistantRail).findByTestId("selected-context-answer")).toBeVisible();

    rendered.unmount();
    render(<GuidelineGraphCanvas />);

    const nextAssistantRail = await screen.findByTestId("assistant-rail");
    expect(within(nextAssistantRail).queryByTestId("selected-context-answer")).toBeNull();
    expect(within(nextAssistantRail).getByRole("textbox", { name: /ask about selected source/i })).toHaveValue("");
    expect(setItemSpy).not.toHaveBeenCalledWith(expect.stringMatching(/prompt|turn|transcript|answer|raw_model_output/i), expect.any(String));
  });

  it("assistant_rail_resizable panel_dismissible contracts are visible in the workbench shell", async () => {
    mockCorpusFetch();

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    const canvas = screen.getByTestId("guideline-graph-canvas");
    const assistantRail = await screen.findByTestId("assistant-rail");
    expect(assistantRail).toHaveAttribute("data-resizable", "vertical");
    expect(assistantRail).toHaveAttribute("data-min-height", "20vh");
    expect(assistantRail).toHaveAttribute("data-max-height", "55vh");
    expect(within(assistantRail).getByRole("textbox", { name: /ask about selected source/i })).toBeDisabled();

    const workbench = screen.getByTestId("atlas-workbench");
    fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
      target: { value: "deterministic parsed excerpt" }
    });
    fireEvent.submit(within(workbench).getByRole("search", { name: "Search public corpus metadata and source spans" }));
    fireEvent.click(await within(workbench).findByRole("button", { name: /Local deterministic parsed excerpt/i }));
    expect(within(assistantRail).getByRole("textbox", { name: /ask about selected source/i })).toBeEnabled();
    expect(within(assistantRail).getByRole("button", { name: "Ask about selected source" })).toBeDisabled();
    expect(within(assistantRail).queryByTestId("selected-context-answer")).toBeNull();

    fireEvent.pointerDown(within(assistantRail).getByRole("separator", { name: "Resize assistant rail" }), { clientY: 700, pointerId: 21 });
    fireEvent.pointerMove(window, { clientY: 520, pointerId: 21 });
    fireEvent.pointerUp(window, { clientY: 520, pointerId: 21 });
    expect(assistantRail).toHaveAttribute("data-height-state", "resized");
    expect(screen.getByTestId("sigma-corpus-graph")).toBeVisible();

    fireEvent.pointerDown(screen.getByRole("separator", { name: "Resize Vault panel" }), { clientX: 240, pointerId: 22 });
    fireEvent.pointerMove(window, { clientX: 300, pointerId: 22 });
    fireEvent.pointerUp(window, { clientX: 300, pointerId: 22 });
    expect(screen.getByRole("separator", { name: "Resize Vault panel" })).toHaveAttribute("aria-valuemin", "208");
    expect(screen.getByRole("separator", { name: "Resize Vault panel" })).toHaveAttribute("aria-valuemax", "360");
    expect(screen.getByRole("separator", { name: "Resize Vault panel" })).not.toHaveAttribute("aria-valuenow", "NaN");

    fireEvent.click(screen.getByRole("button", { name: "Close Graph Search" }));
    expect(screen.queryByTestId("graph-search-panel")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show Graph Search" }));
    expect(screen.getByTestId("graph-search-panel")).toBeVisible();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("graph-search-panel")).toBeNull();
    expect(screen.queryByTestId("source-document-panel")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show Source View" }));
    expect(screen.getByTestId("source-document-panel")).toHaveTextContent("Adjuvant Radiotherapy for Invasive Breast Cancer");

    fireEvent.click(screen.getByRole("button", { name: "Collapse session pins" }));
    expect(screen.getByRole("button", { name: "Expand session pins" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss Provenance panel" }));
    expect(screen.queryByTestId("trust-provenance-drawer")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss assistant rail" }));
    expect(screen.queryByTestId("assistant-rail")).toBeNull();
    expect(canvas).toBeVisible();
  });

  it("clicking terminal entries focuses matching graph nodes while graph selection updates terminal context", async () => {
    mockCorpusFetch();

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    const workbench = screen.getByTestId("atlas-workbench");
    fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
      target: { value: "guideline" }
    });
    fireEvent.submit(within(workbench).getByRole("search", { name: "Search public corpus metadata and source spans" }));
    expect(await within(workbench).findByText("Metadata retrieval")).toBeVisible();
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-highlighted-resource-ids", `${breastResourceId},${brainResourceId}`);

    fireEvent.click(within(screen.getByTestId("retrieval-terminal-state")).getByRole("button", { name: `Metadata terminal result ${brainResourceId}` }));
    await waitFor(() => expect(screen.getByTestId("node-inspector")).toHaveTextContent(brainResourceId));
    expect(screen.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-graph-resource-node-id", `resource.${brainResourceId}`);
    expect(document.querySelector(`[data-node-id="resource.${brainResourceId}"]`)).toHaveAttribute("data-evidence-role", "metadata-blocked");

    const breastProbe = document.querySelector(`[data-node-id="resource.${breastResourceId}"]`);
    expect(breastProbe).not.toBeNull();
    fireEvent.pointerDown(breastProbe as Element, { clientX: 100, clientY: 100, pointerId: 12 });
    fireEvent.pointerUp(breastProbe as Element, { clientX: 100, clientY: 100, pointerId: 12 });
    await waitFor(() => expect(screen.getByTestId("node-inspector")).toHaveTextContent(breastResourceId));
    expect(screen.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-graph-resource-node-id", `resource.${breastResourceId}`);
    expect(screen.getByTestId("retrieval-terminal-state")).toHaveTextContent("Only selected-context cited draft answers are allowed");
    expect(screen.getByTestId("retrieval-terminal-state")).not.toHaveTextContent(/generated answer prose|clinical answer|treatment advice|dosing|diagnosis/i);
  });

  it("defines metadata-only retrieval terminal state as blocked instead of claim-like evidence", async () => {
    mockCorpusFetch();

    render(<GuidelineGraphCanvas />);

    await screen.findByText(/Public corpus metadata loaded from the local API/);
    const workbench = screen.getByTestId("atlas-workbench");
    fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
      target: { value: "Adjuvant Radiotherapy for Invasive Breast Cancer" }
    });
    fireEvent.submit(within(workbench).getByRole("search", { name: "Search public corpus metadata and source spans" }));
    fireEvent.click(await within(workbench).findByRole("button", { name: /Adjuvant Radiotherapy for Invasive Breast Cancer/i }));

    await waitFor(() => expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("Metadata-only, no claim rendered"));
    expect(workbench).toHaveTextContent("Retrieval terminal state");
    expect(workbench).toHaveTextContent("Highlighted resources: 1 public resource");
    expect(workbench).toHaveTextContent("Selected source-span context: metadata-only / blocked");
    expect(workbench).toHaveTextContent("Blocked evidence label: metadata-only, no source span returned");
    expect(workbench).toHaveTextContent("Retrieval trace entries: metadata result, blocked source-span context, provenance drawer focus");
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("Metadata-only, no claim rendered");
    expect(screen.getByTestId("trust-provenance-drawer")).not.toHaveTextContent(/evidence conclusion|generated answer|clinical summary|recommended regimen|patient-specific/i);
  });

  it("renders source-backed review queue cards with local-only actions and focus behavior", async () => {
    const fetchSpy = mockCorpusFetch({ interpretabilitySourceSpans: [reviewQueueFocusSpan] });

    render(<GuidelineGraphCanvas />);

    await waitFor(() => expect(primaryText(screen.getByTestId("review-queue-section"))).toContain("Page 2 · Span 4"));
    const reviewQueue = screen.getByTestId("review-queue-section");
    expect(reviewQueue).toHaveTextContent("Review queue summary");
    expect(reviewQueue).toHaveTextContent("Source-backed local review metadata is summarized by status and source coverage");
    expect(reviewQueue).toHaveTextContent("Adjuvant Radiotherapy for Invasive Breast Cancer");
    expect(primaryText(reviewQueue)).toContain("Page 2 · Span 4");
    expect(primaryText(reviewQueue)).not.toMatch(/page:2;span:4|source-span\.local-review-card|4{64}|review\.local-test/);
    expect(reviewQueue).toHaveTextContent("Review metadata details and copy controls");
    expect(reviewQueue).toHaveTextContent("draft · local_current");
    expect(reviewQueue).toHaveTextContent("Source-backed items");
    expect(reviewQueue).toHaveTextContent("Blocked/unbacked items");
    expect(reviewQueue).toHaveTextContent("Local actions");
    expect(within(reviewQueue).getByRole("button", { name: "Inspect source" })).toBeVisible();
    expect(within(reviewQueue).getByRole("button", { name: "Mark needs review (local)" })).toBeVisible();
    expect(within(reviewQueue).getByRole("button", { name: "Link source (local)" })).toBeVisible();

    fireEvent.click(within(reviewQueue).getByRole("button", { name: /Focus source-backed review task for Page 2 · Span 4/i }));
    expect(primaryText(screen.getByTestId("trust-provenance-drawer"))).toContain("Page 2 · Span 4");
    expect(screen.getByTestId("source-span-details")).toHaveTextContent("source-span.local-review-card");

    const fetchCountBeforeLocalAction = fetchSpy.mock.calls.length;
    fireEvent.click(within(reviewQueue).getByRole("button", { name: "Mark needs review (local)" }));
    expect(fetchSpy.mock.calls).toHaveLength(fetchCountBeforeLocalAction);
    expect(reviewQueue).toHaveTextContent("Local UI state: Mark needs review (local)");
    expect(document.body).not.toHaveTextContent(/mutation|recommendation drafting|approved recommendation|patient-specific/i);
  });

  it("blocks invalid or unbacked review queue fixture cards without source content or actions", async () => {
    mockCorpusFetch({
      reviewQueueItems: [buildReviewQueueItem({
        review_task_id: "review.unbacked-local-fixture",
        source_span_ids: [],
        staleness_status: "invalid_unbacked_local_fixture"
      })]
    });

    render(<GuidelineGraphCanvas />);

    await waitFor(() => expect(screen.getByTestId("review-queue-section")).toHaveTextContent("Blocked local fixture state"));
    const reviewQueue = screen.getByTestId("review-queue-section");
    expect(reviewQueue).toHaveTextContent("Blocked/unbacked items");
    expect(primaryText(reviewQueue)).toContain("1 item");
    const blockedCard = within(reviewQueue).getByTestId("review-queue-card-blocked");
    expect(blockedCard).toHaveAttribute("data-blocked", "true");
    expect(blockedCard).toHaveAttribute("aria-disabled", "true");
    expect(blockedCard).toHaveTextContent("Blocked local fixture state");
    expect(blockedCard).toHaveTextContent("blocked until a returned source span backs this item");
    expect(blockedCard).not.toHaveTextContent("Deterministic source-backed queue excerpt for UI focus.");
    expect(within(blockedCard).queryByRole("button", { name: "Inspect source" })).toBeNull();
    expect(within(blockedCard).queryByRole("button", { name: "Mark needs review (local)" })).toBeNull();
    expect(within(blockedCard).queryByRole("button", { name: "Link source (local)" })).toBeNull();
    expect(screen.getByTestId("trust-provenance-drawer")).not.toHaveTextContent(/evidence conclusion|treatment advice|dosing|diagnosis/i);
  });

  it("explains parse-failed, download-failed, and checksum-mismatch coverage without implying absent evidence", async () => {
    const statusRows = [
      { response_state: "parse_failed", archive_status: "downloaded", parse_status: "parse_failed", expected: "Parser output is unavailable" },
      { response_state: "download_failed", archive_status: "download-failed", parse_status: "download_missing", expected: "Archive download failed" },
      { response_state: "metadata_only", archive_status: "downloaded", parse_status: "checksum_mismatch", expected: "Checksum mismatch blocks source-span use" }
    ];

    for (const row of statusRows) {
      vi.restoreAllMocks();
      const resource = { ...resourcesPayload.resources[0], ...row };
      mockCorpusFetch({
        resources: { ...resourcesPayload, resources: [resource, resourcesPayload.resources[1]], count: 2 },
        graph: {
          ...graphPayload,
          nodes: graphPayload.nodes.map((node) => node.id === `resource.${breastResourceId}`
            ? { ...node, archive_status: row.archive_status, parse_status: row.parse_status, response_state: row.response_state }
            : node)
        }
      });

      const { unmount } = render(<GuidelineGraphCanvas />);
      await screen.findByText(/Public corpus metadata loaded from the local API/);
      const workbench = screen.getByTestId("atlas-workbench");
      fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
        target: { value: "Adjuvant Radiotherapy for Invasive Breast Cancer" }
      });
      fireEvent.submit(within(workbench).getByRole("search", { name: "Search public corpus metadata and source spans" }));
      fireEvent.click(await within(workbench).findByRole("button", { name: /Adjuvant Radiotherapy for Invasive Breast Cancer/i }));

      await waitFor(() => expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent(row.expected));
      expect(screen.getByTestId("trust-provenance-drawer")).not.toHaveTextContent(/no evidence/i);
      unmount();
    }
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
    expect(document.body).not.toHaveTextContent(/chat transcript|assistant response|external llm/i);
    expect(document.body).not.toHaveTextContent(/Synthetic|Packet Alpha|Model Trace Stub|Evidence Hub|Mock|Demo|Placeholder/);
  });

  it("represents API unavailable state safely", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("connection refused"));

    render(<GuidelineGraphCanvas />);

    expect(await screen.findByText("Corpus API unavailable")).toBeVisible();
    expect(screen.getAllByText(/Only selected-context cited draft answers are allowed/).length).toBeGreaterThan(0);
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

async function renderCitedAnswer() {
  mockCorpusFetch();
  render(<GuidelineGraphCanvas />);

  await screen.findByText(/Public corpus metadata loaded from the local API/);
  const workbench = screen.getByTestId("atlas-workbench");
  fireEvent.change(within(workbench).getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }), {
    target: { value: "deterministic parsed excerpt" }
  });
  fireEvent.submit(within(workbench).getByRole("search", { name: "Search public corpus metadata and source spans" }));
  fireEvent.click(await within(workbench).findByRole("button", { name: /Local deterministic parsed excerpt/i }));

  const assistantRail = await screen.findByTestId("assistant-rail");
  fireEvent.change(within(assistantRail).getByRole("textbox", { name: /ask about selected source/i }), {
    target: { value: "Summarize the selected source context." }
  });
  fireEvent.click(within(assistantRail).getByRole("button", { name: "Ask about selected source" }));
  const answer = await within(assistantRail).findByTestId("selected-context-answer");
  const citationButton = within(answer).getByRole("button", { name: /Show citation Page 1 · Span 1/i });

  return { assistantRail, answer, citationButton };
}

function primaryText(element: HTMLElement) {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("details, pre").forEach((node) => node.remove());
  return clone.textContent ?? "";
}

function mockCorpusFetch(overrides: {
  resources?: unknown;
  graph?: unknown;
  sourceSpans?: unknown;
  interpretabilitySourceSpans?: Array<typeof sourceSpanSearchResult>;
  reviewQueueItems?: ReviewQueuePayloadItem[];
} = {}) {
  const payloads: Record<string, unknown> = {
    "/api/knowledgebase/corpus/resources": overrides.resources ?? resourcesPayload,
    "/api/knowledgebase/corpus/graph": overrides.graph ?? graphPayload,
    "/api/knowledgebase/corpus/source-spans": overrides.sourceSpans ?? sourceSpansPayload
  };

  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    const parsedUrl = new URL(url, "http://localhost");
    const payload = parsedUrl.pathname === "/api/knowledgebase/corpus/search"
      ? buildSearchPayload(parsedUrl.searchParams.get("q") ?? "")
      : parsedUrl.pathname === "/api/knowledgebase/corpus/workbench/trace"
        ? buildWorkbenchTracePayload(parsedUrl.searchParams.get("q") ?? "")
      : parsedUrl.pathname === "/api/knowledgebase/corpus/workbench/explain-selection"
        ? buildExplainSelectionPayload(JSON.parse(String(init?.body ?? "{}")))
      : parsedUrl.pathname === "/api/knowledgebase/corpus/workbench/conversation-turn"
        ? buildConversationTurnPayload(JSON.parse(String(init?.body ?? "{}")))
      : parsedUrl.pathname === "/api/knowledgebase/corpus/interpretability"
        ? buildInterpretabilityPayload(parsedUrl.searchParams.get("resource_id") ?? breastResourceId, overrides.interpretabilitySourceSpans, overrides.reviewQueueItems)
      : payloads[parsedUrl.pathname];

    if (!payload) {
      return Promise.resolve(new Response(JSON.stringify({ detail: "not found" }), { status: 404 }));
    }

    return Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } }));
  });

  return fetchSpy;
}

function buildConversationTurnPayload(request: { question?: string; source_span_id?: string; selected_node_id?: string; resource_id?: string }) {
  const question = request.question ?? "";
  const isAdviceLike = isAdviceLikeQuery(question);
  const hasSourceSpanContext = request.source_span_id === sourceSpanSearchResult.span_id;
  const gatewayUnavailable = /gateway unavailable/i.test(question);
  const unsafeFixture = buildUnsafeConversationTurnFixture(question, request);
  if (unsafeFixture) {
    return unsafeFixture;
  }
  const gatewayDecision = isAdviceLike || !hasSourceSpanContext ? {
    allowed: false,
    outcome: "blocked_before_gateway",
    reason_code: isAdviceLike ? "unsupported_advice_like_prompt" : "missing_validated_source_span_context",
    policy_request_id: "policy-request-conversation-turn-local-test",
    external_api_used: false
  } : gatewayUnavailable ? {
    allowed: false,
    outcome: "gateway_unavailable",
    reason_code: "local_gateway_unavailable",
    policy_request_id: "policy-request-conversation-turn-local-test",
    external_api_used: false
  } : {
    allowed: true,
    outcome: "executed",
    reason_code: null,
    policy_request_id: "policy-request-conversation-turn-local-test",
    external_api_used: false
  };

  if (gatewayUnavailable) {
    return {
      status: "unavailable",
      reason_code: "local_gateway_unavailable",
      answer_mode: "unavailable",
      answer_fragments: [],
      citations: [],
      graph_links: [],
      safety_notice: "Draft answer for selected source context only; not medical advice.",
      gateway_decision: gatewayDecision,
      evidence_ids: [],
      raw_output_included: false,
      persistence: { stored: false, transcript_persisted: false },
      model_routing: "none-local-deterministic-search-only"
    };
  }

  if (isAdviceLike || !hasSourceSpanContext) {
    return {
      status: "refused",
      reason_code: isAdviceLike ? "unsupported_advice_like_prompt" : "missing_validated_source_span_context",
      answer_mode: "refusal",
      answer_fragments: [],
      citations: [],
      graph_links: [],
      safety_notice: "Draft answer for selected source context only; not medical advice.",
      gateway_decision: gatewayDecision,
      evidence_ids: [],
      raw_output_included: false,
      persistence: { stored: false, transcript_persisted: false },
      model_routing: "none-local-deterministic-search-only"
    };
  }

  return {
    status: "draft",
    reason_code: null,
    answer_mode: "selected_context_cited_draft",
    answer_fragments: [{
      fragment_id: "fragment.local-test.1",
      text: "The selected source context says: Local deterministic parsed excerpt for search coverage.",
      source_span_ids: [sourceSpanSearchResult.span_id],
      unsupported: false
    }],
    citations: [{
      source_span_id: sourceSpanSearchResult.span_id,
      source_document_id: sourceSpanSearchResult.document_id,
      stable_locator: sourceSpanSearchResult.stable_locator,
      display_label: "Page 1 · Span 1",
      quoted_span: "Local deterministic parsed excerpt for search coverage.",
      excerpt_digest: "sha256:local-test-excerpt-digest",
      answer_fragment_ids: ["fragment.local-test.1"]
    }],
    graph_links: [{
      resource_id: request.resource_id,
      selected_node_id: request.selected_node_id,
      source_span_id: sourceSpanSearchResult.span_id,
      highlight_node_ids: [`resource.${breastResourceId}`]
    }],
    safety_notice: "Draft answer for selected source context only; not medical advice.",
    gateway_decision: gatewayDecision,
    evidence_ids: ["evidence.conversation.source-span.local-test"],
    raw_output_included: false,
    persistence: { stored: false, transcript_persisted: false },
    model_routing: "none-local-deterministic-search-only"
  };
}

function buildUnsafeConversationTurnFixture(question: string, request: { selected_node_id?: string; resource_id?: string }) {
  const baseGatewayDecision = {
    allowed: true,
    outcome: "executed",
    reason_code: null,
    policy_request_id: "policy-request-conversation-turn-local-test",
    external_api_used: false
  };
  const basePayload = {
    status: "draft",
    reason_code: null,
    answer_mode: "selected_context_cited_draft",
    answer_fragments: [{
      fragment_id: "fragment.local-test.1",
      text: "The selected source context says: Local deterministic parsed excerpt for search coverage.",
      source_span_ids: [sourceSpanSearchResult.span_id],
      unsupported: false
    }],
    citations: [{
      source_span_id: sourceSpanSearchResult.span_id,
      source_document_id: sourceSpanSearchResult.document_id,
      stable_locator: sourceSpanSearchResult.stable_locator,
      display_label: "Page 1 · Span 1",
      quoted_span: "Local deterministic parsed excerpt for search coverage.",
      excerpt_digest: "sha256:local-test-excerpt-digest",
      answer_fragment_ids: ["fragment.local-test.1"]
    }],
    graph_links: [{
      resource_id: request.resource_id,
      selected_node_id: request.selected_node_id,
      source_span_id: sourceSpanSearchResult.span_id,
      highlight_node_ids: [`resource.${breastResourceId}`]
    }],
    safety_notice: "Draft answer for selected source context only; not medical advice.",
    gateway_decision: baseGatewayDecision,
    evidence_ids: ["evidence.conversation.source-span.local-test"],
    raw_output_included: false,
    persistence: { stored: false, transcript_persisted: false },
    model_routing: "none-local-deterministic-search-only"
  };
  if (/uncited response fixture/i.test(question)) {
    return { ...basePayload, citations: [] };
  }
  if (/raw output fixture/i.test(question)) {
    return { ...basePayload, raw_output_included: true, raw_model_output: "unsafe raw output", answer_text: "uncited answer text" };
  }
  if (/external routing fixture/i.test(question)) {
    return { ...basePayload, gateway_decision: { ...baseGatewayDecision, external_api_used: true } };
  }
  if (/persisted transcript fixture/i.test(question)) {
    return { ...basePayload, persistence: { stored: true, transcript_persisted: true } };
  }
  return null;
}

function buildExplainSelectionPayload(request: { source_span_id?: string; selected_node_id?: string; resource_id?: string }) {
  const hasSourceSpanContext = request.source_span_id === sourceSpanSearchResult.span_id;
  const selectedNodeId = request.selected_node_id ?? (request.resource_id ? `resource.${request.resource_id}` : sourceSpanSearchResult.span_id);
  const resourceId = request.resource_id ?? (hasSourceSpanContext ? sourceSpanSearchResult.resource_id : breastResourceId);
  const selectedNodeType = hasSourceSpanContext ? "source_span" : "resource";
  const gatewayDecision = hasSourceSpanContext ? {
    allowed: true,
    outcome: "executed",
    reason_code: null,
    policy_request_id: "policy-request-explain-selection-local-test",
    external_api_used: false
  } : {
    allowed: false,
    outcome: "blocked_before_gateway",
    reason_code: "missing_validated_source_span_context",
    policy_request_id: "policy-request-explain-selection-local-test",
    external_api_used: false
  };
  const sourceIdsUsed = hasSourceSpanContext ? [{
    source_span_id: sourceSpanSearchResult.span_id,
    selected_node_id: selectedNodeId,
    resource_id: resourceId,
    source_document_id: sourceSpanSearchResult.document_id,
    stable_locator: sourceSpanSearchResult.stable_locator,
    status: "used",
    evidence_id: "evidence.explain.source-span.local-test"
  }] : [];
  const sourceIdsRejected = hasSourceSpanContext ? [] : [{
    selected_node_id: selectedNodeId,
    resource_id: resourceId,
    status: "rejected",
    reason: "missing_validated_source_span_context",
    evidence_id: `evidence.blocked.${resourceId}`
  }];
  const citationVerifierStatus = hasSourceSpanContext ? "pass" : "not_run";
  const runnerStatus = hasSourceSpanContext ? "dry_run_completed" : "not_invoked";
  const sourceSpanIds = hasSourceSpanContext ? [sourceSpanSearchResult.span_id] : [];

  return {
    command_label: "explain-selection",
    selected_node_id: selectedNodeId,
    selected_node_type: selectedNodeType,
    resource_id: resourceId,
    source_span_ids: sourceSpanIds,
    context_digest: hasSourceSpanContext ? "sha256:context-source-span-local-test" : "sha256:context-blocked-metadata-only",
    output_digest: hasSourceSpanContext ? "sha256:output-source-span-local-test" : "sha256:output-blocked-metadata-only",
    gateway_decision: gatewayDecision,
    model_class: "local_open_weight_7b",
    model_trace: {
      model_class: "local_open_weight_7b",
      provider_kind: "local",
      trace_status: hasSourceSpanContext ? "abstained" : "blocked",
      runner_status: runnerStatus,
      policy_request_id: "policy-request-explain-selection-local-test",
      gateway_outcome: gatewayDecision.outcome,
      gateway_reason_code: gatewayDecision.reason_code,
      citation_verifier_status: citationVerifierStatus,
      abstention_status: hasSourceSpanContext ? "abstained_no_answer_text" : "abstained_no_model_execution",
      input_digest: hasSourceSpanContext ? "sha256:context-source-span-local-test" : "sha256:context-blocked-metadata-only",
      output_digest: hasSourceSpanContext ? "sha256:output-source-span-local-test" : "sha256:output-blocked-metadata-only",
      source_span_ids: sourceSpanIds,
      output_tokens: 0,
      gpu_seconds: 0,
      raw_output_included: false
    },
    runner_status: runnerStatus,
    raw_output_included: false,
    cost_ledger_entry: hasSourceSpanContext ? { external_api_used: false } : null,
    source_ids_used: sourceIdsUsed,
    source_ids_rejected: sourceIdsRejected,
    warnings: hasSourceSpanContext ? [] : ["missing_validated_source_span_context", "no_generated_claim"],
    evidence_ids: [...sourceIdsUsed, ...sourceIdsRejected].map((record) => record.evidence_id),
    no_claim: true,
    model_routing: "none-local-deterministic-search-only"
  };
}

function buildSearchPayload(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const adviceLike = isAdviceLikeQuery(normalizedQuery);
  const metadataResults = resourcesPayload.resources
    .filter((resource) => (
      Boolean(normalizedQuery) && !adviceLike && `${resource.title} ${resource.resource_id} ${resource.disease_site} ${resource.document_type} ${resource.resource_type}`.toLowerCase().includes(normalizedQuery)
    ))
    .map((resource) => ({ ...resource, ...graphFocusMetadata(resource.resource_id, [], graphCoverageStatus(resource)) }));
  const sourceSpanResults = normalizedQuery.includes("deterministic parsed excerpt") && !adviceLike ? [{
    ...sourceSpanSearchResult,
    ...graphFocusMetadata(breastResourceId, [sourceSpanSearchResult.span_id], "source_span_ready"),
    focus_resource: {
      ...resourcesPayload.resources[0],
      ...graphFocusMetadata(breastResourceId, [sourceSpanSearchResult.span_id], "source_span_ready")
    }
  }] : [];
  const warningLabels = adviceLike
    ? ["abstain_advice_like_prompt", "no_generated_claim"]
    : normalizedQuery && metadataResults.length === 0 && sourceSpanResults.length === 0
      ? ["no_retrieval_results", "no_generated_claim"]
      : [];

  return {
    query,
    metadata_results: normalizedQuery ? metadataResults : [],
    source_span_results: sourceSpanResults,
    metadata_result_count: normalizedQuery ? metadataResults.length : 0,
    source_span_result_count: sourceSpanResults.length,
    source_span_coverage_count: 5,
    source_span_coverage_note: "Search checks metadata for all 198 resources and parsed source-span excerpts only for the five-row parsed subset when derived outputs are present.",
    total_resource_count: 198,
    model_routing: "none-local-deterministic-search-only",
    warning_labels: warningLabels,
    abstained: adviceLike || (Boolean(normalizedQuery) && metadataResults.length === 0 && sourceSpanResults.length === 0),
    no_claim: true
  };
}

function buildWorkbenchTracePayload(query: string) {
  const searchPayload = buildSearchPayload(query);
  const normalizedQuery = query.trim().toLowerCase();
  const sourceIdsUsed = searchPayload.source_span_results.map((span) => ({
    source_span_id: span.span_id,
    resource_id: span.resource_id,
    source_document_id: span.document_id,
    stable_locator: span.stable_locator,
    status: "used",
    evidence_id: span.span_id
  }));
  const sourceIdsRejected = searchPayload.metadata_results.map((resource) => ({
    resource_id: resource.resource_id,
    status: "rejected",
    reason: "no_validated_source_span_context",
    evidence_id: resource.resource_id
  }));
  const blockReason = isAdviceLikeQuery(normalizedQuery)
    ? "unsupported_advice_like_prompt"
    : sourceIdsUsed.length === 0
      ? "missing_validated_source_span_context"
      : null;
  const warnings = [...searchPayload.warning_labels];
  if (blockReason && !warnings.includes(blockReason)) {
    warnings.push(blockReason);
  }
  const gatewayDecision = blockReason ? {
    allowed: false,
    outcome: "blocked_before_gateway",
    reason_code: blockReason,
    policy_request_id: "policy-request-local-test",
    external_api_used: false
  } : {
    allowed: true,
    outcome: "executed",
    reason_code: null,
    policy_request_id: "policy-request-local-test",
    external_api_used: false
  };
  const citationVerifierStatus = blockReason ? "not_run" : "pass";
  const abstentionStatus = blockReason ? "abstained_no_model_execution" : "abstained_no_answer_text";

  return {
    command_label: "run-evals:corpus-workbench-trace",
    query,
    retrieval_steps: [
      { step_id: "command", status: "received", command_label: "run-evals:corpus-workbench-trace" },
      {
        step_id: "retrieval",
        status: "completed",
        metadata_result_count: searchPayload.metadata_result_count,
        source_span_result_count: searchPayload.source_span_result_count,
        warning_labels: warnings,
        abstained: searchPayload.abstained
      },
      {
        step_id: "source_selection",
        status: sourceIdsUsed.length > 0 ? "completed" : "blocked",
        source_span_ids_used: sourceIdsUsed.map((record) => record.source_span_id),
        rejected_count: sourceIdsRejected.length
      },
      {
        step_id: "model_gateway",
        status: gatewayDecision.outcome,
        model_class: "local_open_weight_7b",
        external_api_used: false
      }
    ],
    source_ids_used: sourceIdsUsed,
    source_ids_rejected: sourceIdsRejected,
    gateway_decision: gatewayDecision,
    model_class: "local_open_weight_7b",
    model_trace: {
      model_class: "local_open_weight_7b",
      provider_kind: "local",
      trace_status: blockReason ? "blocked" : "abstained",
      runner_status: blockReason ? "not_invoked" : "dry_run_completed",
      policy_request_id: "policy-request-local-test",
      citation_verifier_status: citationVerifierStatus,
      abstention_status: abstentionStatus,
      source_span_ids: sourceIdsUsed.map((record) => record.source_span_id),
      output_tokens: 0,
      gpu_seconds: 0
    },
    cost_ledger_entry: blockReason ? null : { external_api_used: false },
    citation_verifier_status: citationVerifierStatus,
    warnings,
    abstained: true,
    abstention_status: abstentionStatus,
    evidence_ids: [...sourceIdsUsed, ...sourceIdsRejected].map((record) => record.evidence_id),
    no_claim: true,
    model_routing: "none-local-deterministic-search-only"
  };
}

function isAdviceLikeQuery(query: string) {
  return /\b(should|choose|treatment|dosing|diagnosis|recommend)\b/i.test(query);
}

function buildInterpretabilityPayload(
  resourceId: string,
  interpretabilitySourceSpans: Array<typeof sourceSpanSearchResult> = [],
  reviewQueueItems?: ReviewQueuePayloadItem[]
) {
  const resource = resourcesPayload.resources.find((item) => item.resource_id === resourceId) ?? resourcesPayload.resources[0];
  const sourceSpans = resource.resource_id === breastResourceId ? interpretabilitySourceSpans : [];
  const coverageStatus = sourceSpans.length > 0 ? "source_span_ready" : graphCoverageStatus(resource);
  const focus = graphFocusMetadata(resource.resource_id, sourceSpans.map((span) => span.span_id), coverageStatus);
  const queueItems = reviewQueueItems ?? (sourceSpans.length > 0 ? [buildReviewQueueItem({ source_span_ids: sourceSpans.map((span) => span.span_id) })] : []);

  return {
    resource: { ...resource, ...focus },
    graph_neighborhood: {
      focus_node_id: `resource.${resource.resource_id}`,
      resource_node_id: `resource.${resource.resource_id}`,
      neighbor_node_ids: focus.neighbor_node_ids,
      edge_types: focus.edge_types,
      neighbor_nodes: graphPayload.nodes.filter((node) => focus.neighbor_node_ids.includes(node.id)),
      edges: graphPayload.edges.filter((edge) => edge.source === `resource.${resource.resource_id}` || edge.target === `resource.${resource.resource_id}`)
    },
    source_spans: sourceSpans,
    surveillance_status: buildSurveillanceStatus(resource.resource_id),
    review_queue_items: queueItems,
    review_task_ids: queueItems.map((item) => item.review_task_id),
    review_queue_contract: {
      source_of_truth: "source-span-backed local review queue",
      invalid_unbacked_items: "excluded"
    },
    coverage_status: coverageStatus,
    coverage_status_vocabulary: ["source_span_ready", "partial_source_span", "metadata_only", "download_failed", "checksum_mismatch", "parse_failed"],
    model_routing: "none-local-deterministic-search-only"
  };
}

function buildReviewQueueItem(overrides: Partial<ReviewQueuePayloadItem> = {}): ReviewQueuePayloadItem {
  return {
    review_task_id: "review.local-test",
    resource_id: breastResourceId,
    source_span_ids: [reviewQueueFocusSpan.span_id],
    review_status: "draft",
    staleness_status: "local_current",
    allowed_actions: ["inspect_source", "mark_needs_review_local", "link_source_local"],
    ...overrides
  };
}

function buildSurveillanceStatus(resourceId: string) {
  return {
    mode: "local_manifest_status_only",
    status: "offline_local_archive_comparison",
    review_status: "needs_review",
    resource_count: 2,
    changed_count: 1,
    missing_count: 1,
    unchanged_count: 1,
    needs_review_count: 1,
    summary_counts: { checksum_mismatch: 1, missing: 1, unchanged: 1 },
    resource_statuses: {
      [breastResourceId]: {
        resource_id: breastResourceId,
        status: "needs_review",
        change_state: resourceId === breastResourceId ? "checksum_mismatch" : "unchanged",
        review_status: resourceId === breastResourceId ? "needs_review" : "no_change",
        previous_status: "downloaded",
        current_status: "downloaded",
        previous_checksum_sha256: "1".repeat(64),
        current_checksum_sha256: resourceId === breastResourceId ? "2".repeat(64) : "1".repeat(64)
      },
      [brainResourceId]: {
        resource_id: brainResourceId,
        status: "no_change",
        change_state: resourceId === brainResourceId ? "missing" : "unchanged",
        review_status: resourceId === brainResourceId ? "needs_review" : "no_change",
        previous_status: "downloaded",
        current_status: resourceId === brainResourceId ? "failed" : "downloaded",
        previous_checksum_sha256: "3".repeat(64),
        current_checksum_sha256: resourceId === brainResourceId ? undefined : "3".repeat(64)
      }
    }
  };
}

function graphFocusMetadata(resourceId: string, sourceSpanIds: string[] = [], coverageStatus = "metadata_only") {
  const resource = resourcesPayload.resources.find((item) => item.resource_id === resourceId) ?? resourcesPayload.resources[0];
  const diseaseSiteNodeId = `disease-site.${resource.disease_site}`;
  const edgeTypes = ["resource_to_disease_site", "resource_to_document_type", "resource_to_archive_status"];
  if (sourceSpanIds.length > 0) {
    edgeTypes.push("resource_to_source_span", "source_span_to_review_item");
  }

  return {
    focus_node_id: `resource.${resourceId}`,
    resource_node_id: `resource.${resourceId}`,
    neighbor_node_ids: [diseaseSiteNodeId, "document-type.guideline", "archive-status.metadata-only.not-parsed"],
    edge_types: edgeTypes,
    source_span_ids: sourceSpanIds,
    review_task_ids: sourceSpanIds.length > 0 ? ["review.local-test"] : [],
    coverage_status: coverageStatus,
    interpretability_summary: {
      mode: "deterministic-local-search",
      coverage_status: coverageStatus,
      source_span_count: sourceSpanIds.length,
      graph_neighbor_count: 3 + sourceSpanIds.length,
      model_routing: "none-local-deterministic-search-only"
    }
  };
}

function graphCoverageStatus(resource: (typeof resourcesPayload.resources)[number]) {
  if (resource.response_state === "download_failed") {
    return "download_failed";
  }
  if (resource.parse_status === "checksum_mismatch") {
    return "checksum_mismatch";
  }
  if (resource.response_state === "parse_failed") {
    return "parse_failed";
  }
  return "metadata_only";
}
