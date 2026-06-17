import React from "react";
import type { AtlasLoadState, AtlasNodeView } from "./GraphWorkbenchTypes";
import { modelDisabledNote } from "./GraphWorkbenchTypes";

export function StatusChip({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <small className="status-chip" data-tone={tone}>{children}</small>;
}

export function AtlasStateCard({ loadState }: { loadState: AtlasLoadState }) {
  const title = loadState.status === "loading"
    ? "Loading corpus atlas"
    : loadState.status === "empty"
      ? "No atlas resources returned"
      : "Corpus API unavailable";

  return (
    <aside className="atlas-state-card" role="status" aria-live="polite">
      <p className="eyebrow">Atlas state</p>
      <h2>{title}</h2>
      <p>{loadState.message}</p>
      <p>No patient data and no clinical advice are shown in this state. {modelDisabledNote}</p>
    </aside>
  );
}

export function NodeHoverCard({ node }: { node: AtlasNodeView }) {
  return (
    <aside className="node-hover-card" data-testid="node-hover-card" aria-live="polite">
      <span>{node.type}</span>
      <strong>{node.title}</strong>
      <p>{node.summary}</p>
      <p>{node.sourceLabel}</p>
    </aside>
  );
}

export function CopyMetadataButton({ label, value }: { label: string; value: string }) {
  const copyValue = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    void navigator.clipboard.writeText(value);
  };

  return (
    <button type="button" className="metadata-copy-button" onClick={copyValue}>
      Copy {label}
    </button>
  );
}
