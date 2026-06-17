import type {
  CompactAtlasGraphFocusMetadata,
  CompactAtlasInterpretabilityModel,
  CompactAtlasMetadataSearchResult,
  CompactAtlasResource,
  CompactAtlasSearchResponse,
  CompactAtlasSourceSpanSearchResult,
  CompactAtlasSurveillanceStatus,
  CorpusAtlasModel,
  CorpusExplainSelectionRequest,
  CorpusGraphNode,
  CorpusSourceSpan,
  CorpusWorkbenchTraceStep
} from "../../lib/corpusAtlas";
import type { AtlasNodeGroup, AtlasNodeKind, AtlasNodeView, LookupSelection, RetrievalGraphEvidenceState, SearchOption } from "./GraphWorkbenchTypes";

const groupLabels: Record<AtlasNodeGroup, string> = {
  resources: "Resources",
  diseaseSites: "Disease sites",
  documents: "Document types",
  archive: "Archive state",
  provenance: "Source spans"
};

const nodeTypeLabels: Record<AtlasNodeKind, string> = {
  resource: "Public resource",
  cluster: "Metadata cluster",
  archive: "Archive state",
  sourceSpan: "Source span"
};

export function sourceSpanFromSearchResult(result: CompactAtlasSourceSpanSearchResult): CorpusSourceSpan {
  return {
    span_id: result.spanId,
    resource_id: result.resourceId,
    document_id: result.documentId,
    stable_locator: result.stableLocator,
    excerpt: result.excerpt,
    checksum_sha256: result.checksumSha256,
    output_status: result.outputStatus
  };
}

export function buildExplainSelectionRequest(
  retrievalEvidence: RetrievalGraphEvidenceState | null,
  selectedNode: AtlasNodeView | null,
  selectedResource: CompactAtlasResource | null,
  activeSpan: CorpusSourceSpan | null
): CorpusExplainSelectionRequest | null {
  const sourceSpanId = retrievalEvidence?.selectedSourceSpanId ?? activeSpan?.span_id ?? (selectedNode?.kind === "sourceSpan" ? selectedNode.id : null);
  const resourceId = retrievalEvidence?.selectedResourceId ?? selectedResource?.id ?? selectedNode?.resourceId ?? null;
  const selectedNodeId = retrievalEvidence?.graphFocusNodeId ?? selectedNode?.id ?? (resourceId ? `resource.${resourceId}` : null);

  if (!sourceSpanId && !resourceId && !selectedNodeId) {
    return null;
  }

  return {
    ...(sourceSpanId ? { source_span_id: sourceSpanId } : {}),
    ...(selectedNodeId ? { selected_node_id: selectedNodeId } : {}),
    ...(resourceId ? { resource_id: resourceId } : {}),
    command_metadata: {
      ui_surface: "graph_workbench",
      selection_source: sourceSpanId ? "source_span" : "graph_or_metadata_selection",
      focus_mode: retrievalEvidence?.focusMode ?? selectedNode?.kind ?? "resource",
      raw_output_requested: false
    }
  };
}

export function buildRetrievalGraphEvidenceState(
  response: CompactAtlasSearchResponse | null,
  lookupSelection: LookupSelection | null,
  selectedResource: CompactAtlasResource | null,
  selectedNode: AtlasNodeView | null,
  activeSpan: CorpusSourceSpan | null,
  model: CorpusAtlasModel | null
): RetrievalGraphEvidenceState | null {
  if (!response || !model) {
    return null;
  }

  const selectedMetadataResult = lookupSelection?.kind === "metadata"
    ? response.metadataResults.find((result) => result.resourceId === lookupSelection.resourceId) ?? null
    : null;
  const selectedSourceSpanResult = lookupSelection?.kind === "source_span"
    ? response.sourceSpanResults.find((result) => result.spanId === lookupSelection.sourceSpan?.span_id) ?? null
    : null;
  const graphSelectedSourceSpanResult = activeSpan
    ? response.sourceSpanResults.find((result) => result.spanId === activeSpan.span_id) ?? null
    : null;
  const graphSelectedMetadataResult = selectedResource
    ? response.metadataResults.find((result) => result.resourceId === selectedResource.id) ?? null
    : null;
  const focus = selectedSourceSpanResult
    ?? selectedMetadataResult
    ?? graphSelectedSourceSpanResult
    ?? graphSelectedMetadataResult
    ?? response.sourceSpanResults[0]
    ?? response.metadataResults[0]
    ?? null;
  const selectedSourceSpanId = (selectedSourceSpanResult ?? graphSelectedSourceSpanResult)?.spanId
    ?? (selectedNode?.kind === "sourceSpan" ? activeSpan?.span_id ?? selectedNode.id : null);
  const selectedResourceId = focus?.resourceId ?? selectedResource?.id ?? null;
  const resourceNodeId = focus?.resourceNodeId ?? (selectedResourceId ? `resource.${selectedResourceId}` : null);
  const highlightedSourceSpanIds = dedupe(response.sourceSpanResults.map((result) => result.spanId));
  const representedSourceSpanNodeIds = sourceSpanGraphNodeIds(model, highlightedSourceSpanIds);
  const selectedSourceSpanNodeIds = selectedSourceSpanId ? sourceSpanGraphNodeIds(model, [selectedSourceSpanId]) : [];
  const hasSelectedSourceSpanNode = selectedSourceSpanNodeIds.length > 0;
  const selectedSourceSpanResultForMode = selectedSourceSpanId
    ? response.sourceSpanResults.find((result) => result.spanId === selectedSourceSpanId) ?? null
    : null;
  const graphFocusNodeId = selectedSourceSpanResultForMode
    ? hasSelectedSourceSpanNode ? selectedSourceSpanNodeIds[0] : resourceNodeId
    : focus?.focusNodeId ?? selectedNode?.id ?? resourceNodeId;
  const highlightedResourceIds = dedupe([
    ...response.metadataResults.map((result) => result.resourceId),
    ...response.sourceSpanResults.map((result) => result.resourceId),
    ...(selectedResourceId ? [selectedResourceId] : [])
  ]);
  const graphContextNodeIds = dedupe([
    ...(focus?.neighborNodeIds ?? []),
    ...representedSourceSpanNodeIds,
    ...(selectedNode && selectedNode.id !== graphFocusNodeId ? [selectedNode.id] : [])
  ]);
  const graphPathNodeIds = dedupe([
    ...(resourceNodeId ? [resourceNodeId] : []),
    ...(hasSelectedSourceSpanNode ? selectedSourceSpanNodeIds : []),
    ...graphContextNodeIds
  ]);
  const metadataBlocked = Boolean(selectedResourceId && !selectedSourceSpanResultForMode && highlightedSourceSpanIds.length === 0);
  const focusMode: RetrievalGraphEvidenceState["focusMode"] = selectedSourceSpanResultForMode
    ? hasSelectedSourceSpanNode ? "source-span-node" : "source-span-parent-fallback"
    : metadataBlocked ? "metadata-only-blocked" : "metadata-query-hit";

  return {
    query: response.query,
    highlightedResourceIds,
    highlightedSourceSpanIds,
    representedSourceSpanNodeIds,
    selectedResourceId,
    selectedSourceSpanId,
    graphFocusNodeId,
    graphResourceNodeId: resourceNodeId,
    graphContextNodeIds,
    graphPathNodeIds,
    edgeTypes: focus?.edgeTypes ?? [],
    focusMode,
    blockedReason: metadataBlocked ? "Blocked evidence label: metadata-only, no source span returned" : null
  };
}

export function sourceSpanGraphPath(result: CompactAtlasSourceSpanSearchResult) {
  const reviewTaskId = result.reviewTaskIds[0];
  return [`resource.${result.resourceId}`, result.spanId, reviewTaskId].filter(Boolean).join(" -> ");
}

export function sourceSpanGraphPathLabel(result: CompactAtlasSourceSpanSearchResult) {
  return ["Resource", formatSourceSpanLabel(result.stableLocator), formatCount(result.reviewTaskIds.length, "review task")].join(" -> ");
}

export function formatSourceSpanLabel(locator?: string | null) {
  if (!locator) {
    return "Source span unavailable";
  }

  const pageMatch = locator.match(/page\s*[:=-]\s*(\d+)/i);
  const spanMatch = locator.match(/span\s*[:=-]\s*(\d+)/i);
  if (pageMatch && spanMatch) {
    return `Page ${pageMatch[1]} · Span ${spanMatch[1]}`;
  }

  return locator
    .replaceAll(";", " · ")
    .replace(/\bpage\s*[:=-]\s*/gi, "Page ")
    .replace(/\bspan\s*[:=-]\s*/gi, "Span ");
}

export function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function metadataAvailableLabel(value?: string | null) {
  return value ? "Available in metadata details" : "Not returned by local API";
}

export function sourceSpanProvenance(span: CorpusSourceSpan | CompactAtlasSourceSpanSearchResult) {
  const compactSpan = span as Partial<CompactAtlasSourceSpanSearchResult>;
  const corpusSpan = span as Partial<CorpusSourceSpan>;
  const documentId = compactSpan.documentId ?? corpusSpan.document_id ?? "source-document unavailable";
  return {
    sourceDocumentId: compactSpan.sourceDocumentId ?? documentId,
    excerptChecksum: compactSpan.excerptChecksum ?? compactSpan.checksumSha256 ?? corpusSpan.checksum_sha256 ?? "checksum not returned",
    promptOrModelVersion: compactSpan.promptOrModelVersion ?? "none-local-deterministic-parser",
    reviewer: compactSpan.reviewer ?? "unreviewed",
    reviewStatus: compactSpan.reviewStatus ?? compactSpan.outputStatus ?? corpusSpan.output_status ?? "draft",
    timestamp: compactSpan.timestamp ?? "2026-06-15T12:00:00Z"
  };
}

export function optionalRankScore(result: CompactAtlasMetadataSearchResult | CompactAtlasSourceSpanSearchResult, index: number) {
  const rankedResult = result as typeof result & { rank?: number; score?: number };
  const rank = rankedResult.rank ?? index + 1;
  const score = rankedResult.score;
  return score === undefined ? `rank ${rank}` : `rank ${rank} · score ${score}`;
}

export function traceStepSummary(step: CorpusWorkbenchTraceStep) {
  const fields = [
    `status: ${step.status}`,
    step.command_label ? `command: ${step.command_label}` : null,
    step.metadata_result_count !== undefined ? `metadata: ${step.metadata_result_count}` : null,
    step.source_span_result_count !== undefined ? `source spans: ${step.source_span_result_count}` : null,
    step.warning_labels && step.warning_labels.length > 0 ? `warnings: ${step.warning_labels.join(", ")}` : null,
    step.abstained !== undefined ? `abstained: ${String(step.abstained)}` : null,
    step.source_span_ids_used ? `used: ${formatCount(step.source_span_ids_used.length, "source span")}` : null,
    step.rejected_count !== undefined ? `rejected: ${step.rejected_count}` : null,
    step.model_class ? `model: ${step.model_class}` : null,
    step.external_api_used !== undefined ? `external API used: ${String(step.external_api_used)}` : null
  ].filter(Boolean);

  return fields.join("; ");
}

export function relationshipSummaryFromFocus(focus: CompactAtlasGraphFocusMetadata) {
  const labels = focus.edgeTypes.map(edgeTypeLabel);
  if (focus.sourceSpanIds.length > 0) {
    labels.push("resource -> source span");
  }
  if (focus.reviewTaskIds.length > 0) {
    labels.push("source span -> review item");
  }

  return `Trace: ${dedupe(labels).join(" / ") || "resource neighborhood pending"}`;
}

export function buildRelationshipRows(
  resource: CompactAtlasResource | null,
  focus: CompactAtlasGraphFocusMetadata | null,
  interpretabilityModel: CompactAtlasInterpretabilityModel | null,
  atlasModel: CorpusAtlasModel | null,
  activeSpan: CorpusSourceSpan | null
) {
  const rows: Array<{ kind: string; label: string; detail: string }> = [];
  if (!resource) {
    return rows;
  }

  rows.push({ kind: "resource", label: resource.title, detail: resource.id });
  rows.push({ kind: "disease site", label: resource.diseaseSite, detail: "Resource metadata bucket" });
  rows.push({ kind: "document type", label: resource.documentType, detail: "Document classification bucket" });
  rows.push({ kind: "archive", label: `${resource.archiveStatus} · ${resource.parseStatus}`, detail: coverageStatusCopy(effectiveCoverageStatus(resource, focus?.coverageStatus, interpretabilityModel?.coverageStatus)) });

  const neighborNodes = interpretabilityModel?.graphNeighborhood.neighborNodes
    ?? (focus?.neighborNodeIds.map((nodeId) => atlasModel?.graphPayload.nodes.find((node) => node.id === nodeId)).filter(Boolean) as CorpusGraphNode[] | undefined)
    ?? [];
  const sourceSpanNode = neighborNodes.find((node) => node.type === "source_span");
  const sourceSpanIds = dedupe([...(focus?.sourceSpanIds ?? []), ...(interpretabilityModel?.resource.sourceSpanIds ?? []), ...(activeSpan ? [activeSpan.span_id] : [])]);
  if (activeSpan || sourceSpanNode || sourceSpanIds.length > 0) {
    rows.push({
      kind: "source span",
      label: formatSourceSpanLabel(activeSpan?.stable_locator ?? sourceSpanNode?.label ?? null),
      detail: activeSpan ? `Source span ${activeSpan.output_status}; exact locator available in metadata details` : `${formatCount(sourceSpanIds.length, "source span")} linked by API metadata`
    });
  }

  const reviewTaskIds = dedupe([...(focus?.reviewTaskIds ?? []), ...(interpretabilityModel?.reviewTaskIds ?? [])]);
  if (reviewTaskIds.length > 0) {
    rows.push({ kind: "review item", label: formatCount(reviewTaskIds.length, "local review task"), detail: "Exact workflow identifiers available in metadata details" });
  }

  return rows;
}

export function coverageStatusFromResource(resource: CompactAtlasResource | null) {
  if (!resource) {
    return "metadata_only";
  }
  if (resource.responseState === "download_failed") {
    return "download_failed";
  }
  if (resource.responseState === "parse_failed") {
    return "parse_failed";
  }
  if (resource.parseStatus === "checksum_mismatch") {
    return "checksum_mismatch";
  }
  if (resource.sourceSpanCount > 0) {
    return "source_span_ready";
  }
  return "metadata_only";
}

export function effectiveCoverageStatus(resource: CompactAtlasResource | null, lookupStatus?: string, interpretabilityStatus?: string) {
  if (lookupStatus === "source_span_ready" || lookupStatus === "partial_source_span") {
    return lookupStatus;
  }
  const resourceStatus = coverageStatusFromResource(resource);
  if (resourceStatus !== "metadata_only") {
    return resourceStatus;
  }
  return lookupStatus ?? interpretabilityStatus ?? resourceStatus;
}

export function coverageStatusCopy(status: string) {
  if (status === "source_span_ready") {
    return "Parsed source spans are available for deterministic provenance review.";
  }
  if (status === "partial_source_span") {
    return "Some parsed source spans are available; coverage is partial and draft.";
  }
  if (status === "download_failed") {
    return "Archive download failed, so source spans are unavailable until a local raw file is acquired.";
  }
  if (status === "checksum_mismatch") {
    return "Checksum mismatch blocks source-span use until the local archive is reconciled.";
  }
  if (status === "parse_failed") {
    return "Parser output is unavailable for this resource; metadata remains searchable without implying absent supporting material.";
  }
  return "Metadata-only coverage: source spans are unavailable/not parsed for this resource; this does not imply absence of supporting material.";
}

export function offlineSurveillanceSummary(status: CompactAtlasSurveillanceStatus | null) {
  if (!status) {
    return "offline archive status pending";
  }
  return `${status.needsReviewCount ?? 0} needs review · ${status.unchangedCount ?? 0} unchanged local/archive`;
}

export function loadStateLabel(status: string) {
  if (status === "success") {
    return "local API loaded";
  }
  if (status === "loading") {
    return "local API loading";
  }
  if (status === "empty") {
    return "local API empty";
  }
  return "local API unavailable";
}

export function offlineResourceStatusLabel(changeState?: string) {
  if (changeState === "checksum_mismatch") {
    return "changed local archive";
  }
  if (changeState === "changed" || changeState === "resource_added" || changeState === "resource_removed") {
    return "changed local archive";
  }
  if (changeState === "missing") {
    return "missing local archive";
  }
  if (changeState === "unchanged") {
    return "unchanged local archive";
  }
  return "offline archive pending";
}

export function offlineStatusTone(reviewStatus?: string) {
  if (reviewStatus === "needs_review") {
    return "warning";
  }
  if (reviewStatus === "no_change") {
    return "success";
  }
  return "neutral";
}

export function offlineResourceStatusCopy(
  resourceStatus: CompactAtlasSurveillanceStatus["resourceStatuses"][number] | undefined,
  surveillanceStatus: CompactAtlasSurveillanceStatus | null
) {
  if (!resourceStatus || !surveillanceStatus) {
    return "Offline/local archive comparison is pending from the local manifest fixtures; no network check is shown.";
  }
  return `Offline/local manifest comparison only: ${resourceStatus.previousStatus ?? "none"} to ${resourceStatus.currentStatus ?? "none"}; ${resourceStatus.reviewStatus}. No network check or clinical inference is shown.`;
}

export function edgeTypeLabel(edgeType: string) {
  if (edgeType === "resource_to_disease_site") {
    return "resource -> disease site";
  }
  if (edgeType === "resource_to_document_type") {
    return "resource -> document type";
  }
  if (edgeType === "resource_to_archive_status") {
    return "resource -> archive";
  }
  if (edgeType === "resource_to_source_span") {
    return "resource -> source span";
  }
  if (edgeType === "source_span_to_review_item") {
    return "source span -> review item";
  }
  return edgeType.replaceAll("_", " ");
}

export function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function sourceSpanGraphNodeIds(model: CorpusAtlasModel, sourceSpanIds: string[]) {
  const sourceSpanIdSet = new Set(sourceSpanIds);
  if (sourceSpanIdSet.size === 0) {
    return [];
  }

  return model.graphPayload.nodes
    .filter((node) => model.graph.hasNode(node.id) && (
      sourceSpanIdSet.has(node.id)
      || (node.type === "source_span" && (node.source_span_ids ?? []).some((spanId) => sourceSpanIdSet.has(spanId)))
    ))
    .map((node) => node.id)
    .sort((left, right) => left.localeCompare(right));
}

export function selectVisibleResources(resources: CompactAtlasResource[], selectedResourceId?: string) {
  const firstResources = resources.slice(0, 24);
  if (!selectedResourceId || firstResources.some((resource) => resource.id === selectedResourceId)) {
    return firstResources;
  }

  const selectedResource = resources.find((resource) => resource.id === selectedResourceId);
  return selectedResource ? [selectedResource, ...firstResources.slice(0, 23)] : firstResources;
}

export function isInteractiveKeyboardTarget(target: EventTarget) {
  return target instanceof HTMLElement && Boolean(target.closest("input, button, textarea, select, a, [role='search']"));
}

export function buildClusterResourceCounts(model: CorpusAtlasModel) {
  return model.graphPayload.edges.reduce<Record<string, number>>((counts, edge) => {
    if (edge.type.startsWith("resource_to_") && edge.target) {
      counts[edge.target] = (counts[edge.target] ?? 0) + 1;
    }
    return counts;
  }, {});
}

export function buildAtlasNodeViews(model: CorpusAtlasModel, clusterResourceCounts: Record<string, number>): AtlasNodeView[] {
  return [...model.graphPayload.nodes]
    .filter((node) => model.graph.hasNode(node.id))
    .sort((left, right) => nodeSortKey(left).localeCompare(nodeSortKey(right)))
    .map((node) => toAtlasNodeView(node, model, clusterResourceCounts[node.id] ?? 0));
}

function toAtlasNodeView(node: CorpusGraphNode, model: CorpusAtlasModel, aggregateCount: number): AtlasNodeView {
  const attributes = model.graph.getNodeAttributes(node.id);
  const kind = toNodeKind(attributes.nodeType);
  const group = toNodeGroup(attributes.nodeType);
  const title = attributes.nodeType === "source_span" ? formatSourceSpanLabel(attributes.label) : attributes.label;

  return {
    id: node.id,
    title,
    type: toDisplayType(attributes.nodeType),
    kind,
    group,
    priority: attributes.nodeType === "resource" ? "high" : "normal",
    summary: toNodeSummary(node, aggregateCount),
    sourceLabel: toSourceLabel(node),
    provenanceStatus: attributes.nodeType === "resource" ? "Registry metadata" : "Derived metadata cluster",
    reviewerStatus: "Draft atlas view",
    resourceId: attributes.resourceId,
    aggregateCount
  };
}

export function buildSearchOptions(nodeViews: AtlasNodeView[], query: string): SearchOption[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 2) {
    return [];
  }

  return nodeViews
    .filter((node) => `${node.title} ${node.type} ${node.sourceLabel}`.toLowerCase().includes(normalizedQuery))
    .sort((left, right) => searchRank(left, normalizedQuery) - searchRank(right, normalizedQuery) || left.title.localeCompare(right.title))
    .slice(0, 6)
    .map((node) => ({
      id: node.id,
      label: node.title,
      detail: `${nodeTypeLabels[node.kind]} · ${groupLabels[node.group]} · ${node.aggregateCount || 1}`
    }));
}

function searchRank(node: AtlasNodeView, normalizedQuery: string) {
  const title = node.title.toLowerCase();
  if (title === normalizedQuery) {
    return 0;
  }
  if (title.startsWith(normalizedQuery)) {
    return 1;
  }
  return node.kind === "resource" ? 2 : 3;
}

function toNodeKind(nodeType: string): AtlasNodeKind {
  if (nodeType === "resource") {
    return "resource";
  }
  if (nodeType === "archive_status") {
    return "archive";
  }
  if (nodeType === "source_span") {
    return "sourceSpan";
  }
  return "cluster";
}

function toNodeGroup(nodeType: string): AtlasNodeGroup {
  if (nodeType === "resource") {
    return "resources";
  }
  if (nodeType === "disease_site_cluster") {
    return "diseaseSites";
  }
  if (nodeType === "document_type_cluster") {
    return "documents";
  }
  if (nodeType === "source_span") {
    return "provenance";
  }
  return "archive";
}

function toDisplayType(nodeType: string) {
  return nodeType.replaceAll("_", " ");
}

function toNodeSummary(node: CorpusGraphNode, aggregateCount: number) {
  if (node.type === "resource") {
    return `${node.disease_site ?? "unknown"} ${node.document_type ?? node.resource_type ?? "resource"} metadata row with ${node.response_state ?? "unknown"} response state.`;
  }
  if (node.type === "archive_status") {
    return `Archive and parse status cluster for ${aggregateCount} public resources: ${node.archive_status ?? node.label}.`;
  }
  if (node.type === "disease_site_cluster") {
    return `Disease-site cluster containing ${aggregateCount} public resources.`;
  }
  if (node.type === "document_type_cluster") {
    return `Document-type cluster containing ${aggregateCount} public resources.`;
  }
  return `Corpus graph metadata cluster for ${node.label}.`;
}

function toSourceLabel(node: CorpusGraphNode) {
  if (node.type === "resource") {
    return `${node.archive_status ?? "metadata-only"} · ${node.parse_status ?? "not-parsed"}`;
  }
  if (node.type === "source_span") {
    return `${formatSourceSpanLabel(node.label)} · metadata projection`;
  }
  return `${toDisplayType(node.type)} metadata projection`;
}

function nodeSortKey(node: CorpusGraphNode) {
  const typeRank = node.type === "resource" ? "1" : "0";
  return `${typeRank}:${node.type}:${node.label ?? node.title ?? node.id}`;
}
