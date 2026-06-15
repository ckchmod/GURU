import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GuidelineGraphCanvas } from "./GuidelineGraphCanvas";

describe("GuidelineGraphCanvas", () => {
  it("renders the synthetic graph canvas and default inspector", () => {
    render(<GuidelineGraphCanvas />);

    expect(screen.getByTestId("guideline-graph-canvas")).toBeVisible();
    expect(screen.getByTestId("node-inspector")).toHaveTextContent("Synthetic Review Charter");
    expect(screen.getByRole("navigation", { name: "Knowledgebase resources" })).toBeVisible();
    expect(screen.getByText("Evidence Atlas")).toBeVisible();
    expect(screen.getByText("No clinical advice")).toBeVisible();
  });

  it("renders graph navigation controls and API-shaped provenance records", () => {
    render(<GuidelineGraphCanvas />);

    expect(screen.getByRole("button", { name: "Zoom In" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Zoom Out" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Fit View" })).toBeVisible();
    expect(screen.getByTestId("node-inspector")).toHaveTextContent("knowledgebase-record.ahs-guru-breast-br005-adjuvant-rt-invasive-breast");
    expect(screen.getByTestId("node-inspector")).toHaveTextContent("none-local-fixture-only");
    expect(screen.getByTestId("source-document-panel")).toHaveTextContent("source-document.ahs-guru-breast-br005-adjuvant-rt-invasive-breast");
    expect(screen.getByTestId("source-document-panel")).toHaveTextContent("source-span.source-document.ahs-guru-breast-br005-adjuvant-rt-invasive-breast");
    expect(screen.getByRole("contentinfo", { name: "Evidence trace console" })).toHaveTextContent("workbench: queued extraction review placeholder");
  });

  it("switches selected resource metadata, source span IDs, and graph-ready record", () => {
    render(<GuidelineGraphCanvas />);

    fireEvent.click(screen.getByRole("button", { name: /Brain Metastases/i }));

    expect(screen.getByTestId("node-inspector")).toHaveTextContent("knowledgebase-record.ahs-guru-central-nervous-system-cns014-management-of-brain-metastases");
    expect(screen.getByTestId("node-inspector")).toHaveTextContent("central-nervous-system");
    expect(screen.getByTestId("source-document-panel")).toHaveTextContent("source-document.ahs-guru-central-nervous-system-cns014-management-of-brain-metastases");
    expect(screen.getByTestId("atlas-workbench")).toHaveTextContent("ahs-guru-central-nervous-system-cns014-management-of-brain-metastases");
  });
});
