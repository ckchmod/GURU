import React from "react";
import type { CompactAtlasResource, CorpusSourceSpan } from "../../lib/corpusAtlas";
import { formatSourceSpanLabel, metadataAvailableLabel } from "./GraphWorkbenchHelpers";

export function SourceViewPanel({
  selectedResource,
  sourceSpans,
  activeSpanId,
  coverageCount,
  coverageNote,
  onSpanSelect,
  onClose
}: {
  selectedResource: CompactAtlasResource | null;
  sourceSpans: CorpusSourceSpan[];
  activeSpanId: string | null;
  coverageCount: number;
  coverageNote: string;
  onSpanSelect: (spanId: string) => void;
  onClose: () => void;
}) {
  return (
    <aside className="source-document-panel" data-testid="source-document-panel" aria-label="Source document and span browser">
      <div className="source-document-panel__header">
        <div>
          <span className="eyebrow">Source view</span>
          <strong>{coverageCount} parsed-subset coverage</strong>
        </div>
        <button type="button" className="panel-icon-button" onClick={onClose}>Close Source View</button>
      </div>
      <dl className="source-document-meta">
        <div>
          <dt>Selected resource</dt>
          <dd>{selectedResource?.title ?? "Resource pending"}</dd>
        </div>
        <div>
          <dt>Coverage note</dt>
          <dd>{coverageNote}</dd>
        </div>
      </dl>
      <div className="source-span-list" role="list" aria-label="Source spans for selected resource">
        {sourceSpans.length > 0 ? sourceSpans.map((span) => (
          <button
            key={span.span_id}
            type="button"
            data-active={span.span_id === activeSpanId}
            onClick={() => onSpanSelect(span.span_id)}
          >
            <span>{formatSourceSpanLabel(span.stable_locator)}</span>
            <strong>{span.output_status} source span</strong>
            <small>{metadataAvailableLabel(span.span_id)}</small>
          </button>
        )) : (
          <p className="source-span-empty">No source-span records are available for this resource in the current parsed subset output.</p>
        )}
      </div>
    </aside>
  );
}
