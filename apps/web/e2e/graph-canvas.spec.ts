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
  await expect(page.getByRole("navigation", { name: "Synthetic graph layers" })).toBeVisible();
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
  await expect(page.getByTestId("node-inspector")).toContainText("SYNTH-EVIDENCE-003");
  await expect(page.getByTestId("node-inspector")).toContainText("Checksum placeholder only");

  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");

  expect(consoleErrors).toEqual([]);
});
