import React, { useMemo } from "react";
import type { CompactAtlasResource, CompactAtlasReviewQueueItem, CorpusSourceSpan } from "../../lib/corpusAtlas";
import { formatCount, formatSourceSpanLabel, metadataAvailableLabel } from "./GraphWorkbenchHelpers";
import { CopyMetadataButton, StatusChip } from "./GraphWorkbenchShared";
import type { ReviewQueueLocalAction } from "./GraphWorkbenchTypes";

export function ReviewPanel({
  items,
  resource,
  sourceSpans,
  localAction,
  onFocus,
  onLocalAction,
  onCollapse,
  onDismiss
}: {
  items: CompactAtlasReviewQueueItem[];
  resource: CompactAtlasResource | null;
  sourceSpans: CorpusSourceSpan[];
  localAction: ReviewQueueLocalAction | null;
  onFocus: (resourceId: string, spanId?: string) => void;
  onLocalAction: (reviewTaskId: string, label: string) => void;
  onCollapse: () => void;
  onDismiss: () => void;
}) {
  const sourceSpanById = useMemo(() => new Map(sourceSpans.map((span) => [span.span_id, span])), [sourceSpans]);
  const reviewGroups = useMemo(() => buildReviewGroups(items, resource?.id ?? null, sourceSpanById), [items, resource?.id, sourceSpanById]);
  const statusSummary = summarizeStatuses(items.map((item) => item.reviewStatus));
  const stalenessSummary = summarizeStatuses(items.map((item) => item.stalenessStatus));
  const allowedActionLabels = reviewGroups.sourceBacked.flatMap((item) => item.allowedActions.map(reviewQueueActionLabel));
  const uniqueActionLabels = [...new Set(allowedActionLabels)];

  return (
    <section className="review-queue-relation" data-testid="review-queue-section" aria-label="Review Queue">
      <div className="relationship-trace__title">
        <strong>Review queue summary</strong>
        <span>{formatCount(items.length, "review task")}</span>
        <div className="panel-header-actions" aria-label="Review panel controls">
          <button type="button" onClick={onCollapse}>Collapse Review panel</button>
          <button type="button" onClick={onDismiss}>Dismiss Review panel</button>
        </div>
      </div>
      <p className="review-queue-relation__note">Source-backed local review metadata is summarized by status and source coverage. Exact review IDs remain in metadata details; actions update this view only and do not write to a backend.</p>
      {items.length > 0 ? (
        <div className="review-summary-grid">
          <article className="review-summary-card">
            <span>Review queue summary</span>
            <strong>{formatCount(items.length, "review task")}</strong>
            <p>{statusSummary} · {stalenessSummary}</p>
          </article>
          <article className="review-summary-card">
            <span>Source-backed items</span>
            <strong>{formatCount(reviewGroups.sourceBacked.length, "item")}</strong>
            <p>{reviewGroups.sourceBacked.length > 0 ? `${formatCount(reviewGroups.sourceBackedSourceSpanCount, "source span")} ready for local inspection.` : "No source-backed review item is ready for this resource."}</p>
          </article>
          <article className="review-summary-card">
            <span>Blocked/unbacked items</span>
            <strong>{formatCount(reviewGroups.blocked.length, "item")}</strong>
            <p>{reviewGroups.blocked.length > 0 ? "Blocked local items do not display source content or imply findings." : "No blocked local review items returned."}</p>
          </article>
          <article className="review-summary-card">
            <span>Local actions</span>
            <strong>{formatCount(uniqueActionLabels.length, "action")}</strong>
            <p>{uniqueActionLabels.length > 0 ? uniqueActionLabels.join(" · ") : "No local actions available until source backing exists."}</p>
          </article>
        </div>
      ) : (
        <p className="review-queue-relation__empty">No source-backed local review queue items returned for this resource.</p>
      )}

      {reviewGroups.sourceBacked.length > 0 ? (
        <section className="review-queue-group" aria-label="Source-backed items">
          <div className="relationship-trace__title">
            <strong>Source-backed items</strong>
            <span>{formatCount(reviewGroups.sourceBacked.length, "item")}</span>
          </div>
          <ul>
            {reviewGroups.sourceBacked.map((item) => {
              const primarySpanId = item.sourceSpanIds[0];
              const primarySpan = primarySpanId ? sourceSpanById.get(primarySpanId) : undefined;
              const localStatus = localAction?.reviewTaskId === item.reviewTaskId ? localAction.label : null;
              const sourceSpanLabel = primarySpan ? formatSourceSpanLabel(primarySpan.stable_locator) : "source span unavailable";

              return (
                <li
                  key={item.reviewTaskId}
                  className="review-queue-card"
                  data-testid={`review-queue-card-${item.reviewTaskId}`}
                  data-blocked="false"
                  role="button"
                  tabIndex={0}
                  aria-label={`Focus source-backed review task for ${sourceSpanLabel}`}
                  onClick={() => onFocus(item.resourceId, primarySpanId)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") {
                      return;
                    }
                    event.preventDefault();
                    onFocus(item.resourceId, primarySpanId);
                  }}
                >
                  <div className="review-queue-card__topline">
                    <span>{item.reviewStatus} · {item.stalenessStatus}</span>
                    <StatusChip tone={reviewQueueStatusTone(true, item.stalenessStatus)}>source-backed</StatusChip>
                  </div>
                  <strong className="wrap-anywhere">{resource?.title ?? "Resource title unavailable"}</strong>
                  <small className="wrap-anywhere">Source span: {sourceSpanLabel}</small>
                  <small className="wrap-anywhere">Audit status: {primarySpan ? `${primarySpan.output_status}; checksum ${metadataAvailableLabel(primarySpan.checksum_sha256).toLowerCase()}` : "source metadata pending"}</small>
                  <details className="inspector-details review-queue-card__details" onClick={(event) => event.stopPropagation()}>
                    <summary>Review metadata details and copy controls</summary>
                    <CopyMetadataButton label="review task ID" value={item.reviewTaskId} />
                    <dl>
                      <div><dt>Review task ID</dt><dd className="wrap-anywhere">{item.reviewTaskId}</dd></div>
                      <div><dt>Source span IDs</dt><dd className="wrap-anywhere">{item.sourceSpanIds.join(", ") || "none"}</dd></div>
                      <div><dt>Stable locator</dt><dd className="wrap-anywhere">{primarySpan?.stable_locator ?? "No stable locator returned"}</dd></div>
                      <div><dt>Checksum</dt><dd className="wrap-anywhere">{primarySpan?.checksum_sha256 ?? "No checksum returned"}</dd></div>
                    </dl>
                  </details>
                  {primarySpan?.excerpt ? <q>{primarySpan.excerpt}</q> : null}
                  <div className="review-queue-actions" aria-label={`Allowed local actions for ${sourceSpanLabel}`}>
                    {item.allowedActions.map((action) => {
                      const label = reviewQueueActionLabel(action);
                      return (
                        <button
                          key={action}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (action === "inspect_source") {
                              onFocus(item.resourceId, primarySpanId);
                            }
                            onLocalAction(item.reviewTaskId, label);
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {localStatus ? <small role="status" className="review-queue-local-state">Local UI state: {localStatus}</small> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {reviewGroups.blocked.length > 0 ? (
        <section className="review-queue-group" aria-label="Blocked/unbacked items">
          <div className="relationship-trace__title">
            <strong>Blocked/unbacked items</strong>
            <span>{formatCount(reviewGroups.blocked.length, "item")}</span>
          </div>
          <ul>
            {reviewGroups.blocked.map((item) => (
              <li
                key={item.reviewTaskId}
                className="review-queue-card"
                data-testid="review-queue-card-blocked"
                data-blocked="true"
                role="button"
                aria-disabled="true"
              >
                <div className="review-queue-card__topline">
                  <span>{item.reviewStatus} · {item.stalenessStatus}</span>
                  <StatusChip tone="warning">blocked</StatusChip>
                </div>
                <strong className="wrap-anywhere">{resource?.title ?? "Resource title unavailable"}</strong>
                <small className="wrap-anywhere">Source span: blocked until a returned source span backs this item</small>
                <p className="review-queue-card__blocked-copy">Blocked local fixture state: no source-backed review content is displayed and no finding is implied.</p>
                <details className="inspector-details review-queue-card__details">
                  <summary>Review metadata details and copy controls</summary>
                  <CopyMetadataButton label="review task ID" value={item.reviewTaskId} />
                  <dl>
                    <div><dt>Review task ID</dt><dd className="wrap-anywhere">{item.reviewTaskId}</dd></div>
                    <div><dt>Source span IDs</dt><dd className="wrap-anywhere">{item.sourceSpanIds.join(", ") || "none"}</dd></div>
                  </dl>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

function buildReviewGroups(
  items: CompactAtlasReviewQueueItem[],
  resourceId: string | null,
  sourceSpanById: Map<string, CorpusSourceSpan>
) {
  const sourceBacked = items.filter((item) => {
    const primarySpan = item.sourceSpanIds[0] ? sourceSpanById.get(item.sourceSpanIds[0]) : undefined;
    return Boolean(primarySpan && item.sourceSpanIds.length > 0 && item.resourceId === resourceId);
  });
  const blocked = items.filter((item) => !sourceBacked.includes(item));
  const sourceBackedSourceSpanCount = sourceBacked.reduce((count, item) => count + item.sourceSpanIds.length, 0);

  return { sourceBacked, blocked, sourceBackedSourceSpanCount };
}

function summarizeStatuses(values: string[]) {
  const counts = values.reduce<Record<string, number>>((memo, value) => {
    memo[value] = (memo[value] ?? 0) + 1;
    return memo;
  }, {});

  return Object.entries(counts)
    .map(([status, count]) => `${status}: ${count}`)
    .join(" · ") || "no status";
}

function reviewQueueActionLabel(action: CompactAtlasReviewQueueItem["allowedActions"][number]) {
  if (action === "inspect_source") {
    return "Inspect source";
  }
  if (action === "mark_needs_review_local") {
    return "Mark needs review (local)";
  }
  return "Link source (local)";
}

function reviewQueueStatusTone(isSourceBacked: boolean, stalenessStatus: string) {
  if (!isSourceBacked) {
    return "warning";
  }
  if (stalenessStatus.includes("stale") || stalenessStatus.includes("invalid")) {
    return "warning";
  }
  return "success";
}
