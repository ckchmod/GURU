import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const breastResourceId = "ahs-guru-breast-br005-adjuvant-rt-invasive-breast";
const brainResourceId = "ahs-guru-central-nervous-system-cns014-management-of-brain-metastases";
const responseStateVocabulary = {
  metadata_only: "Registry metadata exists, but no local parsed artifact is exposed.",
  downloaded_unparsed: "A local raw archive state is recorded, but parser output is not available.",
  parsed: "A parsed or partial-text parser artifact is available for the bounded subset.",
  download_failed: "Download or expected raw-file availability failed before parsing.",
  parse_failed: "Parser execution failed or produced no usable technical extraction."
};

const atlasSmoothnessThresholds = {
  settleMs: 3000,
  maxFrameGapMs: 250,
  p95RafIntervalMs: 50,
  consoleErrorCount: 0,
  consoleWarningCount: 0
};
const activeInteractionRafSampleMs = 3500;

type InteractionSuccessFlags = {
  pan: boolean;
  zoom: boolean;
  drag: boolean;
  searchFocus: boolean;
  resize: boolean;
};

type ConsoleCaptureEntry = {
  type: "error" | "warning";
  text: string;
  location: { url: string; lineNumber: number; columnNumber: number };
  ignoredKnownNoise: boolean;
};

type RafIntervalMetrics = {
  maxFrameGapMs: number;
  p95RafIntervalMs: number;
  rafSampleCount: number;
  rafDurationMs: number;
};

type RafIntervalCapture = RafIntervalMetrics & {
  intervals: number[];
};

type InteractionRafMetrics = RafIntervalMetrics & {
  interaction: keyof InteractionSuccessFlags;
};

type SettledMarkerObservation = {
  present: boolean;
  settled: boolean;
  layoutMetricsPresent: boolean;
  layoutMetricAttributes: {
    iterations: string | null;
    overlapCount: string | null;
    seed: string | null;
  };
  settleMs: number;
};

type AtlasSmoothnessEvidence = RafIntervalMetrics & {
  task: string;
  apiMode: string;
  thresholds: typeof atlasSmoothnessThresholds;
  settledMarkerAttribute: string;
  layoutMetricsRequired: string[];
  nodeCount: number;
  edgeCount: number;
  settleMs: number;
  settled: boolean;
  settledMarkerPresent: boolean;
  layoutMetricsPresent: boolean;
  layoutMetricAttributes?: SettledMarkerObservation["layoutMetricAttributes"];
  consoleErrorCount: number;
  consoleWarningCount: number;
  ignoredKnownConsoleNoiseCount?: number;
  interactionSuccess: InteractionSuccessFlags;
  interactionRafMetrics?: InteractionRafMetrics[];
  resourceNodeCount?: number;
  sourceSpanNodeCount?: number;
  corpusScaleNote?: string;
};

type SafetyNegativeEvidence = {
  task: string;
  query: string;
  visibleState: {
    terminalText: string;
    workbenchText: string;
    graphFocusMode: string | null;
    blockedReason: string | null;
    selectedQuery: string | null;
    highlightedResourceIds: string | null;
    highlightedSourceSpanIds: string | null;
  };
  forbiddenStringCheck: Record<string, boolean>;
  consoleCounts: { errors: number; warnings: number };
  pass: boolean;
};

const forbiddenGeneratedAnswerStrings = [
  "generated answer",
  "clinical answer",
  "treatment advice",
  "dosing",
  "diagnosis",
  "external LLM",
  "chat transcript",
  "assistant response"
];

const forbiddenExplainSelectionFields = [
  "answer_text",
  "output_text",
  "generated_answer",
  "generatedAnswer",
  "raw_model_output",
  "chat transcript",
  "assistant response",
  "recommendation text",
  "treatment advice",
  "dosing",
  "diagnosis"
];

type CorpusGraphScalePayload = {
  nodes: unknown[];
  edges: unknown[];
  metadata: {
    resource_node_count: number;
    source_span_node_count: number;
  };
};

test("Sigma graph canvas load, search, selection, and API-backed corpus states work without console findings", async ({ page }) => {
  const consoleFindings: string[] = [];
  const mutationRequests: string[] = [];
  const traceRequests: string[] = [];
  const explainSelectionRequests: string[] = [];
  const performanceEvidence: Record<string, number | string | boolean> = {
    graphReadyThresholdMs: 10000,
    searchVisibleThresholdMs: 2500,
    mockedCorpusApi: true
  };
  await installStorageSetItemSpy(page);
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      if (isKnownBrowserConsoleNoise(message.text())) {
        return;
      }
      consoleFindings.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/api/knowledgebase/corpus/workbench/explain-selection")) {
      explainSelectionRequests.push(`${request.method()} ${request.url()}`);
      return;
    }
    if (request.url().includes("/api/knowledgebase/corpus/workbench/trace")) {
      traceRequests.push(`${request.method()} ${request.url()}`);
    }
    if (request.method() !== "GET" && request.url().includes("/api/knowledgebase/corpus")) {
      mutationRequests.push(`${request.method()} ${request.url()}`);
    }
  });
  const corpusApiMock = await mockCorpusApi(page);

  const graphStart = performance.now();
  await page.goto("/");

  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.locator(".ide-window-controls")).toHaveCount(0);
  await expect(page.getByTestId("guideline-graph-canvas")).toBeVisible();
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-node-count", "6");
  performanceEvidence.graphReadyMs = Math.round(performance.now() - graphStart);
  expect(performanceEvidence.graphReadyMs as number).toBeLessThanOrEqual(performanceEvidence.graphReadyThresholdMs as number);
  await expect(page.getByTestId("sigma-corpus-graph").locator("canvas").first()).toBeVisible();
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-layout-mode", "deterministic-force-atlas");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-layout-settled", "true");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-layout-iterations", "120");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-layout-overlap-count", "0");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-layout-seed", "atlas-force-layout-task-4-v1");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-label-mode", "sparse-focus");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-interaction-mode", "hover-click-drag");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-drag-policy", "sigma-node-drag-session-pin-release-reset");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-pin-policy", "frontend-session-only-no-backend-mutation");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-document-layout-policy", "force-layout-type-encoded-labels");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-visual-theme", "dark-evidence-vault");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-node-encoding-policy", "color-ring-shape-label-chip");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-dragging-node", "none");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-pinned-node-count", "0");
  await expect(page.getByRole("button", { name: "Release focus pin" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Reset session pins" })).toBeDisabled();
  await expect(page.getByLabel("Sigma atlas visual policy")).toContainText("ForceAtlas layout");
  await expect(page.getByLabel("Sigma atlas visual policy")).toContainText("smooth Sigma camera focus");
  await expect(page.getByLabel("Sigma atlas visual policy")).toContainText("frontend-only session pinning");
  await expect(page.getByLabel("Graph corpus context")).toContainText("Resources");
  await expect(page.getByLabel("Graph corpus context")).toContainText("Source-span nodes");
  await expect(page.getByLabel("Graph corpus context")).toContainText("Selected");
  await expect(page.getByTestId("sigma-camera-node-layer")).toBeVisible();
  await expect(page.locator(`[data-node-id="resource.${breastResourceId}"]`)).toHaveAttribute("data-node-kind", "resource");
  await expect(page.locator(`[data-node-id="resource.${breastResourceId}"]`)).toHaveAttribute("data-node-status", "Registry metadata");
  await expect(page.locator('[data-node-id="document-type.guideline"]')).toHaveAttribute("data-node-group", "documents");
  await expect(page.locator('[data-node-id="archive-status.metadata-only.not-parsed"]')).toHaveAttribute("data-node-kind", "archive");
  await expectDocumentNodesIntegrated(page);
  await expectNodeDragPinsAndResetsSessionPosition(page, "document-type.guideline", "guideline", { reload: true, writeEvidence: true });
  await expectWheelZoomChangesNodeViewportRect(page, `resource.${breastResourceId}`);
  await expectEmptySpacePanChangesNodeViewportRect(page, `resource.${breastResourceId}`);
  await expectNoOvalGraphBoundary(page);
  await expectRestrainedSigmaAesthetic(page);
  await expect(page.getByLabel("Current workspace path")).toContainText("public-corpus-atlas.graph");
  await expect(page.getByRole("navigation", { name: "Knowledgebase resources" })).toBeVisible();
  await expect(page.getByTestId("source-document-panel")).toContainText("5 parsed-subset coverage");
  await expect(page.getByTestId("source-document-panel")).toContainText("No source-span records are available");
  await expect(page.getByTestId("atlas-workbench")).toContainText("198 public resources");
  await expect(page.getByTestId("atlas-workbench")).toContainText("Retrieval query");
  await expect(page.getByTestId("atlas-workbench")).toContainText("Selected resource context");
  await expect(page.getByTestId("atlas-workbench")).toContainText("Graph focus / trust path");
  await expect(page.getByTestId("atlas-workbench")).toContainText("Graph-RAG retrieval trace");
  await expect(page.getByTestId("atlas-workbench")).toContainText("Generated answers disabled until retrieval/source-span verification is implemented.");
  await expect(page.getByTestId("compact-inspector-summary")).toBeVisible();
  await expect(page.getByTestId("compact-inspector-summary")).toContainText("Source availability");
  await expect(page.getByText("changed local archive").first()).toBeVisible();
  await expect(page.getByTestId("trust-provenance-drawer")).toContainText("Offline/local manifest comparison only");
  await expect(page.getByTestId("trust-provenance-drawer")).toContainText("needs review 1");
  await expect(page.getByTestId("trust-provenance-drawer")).not.toContainText(/impact diff|recommendation impact|live surveillance/i);
  await expect(page.getByTestId("compact-inspector-summary")).not.toContainText(breastResourceId);
  await expect(page.getByTestId("resource-identifier-details")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Guideline graph workbench" })).toHaveCount(0);
  await expect(page.locator(".sigma-interaction-cue")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/Hover|Click to inspect|Drag to pin|detail labels visible|map labels sparse|Zoom detail|Graph filter toggles|⌘K Evidence Atlas/);

  const canvas = page.getByTestId("guideline-graph-canvas");
  await canvas.hover();
  await page.mouse.wheel(0, -240);
  await page.mouse.down();
  await page.mouse.move(520, 360);
  await page.mouse.up();

  await page.getByRole("navigation", { name: "Knowledgebase resources" }).getByRole("button", { name: /Adjuvant Radiotherapy/i }).click();
  await expect(page.getByTestId("node-inspector")).toContainText(breastResourceId);
  await expect(page.getByTestId("node-inspector")).toContainText("No source-span result for this resource");
  await page.getByTestId("guideline-graph-canvas").screenshot({ path: "../../.omo/evidence/task-7-graph-aesthetic.png" });
  await page.getByTestId("node-inspector").screenshot({ path: "../../.omo/evidence/task-10-compact-inspector.png" });
  await page.getByTestId("resource-identifier-details").click();
  await expect(page.getByTestId("resource-identifier-details")).toContainText(breastResourceId);

  await page.getByRole("navigation", { name: "Knowledgebase resources" }).getByRole("button", { name: /Brain Metastases/i }).click();
  await expect(page.getByTestId("node-inspector")).toContainText(brainResourceId);

  await page.getByRole("searchbox", { name: "Search public corpus graph nodes" }).fill("Adjuvant Radiotherapy for Invasive Breast Cancer");
  await expect(page.locator(".sigma-search-results button")).toContainText("Adjuvant Radiotherapy for Invasive Breast Cancer");
  await expectCompactTextStyle(page, ".sigma-search-results span");
  await page.getByRole("searchbox", { name: "Search public corpus graph nodes" }).press("Enter");
  await expect(page.getByTestId("node-inspector")).toContainText(breastResourceId);
  await expect(page.getByTestId("node-inspector")).toContainText("Adjuvant Radiotherapy for Invasive Breast Cancer");
  await expect(page.getByTestId("source-document-panel")).toContainText("Adjuvant Radiotherapy for Invasive Breast Cancer");
  await expect(page.getByTestId("atlas-workbench")).toContainText(breastResourceId);
  await page.getByTestId("guideline-graph-canvas").screenshot({ path: "../../.omo/evidence/task-4-smooth-focus.png" });

  await page.getByRole("navigation", { name: "Knowledgebase resources" }).getByRole("button", { name: /Brain Metastases/i }).click();
  await page.locator(".sigma-search-results button").filter({ hasText: "Adjuvant Radiotherapy for Invasive Breast Cancer" }).first().click();
  await expect(page.getByTestId("node-inspector")).toContainText(breastResourceId);
  await expect(page.getByTestId("source-document-panel")).toContainText("Adjuvant Radiotherapy for Invasive Breast Cancer");
  await expect(page.getByTestId("atlas-workbench")).toContainText(breastResourceId);

  await page.getByRole("button", { name: "breast · 1" }).click();
  await expect(page.getByTestId("node-inspector")).toContainText("disease site cluster");
  await expect(page.getByTestId("node-inspector")).toContainText("1 public resources");
  await expect(page.getByTestId("compact-inspector-summary")).not.toContainText(breastResourceId);
  await expect(page.getByTestId("resource-identifier-details")).toHaveCount(0);

  await page.getByRole("navigation", { name: "Knowledgebase resources" }).getByRole("button", { name: /Brain Metastases/i }).click();
  await expect(page.getByTestId("node-inspector")).toContainText(brainResourceId);
  await expect(page.getByTestId("source-document-panel")).toContainText("Brain Metastases");

  const workbench = page.getByTestId("atlas-workbench");
  const workbenchSearchStart = performance.now();
  await workbench.getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }).fill("Adjuvant Radiotherapy for Invasive Breast Cancer");
  await workbench.getByRole("button", { name: "Search", exact: true }).click();
  await expect(workbench).toContainText("Metadata retrieval");
  await expectCompactTextStyle(page, ".atlas-workbench-result span");
  performanceEvidence.searchVisibleMs = Math.round(performance.now() - workbenchSearchStart);
  expect(performanceEvidence.searchVisibleMs as number).toBeLessThanOrEqual(performanceEvidence.searchVisibleThresholdMs as number);
  await expect(workbench).toContainText("Source-span retrieval");
  await expect(workbench).toContainText("No source-span records returned for this query");
  await scrollWorkbenchResultsToTop(page);
  await expect(workbench.getByRole("button", { name: /Adjuvant Radiotherapy for Invasive Breast Cancer/i })).toBeVisible();
  await workbench.locator('section[aria-label="Metadata retrieval"] button').first().dispatchEvent("click", { bubbles: true });
  await expect(page.getByTestId("node-inspector")).toContainText(breastResourceId);
  await expect(page.getByTestId("source-document-panel")).toContainText("Adjuvant Radiotherapy for Invasive Breast Cancer");
  await expect(page.getByTestId("trust-provenance-drawer")).toContainText("metadata_only");
  await expect(page.getByTestId("trust-provenance-drawer")).toContainText("Metadata-only coverage: source spans are unavailable/not parsed");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-selected-query", "Adjuvant Radiotherapy for Invasive Breast Cancer");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-highlighted-resource-ids", breastResourceId);
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-highlighted-source-span-ids", "none");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-focus-mode", "metadata-only-blocked");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-blocked-reason", "Blocked evidence label: metadata-only, no source span returned");
  await expect(page.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-focus-mode", "metadata-only-blocked");
  await expect(page.getByTestId("retrieval-terminal-state")).toContainText("Generated answers are disabled");
  await expect(page.getByTestId("lookup-relationship-trace")).toContainText("resource");
  await expect(page.getByTestId("lookup-relationship-trace")).toContainText("disease site");
  await expect(page.getByTestId("lookup-relationship-trace")).toContainText("document type");
  await expect(page.getByTestId("lookup-relationship-trace")).toContainText("archive");
  await page.getByTestId("trust-provenance-drawer").screenshot({ path: "../../.omo/evidence/task-8-lookup-focus.png" });
  await page.getByTestId("trust-provenance-drawer").screenshot({ path: "../../.omo/evidence/task-9-surveillance-hud.png" });

  await workbench.getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }).fill("guideline");
  await workbench.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-highlighted-resource-ids", `${breastResourceId},${brainResourceId}`);
  await expect(page.getByTestId("retrieval-terminal-state").getByRole("button", { name: `Metadata terminal result ${brainResourceId}` })).toBeVisible();
  await page.getByTestId("retrieval-terminal-state").getByRole("button", { name: `Metadata terminal result ${brainResourceId}` }).dispatchEvent("click", { bubbles: true });
  await expect(page.getByTestId("node-inspector")).toContainText(brainResourceId);
  await expect(page.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-graph-resource-node-id", `resource.${brainResourceId}`);
  await page.locator(`[data-node-id="resource.${breastResourceId}"]`).dispatchEvent("pointerdown", { clientX: 100, clientY: 100, pointerId: 22, bubbles: true });
  await page.locator(`[data-node-id="resource.${breastResourceId}"]`).dispatchEvent("pointerup", { clientX: 100, clientY: 100, pointerId: 22, bubbles: true });
  await expect(page.getByTestId("node-inspector")).toContainText(breastResourceId);
  await expect(page.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-graph-resource-node-id", `resource.${breastResourceId}`);

  await workbench.getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }).fill("deterministic parsed excerpt");
  await workbench.getByRole("button", { name: "Search", exact: true }).click();
  await expect(workbench).toContainText("page:1;span:1");
  await expect(workbench).toContainText("Local deterministic parsed excerpt for search coverage.");
  await expect(workbench).toContainText("source status: draft");
  await expect(workbench).toContainText("parse status: not-parsed");
  await expect(workbench.getByRole("button", { name: /Local deterministic parsed excerpt/i })).toBeVisible();
  await workbench.getByRole("button", { name: /Local deterministic parsed excerpt/i }).dispatchEvent("click", { bubbles: true });
  await expect(page.getByTestId("node-inspector")).toContainText(breastResourceId);
  await expect(page.getByTestId("trust-provenance-drawer")).toContainText("page:1;span:1");
  await expect(page.getByTestId("trust-provenance-drawer")).toContainText(`${"0".repeat(64)} · draft`);
  await expect(page.getByTestId("trust-provenance-drawer")).toContainText("Parent resource");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-selected-query", "deterministic parsed excerpt");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-highlighted-resource-ids", breastResourceId);
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-highlighted-source-span-ids", "source-span.local-test");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-represented-source-span-node-ids", "none");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-focus-mode", "source-span-parent-fallback");
  await expect(page.locator(`[data-node-id="resource.${breastResourceId}"]`)).toHaveAttribute("data-evidence-role", "selected-resource");
  await expect(page.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-focus-mode", "source-span-parent-fallback");
  await expect(page.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-graph-focus-node-id", `resource.${breastResourceId}`);
  await expect(page.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-selected-query", "deterministic parsed excerpt");
  await expect(page.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-highlighted-resource-ids", breastResourceId);
  await expect(page.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-highlighted-source-span-ids", "source-span.local-test");
  await expect(page.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-graph-resource-node-id", `resource.${breastResourceId}`);
  await expect(page.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-graph-path-node-ids", `resource.${breastResourceId},disease-site.breast,document-type.guideline,archive-status.metadata-only.not-parsed`);
  await expect(page.getByTestId("retrieval-terminal-state")).toContainText("Generated answers are disabled");
  await expect(page.getByTestId("workbench-trace-terminal")).toHaveAttribute("data-command-label", "run-evals:corpus-workbench-trace");
  await expect(page.getByTestId("workbench-trace-terminal")).toHaveAttribute("data-gateway-outcome", "executed");
  await expect(page.getByTestId("workbench-trace-terminal")).toHaveAttribute("data-abstention-status", "abstained_no_answer_text");
  await expect(page.getByTestId("workbench-trace-terminal")).toHaveAttribute("data-citation-verifier-status", "pass");
  await expect(page.getByTestId("workbench-trace-terminal")).toContainText("Source spans used/rejected");
  await expect(page.getByTestId("workbench-trace-terminal")).toContainText("1 used / 0 rejected");
  await expect(page.getByTestId("workbench-trace-terminal")).toContainText("local_open_weight_7b");
  await resetStorageSetItemSpy(page);
  const explainRequestCountBefore = explainSelectionRequests.length;
  const mutationRequestCountBeforeExplain = mutationRequests.length;
  await expect(workbench.getByRole("button", { name: "Explain Selection" })).toBeEnabled();
  await workbench.getByRole("button", { name: "Explain Selection" }).click();
  const explainTrace = page.getByTestId("explain-selection-trace-terminal");
  await expect(explainTrace).toHaveAttribute("data-command-label", "explain-selection");
  await expect(explainTrace).toHaveAttribute("data-gateway-outcome", "executed");
  await expect(explainTrace).toHaveAttribute("data-runner-status", "dry_run_completed");
  await expect(explainTrace).toHaveAttribute("data-citation-verifier-status", "pass");
  await expect(explainTrace).toHaveAttribute("data-raw-output-included", "false");
  await expect(explainTrace).toContainText("Command label");
  await expect(explainTrace).toContainText("explain-selection");
  await expect(explainTrace).toContainText("Selected node ID");
  await expect(explainTrace).toContainText(`resource.${breastResourceId}`);
  await expect(explainTrace).toContainText("Selected source-span IDs");
  await expect(explainTrace).toContainText("source-span.local-test");
  await expect(explainTrace).toContainText("Context digest");
  await expect(explainTrace).toContainText("sha256:context-source-span-local-test");
  await expect(explainTrace).toContainText("Output digest");
  await expect(explainTrace).toContainText("sha256:output-source-span-local-test");
  await expect(explainTrace).toContainText("Runner status");
  await expect(explainTrace).toContainText("Gateway outcome");
  await expect(explainTrace).toContainText("Citation/verifier status");
  await expect(explainTrace).toContainText("Warnings");
  await expect(explainTrace).toContainText("none");
  await expect(explainTrace).toContainText("Evidence IDs");
  await expect(explainTrace).toContainText("evidence.explain.source-span.local-test");
  await expect(explainTrace).toContainText("raw_output_included");
  await expect(explainTrace).toContainText("false");
  await expect(explainTrace).toContainText("no claim: true");
  await expectNoForbiddenExplainSelectionText(page);
  const storageSetItemCalls = await readStorageSetItemCalls(page);
  expect(storageSetItemCalls, "Explain Selection inference trace must not persist to localStorage/sessionStorage").toEqual([]);
  expect(explainSelectionRequests.slice(explainRequestCountBefore)).toEqual([expect.stringContaining("POST")]);
  expect(mutationRequests.slice(mutationRequestCountBeforeExplain), "Explain Selection must not issue corpus mutation/write requests").toEqual([]);
  await screenshotExpandedExplainSelectionTrace(page, "../../.omo/evidence/task-7-explain-selection-trace-ui.png");
  await screenshotExpandedWorkbenchTrace(page, "../../.omo/evidence/task-7-workbench-trace-ui.png");
  writeTask7WorkbenchTraceText(await readTask7WorkbenchTraceEvidence(page, consoleFindings, traceRequests, explainSelectionRequests, storageSetItemCalls));
  await expect(page.getByTestId("lookup-relationship-trace")).toContainText("source span");
  await expect(page.getByTestId("lookup-relationship-trace")).toContainText("review item");
  await expectNoForbiddenGeneratedAnswerText(page);
  await page.getByTestId("guideline-graph-canvas").screenshot({ path: "../../.omo/evidence/task-8-query-graph-coupling.png" });
  await page.getByTestId("guideline-graph-canvas").screenshot({ path: "../../.omo/evidence/task-9-integrated-retrieval-graph.png" });
  writeTask8GraphTerminalContextEvidence(await readTask8GraphTerminalContext(page));
  await page.getByTestId("trust-provenance-drawer").screenshot({ path: "../../.omo/evidence/task-8-source-span-drawer.png" });

  corpusApiMock.setInterpretabilitySourceSpans([reviewQueueFocusSpan]);
  corpusApiMock.setReviewQueueItems(undefined);
  await page.getByRole("navigation", { name: "Knowledgebase resources" }).getByRole("button", { name: /Brain Metastases/i }).click();
  await expect(page.getByTestId("node-inspector")).toContainText(brainResourceId);
  await page.getByRole("navigation", { name: "Knowledgebase resources" }).getByRole("button", { name: /Adjuvant Radiotherapy/i }).click();
  const reviewQueue = page.getByTestId("review-queue-section");
  await expect(reviewQueue).toContainText("Review Queue");
  await expect(reviewQueue).toContainText("Adjuvant Radiotherapy for Invasive Breast Cancer");
  await expect(reviewQueue).toContainText("page:2;span:4");
  await expect(reviewQueue).toContainText(`${"4".repeat(64)} · draft`);
  await expect(reviewQueue).toContainText("Inspect source");
  await expect(reviewQueue).toContainText("Mark needs review (local)");
  await expect(reviewQueue).toContainText("Link source (local)");
  await reviewQueue.getByRole("button", { name: /Focus review queue item review\.local-test/i }).click();
  await expect(page.getByTestId("trust-provenance-drawer")).toContainText("page:2;span:4");
  await expect(page.getByTestId("source-span-details")).toContainText("source-span.local-review-card");
  await reviewQueue.getByRole("button", { name: "Mark needs review (local)" }).click();
  await expect(reviewQueue).toContainText("Local UI state: Mark needs review (local)");
  expect(mutationRequests).toEqual([]);
  await reviewQueue.screenshot({ path: "../../.omo/evidence/task-10-review-card-focus.png" });

  corpusApiMock.setInterpretabilitySourceSpans([]);
  corpusApiMock.setReviewQueueItems([buildReviewQueueItem({
    review_task_id: "review.unbacked-local-fixture",
    source_span_ids: [],
    staleness_status: "invalid_unbacked_local_fixture"
  })]);
  await page.getByRole("navigation", { name: "Knowledgebase resources" }).getByRole("button", { name: /Brain Metastases/i }).click();
  await expect(page.getByTestId("node-inspector")).toContainText(brainResourceId);
  await page.getByRole("navigation", { name: "Knowledgebase resources" }).getByRole("button", { name: /Adjuvant Radiotherapy/i }).click();
  const blockedReviewCard = page.getByTestId("review-queue-card-blocked");
  await expect(blockedReviewCard).toHaveAttribute("data-blocked", "true");
  await expect(blockedReviewCard).toHaveAttribute("aria-disabled", "true");
  await expect(blockedReviewCard).toContainText("Blocked local fixture state");
  await expect(blockedReviewCard).toContainText("blocked until a returned source span backs this item");
  await expect(blockedReviewCard).not.toContainText("Deterministic source-backed queue excerpt for UI focus.");
  await expect(blockedReviewCard.getByRole("button", { name: "Inspect source" })).toHaveCount(0);
  await blockedReviewCard.screenshot({ path: "../../.omo/evidence/task-10-invalid-card.png" });

  await workbench.getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }).fill("zzzz-no-such-guideline");
  await workbench.getByRole("button", { name: "Search", exact: true }).click();
  await expect(workbench).toContainText("No results for this query in public metadata or parsed source spans.");
  await expect(workbench).not.toContainText(/no evidence/i);

  const safetyNegativeQuery = "what should someone choose for treatment";
  await workbench.getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }).fill(safetyNegativeQuery);
  await workbench.getByRole("button", { name: "Search", exact: true }).click();
  await expect(workbench).toContainText("No results for this query in public metadata or parsed source spans.");
  await expect(workbench).toContainText("Generated answers disabled until retrieval/source-span verification is implemented.");
  await expect(page.getByTestId("workbench-trace-terminal")).toHaveAttribute("data-gateway-outcome", "blocked_before_gateway");
  await expect(page.getByTestId("workbench-trace-terminal")).toHaveAttribute("data-abstention-status", "abstained_no_model_execution");
  await expect(page.getByTestId("workbench-trace-terminal")).toHaveAttribute("data-citation-verifier-status", "not_run");
  await expect(page.getByTestId("workbench-trace-terminal")).toContainText("unsupported_advice_like_prompt");
  await expect(page.getByTestId("workbench-trace-terminal")).toContainText("No source spans used by this trace.");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-selected-query", safetyNegativeQuery);
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-highlighted-resource-ids", breastResourceId);
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-highlighted-source-span-ids", "none");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-represented-source-span-node-ids", "none");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-focus-mode", "metadata-only-blocked");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-evidence-blocked-reason", "Blocked evidence label: metadata-only, no source span returned");
  await expect(page.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-selected-query", safetyNegativeQuery);
  await expect(page.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-focus-mode", "metadata-only-blocked");
  await expect(page.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-graph-focus-node-id", `resource.${breastResourceId}`);
  await expect(page.getByTestId("retrieval-terminal-state")).toHaveAttribute("data-graph-resource-node-id", `resource.${breastResourceId}`);
  await expect(page.getByTestId("retrieval-terminal-state")).toContainText("No metadata resources in the current terminal trace.");
  await expectNoForbiddenGeneratedAnswerText(page);
  await screenshotExpandedWorkbenchTrace(page, "../../.omo/evidence/task-7-workbench-trace-ui-error.png");
  writeTask9SafetyNegativeEvidence(await readTask9SafetyNegativeEvidence(page, safetyNegativeQuery, consoleFindings));

  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("atlas-workbench")).not.toContainText(/Synthetic|Packet Alpha|Model Trace Stub|Evidence Hub|Mock|Demo|Placeholder/);
  await expect(page.locator("body")).not.toContainText(/chat transcript|assistant response|external llm/i);

  await page.setViewportSize({ width: 500, height: 900 });
  await expect(workbench).toBeVisible();
  await expect(workbench.getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" })).toBeVisible();
  await expect(workbench).toContainText("Metadata retrieval");
  await expect(workbench).toContainText("Source-span retrieval");
  expect(consoleFindings).toEqual([]);
  performanceEvidence.consoleFindings = consoleFindings.length;
  performanceEvidence.panZoomSmokeCompleted = true;
  performanceEvidence.graphSearchSmokeCompleted = true;
  performanceEvidence.workbenchSearchSmokeCompleted = true;
  performanceEvidence.reviewQueueSmokeCompleted = true;
  writeTask12PerformanceEvidence(performanceEvidence);
});

test("Sigma graph canvas smoothness contract records RAF, interaction, settled, and console evidence", async ({ page }) => {
  const consoleCapture: ConsoleCaptureEntry[] = [];
  const interactionSuccess = {
    pan: false,
    zoom: false,
    drag: false,
    searchFocus: false,
    resize: false
  };
  const evidence: AtlasSmoothnessEvidence = {
    task: "task-2-smoothness-contract",
    apiMode: "mocked-corpus-api",
    thresholds: atlasSmoothnessThresholds,
    settledMarkerAttribute: "data-layout-settled",
    layoutMetricsRequired: ["data-layout-iterations", "data-layout-overlap-count", "data-layout-seed"],
    nodeCount: 0,
    edgeCount: graphPayload.edges.length,
    settleMs: atlasSmoothnessThresholds.settleMs + 1,
    settled: false,
    settledMarkerPresent: false,
    layoutMetricsPresent: false,
    maxFrameGapMs: 0,
    p95RafIntervalMs: 0,
    rafSampleCount: 0,
    rafDurationMs: 0,
    consoleErrorCount: 0,
    consoleWarningCount: 0,
    interactionSuccess
  };

  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") {
      return;
    }
    const entry = {
      type: message.type() as "error" | "warning",
      text: message.text(),
      location: message.location(),
      ignoredKnownNoise: isKnownBrowserConsoleNoise(message.text())
    };
    consoleCapture.push(entry);
  });
  await mockCorpusApi(page);

  try {
    await page.goto("/");
    await expect(page.getByTestId("app-shell")).toBeVisible();
    await expect(page.getByTestId("guideline-graph-canvas")).toBeVisible();
    await expect(page.getByTestId("sigma-corpus-graph").locator("canvas").first()).toBeVisible();
    evidence.nodeCount = Number(await page.getByTestId("sigma-corpus-graph").getAttribute("data-node-count"));

    const settledMarker = await observeLayoutSettledMarker(page, atlasSmoothnessThresholds.settleMs);
    evidence.settleMs = settledMarker.settleMs;
    evidence.settled = settledMarker.settled;
    evidence.settledMarkerPresent = settledMarker.present;
    evidence.layoutMetricsPresent = settledMarker.layoutMetricsPresent;
    evidence.layoutMetricAttributes = settledMarker.layoutMetricAttributes;
    await page.waitForTimeout(1500);

    const rafCaptures: Array<{ interaction: keyof InteractionSuccessFlags; metrics: RafIntervalCapture }> = [];
    const measureInteraction = async (interaction: keyof InteractionSuccessFlags, action: () => Promise<void>) => {
      const metrics = await measureInteractionRaf(page, action);
      rafCaptures.push({ interaction, metrics });
    };

    await measureInteraction("zoom", async () => {
      await expectWheelZoomChangesNodeViewportRect(page, `resource.${breastResourceId}`);
    });
    interactionSuccess.zoom = true;
    await measureInteraction("pan", async () => {
      await expectStagePanChangesNodeViewportRect(page, `resource.${breastResourceId}`);
    });
    interactionSuccess.pan = true;
    await measureInteraction("drag", async () => {
      await expectNodeDragPinsSessionPosition(page, "document-type.guideline", "guideline");
    });
    await page.getByRole("button", { name: "Reset session pins" }).dispatchEvent("click", { bubbles: true });
    await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-pinned-node-count", "0");
    interactionSuccess.drag = true;
    await measureInteraction("searchFocus", async () => {
      await page.getByRole("searchbox", { name: "Search public corpus graph nodes" }).fill("Adjuvant Radiotherapy for Invasive Breast Cancer");
      await expect(page.locator(".sigma-search-results button")).toContainText("Adjuvant Radiotherapy for Invasive Breast Cancer");
      await page.getByRole("searchbox", { name: "Search public corpus graph nodes" }).press("Enter");
      await expect(page.getByTestId("node-inspector")).toContainText(breastResourceId);
    });
    interactionSuccess.searchFocus = true;
    await measureInteraction("resize", async () => {
      await page.setViewportSize({ width: 520, height: 900 });
      await expect(page.getByTestId("guideline-graph-canvas")).toBeVisible();
      await expect(page.getByTestId("atlas-workbench")).toBeVisible();
    });
    interactionSuccess.resize = true;
    const rafMetrics = combineRafCaptures(rafCaptures.map((capture) => capture.metrics));
    evidence.maxFrameGapMs = rafMetrics.maxFrameGapMs;
    evidence.p95RafIntervalMs = rafMetrics.p95RafIntervalMs;
    evidence.rafSampleCount = rafMetrics.rafSampleCount;
    evidence.rafDurationMs = rafMetrics.rafDurationMs;
    evidence.interactionRafMetrics = rafCaptures.map(({ interaction, metrics }) => ({
      interaction,
      maxFrameGapMs: metrics.maxFrameGapMs,
      p95RafIntervalMs: metrics.p95RafIntervalMs,
      rafSampleCount: metrics.rafSampleCount,
      rafDurationMs: metrics.rafDurationMs
    }));
  } finally {
    const actionableConsoleCapture = consoleCapture.filter((entry) => !entry.ignoredKnownNoise);
    evidence.consoleErrorCount = actionableConsoleCapture.filter((entry) => entry.type === "error").length;
    evidence.consoleWarningCount = actionableConsoleCapture.filter((entry) => entry.type === "warning").length;
    evidence.ignoredKnownConsoleNoiseCount = consoleCapture.length - actionableConsoleCapture.length;
    writeAtlasSmoothnessEvidence(evidence);
    writeTask2ConsoleCapture(consoleCapture, evidence);
  }

  expect(evidence.interactionSuccess).toEqual({
    pan: true,
    zoom: true,
    drag: true,
    searchFocus: true,
    resize: true
  });
  expect(evidence.settledMarkerPresent, "Sigma graph must expose data-layout-settled instrumentation").toBe(true);
  expect(evidence.layoutMetricsPresent, "Sigma graph must expose layout metric attributes for tuning").toBe(true);
  expect(evidence.settled, "Sigma graph layout must report settled=true").toBe(true);
  expect(evidence.settleMs).toBeLessThanOrEqual(atlasSmoothnessThresholds.settleMs);
  expect(evidence.maxFrameGapMs).toBeLessThanOrEqual(atlasSmoothnessThresholds.maxFrameGapMs);
  expect(evidence.p95RafIntervalMs).toBeLessThanOrEqual(atlasSmoothnessThresholds.p95RafIntervalMs);
  expect(evidence.consoleErrorCount).toBe(atlasSmoothnessThresholds.consoleErrorCount);
  expect(evidence.consoleWarningCount).toBe(atlasSmoothnessThresholds.consoleWarningCount);
});

test("Sigma graph canvas real corpus smoothness records 198-resource interaction evidence", async ({ page }) => {
  test.setTimeout(60_000);
  const consoleCapture: ConsoleCaptureEntry[] = [];
  const interactionSuccess = {
    pan: false,
    zoom: false,
    drag: false,
    searchFocus: false,
    resize: false
  };
  const evidence: AtlasSmoothnessEvidence = {
    task: "task-5-real-corpus-smoothness",
    apiMode: "live-real-corpus-api",
    thresholds: atlasSmoothnessThresholds,
    settledMarkerAttribute: "data-layout-settled",
    layoutMetricsRequired: ["data-layout-iterations", "data-layout-overlap-count", "data-layout-seed"],
    nodeCount: 0,
    edgeCount: 0,
    settleMs: atlasSmoothnessThresholds.settleMs + 1,
    settled: false,
    settledMarkerPresent: false,
    layoutMetricsPresent: false,
    maxFrameGapMs: 0,
    p95RafIntervalMs: 0,
    rafSampleCount: 0,
    rafDurationMs: 0,
    consoleErrorCount: 0,
    consoleWarningCount: 0,
    interactionSuccess
  };

  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") {
      return;
    }
    const entry = {
      type: message.type() as "error" | "warning",
      text: message.text(),
      location: message.location(),
      ignoredKnownNoise: isKnownBrowserConsoleNoise(message.text())
    };
    consoleCapture.push(entry);
  });

  try {
    await gotoLiveAtlasAndWaitForSigma(page);

    const liveGraphPayload = await page.evaluate(async () => {
      const response = await fetch("/api/knowledgebase/corpus/graph");
      if (!response.ok) {
        throw new Error(`Corpus graph API failed with ${response.status}`);
      }
      return response.json() as Promise<CorpusGraphScalePayload>;
    });
    evidence.resourceNodeCount = liveGraphPayload.metadata.resource_node_count;
    evidence.sourceSpanNodeCount = liveGraphPayload.metadata.source_span_node_count;
    evidence.edgeCount = liveGraphPayload.edges.length;
    evidence.nodeCount = Number(await page.getByTestId("sigma-corpus-graph").getAttribute("data-node-count"));
    evidence.corpusScaleNote = `${evidence.nodeCount} rendered compact graph nodes from ${evidence.resourceNodeCount} public corpus resources; extra nodes are clusters/source-span metadata.`;

    expect(evidence.resourceNodeCount).toBeGreaterThanOrEqual(198);
    expect(evidence.nodeCount).toBeGreaterThan(6);
    await expect(page.getByTestId("atlas-workbench")).toContainText("198 public resources");

    const settledMarker = await observeLayoutSettledMarker(page, atlasSmoothnessThresholds.settleMs);
    evidence.settleMs = settledMarker.settleMs;
    evidence.settled = settledMarker.settled;
    evidence.settledMarkerPresent = settledMarker.present;
    evidence.layoutMetricsPresent = settledMarker.layoutMetricsPresent;
    evidence.layoutMetricAttributes = settledMarker.layoutMetricAttributes;
    await page.waitForTimeout(1500);

    const rafCaptures: Array<{ interaction: keyof InteractionSuccessFlags; metrics: RafIntervalCapture }> = [];
    const measureInteraction = async (interaction: keyof InteractionSuccessFlags, action: () => Promise<void>) => {
      const metrics = await measureInteractionRaf(page, action);
      rafCaptures.push({ interaction, metrics });
    };

    const zoomBefore = await nodeViewportRect(page, `resource.${breastResourceId}`);
    await measureInteraction("zoom", async () => {
      await performWheelZoom(page);
    });
    await expectNodeRectToChange(page, `resource.${breastResourceId}`, zoomBefore);
    interactionSuccess.zoom = true;

    const panBefore = await nodeViewportRect(page, `resource.${breastResourceId}`);
    await measureInteraction("pan", async () => {
      await performStagePan(page);
    });
    await expectNodeRectToChange(page, `resource.${breastResourceId}`, panBefore);
    interactionSuccess.pan = true;

    const dragBefore = await nodeViewportRect(page, "document-type.guideline");
    await measureInteraction("drag", async () => {
      await performNodeProbeDrag(page, "document-type.guideline", 17, 72, 44);
    });
    await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-pinned-node-count", "1");
    await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-pinned-nodes", "document-type.guideline");
    await expect(page.locator('.sigma-camera-node-probe[data-node-id="document-type.guideline"]')).toHaveAttribute("data-pinned", "true");
    await expectNodeRectToChange(page, "document-type.guideline", dragBefore);
    await expect(page.getByTestId("node-inspector")).toContainText("guideline");
    await page.getByRole("button", { name: "Reset session pins" }).dispatchEvent("click", { bubbles: true });
    await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-pinned-node-count", "0");
    interactionSuccess.drag = true;

    await measureInteraction("searchFocus", async () => {
      await performGraphSearchFocus(page, "Document type: guideline");
    });
    await expect(page.locator(".sigma-search-results button")).toContainText("Document type: guideline");
    await expect(page.getByTestId("node-inspector")).toContainText("document type cluster");
    interactionSuccess.searchFocus = true;

    await measureInteraction("resize", async () => {
      await page.setViewportSize({ width: 520, height: 900 });
    });
    await expect(page.getByTestId("guideline-graph-canvas")).toBeVisible();
    await expect(page.getByTestId("atlas-workbench")).toBeVisible();
    interactionSuccess.resize = true;
    const rafMetrics = combineRafCaptures(rafCaptures.map((capture) => capture.metrics));
    evidence.maxFrameGapMs = rafMetrics.maxFrameGapMs;
    evidence.p95RafIntervalMs = rafMetrics.p95RafIntervalMs;
    evidence.rafSampleCount = rafMetrics.rafSampleCount;
    evidence.rafDurationMs = rafMetrics.rafDurationMs;
    evidence.interactionRafMetrics = rafCaptures.map(({ interaction, metrics }) => ({
      interaction,
      maxFrameGapMs: metrics.maxFrameGapMs,
      p95RafIntervalMs: metrics.p95RafIntervalMs,
      rafSampleCount: metrics.rafSampleCount,
      rafDurationMs: metrics.rafDurationMs
    }));
    await page.getByTestId("guideline-graph-canvas").screenshot({ path: "../../.omo/evidence/task-5-interaction-regression.png" });
  } finally {
    const actionableConsoleCapture = consoleCapture.filter((entry) => !entry.ignoredKnownNoise);
    evidence.consoleErrorCount = actionableConsoleCapture.filter((entry) => entry.type === "error").length;
    evidence.consoleWarningCount = actionableConsoleCapture.filter((entry) => entry.type === "warning").length;
    evidence.ignoredKnownConsoleNoiseCount = consoleCapture.length - actionableConsoleCapture.length;
    writeAtlasSmoothnessEvidence(evidence);
    writeTask5RealCorpusSmoothnessEvidence(evidence);
  }

  expect(evidence.interactionSuccess).toEqual({
    pan: true,
    zoom: true,
    drag: true,
    searchFocus: true,
    resize: true
  });
  expect(evidence.settledMarkerPresent, "Sigma graph must expose data-layout-settled instrumentation").toBe(true);
  expect(evidence.layoutMetricsPresent, "Sigma graph must expose layout metric attributes for tuning").toBe(true);
  expect(evidence.settled, "Sigma graph layout must report settled=true").toBe(true);
  expect(evidence.settleMs).toBeLessThanOrEqual(atlasSmoothnessThresholds.settleMs);
  expect(evidence.maxFrameGapMs).toBeLessThanOrEqual(atlasSmoothnessThresholds.maxFrameGapMs);
  expect(evidence.p95RafIntervalMs).toBeLessThanOrEqual(atlasSmoothnessThresholds.p95RafIntervalMs);
  expect(evidence.consoleErrorCount).toBe(atlasSmoothnessThresholds.consoleErrorCount);
  expect(evidence.consoleWarningCount).toBe(atlasSmoothnessThresholds.consoleWarningCount);
});

function writeTask12PerformanceEvidence(evidence: Record<string, number | string | boolean>) {
  mkdirSync("../../.omo/evidence", { recursive: true });
  writeFileSync("../../.omo/evidence/task-12-performance.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf-8");
}

function writeTask8GraphTerminalContextEvidence(evidence: Record<string, unknown>) {
  mkdirSync("../../.omo/evidence", { recursive: true });
  writeFileSync("../../.omo/evidence/task-8-graph-terminal-context.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf-8");
}

function writeTask7WorkbenchTraceText(evidence: Record<string, unknown>) {
  mkdirSync("../../.omo/evidence", { recursive: true });
  writeFileSync("../../.omo/evidence/task-7-workbench-trace-ui.txt", `${JSON.stringify(evidence, null, 2)}\n`, "utf-8");
}

function writeTask9SafetyNegativeEvidence(evidence: SafetyNegativeEvidence) {
  mkdirSync("../../.omo/evidence", { recursive: true });
  writeFileSync("../../.omo/evidence/task-9-safety-negative.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf-8");
}

function writeAtlasSmoothnessEvidence(evidence: AtlasSmoothnessEvidence) {
  mkdirSync("../../.omo/evidence", { recursive: true });
  writeFileSync("../../.omo/evidence/atlas-smoothness.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf-8");
}

function writeTask2ConsoleCapture(consoleCapture: ConsoleCaptureEntry[], evidence: AtlasSmoothnessEvidence) {
  mkdirSync("../../.omo/evidence", { recursive: true });
  writeFileSync("../../.omo/evidence/task-2-console-capture.json", `${JSON.stringify({
    task: evidence.task,
    consoleErrorCount: evidence.consoleErrorCount,
    consoleWarningCount: evidence.consoleWarningCount,
    ignoredKnownConsoleNoiseCount: evidence.ignoredKnownConsoleNoiseCount,
    entries: consoleCapture
  }, null, 2)}\n`, "utf-8");
}

function writeTask5RealCorpusSmoothnessEvidence(evidence: AtlasSmoothnessEvidence) {
  mkdirSync("../../.omo/evidence", { recursive: true });
  writeFileSync("../../.omo/evidence/task-5-real-corpus-smoothness.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf-8");
}

function writeTask4PinResetEvidence(evidence: Record<string, unknown>) {
  mkdirSync("../../.omo/evidence", { recursive: true });
  writeFileSync("../../.omo/evidence/task-4-pin-reset.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf-8");
}

async function observeLayoutSettledMarker(page: Page, thresholdMs: number): Promise<SettledMarkerObservation> {
  const startedAt = performance.now();
  let lastState = await readLayoutSettledState(page);

  while (performance.now() - startedAt <= thresholdMs) {
    if (lastState.settled) {
      return {
        ...lastState,
        settleMs: Math.round(performance.now() - startedAt)
      };
    }
    await page.waitForTimeout(100);
    lastState = await readLayoutSettledState(page);
  }

  return {
    ...lastState,
    settleMs: Math.round(performance.now() - startedAt)
  };
}

async function readLayoutSettledState(page: Page) {
  return page.getByTestId("sigma-corpus-graph").evaluate((element) => {
    const layoutMetricAttributes = {
      iterations: element.getAttribute("data-layout-iterations"),
      overlapCount: element.getAttribute("data-layout-overlap-count"),
      seed: element.getAttribute("data-layout-seed")
    };
    const settledAttribute = element.getAttribute("data-layout-settled");

    return {
      present: settledAttribute !== null,
      settled: settledAttribute === "true",
      layoutMetricsPresent: Object.values(layoutMetricAttributes).every((value) => value !== null && value !== ""),
      layoutMetricAttributes
    };
  });
}

async function startRafIntervalProbe(page: Page) {
  await page.evaluate(() => {
    type AtlasRafProbe = {
      frameCount: number;
      intervals: number[];
      lastTimestamp: number | null;
      rafId: number | null;
      running: boolean;
      startedAt: number;
      endedAt: number | null;
    };
    const probeWindow = window as Window & { __atlasRafProbe?: AtlasRafProbe };
    const probe: AtlasRafProbe = {
      frameCount: 0,
      intervals: [],
      lastTimestamp: null,
      rafId: null,
      running: true,
      startedAt: performance.now(),
      endedAt: null
    };
    probeWindow.__atlasRafProbe = probe;

    const tick = (timestamp: number) => {
      if (!probe.running) {
        return;
      }
      if (probe.lastTimestamp !== null) {
        probe.intervals.push(timestamp - probe.lastTimestamp);
      }
      probe.lastTimestamp = timestamp;
      probe.frameCount += 1;
      probe.rafId = window.requestAnimationFrame(tick);
    };

    probe.rafId = window.requestAnimationFrame(tick);
  });
}

async function stopRafIntervalProbe(page: Page): Promise<RafIntervalCapture> {
  return page.evaluate(() => {
    type AtlasRafProbe = {
      frameCount: number;
      intervals: number[];
      lastTimestamp: number | null;
      rafId: number | null;
      running: boolean;
      startedAt: number;
      endedAt: number | null;
    };
    const probeWindow = window as Window & { __atlasRafProbe?: AtlasRafProbe };
    const probe = probeWindow.__atlasRafProbe;
    if (!probe) {
      return { maxFrameGapMs: 0, p95RafIntervalMs: 0, rafSampleCount: 0, rafDurationMs: 0, intervals: [] };
    }
    probe.running = false;
    probe.endedAt = performance.now();
    if (probe.rafId !== null) {
      window.cancelAnimationFrame(probe.rafId);
    }
    const intervals = [...probe.intervals].sort((left, right) => left - right);
    const p95Index = intervals.length === 0 ? 0 : Math.min(intervals.length - 1, Math.ceil(intervals.length * 0.95) - 1);

    return {
      maxFrameGapMs: Math.round(Math.max(0, ...probe.intervals)),
      p95RafIntervalMs: Math.round(intervals[p95Index] ?? 0),
      rafSampleCount: probe.intervals.length,
      rafDurationMs: Math.round(probe.endedAt - probe.startedAt),
      intervals: probe.intervals
    };
  });
}

async function measureInteractionRaf(page: Page, action: () => Promise<void>): Promise<RafIntervalCapture> {
  await startRafIntervalProbe(page);
  let actionError: unknown = null;
  try {
    await action();
    await page.waitForTimeout(activeInteractionRafSampleMs);
  } catch (error: unknown) {
    actionError = error;
  }
  const metrics = await stopRafIntervalProbe(page);
  if (actionError) {
    throw actionError;
  }
  return metrics;
}

function combineRafCaptures(captures: RafIntervalCapture[]): RafIntervalMetrics {
  const intervals = captures.flatMap((capture) => capture.intervals);
  const sortedIntervals = [...intervals].sort((left, right) => left - right);
  const p95Index = sortedIntervals.length === 0 ? 0 : Math.min(sortedIntervals.length - 1, Math.ceil(sortedIntervals.length * 0.95) - 1);

  return {
    maxFrameGapMs: Math.round(Math.max(0, ...intervals)),
    p95RafIntervalMs: Math.round(sortedIntervals[p95Index] ?? 0),
    rafSampleCount: intervals.length,
    rafDurationMs: captures.reduce((total, capture) => total + capture.rafDurationMs, 0)
  };
}

async function gotoLiveAtlasAndWaitForSigma(page: Page) {
  const atlasApiResponses = waitForAtlasApiResponses(page);

  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("guideline-graph-canvas")).toBeVisible();
  await atlasApiResponses;
  await expect(page.getByText("Loading corpus atlas")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-layout-mode", "deterministic-force-atlas", { timeout: 15_000 });
  await expect(page.getByTestId("sigma-corpus-graph").locator("canvas").first()).toBeVisible({ timeout: 15_000 });
}

async function waitForAtlasApiResponses(page: Page) {
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/knowledgebase/corpus/resources") && response.ok(), { timeout: 20_000 }),
    page.waitForResponse((response) => response.url().includes("/api/knowledgebase/corpus/graph") && response.ok(), { timeout: 20_000 }),
    page.waitForResponse((response) => response.url().includes("/api/knowledgebase/corpus/source-spans") && response.ok(), { timeout: 20_000 })
  ]);
}

async function expectNoOvalGraphBoundary(page: Page) {
  const visualPolicy = await page.evaluate(() => {
    const graphCanvas = document.querySelector(".graph-canvas");
    const beforeBackground = graphCanvas ? getComputedStyle(graphCanvas, "::before").backgroundImage : "";
    const stylesheetText = Array.from(document.styleSheets).flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((rule) => rule.cssText);
      } catch {
        return [];
      }
    }).join("\n");

    return {
      beforeBackground,
      hasCenteredRadialVignette: beforeBackground.includes("radial-gradient") || stylesheetText.includes("radial-gradient(circle at center"),
      hasConstellationOvalRule: stylesheetText.includes(".sigma-constellation-map::before") || stylesheetText.includes("border-radius: 48%"),
      hasVisibleGridChrome: /repeating-linear-gradient|graph-vault-grid|linear-gradient\([^)]*1px,\s*transparent\s+1px/i.test(stylesheetText),
      hidesWorkbenchAtSmallViewport: /\.atlas-workbench\s*\{[^}]*display:\s*none/.test(stylesheetText)
    };
  });

  expect(visualPolicy).toEqual({
    beforeBackground: expect.not.stringContaining("radial-gradient"),
    hasCenteredRadialVignette: false,
    hasConstellationOvalRule: false,
    hasVisibleGridChrome: false,
    hidesWorkbenchAtSmallViewport: false
  });
}

async function expectRestrainedSigmaAesthetic(page: Page) {
  const visualPolicy = await page.evaluate(() => {
    const graph = document.querySelector('[data-testid="sigma-corpus-graph"]');
    const readTextStyle = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) {
        return null;
      }
      const computedStyle = getComputedStyle(element);
      return {
        minWidth: computedStyle.minWidth,
        overflowWrap: computedStyle.overflowWrap,
        wordBreak: computedStyle.wordBreak,
        lineBreak: computedStyle.getPropertyValue("line-break"),
        textOverflow: computedStyle.textOverflow
      };
    };
    const stylesheetText = Array.from(document.styleSheets).flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((rule) => rule.cssText);
      } catch {
        return [];
      }
    }).join("\n");

    return {
      visualTheme: graph?.getAttribute("data-visual-theme"),
      nodeEncodingPolicy: graph?.getAttribute("data-node-encoding-policy"),
      canvasCount: graph?.querySelectorAll("canvas").length ?? 0,
      fakeImageCount: graph?.querySelectorAll("img, picture, image").length ?? 0,
      hasForbiddenVisualRewrite: /autoRotate|auto-rotation|Three\.js|@react-three|galaxy scatter|heavy bloom|top document strip/i.test(stylesheetText),
      hasCustomThreeRenderer: /three\/|webgl custom renderer/i.test(stylesheetText),
      cameraProbeStyle: readTextStyle(".sigma-camera-node-probe"),
      hasPinnedConstellationLayer: Boolean(document.querySelector(".sigma-constellation-map, .sigma-constellation-node, .sigma-relationship-overlay"))
    };
  });

  expect(visualPolicy).toEqual({
    visualTheme: "dark-evidence-vault",
    nodeEncodingPolicy: "color-ring-shape-label-chip",
    canvasCount: expect.any(Number),
    fakeImageCount: 0,
    hasForbiddenVisualRewrite: false,
    hasCustomThreeRenderer: false,
    cameraProbeStyle: {
      minWidth: "0px",
      overflowWrap: "normal",
      wordBreak: "normal",
      lineBreak: "auto",
      textOverflow: "clip"
    },
    hasPinnedConstellationLayer: false
  });
  expect(visualPolicy.canvasCount).toBeGreaterThan(0);
}

async function expectCompactTextStyle(page: Page, selector: string) {
  const style = await page.locator(selector).first().evaluate((element) => {
    const computedStyle = getComputedStyle(element);
    return {
      minWidth: computedStyle.minWidth,
      overflowWrap: computedStyle.overflowWrap,
      wordBreak: computedStyle.wordBreak,
      lineBreak: computedStyle.getPropertyValue("line-break"),
      textOverflow: computedStyle.textOverflow,
      whiteSpace: computedStyle.whiteSpace
    };
  });

  expect(style).toEqual({
    minWidth: "0px",
    overflowWrap: "anywhere",
    wordBreak: "keep-all",
    lineBreak: "strict",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  });
}

async function scrollWorkbenchResultsToTop(page: Page) {
  await page.evaluate(() => {
    const results = document.querySelector(".atlas-workbench__results");
    if (results) {
      results.scrollTop = 0;
    }
  });
}

async function screenshotExpandedWorkbenchTrace(page: Page, path: string) {
  await page.evaluate(() => {
    document.getElementById("task-7-evidence-screenshot-style")?.remove();
    const style = document.createElement("style");
    style.id = "task-7-evidence-screenshot-style";
    style.textContent = ".atlas-workbench{max-height:none!important;overflow:visible!important}.atlas-workbench__results{overflow:visible!important}";
    document.head.append(style);
    const results = document.querySelector(".atlas-workbench__results");
    if (results) {
      results.scrollTop = 0;
    }
  });
  await page.getByTestId("workbench-trace-terminal").screenshot({ path });
  await page.evaluate(() => {
    document.getElementById("task-7-evidence-screenshot-style")?.remove();
  });
}

async function screenshotExpandedExplainSelectionTrace(page: Page, path: string) {
  await page.evaluate(() => {
    document.getElementById("task-7-evidence-screenshot-style")?.remove();
    const style = document.createElement("style");
    style.id = "task-7-evidence-screenshot-style";
    style.textContent = ".atlas-workbench{max-height:none!important;overflow:visible!important}.atlas-workbench__results{overflow:visible!important}";
    document.head.append(style);
    const results = document.querySelector(".atlas-workbench__results");
    if (results) {
      results.scrollTop = 0;
    }
  });
  await page.getByTestId("explain-selection-trace-terminal").screenshot({ path });
  await page.evaluate(() => {
    document.getElementById("task-7-evidence-screenshot-style")?.remove();
  });
}

async function installStorageSetItemSpy(page: Page) {
  await page.addInitScript(() => {
    const calls: Array<{ area: string; key: string; valuePreview: string }> = [];
    Object.defineProperty(window, "__guruStorageSetItemCalls", {
      configurable: true,
      value: calls
    });
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItemSpy(key: string, value: string) {
      calls.push({
        area: this === window.localStorage ? "localStorage" : this === window.sessionStorage ? "sessionStorage" : "unknownStorage",
        key: String(key),
        valuePreview: String(value).slice(0, 80)
      });
      return originalSetItem.call(this, key, value);
    };
  });
}

async function resetStorageSetItemSpy(page: Page) {
  await page.evaluate(() => {
    const calls = (window as typeof window & { __guruStorageSetItemCalls?: unknown[] }).__guruStorageSetItemCalls;
    if (Array.isArray(calls)) {
      calls.length = 0;
    }
  });
}

async function readStorageSetItemCalls(page: Page) {
  return page.evaluate(() => {
    const calls = (window as typeof window & { __guruStorageSetItemCalls?: unknown[] }).__guruStorageSetItemCalls;
    return Array.isArray(calls) ? calls : [];
  });
}

async function readTask8GraphTerminalContext(page: Page) {
  return page.evaluate(() => {
    const graph = document.querySelector('[data-testid="sigma-corpus-graph"]');
    const terminal = document.querySelector('[data-testid="retrieval-terminal-state"]');
    const selectedResource = document.querySelector('.sigma-camera-node-probe[data-evidence-role="selected-resource"]');
    return {
      task: "task-8-query-graph-coupling",
      graph: {
        query: graph?.getAttribute("data-evidence-selected-query"),
        highlightedResourceIds: graph?.getAttribute("data-highlighted-resource-ids"),
        highlightedSourceSpanIds: graph?.getAttribute("data-highlighted-source-span-ids"),
        representedSourceSpanNodeIds: graph?.getAttribute("data-represented-source-span-node-ids"),
        focusNodeId: graph?.getAttribute("data-graph-focus-node-id"),
        resourceNodeId: graph?.getAttribute("data-graph-resource-node-id"),
        contextNodeIds: graph?.getAttribute("data-graph-context-node-ids"),
        pathNodeIds: graph?.getAttribute("data-graph-path-node-ids"),
        focusMode: graph?.getAttribute("data-evidence-focus-mode"),
        blockedReason: graph?.getAttribute("data-evidence-blocked-reason")
      },
      terminal: {
        query: terminal?.getAttribute("data-selected-query"),
        focusMode: terminal?.getAttribute("data-focus-mode"),
        graphFocusNodeId: terminal?.getAttribute("data-graph-focus-node-id"),
        graphPathNodeIds: terminal?.getAttribute("data-graph-path-node-ids"),
        generatedAnswersDisabled: terminal?.textContent?.includes("Generated answers are disabled") ?? false
      },
      selectedResourceProbe: {
        nodeId: selectedResource?.getAttribute("data-node-id"),
        evidenceRole: selectedResource?.getAttribute("data-evidence-role"),
        pathContext: selectedResource?.getAttribute("data-path-context"),
        sourceSpanHit: selectedResource?.getAttribute("data-source-span-hit")
      }
    };
  });
}

async function readTask7WorkbenchTraceEvidence(
  page: Page,
  consoleFindings: string[],
  traceRequests: string[],
  explainSelectionRequests: string[],
  storageSetItemCalls: unknown[]
) {
  const visibleState = await page.evaluate(() => {
    const workbench = document.querySelector('[data-testid="atlas-workbench"]');
    const trace = document.querySelector('[data-testid="workbench-trace-terminal"]');
    const explainTrace = document.querySelector('[data-testid="explain-selection-trace-terminal"]');
    const terminal = document.querySelector('[data-testid="retrieval-terminal-state"]');
    return {
      workbenchText: workbench?.textContent?.trim() ?? "",
      traceText: trace?.textContent?.trim() ?? "",
      explainTraceText: explainTrace?.textContent?.trim() ?? "",
      retrievalText: terminal?.textContent?.trim() ?? "",
      commandLabel: trace?.getAttribute("data-command-label") ?? null,
      explainCommandLabel: explainTrace?.getAttribute("data-command-label") ?? null,
      explainGatewayOutcome: explainTrace?.getAttribute("data-gateway-outcome") ?? null,
      explainRunnerStatus: explainTrace?.getAttribute("data-runner-status") ?? null,
      explainRawOutputIncluded: explainTrace?.getAttribute("data-raw-output-included") ?? null,
      gatewayOutcome: trace?.getAttribute("data-gateway-outcome") ?? null,
      abstentionStatus: trace?.getAttribute("data-abstention-status") ?? null,
      citationVerifierStatus: trace?.getAttribute("data-citation-verifier-status") ?? null,
      forbiddenSurfacePresent: /answer_text|output_text|generated_answer|generatedAnswer|raw_model_output|clinical answer|treatment advice|dosing|diagnosis|assistant response|chat transcript|recommendation text/i.test(workbench?.textContent ?? "")
    };
  });

  return {
    task: "task-7-workbench-trace-ui",
    query: "deterministic parsed excerpt",
    visibleState,
    consoleFindings,
    traceRequests,
    explainSelectionRequests,
    storageSetItemCalls,
    pass: visibleState.commandLabel === "run-evals:corpus-workbench-trace"
      && visibleState.explainCommandLabel === "explain-selection"
      && visibleState.explainGatewayOutcome === "executed"
      && visibleState.explainRunnerStatus === "dry_run_completed"
      && visibleState.explainRawOutputIncluded === "false"
      && visibleState.gatewayOutcome === "executed"
      && visibleState.abstentionStatus === "abstained_no_answer_text"
      && visibleState.citationVerifierStatus === "pass"
      && explainSelectionRequests.some((request) => request.startsWith("POST "))
      && storageSetItemCalls.length === 0
      && !visibleState.forbiddenSurfacePresent
  };
}

async function expectNoForbiddenGeneratedAnswerText(page: Page, queryToIgnore = "") {
  const safetyText = await readVisibleSafetyText(page, queryToIgnore);
  for (const forbiddenString of forbiddenGeneratedAnswerStrings) {
    expect(safetyText.toLowerCase(), `visible retrieval/graph safety surface must not include ${forbiddenString}`).not.toContain(forbiddenString.toLowerCase());
  }
}

async function expectNoForbiddenExplainSelectionText(page: Page) {
  const safetyText = (await readVisibleSafetyText(page)).split("abstained_no_answer_text").join("");
  for (const forbiddenField of forbiddenExplainSelectionFields) {
    expect(safetyText, `Explain Selection normal UI must not include ${forbiddenField}`).not.toContain(forbiddenField);
  }
}

async function readVisibleSafetyText(page: Page, queryToIgnore = "") {
  return page.evaluate(({ allowedDisabledCopy, query }) => {
    const visibleText = [
      document.querySelector('[data-testid="atlas-workbench"]')?.textContent ?? "",
      document.querySelector('[data-testid="retrieval-terminal-state"]')?.textContent ?? "",
      document.querySelector('[data-testid="trust-provenance-drawer"]')?.textContent ?? ""
    ].join("\n");
    return [
      ...allowedDisabledCopy,
      query
    ].filter(Boolean).reduce((text, allowedText) => text.split(allowedText).join(""), visibleText);
  }, {
    allowedDisabledCopy: [
      "Generated answers disabled until retrieval/source-span verification is implemented.",
      "Generated answers are disabled; terminal output is limited to retrieval metadata, source-span provenance, and graph focus state.",
      "Generated answers are disabled. The graph shows visual evidence for retrieval only; draft metadata and source spans are not approved guidance."
    ],
    query: queryToIgnore
  });
}

async function readTask9SafetyNegativeEvidence(page: Page, query: string, consoleFindings: string[]): Promise<SafetyNegativeEvidence> {
  const visibleState = await page.evaluate(() => {
    const graph = document.querySelector('[data-testid="sigma-corpus-graph"]');
    const terminal = document.querySelector('[data-testid="retrieval-terminal-state"]');
    const workbench = document.querySelector('[data-testid="atlas-workbench"]');
    return {
      terminalText: terminal?.textContent?.trim() ?? "",
      workbenchText: workbench?.textContent?.trim() ?? "",
      graphFocusMode: graph?.getAttribute("data-evidence-focus-mode") ?? null,
      blockedReason: graph?.getAttribute("data-evidence-blocked-reason") ?? null,
      selectedQuery: graph?.getAttribute("data-evidence-selected-query") ?? null,
      highlightedResourceIds: graph?.getAttribute("data-highlighted-resource-ids") ?? null,
      highlightedSourceSpanIds: graph?.getAttribute("data-highlighted-source-span-ids") ?? null
    };
  });
  const safetyText = (await readVisibleSafetyText(page, query)).toLowerCase();
  const forbiddenStringCheck = Object.fromEntries(forbiddenGeneratedAnswerStrings.map((forbiddenString) => [
    forbiddenString,
    !safetyText.includes(forbiddenString.toLowerCase())
  ]));
  const consoleCounts = {
    errors: consoleFindings.filter((finding) => finding.startsWith("error:")).length,
    warnings: consoleFindings.filter((finding) => finding.startsWith("warning:")).length
  };
  const pass = Object.values(forbiddenStringCheck).every(Boolean)
    && consoleCounts.errors === 0
    && consoleCounts.warnings === 0
    && visibleState.graphFocusMode === "metadata-only-blocked"
    && visibleState.blockedReason === "Blocked evidence label: metadata-only, no source span returned"
    && visibleState.highlightedSourceSpanIds === "none";

  return {
    task: "task-9-safety-negative-retrieval-only",
    query,
    visibleState,
    forbiddenStringCheck,
    consoleCounts,
    pass
  };
}

async function expectDocumentNodesIntegrated(page: Page) {
  const documentLayout = await page.evaluate(() => Array.from(document.querySelectorAll('.sigma-camera-node-probe[data-node-group="documents"]')).map((node) => ({
    nodeId: node.getAttribute("data-node-id"),
    y: Number(node.getAttribute("data-layout-y")),
    viewportY: Number(node.getAttribute("data-viewport-y"))
  })));

  expect(documentLayout.length).toBeGreaterThan(0);
  expect(documentLayout.every((node) => Number.isFinite(node.y))).toBe(true);
  expect(documentLayout.every((node) => Number.isFinite(node.viewportY))).toBe(true);
}

async function expectWheelZoomChangesNodeViewportRect(page: Page, nodeId: string) {
  const before = await nodeViewportRect(page, nodeId);
  await performWheelZoom(page);
  await expectNodeRectToChange(page, nodeId, before);
}

async function performWheelZoom(page: Page) {
  const canvas = page.getByTestId("sigma-corpus-graph").locator("canvas").first();
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();

  await page.mouse.move((canvasBox?.x ?? 0) + (canvasBox?.width ?? 0) / 2, (canvasBox?.y ?? 0) + (canvasBox?.height ?? 0) / 2);
  await page.mouse.wheel(0, -360);
}

async function expectEmptySpacePanChangesNodeViewportRect(page: Page, nodeId: string) {
  const before = await nodeViewportRect(page, nodeId);
  const emptyPoint = await findEmptyCanvasPoint(page);

  await page.mouse.move(emptyPoint.x, emptyPoint.y);
  await page.mouse.down();
  await page.mouse.move(emptyPoint.x + 96, emptyPoint.y + 58, { steps: 12 });
  await page.mouse.up();
  await expectNodeRectToChange(page, nodeId, before);
}

async function expectStagePanChangesNodeViewportRect(page: Page, nodeId: string) {
  const before = await nodeViewportRect(page, nodeId);
  await performStagePan(page);
  await expectNodeRectToChange(page, nodeId, before);
}

async function performStagePan(page: Page) {
  const stage = page.getByTestId("sigma-camera-node-layer");
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  const startX = (box?.x ?? 0) + (box?.width ?? 0) * 0.32;
  const startY = (box?.y ?? 0) + (box?.height ?? 0) * 0.62;

  await stage.dispatchEvent("pointerdown", { clientX: startX, clientY: startY, pointerId: 19, bubbles: true });
  await stage.dispatchEvent("pointermove", { clientX: startX + 96, clientY: startY + 58, pointerId: 19, bubbles: true });
  await stage.dispatchEvent("pointerup", { clientX: startX + 96, clientY: startY + 58, pointerId: 19, bubbles: true });
}

async function expectNodeDragPinsAndResetsSessionPosition(
  page: Page,
  nodeId: string,
  expectedInspectorText: string,
  options: { reload: boolean; writeEvidence: boolean }
) {
  const graph = page.getByTestId("sigma-corpus-graph");
  const node = page.locator(`.sigma-camera-node-probe[data-node-id="${nodeId}"]`);
  const before = await node.evaluate((element) => ({
    x: Number(element.getAttribute("data-layout-x")),
    y: Number(element.getAttribute("data-layout-y"))
  }));
  const viewportBefore = await nodeViewportRect(page, nodeId);
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  const startX = (box?.x ?? 0) + (box?.width ?? 0) / 2;
  const startY = (box?.y ?? 0) + (box?.height ?? 0) / 2;

  await node.dispatchEvent("pointerdown", { clientX: startX, clientY: startY, pointerId: 7, bubbles: true });
  await expect(graph).toHaveAttribute("data-dragging-node", nodeId);
  await node.dispatchEvent("pointermove", { clientX: startX + 72, clientY: startY + 44, pointerId: 7, bubbles: true });
  await expect(graph).toHaveAttribute("data-dragging-node", nodeId);
  await node.dispatchEvent("pointerup", { clientX: startX + 72, clientY: startY + 44, pointerId: 7, bubbles: true });
  await expect(graph).toHaveAttribute("data-dragging-node", "none");
  await expect(graph).toHaveAttribute("data-pinned-node-count", "1");
  await expect(graph).toHaveAttribute("data-pinned-nodes", nodeId);
  await expect(node).toHaveAttribute("data-pinned", "true");

  const after = await node.evaluate((element) => ({
    x: Number(element.getAttribute("data-layout-x")),
    y: Number(element.getAttribute("data-layout-y"))
  }));
  expect(after).not.toEqual(before);
  await expectNodeRectToChange(page, nodeId, viewportBefore);
  await expect(page.getByTestId("node-inspector")).toContainText(expectedInspectorText);

  await page.getByRole("button", { name: "Release focus pin" }).dispatchEvent("click", { bubbles: true });
  await expect(graph).toHaveAttribute("data-pinned-node-count", "0");
  await expect(node).toHaveAttribute("data-pinned", "false");
  const released = await node.evaluate((element) => ({
    x: Number(element.getAttribute("data-layout-x")),
    y: Number(element.getAttribute("data-layout-y"))
  }));
  expect(released).toEqual(before);

  const releasedBox = await node.boundingBox();
  expect(releasedBox).not.toBeNull();
  const secondStartX = (releasedBox?.x ?? 0) + (releasedBox?.width ?? 0) / 2;
  const secondStartY = (releasedBox?.y ?? 0) + (releasedBox?.height ?? 0) / 2;
  await node.dispatchEvent("pointerdown", { clientX: secondStartX, clientY: secondStartY, pointerId: 8, bubbles: true });
  await node.dispatchEvent("pointermove", { clientX: secondStartX - 58, clientY: secondStartY + 36, pointerId: 8, bubbles: true });
  await node.dispatchEvent("pointerup", { clientX: secondStartX - 58, clientY: secondStartY + 36, pointerId: 8, bubbles: true });
  await expect(graph).toHaveAttribute("data-pinned-node-count", "1");
  await page.getByRole("button", { name: "Reset session pins" }).dispatchEvent("click", { bubbles: true });
  await expect(graph).toHaveAttribute("data-pinned-node-count", "0");
  const reset = await node.evaluate((element) => ({
    x: Number(element.getAttribute("data-layout-x")),
    y: Number(element.getAttribute("data-layout-y"))
  }));
  expect(reset).toEqual(before);

  let reloaded: typeof reset | null = null;
  if (options.reload) {
    await page.reload();
    await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-layout-mode", "deterministic-force-atlas");
    const reloadedNode = page.locator(`.sigma-camera-node-probe[data-node-id="${nodeId}"]`);
    reloaded = await reloadedNode.evaluate((element) => ({
      x: Number(element.getAttribute("data-layout-x")),
      y: Number(element.getAttribute("data-layout-y"))
    }));
    expect(reloaded).toEqual(before);
    const reloadedBox = await reloadedNode.boundingBox();
    expect(reloadedBox).not.toBeNull();
    const reloadedStartX = (reloadedBox?.x ?? 0) + (reloadedBox?.width ?? 0) / 2;
    const reloadedStartY = (reloadedBox?.y ?? 0) + (reloadedBox?.height ?? 0) / 2;
    await reloadedNode.dispatchEvent("pointerdown", { clientX: reloadedStartX, clientY: reloadedStartY, pointerId: 9, bubbles: true });
    await reloadedNode.dispatchEvent("pointerup", { clientX: reloadedStartX, clientY: reloadedStartY, pointerId: 9, bubbles: true });
    await expect(page.getByTestId("node-inspector")).toContainText(expectedInspectorText);
  }

  if (options.writeEvidence) {
    writeTask4PinResetEvidence({
      task: "task-4-session-pin-reset",
      nodeId,
      before,
      afterDrag: after,
      afterRelease: released,
      afterReset: reset,
      afterReload: reloaded,
      layoutSeed: await graph.getAttribute("data-layout-seed"),
      pinPolicy: await graph.getAttribute("data-pin-policy")
    });
  }
}

async function expectNodeDragPinsSessionPosition(page: Page, nodeId: string, expectedInspectorText: string) {
  const graph = page.getByTestId("sigma-corpus-graph");
  const node = page.locator(`.sigma-camera-node-probe[data-node-id="${nodeId}"]`);
  const before = await node.evaluate((element) => ({
    x: Number(element.getAttribute("data-layout-x")),
    y: Number(element.getAttribute("data-layout-y"))
  }));
  const viewportBefore = await nodeViewportRect(page, nodeId);
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  const startX = (box?.x ?? 0) + (box?.width ?? 0) / 2;
  const startY = (box?.y ?? 0) + (box?.height ?? 0) / 2;

  await node.dispatchEvent("pointerdown", { clientX: startX, clientY: startY, pointerId: 17, bubbles: true });
  await expect(graph).toHaveAttribute("data-dragging-node", nodeId);
  await node.dispatchEvent("pointermove", { clientX: startX + 72, clientY: startY + 44, pointerId: 17, bubbles: true });
  await expect(graph).toHaveAttribute("data-dragging-node", nodeId);
  await node.dispatchEvent("pointerup", { clientX: startX + 72, clientY: startY + 44, pointerId: 17, bubbles: true });
  await expect(graph).toHaveAttribute("data-dragging-node", "none");
  await expect(graph).toHaveAttribute("data-pinned-node-count", "1");
  await expect(graph).toHaveAttribute("data-pinned-nodes", nodeId);
  await expect(node).toHaveAttribute("data-pinned", "true");

  const after = await node.evaluate((element) => ({
    x: Number(element.getAttribute("data-layout-x")),
    y: Number(element.getAttribute("data-layout-y"))
  }));
  expect(after).not.toEqual(before);
  await expectNodeRectToChange(page, nodeId, viewportBefore);
  await expect(page.getByTestId("node-inspector")).toContainText(expectedInspectorText);
}

async function performNodeProbeDrag(page: Page, nodeId: string, pointerId: number, deltaX: number, deltaY: number) {
  const node = page.locator(`.sigma-camera-node-probe[data-node-id="${nodeId}"]`);
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  const startX = (box?.x ?? 0) + (box?.width ?? 0) / 2;
  const startY = (box?.y ?? 0) + (box?.height ?? 0) / 2;

  await node.dispatchEvent("pointerdown", { clientX: startX, clientY: startY, pointerId, bubbles: true });
  await node.dispatchEvent("pointermove", { clientX: startX + deltaX, clientY: startY + deltaY, pointerId, bubbles: true });
  await node.dispatchEvent("pointerup", { clientX: startX + deltaX, clientY: startY + deltaY, pointerId, bubbles: true });
}

async function performGraphSearchFocus(page: Page, query: string) {
  const searchbox = page.getByRole("searchbox", { name: "Search public corpus graph nodes" });
  await searchbox.fill(query);
  await page.waitForTimeout(0);
  await searchbox.press("Enter");
}

async function expectNodeRectToChange(page: Page, nodeId: string, before: ViewportRect) {
  await expect.poll(async () => {
    const after = await nodeViewportRect(page, nodeId);
    return Math.round(Math.abs(after.x - before.x) + Math.abs(after.y - before.y) + Math.abs(after.width - before.width) + Math.abs(after.height - before.height));
  }).toBeGreaterThan(2);
}

type ViewportRect = { x: number; y: number; width: number; height: number };

async function nodeViewportRect(page: Page, nodeId: string): Promise<ViewportRect> {
  return page.locator(`.sigma-camera-node-probe[data-node-id="${nodeId}"]`).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
}

async function findEmptyCanvasPoint(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="sigma-corpus-graph"] canvas');
    if (!canvas) {
      throw new Error("Sigma canvas is unavailable");
    }
    const canvasRect = canvas.getBoundingClientRect();
    const nodes = Array.from(document.querySelectorAll(".sigma-camera-node-probe[data-node-id]")).map((node) => node.getBoundingClientRect());
    const candidates = [
      { x: canvasRect.left + canvasRect.width * 0.18, y: canvasRect.top + canvasRect.height * 0.72 },
      { x: canvasRect.left + canvasRect.width * 0.78, y: canvasRect.top + canvasRect.height * 0.32 },
      { x: canvasRect.left + canvasRect.width * 0.52, y: canvasRect.top + canvasRect.height * 0.84 },
      { x: canvasRect.left + canvasRect.width * 0.44, y: canvasRect.top + canvasRect.height * 0.48 }
    ];

    return candidates.find((candidate) => nodes.every((node) => {
      const nodeCenterX = node.left + node.width / 2;
      const nodeCenterY = node.top + node.height / 2;
      return Math.hypot(candidate.x - nodeCenterX, candidate.y - nodeCenterY) > 42;
    })) ?? candidates[0];
  });
}

async function mockCorpusApi(page: Page) {
  let interpretabilitySourceSpans: Array<typeof sourceSpanSearchResult> = [];
  let reviewQueueItems: ReviewQueuePayloadItem[] | undefined;

  await page.route("**/api/knowledgebase/corpus/resources", async (route) => {
    await route.fulfill({ json: resourcesPayload });
  });
  await page.route("**/api/knowledgebase/corpus/graph", async (route) => {
    await route.fulfill({ json: graphPayload });
  });
  await page.route("**/api/knowledgebase/corpus/source-spans", async (route) => {
    await route.fulfill({ json: sourceSpansPayload });
  });
  await page.route("**/api/knowledgebase/corpus/search?**", async (route) => {
    const requestUrl = new URL(route.request().url());
    await route.fulfill({ json: buildSearchPayload(requestUrl.searchParams.get("q") ?? "") });
  });
  await page.route("**/api/knowledgebase/corpus/workbench/trace?**", async (route) => {
    const requestUrl = new URL(route.request().url());
    await route.fulfill({ json: buildWorkbenchTracePayload(requestUrl.searchParams.get("q") ?? "") });
  });
  await page.route("**/api/knowledgebase/corpus/workbench/explain-selection", async (route) => {
    const payload = route.request().postDataJSON() as { source_span_id?: string; selected_node_id?: string; resource_id?: string };
    await route.fulfill({ json: buildExplainSelectionPayload(payload) });
  });
  await page.route("**/api/knowledgebase/corpus/interpretability?**", async (route) => {
    const requestUrl = new URL(route.request().url());
    await route.fulfill({ json: buildInterpretabilityPayload(requestUrl.searchParams.get("resource_id") ?? breastResourceId, interpretabilitySourceSpans, reviewQueueItems) });
  });

  return {
    setInterpretabilitySourceSpans(nextSourceSpans: Array<typeof sourceSpanSearchResult>) {
      interpretabilitySourceSpans = nextSourceSpans;
    },
    setReviewQueueItems(nextReviewQueueItems: ReviewQueuePayloadItem[] | undefined) {
      reviewQueueItems = nextReviewQueueItems;
    }
  };
}

function isKnownBrowserConsoleNoise(message: string) {
  return message.includes("GL Driver Message") && message.includes("GPU stall due to ReadPixels");
}

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

function buildExplainSelectionPayload(request: { source_span_id?: string; selected_node_id?: string; resource_id?: string }) {
  const hasSourceSpanContext = request.source_span_id === sourceSpanSearchResult.span_id;
  const selectedNodeId = request.selected_node_id ?? (request.source_span_id ? request.source_span_id : `resource.${request.resource_id ?? breastResourceId}`);
  const sourceSpanIds = hasSourceSpanContext ? [sourceSpanSearchResult.span_id] : [];
  const sourceIdsUsed = hasSourceSpanContext ? [{
    source_span_id: sourceSpanSearchResult.span_id,
    resource_id: sourceSpanSearchResult.resource_id,
    source_document_id: sourceSpanSearchResult.document_id,
    stable_locator: sourceSpanSearchResult.stable_locator,
    status: "used",
    evidence_id: "evidence.explain.source-span.local-test"
  }] : [];
  const sourceIdsRejected = hasSourceSpanContext ? [] : [{
    resource_id: request.resource_id ?? breastResourceId,
    status: "rejected",
    reason: "missing_validated_source_span_context",
    evidence_id: `evidence.blocked.${request.resource_id ?? breastResourceId}`
  }];
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
  const runnerStatus = hasSourceSpanContext ? "dry_run_completed" : "not_invoked";
  const citationVerifierStatus = hasSourceSpanContext ? "pass" : "not_run";

  return {
    command_label: "explain-selection",
    selected_node_id: selectedNodeId,
    selected_node_type: hasSourceSpanContext ? "resource" : "Resource",
    resource_id: request.resource_id ?? breastResourceId,
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
    cost_ledger_entry: hasSourceSpanContext ? { external_api_used: false, outcome: "executed" } : null,
    source_ids_used: sourceIdsUsed,
    source_ids_rejected: sourceIdsRejected,
    warnings: hasSourceSpanContext ? [] : ["missing_validated_source_span_context"],
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
