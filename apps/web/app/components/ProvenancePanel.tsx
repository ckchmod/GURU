import React from "react";
import type { CompactAtlasInterpretabilityModel, CompactAtlasResource, CompactAtlasSurveillanceStatus, CorpusAtlasModel, CorpusSourceSpan } from "../../lib/corpusAtlas";
import {
  buildRelationshipRows,
  coverageStatusCopy,
  effectiveCoverageStatus,
  formatCount,
  formatSourceSpanLabel,
  metadataAvailableLabel,
  offlineResourceStatusCopy,
  offlineResourceStatusLabel,
  offlineStatusTone,
  sourceSpanProvenance
} from "./GraphWorkbenchHelpers";
import { ReviewPanel } from "./ReviewPanel";
import { CopyMetadataButton, StatusChip } from "./GraphWorkbenchShared";
import type { AtlasLoadState, AtlasNodeView, InterpretabilityLoadState, LookupSelection, ReviewQueueLocalAction } from "./GraphWorkbenchTypes";
import type { WorkbenchPanelMode } from "./GraphWorkbenchTypes";

export function ProvenancePanel({
  node,
  resource,
  activeSpan,
  model,
  loadState,
  interpretabilityState,
  lookupSelection,
  surveillanceStatus,
  reviewQueueLocalAction,
  onReviewQueueFocus,
  onReviewQueueLocalAction,
  reviewPanelMode,
  onCollapse,
  onDismiss,
  onCollapseReview,
  onDismissReview,
  onShowReview
}: {
  node: AtlasNodeView | null;
  resource: CompactAtlasResource | null;
  activeSpan: CorpusSourceSpan | null;
  model: CorpusAtlasModel | null;
  loadState: AtlasLoadState;
  interpretabilityState: InterpretabilityLoadState;
  lookupSelection: LookupSelection | null;
  surveillanceStatus: CompactAtlasSurveillanceStatus | null;
  reviewQueueLocalAction: ReviewQueueLocalAction | null;
  onReviewQueueFocus: (resourceId: string, spanId?: string) => void;
  onReviewQueueLocalAction: (reviewTaskId: string, label: string) => void;
  reviewPanelMode: WorkbenchPanelMode;
  onCollapse: () => void;
  onDismiss: () => void;
  onCollapseReview: () => void;
  onDismissReview: () => void;
  onShowReview: () => void;
}) {
  const isResourceSelection = node?.kind === "resource";
  const interpretabilityModel = interpretabilityState.model?.resource.id === resource?.id ? interpretabilityState.model : null;
  const lookupFocus = lookupSelection && resource && lookupSelection.resourceId === resource.id ? lookupSelection.focus : null;
  const activeFocus = lookupFocus ?? interpretabilityModel?.resource ?? null;
  const coverageStatus = effectiveCoverageStatus(resource, activeFocus?.coverageStatus, interpretabilityModel?.coverageStatus);
  const relationshipRows = buildRelationshipRows(resource, activeFocus, interpretabilityModel, model, activeSpan);
  const reviewQueueItems = interpretabilityModel?.reviewQueueItems ?? [];
  const selectedOfflineStatus = surveillanceStatus?.resourceStatuses.find((status) => status.resourceId === resource?.id);
  const sourceAvailability = model
    ? `${model.sourceSpanCoverage.count} parsed-subset resources · ${model.metadata.source_span_node_count} span nodes`
    : "Coverage pending";
  const graphCounts = model ? `${model.graph.order} nodes · ${model.graph.size} edges` : "Graph pending";
  const selectionCount = node
    ? node.aggregateCount > 0 ? `${node.aggregateCount} public resources` : "Single graph node"
    : "Selection pending";
  const sourceSpans = sourceSpansForReviewQueue(interpretabilityModel, activeSpan);
  const sourceSpanCount = activeFocus?.interpretabilitySummary.sourceSpanCount
    ?? interpretabilityModel?.sourceSpans.length
    ?? resource?.sourceSpanCount
    ?? 0;
  const citationLabel = activeSpan ? formatSourceSpanLabel(activeSpan.stable_locator) : "No citation anchor selected";
  const graphPathLabels = relationshipRows.map((row) => row.kind === "source span" ? row.label : row.kind);
  const modelRouting = activeFocus?.interpretabilitySummary.modelRouting ?? interpretabilityModel?.modelRouting ?? "none-local-deterministic-search-only";

  return (
    <aside
      className="node-inspector"
      data-testid="node-inspector"
      aria-label={node ? `Provenance inspector for ${node.title}` : "Provenance inspector"}
    >
      <header className="node-inspector__header">
        <div className="panel-header-row">
          <p className="eyebrow">Provenance inspector</p>
          <div className="panel-header-actions" aria-label="Provenance panel controls">
            <button type="button" onClick={onCollapse}>Collapse Provenance panel</button>
            <button type="button" onClick={onDismiss}>Dismiss Provenance panel</button>
          </div>
        </div>
        <h2>{node ? node.title : "No graph node selected"}</h2>
        <p>{node?.summary ?? loadState.message}</p>
      </header>

      <section className="provenance-purpose" aria-label="Provenance purpose">
        <strong>Trust, source, graph, and model status for the selected atlas item.</strong>
        <p>This panel explains why a result can or cannot be trusted without rendering guidance text, clinical advice, or raw audit identifiers in the primary view.</p>
      </section>

      <div className="inspector-card-grid" data-testid="compact-inspector-summary">
        <section className="inspector-card" aria-label="Selected graph node summary">
          <span className="inspector-card__label">Selected graph node</span>
          <strong>{node?.type ?? "pending"}</strong>
          <small>{selectionCount}</small>
        </section>
        <section className="inspector-card" aria-label="Archive and parse state">
          <span className="inspector-card__label">Archive and parse state</span>
          <strong>{isResourceSelection && resource ? resource.responseState : loadState.status}</strong>
          <small>{isResourceSelection && resource ? `${resource.archiveStatus} · ${resource.parseStatus}` : loadState.message}</small>
        </section>
        <section className="inspector-card" aria-label="Source-span availability">
          <span className="inspector-card__label">Source availability</span>
          <strong>{sourceAvailability}</strong>
          <small>{activeSpan ? formatSourceSpanLabel(activeSpan.stable_locator) : "No source-span records are available for this resource in the current parsed subset output."}</small>
        </section>
        <section className="inspector-card inspector-card--safety" aria-label="Safety and provenance boundary">
          <span className="inspector-card__label">Safety and provenance</span>
          <strong>{node?.provenanceStatus ?? "Draft atlas view"}</strong>
          <small>No patient data, no clinical advice, and no approved clinical claim.</small>
        </section>
      </div>

      <div className="inspector-compact-rows" aria-label="Graph metadata summary">
        <div>
          <span>Atlas load state</span>
          <strong>{loadState.status} · {loadState.message}</strong>
        </div>
        <div>
          <span>Graphology model</span>
          <strong>{graphCounts}</strong>
        </div>
        <div>
          <span>Reviewer status</span>
          <strong>{node?.reviewerStatus ?? "Draft atlas view"}</strong>
        </div>
      </div>

      <section className="trust-drawer" data-testid="trust-provenance-drawer" aria-label="Trust and provenance drawer">
        <div className="trust-drawer__header">
          <span className="eyebrow">Trust drawer</span>
          <strong>{resource?.title ?? "Resource pending"}</strong>
          <small>{interpretabilityState.status} · {interpretabilityState.message}</small>
        </div>

        <section className="provenance-question-grid" aria-label="Concise provenance answers">
          <article className="provenance-question-card">
            <span>Why trust this?</span>
            <strong>{activeSpan ? "Source-backed draft context" : "Metadata-only, no claim rendered"}</strong>
            <p>{activeSpan ? `A parsed ${activeSpan.output_status} source span is selected; exact audit metadata stays in details.` : coverageStatusCopy(coverageStatus)}</p>
          </article>
          <article className="provenance-question-card">
            <span>Source coverage</span>
            <strong>{formatCount(sourceSpanCount, "source span")}</strong>
            <p>{coverageStatusCopy(coverageStatus)}</p>
          </article>
          <article className="provenance-question-card">
            <span>Citations</span>
            <strong>{citationLabel}</strong>
            <p>{activeSpan ? `Citation metadata is available for ${metadataAvailableLabel(sourceSpanProvenance(activeSpan).sourceDocumentId).toLowerCase()}; exact IDs and checksum are in details.` : "No citation-ready source span is selected, so no clinical claim is displayed."}</p>
          </article>
          <article className="provenance-question-card" data-testid="lookup-relationship-trace">
            <span>Graph path</span>
            <strong>{graphPathLabels.length > 0 ? graphPathLabels.join(" -> ") : "Graph path pending"}</strong>
            <p>{formatCount(activeFocus?.interpretabilitySummary.graphNeighborCount ?? relationshipRows.length, "relationship")} connect resource metadata, source-span context, and review state when present.</p>
          </article>
          <article className="provenance-question-card provenance-question-card--wide">
            <span>Model/gateway status</span>
            <strong>{modelRouting}</strong>
            <p>Only selected-context cited draft answers are allowed; this view shows deterministic metadata, graph links, local gateway status, and source-span provenance. External API use is not shown as enabled.</p>
            <div className="status-chip-row" aria-label="Offline local archive status chips">
              <StatusChip tone={offlineStatusTone(selectedOfflineStatus?.reviewStatus)}>{selectedOfflineStatus?.reviewStatus ?? "local_pending"}</StatusChip>
              <StatusChip tone="neutral">changed {surveillanceStatus?.changedCount ?? 0}</StatusChip>
              <StatusChip tone="warning">missing {surveillanceStatus?.missingCount ?? 0}</StatusChip>
              <StatusChip tone="success">unchanged {surveillanceStatus?.unchangedCount ?? 0}</StatusChip>
              <StatusChip tone="warning">needs review {surveillanceStatus?.needsReviewCount ?? 0}</StatusChip>
            </div>
            <small>{offlineResourceStatusLabel(selectedOfflineStatus?.changeState)} · {offlineResourceStatusCopy(selectedOfflineStatus, surveillanceStatus)}</small>
          </article>
        </section>

        {reviewPanelMode === "visible" ? (
          <ReviewPanel
            items={reviewQueueItems}
            resource={resource}
            sourceSpans={sourceSpans}
            localAction={reviewQueueLocalAction}
            onFocus={onReviewQueueFocus}
            onLocalAction={onReviewQueueLocalAction}
            onCollapse={onCollapseReview}
            onDismiss={onDismissReview}
          />
        ) : (
          <button type="button" className="panel-restore-button" onClick={onShowReview}>
            {reviewPanelMode === "collapsed" ? "Expand Review panel" : "Show Review panel"}
          </button>
        )}
      </section>

      {isResourceSelection && resource ? (
        <details className="inspector-details" data-testid="resource-identifier-details">
          <summary>Resource metadata details and copy controls</summary>
          <CopyMetadataButton label="resource ID" value={resource.id} />
          <dl>
            <div>
              <dt>Resource ID</dt>
              <dd className="wrap-anywhere">{resource.id}</dd>
            </div>
            <div>
              <dt>Source URL</dt>
              <dd className="wrap-anywhere">{resource.url}</dd>
            </div>
            <div>
              <dt>Resource metadata</dt>
              <dd>{resource.title} · {resource.diseaseSite} · {resource.documentType}</dd>
            </div>
          </dl>
        </details>
      ) : null}

      <details className="inspector-details" data-testid="source-span-details">
        <summary>Source span metadata details and copy controls</summary>
        {activeSpan ? <CopyMetadataButton label="source span ID" value={activeSpan.span_id} /> : null}
        <dl>
          <div>
            <dt>Active source span ID</dt>
            <dd className="wrap-anywhere">{activeSpan?.span_id ?? "No source-span result for this resource"}</dd>
          </div>
          <div>
            <dt>Stable locator</dt>
            <dd className="wrap-anywhere">{activeSpan?.stable_locator ?? "No locator available"}</dd>
          </div>
          <div>
            <dt>Checksum</dt>
            <dd className="wrap-anywhere">{activeSpan?.checksum_sha256 ?? "No checksum returned"}</dd>
          </div>
          <div>
            <dt>Source document</dt>
            <dd className="wrap-anywhere">{activeSpan ? sourceSpanProvenance(activeSpan).sourceDocumentId : "No source document returned"}</dd>
          </div>
          <div>
            <dt>Quoted span</dt>
            <dd className="wrap-anywhere">{activeSpan?.excerpt ?? "No quoted span is displayed when derived source-span files are absent."}</dd>
          </div>
        </dl>
      </details>
    </aside>
  );
}

function sourceSpansForReviewQueue(interpretabilityModel: CompactAtlasInterpretabilityModel | null, activeSpan: CorpusSourceSpan | null) {
  const spans = interpretabilityModel?.sourceSpans ?? [];
  if (!activeSpan || spans.some((span) => span.span_id === activeSpan.span_id)) {
    return spans;
  }
  return [activeSpan, ...spans];
}
