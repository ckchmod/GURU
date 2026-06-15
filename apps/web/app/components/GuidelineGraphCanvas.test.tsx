import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GuidelineGraphCanvas } from "./GuidelineGraphCanvas";

describe("GuidelineGraphCanvas", () => {
  it("renders the synthetic graph canvas and default inspector", () => {
    render(<GuidelineGraphCanvas />);

    expect(screen.getByTestId("guideline-graph-canvas")).toBeVisible();
    expect(screen.getByTestId("node-inspector")).toHaveTextContent("Synthetic Review Charter");
    expect(screen.getByRole("navigation", { name: "Synthetic graph layers" })).toBeVisible();
    expect(screen.getByText("Evidence Atlas")).toBeVisible();
    expect(screen.getByText("No clinical advice")).toBeVisible();
  });

  it("renders graph navigation controls and provenance placeholders", () => {
    render(<GuidelineGraphCanvas />);

    expect(screen.getByRole("button", { name: "Zoom In" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Zoom Out" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Fit View" })).toBeVisible();
    expect(screen.getByTestId("node-inspector")).toHaveTextContent("Source placeholder");
    expect(screen.getByTestId("node-inspector")).toHaveTextContent("SYNTH-CHARTER-001");
    expect(screen.getByRole("contentinfo", { name: "Evidence trace console" })).toHaveTextContent("source-span placeholders visible");
  });
});
