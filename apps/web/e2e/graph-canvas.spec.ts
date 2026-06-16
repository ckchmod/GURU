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
  const mutationRequests: string[] = [];
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
  page.on("request", (request) => {
    if (request.method() !== "GET" && /review|queue|interpretability|mutation/i.test(request.url())) {
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
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-layout-mode", "semantic-neighborhoods");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-label-mode", "sparse-focus");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-interaction-mode", "hover-click-drag");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-drag-policy", "sigma-node-drag-session-positions-with-neighbor-tension");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-tension-policy", "edge-weighted-neighbor-pull");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-document-layout-policy", "centroid-integrated-classification-pockets");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-visual-theme", "dark-evidence-vault");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-node-encoding-policy", "color-ring-shape-label-chip");
  await expect(page.getByTestId("sigma-corpus-graph")).toHaveAttribute("data-dragging-node", "none");
  await expect(page.getByLabel("Sigma atlas visual policy")).toContainText("drag affordances");
  await expect(page.getByLabel("Sigma atlas visual policy")).toContainText("edge-weighted neighbor tension");
  await expect(page.getByLabel("Sigma atlas visual policy")).toContainText("centroid-integrated classification pockets");
  await expect(page.getByTestId("sigma-relationship-overlay")).toBeVisible();
  await expect(page.getByLabel("Graph purpose and edge semantics")).toContainText("metadata buckets");
  await expect(page.getByLabel("Graph purpose and edge semantics")).toContainText("archive");
  await expect(page.getByTestId("sigma-constellation-map")).toBeVisible();
  await expect(page.locator(`[data-node-id="resource.${breastResourceId}"]`)).toHaveAttribute("data-node-kind", "resource");
  await expect(page.locator(`[data-node-id="resource.${breastResourceId}"]`)).toHaveAttribute("data-node-status", "Registry metadata");
  await expect(page.locator('[data-node-id="document-type.guideline"]')).toHaveAttribute("data-node-group", "documents");
  await expect(page.locator('[data-node-id="archive-status.metadata-only.not-parsed"]')).toHaveAttribute("data-node-kind", "archive");
  await expect(page.locator(".sigma-constellation-label__chip").first()).toBeVisible();
  await expectDocumentNodesIntegrated(page);
  await expectNodeDragPullsNeighborAndPersistsSessionPosition(page, `resource.${breastResourceId}`, "document-type.guideline", breastResourceId);
  await expectNoOvalGraphBoundary(page);
  await expectRestrainedSigmaAesthetic(page);
  await expect(page.getByLabel("Current workspace path")).toContainText("public-corpus-atlas.graph");
  await expect(page.getByRole("navigation", { name: "Knowledgebase resources" })).toBeVisible();
  await expect(page.getByTestId("source-document-panel")).toContainText("5 parsed-subset coverage");
  await expect(page.getByTestId("source-document-panel")).toContainText("No source-span records are available");
  await expect(page.getByTestId("atlas-workbench")).toContainText("198 public resources");
  await expect(page.getByTestId("atlas-workbench")).toContainText("Model answers disabled until retrieval/source-span verification is implemented.");
  await expect(page.getByTestId("compact-inspector-summary")).toBeVisible();
  await expect(page.getByTestId("compact-inspector-summary")).toContainText("Source availability");
  await expect(page.getByText("changed local archive").first()).toBeVisible();
  await expect(page.getByTestId("trust-provenance-drawer")).toContainText("Offline/local manifest comparison only");
  await expect(page.getByTestId("trust-provenance-drawer")).toContainText("needs review 1");
  await expect(page.getByTestId("trust-provenance-drawer")).not.toContainText(/impact diff|recommendation impact|live surveillance/i);
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
  await expectCompactTextStyle(page, ".atlas-workbench-result span");
  performanceEvidence.searchVisibleMs = Math.round(performance.now() - workbenchSearchStart);
  expect(performanceEvidence.searchVisibleMs as number).toBeLessThanOrEqual(performanceEvidence.searchVisibleThresholdMs as number);
  await expect(workbench).toContainText("Source span results");
  await expect(workbench).toContainText("No source-span records returned for this query");
  await workbench.getByRole("button", { name: /Adjuvant Radiotherapy for Invasive Breast Cancer/i }).click();
  await expect(page.getByTestId("node-inspector")).toContainText(breastResourceId);
  await expect(page.getByTestId("source-document-panel")).toContainText("Adjuvant Radiotherapy for Invasive Breast Cancer");
  await expect(page.getByTestId("trust-provenance-drawer")).toContainText("metadata_only");
  await expect(page.getByTestId("trust-provenance-drawer")).toContainText("Metadata-only coverage: source spans are unavailable/not parsed");
  await expect(page.getByTestId("lookup-relationship-trace")).toContainText("resource");
  await expect(page.getByTestId("lookup-relationship-trace")).toContainText("disease site");
  await expect(page.getByTestId("lookup-relationship-trace")).toContainText("document type");
  await expect(page.getByTestId("lookup-relationship-trace")).toContainText("archive");
  await page.getByTestId("trust-provenance-drawer").screenshot({ path: "../../.omo/evidence/task-8-lookup-focus.png" });
  await page.getByTestId("trust-provenance-drawer").screenshot({ path: "../../.omo/evidence/task-9-surveillance-hud.png" });

  await workbench.getByRole("searchbox", { name: "Search public corpus metadata and parsed source spans" }).fill("deterministic parsed excerpt");
  await workbench.getByRole("button", { name: "Search", exact: true }).click();
  await expect(workbench).toContainText("page:1;span:1");
  await expect(workbench).toContainText("Local deterministic parsed excerpt for search coverage.");
  await expect(workbench).toContainText("source status: draft");
  await expect(workbench).toContainText("parse status: not-parsed");
  await workbench.getByRole("button", { name: /Local deterministic parsed excerpt/i }).click();
  await expect(page.getByTestId("node-inspector")).toContainText(breastResourceId);
  await expect(page.getByTestId("trust-provenance-drawer")).toContainText("page:1;span:1");
  await expect(page.getByTestId("trust-provenance-drawer")).toContainText(`${"0".repeat(64)} · draft`);
  await expect(page.getByTestId("trust-provenance-drawer")).toContainText("Parent resource");
  await expect(page.getByTestId("lookup-relationship-trace")).toContainText("source span");
  await expect(page.getByTestId("lookup-relationship-trace")).toContainText("review item");
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
  performanceEvidence.reviewQueueSmokeCompleted = true;
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
      labelStyle: readTextStyle(".sigma-constellation-label"),
      labelTextStyle: readTextStyle(".sigma-constellation-label > span:last-child")
    };
  });

  expect(visualPolicy).toEqual({
    visualTheme: "dark-evidence-vault",
    nodeEncodingPolicy: "color-ring-shape-label-chip",
    canvasCount: expect.any(Number),
    fakeImageCount: 0,
    hasForbiddenVisualRewrite: false,
    hasCustomThreeRenderer: false,
    labelStyle: {
      minWidth: "0px",
      overflowWrap: "anywhere",
      wordBreak: "keep-all",
      lineBreak: "strict",
      textOverflow: "clip"
    },
    labelTextStyle: {
      minWidth: "0px",
      overflowWrap: "anywhere",
      wordBreak: "keep-all",
      lineBreak: "strict",
      textOverflow: "ellipsis"
    }
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
  pico_placeholder: { population: string | null; intervention: string | null; comparator: string | null; outcome: string | null };
  review_status: string;
  staleness_status: string;
  allowed_actions: string[];
};

function buildSearchPayload(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const metadataResults = resourcesPayload.resources
    .filter((resource) => (
      `${resource.title} ${resource.resource_id} ${resource.disease_site} ${resource.document_type} ${resource.resource_type}`.toLowerCase().includes(normalizedQuery)
    ))
    .map((resource) => ({ ...resource, ...graphFocusMetadata(resource.resource_id, [], graphCoverageStatus(resource)) }));
  const sourceSpanResults = normalizedQuery.includes("deterministic parsed excerpt") ? [{
    ...sourceSpanSearchResult,
    ...graphFocusMetadata(breastResourceId, [sourceSpanSearchResult.span_id], "source_span_ready"),
    focus_resource: {
      ...resourcesPayload.resources[0],
      ...graphFocusMetadata(breastResourceId, [sourceSpanSearchResult.span_id], "source_span_ready")
    }
  }] : [];

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
    pico_placeholder: { population: null, intervention: null, comparator: null, outcome: null },
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
