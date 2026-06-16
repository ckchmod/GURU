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

test("Sigma graph canvas load, search, selection, and API-backed corpus states work without console findings", async ({ page }) => {
  const consoleFindings: string[] = [];
  const performanceEvidence: Record<string, number | string | boolean> = {
    graphReadyThresholdMs: 10000,
    searchVisibleThresholdMs: 2500,
    mockedCorpusApi: true
  };
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      if (isKnownBrowserConsoleNoise(message.text())) {
        return;
      }
      consoleFindings.push(`${message.type()}: ${message.text()}`);
    }
  });
  await mockCorpusApi(page);

  const graphStart = performance.now();
  await page.goto("/");

  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.locator(".ide-window-controls")).toHaveCount(0);
  await expect(page.getByTestId("guideline-graph-canvas")).toBeVisible();
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-node-count", "6");
  performanceEvidence.graphReadyMs = Math.round(performance.now() - graphStart);
  expect(performanceEvidence.graphReadyMs as number).toBeLessThanOrEqual(performanceEvidence.graphReadyThresholdMs as number);
  await expect(page.getByTestId("sigma-corpus-graph").locator("canvas").first()).toBeVisible();
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-layout-mode", "semantic-neighborhoods");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-label-mode", "sparse-focus");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-interaction-mode", "hover-click-drag");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-drag-policy", "sigma-node-drag-session-positions-with-neighbor-tension");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-tension-policy", "edge-weighted-neighbor-pull");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-document-layout-policy", "centroid-integrated-classification-pockets");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-dragging-node", "none");
  await expect(page.getByLabel("Sigma atlas visual policy")).toContainText("drag affordances");
  await expect(page.getByLabel("Sigma atlas visual policy")).toContainText("edge-weighted neighbor tension");
  await expect(page.getByLabel("Sigma atlas visual policy")).toContainText("centroid-integrated classification pockets");
  await expect(page.getByTestId("sigma-relationship-overlay")).toBeVisible();
  await expect(page.getByLabel("Graph purpose and edge semantics")).toContainText("metadata buckets");
  await expect(page.getByLabel("Graph purpose and edge semantics")).toContainText("archive");
  await expect(page.getByTestId("sigma-constellation-map")).toBeVisible();
  await expectDocumentNodesIntegrated(page);
  await expectNodeDragPullsNeighborAndPersistsSessionPosition(page, `resource.${breastResourceId}`, "document-type.guideline", breastResourceId);
  await expectNoOvalGraphBoundary(page);
  await expect(page.getByLabel("Current workspace path")).toContainText("public-corpus-atlas.graph");
  await expect(page.getByRole("navigation", { name: "Knowledgebase resources" })).toBeVisible();
  await expect(page.getByTestId("source-document-panel")).toContainText("5 parsed-subset coverage");
  await expect(page.getByTestId("source-document-panel")).toContainText("No source-span records are available");
  await expect(page.getByTestId("atlas-workbench")).toContainText("198 public resources");
  await expect(page.getByTestId("atlas-workbench")).toContainText("Model answers disabled until retrieval/source-span verification is implemented.");
  await expect(page.getByTestId("compact-inspector-summary")).toBeVisible();
  await expect(page.getByTestId("compact-inspector-summary")).toContainText("Source availability");
  await expect(page.getByTestId("compact-inspector-summary")).not.toContainText(breastResourceId);
  await expect(page.getByTestId("resource-identifier-details")).not.toHaveAttribute("open", "");
  await expect(page.getByRole("heading", { name: "Guideline graph workbench" })).toHaveCount(0);

  const canvas = page.getByTestId("guideline-graph-canvas");
  await canvas.hover();
  await page.mouse.wheel(0, -240);
  await page.mouse.down();
  await page.mouse.move(520, 360);
  await page.mouse.up();

  await expect(page.getByTestId("node-inspector")).toContainText(breastResourceId);
  await expect(page.getByTestId("node-inspector")).toContainText("No source-span result for this resource");
  await page.getByTestId("node-inspector").screenshot({ path: "../../.omo/evidence/task-10-compact-inspector.png" });
  await page.getByTestId("resource-identifier-details").click();
  await expect(page.getByTestId("resource-identifier-details")).toContainText(breastResourceId);

  await page.getByRole("navigation", { name: "Knowledgebase resources" }).getByRole("button", { name: /Brain Metastases/i }).click();
  await expect(page.getByTestId("node-inspector")).toContainText(brainResourceId);

  await page.getByRole("searchbox", { name: "Search public corpus graph nodes" }).fill("Adjuvant Radiotherapy for Invasive Breast Cancer");
  await expect(page.locator(".sigma-search-results button")).toContainText("Adjuvant Radiotherapy for Invasive Breast Cancer");
  await page.getByRole("searchbox", { name: "Search public corpus graph nodes" }).press("Enter");
  await expect(page.getByTestId("node-inspector")).toContainText(breastResourceId);
  await expect(page.getByTestId("node-inspector")).toContainText("Adjuvant Radiotherapy for Invasive Breast Cancer");
  await expect(page.getByTestId("source-document-panel")).toContainText("Adjuvant Radiotherapy for Invasive Breast Cancer");
  await expect(page.getByTestId("atlas-workbench")).toContainText(breastResourceId);

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
  await expect(workbench).toContainText("Metadata results");
  performanceEvidence.searchVisibleMs = Math.round(performance.now() - workbenchSearchStart);
  expect(performanceEvidence.searchVisibleMs as number).toBeLessThanOrEqual(performanceEvidence.searchVisibleThresholdMs as number);
  await expect(workbench).toContainText("Source span results");
  await expect(workbench).toContainText("No source-span records returned for this query");
  await workbench.getByRole("button", { name: /Adjuvant Radiotherapy for Invasive Breast Cancer/i }).click();
  await expect(page.getByTestId("node-inspector")).toContainText(breastResourceId);
  await expect(page.getByTestId("source-document-panel")).toContainText("Adjuvant Radiotherapy for Invasive Breast Cancer");

  await workbench.getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }).fill("deterministic parsed excerpt");
  await workbench.getByRole("button", { name: "Search", exact: true }).click();
  await expect(workbench).toContainText("page:1;span:1");
  await expect(workbench).toContainText("Local deterministic parsed excerpt for search coverage.");
  await expect(workbench).toContainText("source status: draft");
  await expect(workbench).toContainText("parse status: not-parsed");

  await workbench.getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }).fill("zzzz-no-such-guideline");
  await workbench.getByRole("button", { name: "Search", exact: true }).click();
  await expect(workbench).toContainText("No results for this query in public metadata or parsed source spans.");
  await expect(workbench).not.toContainText(/no evidence/i);

  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("atlas-workbench")).not.toContainText(/Synthetic|Packet Alpha|Model Trace Stub|Evidence Hub|Mock|Demo|Placeholder/);
  await expect(page.locator("body")).not.toContainText(/chat transcript|assistant response|generated answer|external llm/i);

  await page.setViewportSize({ width: 500, height: 900 });
  await expect(workbench).toBeVisible();
  await expect(workbench.getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" })).toBeVisible();
  await expect(workbench).toContainText("Metadata results");
  await expect(workbench).toContainText("Source span results");
  expect(consoleFindings).toEqual([]);
  performanceEvidence.consoleFindings = consoleFindings.length;
  performanceEvidence.panZoomSmokeCompleted = true;
  performanceEvidence.graphSearchSmokeCompleted = true;
  performanceEvidence.workbenchSearchSmokeCompleted = true;
  writeTask12PerformanceEvidence(performanceEvidence);
});

function writeTask12PerformanceEvidence(evidence: Record<string, number | string | boolean>) {
  mkdirSync("../../.omo/evidence", { recursive: true });
  writeFileSync("../../.omo/evidence/task-12-performance.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf-8");
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
      hidesWorkbenchAtSmallViewport: /\.atlas-workbench\s*\{[^}]*display:\s*none/.test(stylesheetText)
    };
  });

  expect(visualPolicy).toEqual({
    beforeBackground: expect.not.stringContaining("radial-gradient"),
    hasCenteredRadialVignette: false,
    hasConstellationOvalRule: false,
    hidesWorkbenchAtSmallViewport: false
  });
}

async function expectDocumentNodesIntegrated(page: Page) {
  const documentLayout = await page.evaluate(() => Array.from(document.querySelectorAll('[data-node-group="documents"]')).map((node) => ({
    nodeId: node.getAttribute("data-node-id"),
    y: Number(node.getAttribute("data-layout-y")),
    topPercent: Number.parseFloat((node as HTMLElement).style.top)
  })));

  expect(documentLayout.length).toBeGreaterThan(0);
  expect(documentLayout.every((node) => node.y > -130)).toBe(true);
  expect(documentLayout.every((node) => node.topPercent > 20)).toBe(true);
}

async function expectNodeDragPullsNeighborAndPersistsSessionPosition(page: Page, nodeId: string, neighborNodeId: string, expectedInspectorText: string) {
  const graph = page.getByTestId("sigma-corpus-graph");
  const node = page.locator(`[data-node-id="${nodeId}"]`);
  const neighbor = page.locator(`[data-node-id="${neighborNodeId}"]`);
  const before = await node.evaluate((element) => ({
    x: Number(element.getAttribute("data-layout-x")),
    y: Number(element.getAttribute("data-layout-y"))
  }));
  const neighborBefore = await neighbor.evaluate((element) => ({
    x: Number(element.getAttribute("data-layout-x")),
    y: Number(element.getAttribute("data-layout-y"))
  }));
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  const startX = (box?.x ?? 0) + (box?.width ?? 0) / 2;
  const startY = (box?.y ?? 0) + (box?.height ?? 0) / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await expect(graph).toHaveAttribute("data-dragging-node", nodeId);
  await expect(neighbor).toHaveAttribute("data-reacting", "true");
  await page.mouse.move(startX + 72, startY + 44, { steps: 10 });
  await expect(graph).toHaveAttribute("data-dragging-node", nodeId);
  await page.mouse.up();
  await expect(graph).toHaveAttribute("data-dragging-node", "none");

  const after = await node.evaluate((element) => ({
    x: Number(element.getAttribute("data-layout-x")),
    y: Number(element.getAttribute("data-layout-y"))
  }));
  const neighborAfter = await neighbor.evaluate((element) => ({
    x: Number(element.getAttribute("data-layout-x")),
    y: Number(element.getAttribute("data-layout-y"))
  }));
  expect(after).not.toEqual(before);
  expect(neighborAfter).not.toEqual(neighborBefore);
  await expect(page.getByTestId("node-inspector")).toContainText(expectedInspectorText);
}

async function mockCorpusApi(page: Page) {
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
