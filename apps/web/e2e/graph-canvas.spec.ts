import { expect, test } from "@playwright/test";

test("graph canvas shell, hover card, inspector, and zoom controls work without console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");

  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("guideline-graph-canvas")).toBeVisible();
  await expect(page.getByLabel("Current workspace path")).toContainText("synthetic-atlas.graph");
  await expect(page.getByRole("navigation", { name: "Knowledgebase resources" })).toBeVisible();
  await expect(page.getByTestId("source-document-panel")).toContainText("source_document");
  await expect(page.getByTestId("node-inspector")).toContainText("knowledgebase-record.ahs-guru-breast-br005-adjuvant-rt-invasive-breast");
  await expect(page.getByRole("heading", { name: "Guideline graph workbench" })).toHaveCount(0);

  const canvas = page.getByTestId("guideline-graph-canvas");
  await canvas.hover();
  await page.mouse.wheel(0, -240);
  await page.mouse.down();
  await page.mouse.move(520, 360);
  await page.mouse.up();

  const node = page.getByRole("button", { name: /Synthetic Evidence Packet/i });
  await node.hover();
  await expect(page.getByTestId("node-hover-card")).toContainText("Synthetic Evidence Packet");
  await expect(page.getByTestId("node-hover-card")).toContainText("Evidence item");

  await node.click();
  await expect(page.getByTestId("node-inspector")).toContainText("Synthetic Evidence Packet");
  await expect(page.getByTestId("node-inspector")).toContainText("source-span.source-document.ahs-guru-breast-br005-adjuvant-rt-invasive-breast");

  await page.getByRole("button", { name: /Brain Metastases/i }).click();
  await expect(page.getByTestId("node-inspector")).toContainText("knowledgebase-record.ahs-guru-central-nervous-system-cns014-management-of-brain-metastases");
  await expect(page.getByTestId("source-document-panel")).toContainText("source-document.ahs-guru-central-nervous-system-cns014-management-of-brain-metastases");

  await page.getByRole("button", { name: /paragraph:2/ }).click();
  await expect(page.getByTestId("node-inspector")).toContainText("paragraph:2");
  await expect(page.getByTestId("atlas-workbench")).toContainText("p0002");

  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");

  expect(consoleErrors).toEqual([]);
});
