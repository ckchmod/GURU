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
    expect(screen.getByTestId("trust-provenance-drawer")).not.toHaveTextContent(/impact diff|recommendation impact|live surveillance/i);
    expect(screen.getByTestId("compact-inspector-summary")).not.toHaveTextContent(breastResourceId);
    expect(screen.getByTestId("resource-identifier-details")).not.toHaveAttribute("open");
    expect(screen.getByTestId("source-span-details")).not.toHaveAttribute("open");
    expect(screen.getByText("No clinical advice")).toBeVisible();
    expect(document.querySelector(".ide-window-controls")).toBeNull();
    expect(document.querySelector(".sigma-interaction-cue")).toBeNull();
    expect(document.body).not.toHaveTextContent(/Hover|Click to inspect|Drag to pin|detail labels visible|map labels sparse|Zoom detail|Graph filter toggles|⌘K Evidence Atlas/);
    expect(screen.getByTestId("atlas-workbench")).toHaveTextContent("Retrieval query");
    expect(screen.getByTestId("atlas-workbench")).toHaveTextContent("Selected resource context");
    expect(screen.getByTestId("atlas-workbench")).toHaveTextContent("Graph focus / trust path");
    expect(screen.getByTestId("atlas-workbench")).toHaveTextContent("Graph-RAG retrieval trace");
    expect(screen.getByTestId("atlas-workbench")).toHaveTextContent("Generated answers disabled");
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
    expect(screen.getByRole("contentinfo", { name: "Corpus search workbench" })).toHaveTextContent("Generated answers disabled until retrieval/source-span verification is implemented.");
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
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("metadata_only");
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("Metadata-only coverage: source spans are unavailable/not parsed");
    expect(screen.getByTestId("lookup-relationship-trace")).toHaveTextContent("resource");
    expect(screen.getByTestId("lookup-relationship-trace")).toHaveTextContent("disease site");
    expect(screen.getByTestId("lookup-relationship-trace")).toHaveTextContent("document type");
    expect(screen.getByTestId("lookup-relationship-trace")).toHaveTextContent("archive");
    expect(workbench).toHaveTextContent("none-local-deterministic-search-only");
    expect(workbench).toHaveTextContent("Generated answers disabled until retrieval/source-span verification is implemented.");
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

    expect(await within(workbench).findByText("Source-span retrieval")).toBeVisible();
    expect(workbench).toHaveTextContent("page:1;span:1");
    expect(workbench).toHaveTextContent("Local deterministic parsed excerpt for search coverage.");
    expect(workbench).toHaveTextContent("source status: draft");
    expect(workbench).toHaveTextContent("parse status: not-parsed");
    expect(workbench).toHaveTextContent("Adjuvant Radiotherapy for Invasive Breast Cancer");
    fireEvent.click(within(workbench).getByRole("button", { name: /Local deterministic parsed excerpt/i }));

    await waitFor(() => expect(screen.getByTestId("node-inspector")).toHaveTextContent(breastResourceId));
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("page:1;span:1");
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent(`${"0".repeat(64)} · draft`);
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("Parent resource");
    expect(screen.getByTestId("lookup-relationship-trace")).toHaveTextContent("source span");
    expect(screen.getByTestId("lookup-relationship-trace")).toHaveTextContent("review item");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-focus-mode", "source-span-parent-fallback");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-highlighted-source-span-ids", "source-span.local-test");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-represented-source-span-node-ids", "none");
    expect(screen.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-graph-focus-node-id", `resource.${breastResourceId}`);
    expect(screen.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-focus-mode", "source-span-parent-fallback");
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

    await waitFor(() => expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("page:1;span:1"));
    expect(workbench).toHaveTextContent("Retrieval terminal state");
    expect(workbench).toHaveTextContent(`Highlighted resources: ${breastResourceId}`);
    expect(workbench).toHaveTextContent("Highlighted source spans: source-span.local-test");
    expect(workbench).toHaveTextContent(`Selected graph path: resource.${breastResourceId} -> source-span.local-test -> review.local-test`);
    expect(workbench).toHaveTextContent(`Path/context IDs: resource.${breastResourceId}, disease-site.breast, document-type.guideline, archive-status.metadata-only.not-parsed`);
    expect(workbench).toHaveTextContent("source-span-parent-fallback");
    expect(workbench).toHaveTextContent("Retrieval trace entries: metadata result, source-span result, provenance drawer focus");
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("Source document ID: source-document.local-test");
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("Prompt/model version: none-local-deterministic-parser");
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("Reviewer: unreviewed · draft · 2026-06-15T12:00:00Z");
    expect(screen.getByTestId("trust-provenance-drawer")).not.toHaveTextContent(/generated answer|clinical answer|recommendation text|treatment advice|dosing|diagnosis/i);
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
    expect(traceTerminal).toHaveTextContent("source-span.local-test");
    expect(traceTerminal).toHaveTextContent("Generated answers disabled until retrieval/source-span verification is implemented.");
    expect(traceTerminal).not.toHaveTextContent(/clinical answer|recommendation text|treatment advice|dosing|diagnosis|assistant response|chat transcript/i);
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
    expect(screen.getByTestId("retrieval-terminal-state")).toHaveTextContent("Generated answers are disabled");
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

    await waitFor(() => expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("metadata_only"));
    expect(workbench).toHaveTextContent("Retrieval terminal state");
    expect(workbench).toHaveTextContent(`Highlighted resources: ${breastResourceId}`);
    expect(workbench).toHaveTextContent("Selected source-span context: metadata-only / blocked");
    expect(workbench).toHaveTextContent("Blocked evidence label: metadata-only, no source span returned");
    expect(workbench).toHaveTextContent("Retrieval trace entries: metadata result, blocked source-span context, provenance drawer focus");
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("metadata-only blocked: no clinical claim rendered");
    expect(screen.getByTestId("trust-provenance-drawer")).not.toHaveTextContent(/evidence conclusion|generated answer|clinical summary|recommended regimen|patient-specific/i);
  });

  it("renders source-backed review queue cards with local-only actions and focus behavior", async () => {
    const fetchSpy = mockCorpusFetch({ interpretabilitySourceSpans: [reviewQueueFocusSpan] });

    render(<GuidelineGraphCanvas />);

    await waitFor(() => expect(screen.getByTestId("review-queue-section")).toHaveTextContent("page:2;span:4"));
    const reviewQueue = screen.getByTestId("review-queue-section");
    expect(reviewQueue).toHaveTextContent("Review Queue");
    expect(reviewQueue).toHaveTextContent("Source-span-backed local review metadata");
    expect(reviewQueue).toHaveTextContent("Adjuvant Radiotherapy for Invasive Breast Cancer");
    expect(reviewQueue).toHaveTextContent("page:2;span:4");
    expect(reviewQueue).toHaveTextContent(`${"4".repeat(64)} · draft`);
    expect(reviewQueue).toHaveTextContent("draft · local_current");
    expect(reviewQueue).toHaveTextContent("Backing source spans");
    expect(reviewQueue).toHaveTextContent("Allowed local actions");
    expect(within(reviewQueue).getByRole("button", { name: "Inspect source" })).toBeVisible();
    expect(within(reviewQueue).getByRole("button", { name: "Mark needs review (local)" })).toBeVisible();
    expect(within(reviewQueue).getByRole("button", { name: "Link source (local)" })).toBeVisible();

    fireEvent.click(within(reviewQueue).getByRole("button", { name: /Focus review queue item review\.local-test/i }));
    expect(screen.getByTestId("trust-provenance-drawer")).toHaveTextContent("page:2;span:4");
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
    expect(screen.getAllByText(/Generated answers disabled until retrieval\/source-span verification is implemented/).length).toBeGreaterThan(0);
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

  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
    const url = input.toString();
    const parsedUrl = new URL(url, "http://localhost");
    const payload = parsedUrl.pathname === "/api/knowledgebase/corpus/search"
      ? buildSearchPayload(parsedUrl.searchParams.get("q") ?? "")
      : parsedUrl.pathname === "/api/knowledgebase/corpus/workbench/trace"
        ? buildWorkbenchTracePayload(parsedUrl.searchParams.get("q") ?? "")
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
