"use client";

import React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  CorpusAtlasClientError,
  loadCorpusAtlas,
  loadCorpusInterpretability,
  searchCorpus,
  type CompactAtlasGraphFocusMetadata,
  type CompactAtlasInterpretabilityModel,
  type CompactAtlasMetadataSearchResult,
  type CompactAtlasReviewQueueItem,
  type CompactAtlasResource,
  type CompactAtlasSearchResponse,
  type CompactAtlasSourceSpanSearchResult,
  type CompactAtlasSurveillanceStatus,
  type CorpusGraphNode,
  type CorpusAtlasModel,
  type CorpusSourceSpan
} from "../../lib/corpusAtlas";
import type { SigmaCorpusGraphProps } from "./SigmaCorpusGraph";

export type AtlasNodeKind = "resource" | "cluster" | "archive" | "sourceSpan";
type AtlasNodeGroup = "resources" | "diseaseSites" | "documents" | "archive" | "provenance";
type DetailPriority = "high" | "normal";
type LoadStatus = "loading" | "success" | "empty" | "error";
type SearchStatus = "idle" | "loading" | "success" | "error";

type AtlasNodeData = {
  title: string;
  type: string;
  kind: AtlasNodeKind;
  group: AtlasNodeGroup;
  priority: DetailPriority;
  summary: string;
  sourceLabel: string;
  provenanceStatus: string;
  reviewerStatus: string;
  resourceId?: string;
  aggregateCount: number;
};

export type AtlasNodeView = AtlasNodeData & {
  id: string;
};

type SearchOption = {
  id: string;
  label: string;
  detail: string;
};

type SearchSubmitEvent = {
  preventDefault: () => void;
  stopPropagation: () => void;
  currentTarget: HTMLFormElement;
};

type WorkbenchSearchSubmitEvent = {
  preventDefault: () => void;
  currentTarget: HTMLFormElement;
};

type ReviewQueueLocalAction = {
  reviewTaskId: string;
  label: string;
};

const SigmaCorpusGraph = dynamic<SigmaCorpusGraphProps>(
  () => import("./SigmaCorpusGraph").then((module) => module.SigmaCorpusGraph),
  {
    ssr: false,
    loading: () => <div className="sigma-atlas-loading" role="status">Loading Sigma corpus graph</div>
  }
);

type AtlasLoadState = {
  status: LoadStatus;
  model: CorpusAtlasModel | null;
  message: string;
};

type WorkbenchSearchState = {
  status: SearchStatus;
  query: string;
  response: CompactAtlasSearchResponse | null;
  message: string;
};

type InterpretabilityLoadState = {
  status: SearchStatus;
  resourceId: string | null;
  model: CompactAtlasInterpretabilityModel | null;
  message: string;
};

type LookupSelection = {
  kind: "metadata" | "source_span";
  resourceId: string;
  title: string;
  focus: CompactAtlasGraphFocusMetadata;
  sourceSpan?: CorpusSourceSpan;
};

const initialLoadState: AtlasLoadState = {
  status: "loading",
  model: null,
  message: "Loading public corpus metadata from the local API."
};

const initialWorkbenchSearchState: WorkbenchSearchState = {
  status: "idle",
  query: "",
  response: null,
  message: "Search metadata across all public resources; source-span search is scoped to parsed subset records when present."
};

const initialInterpretabilityState: InterpretabilityLoadState = {
  status: "idle",
  resourceId: null,
  model: null,
  message: "Select a resource or search result to load local deterministic graph provenance."
};

const modelDisabledNote = "Model answers disabled until retrieval/source-span verification is implemented.";

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

export function GuidelineGraphCanvas() {
  const [loadState, setLoadState] = useState<AtlasLoadState>(initialLoadState);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [activeSpanId, setActiveSpanId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [workbenchQuery, setWorkbenchQuery] = useState("");
  const [workbenchSearchState, setWorkbenchSearchState] = useState<WorkbenchSearchState>(initialWorkbenchSearchState);
  const [interpretabilityState, setInterpretabilityState] = useState<InterpretabilityLoadState>(initialInterpretabilityState);
  const [lookupSelection, setLookupSelection] = useState<LookupSelection | null>(null);
  const [reviewQueueLocalAction, setReviewQueueLocalAction] = useState<ReviewQueueLocalAction | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setLoadState(initialLoadState);
    loadCorpusAtlas({ signal: controller.signal })
      .then((model) => {
        if (model.resources.length === 0 || model.compactNodes.length === 0) {
          setLoadState({
            status: "empty",
            model,
            message: "No atlas resources returned from the corpus API."
          });
          return;
        }

        setLoadState({
          status: "success",
          model,
          message: "Public corpus metadata loaded from the local API."
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        const message = error instanceof CorpusAtlasClientError
          ? error.message
          : "Corpus API unavailable while loading the atlas.";
        setLoadState({ status: "error", model: null, message });
      });

    return () => controller.abort();
  }, []);

  const model = loadState.model;
  const detailMode = zoomLevel >= 1.05 ? "semantic" : "map";
  const clusterResourceCounts = useMemo(() => model ? buildClusterResourceCounts(model) : {}, [model]);
  const nodeViews = useMemo(() => model ? buildAtlasNodeViews(model, clusterResourceCounts) : [], [clusterResourceCounts, model]);
  const searchResults = useMemo(() => buildSearchOptions(nodeViews, searchQuery), [nodeViews, searchQuery]);

  useEffect(() => {
    if (!model) {
      return;
    }

    setSelectedResourceId((current) => current ?? model.resources[0]?.id ?? null);
    setSelectedNodeId((current) => current ?? nodeViews.find((node) => node.kind === "resource")?.id ?? nodeViews[0]?.id ?? null);
    setActiveSpanId((current) => current ?? model.sourceSpans[0]?.span_id ?? null);
  }, [model, nodeViews]);

  useEffect(() => {
    if (!selectedResourceId) {
      setInterpretabilityState(initialInterpretabilityState);
      return;
    }

    const controller = new AbortController();
    setInterpretabilityState({
      status: "loading",
      resourceId: selectedResourceId,
      model: null,
      message: "Loading local deterministic graph provenance."
    });

    loadCorpusInterpretability(selectedResourceId, { signal: controller.signal })
      .then((interpretabilityModel) => {
        setInterpretabilityState({
          status: "success",
          resourceId: selectedResourceId,
          model: interpretabilityModel,
          message: "Trust drawer loaded from local interpretability API."
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        const message = error instanceof CorpusAtlasClientError
          ? error.message
          : "Corpus interpretability API unavailable.";
        setInterpretabilityState({ status: "error", resourceId: selectedResourceId, model: null, message });
      });

    return () => controller.abort();
  }, [selectedResourceId]);

  const selectedResource = useMemo(() => {
    if (!model) {
      return null;
    }
    return model.resources.find((resource) => resource.id === selectedResourceId) ?? model.resources[0] ?? null;
  }, [model, selectedResourceId]);
  const selectedNode = useMemo(() => nodeViews.find((node) => node.id === selectedNodeId) ?? null, [nodeViews, selectedNodeId]);
  const hoveredNode = useMemo(() => nodeViews.find((node) => node.id === hoveredNodeId) ?? null, [hoveredNodeId, nodeViews]);
  const sourceSpans = useMemo(() => {
    if (!model || !selectedResource) {
      return [];
    }
    const atlasSpans = model.sourceSpans.filter((span) => span.resource_id === selectedResource.id);
    const interpretabilitySpans = interpretabilityState.model?.resource.id === selectedResource.id
      ? interpretabilityState.model.sourceSpans
      : [];
    const spansById = new Map([...atlasSpans, ...interpretabilitySpans].map((span) => [span.span_id, span]));
    return [...spansById.values()].sort((left, right) => left.span_id.localeCompare(right.span_id));
  }, [interpretabilityState.model, model, selectedResource]);
  const activeSpan = sourceSpans.find((span) => span.span_id === activeSpanId)
    ?? (lookupSelection?.kind === "source_span" && lookupSelection.resourceId === selectedResource?.id ? lookupSelection.sourceSpan ?? null : null)
    ?? sourceSpans[0]
    ?? null;
  const visibleResources = useMemo(() => model ? selectVisibleResources(model.resources, selectedResource?.id) : [], [model, selectedResource]);
  const diseaseSiteClusters = useMemo(() => {
    if (!model) {
      return [];
    }
    return nodeViews
      .filter((node) => node.group === "diseaseSites")
      .sort((left, right) => right.aggregateCount - left.aggregateCount || left.title.localeCompare(right.title));
  }, [model, nodeViews]);
  const surveillanceStatus = interpretabilityState.model?.surveillanceStatus ?? null;
  const surveillanceStatusByResourceId = useMemo(
    () => new Map((surveillanceStatus?.resourceStatuses ?? []).map((status) => [status.resourceId, status])),
    [surveillanceStatus]
  );

  const selectNodeById = useCallback((nodeId: string) => {
    if (!model) {
      return;
    }

    const nextNode = nodeViews.find((node) => node.id === nodeId);
    if (!nextNode) {
      return;
    }

    setSelectedNodeId(nextNode.id);
    if (nextNode.resourceId) {
      setSelectedResourceId(nextNode.resourceId);
      setActiveSpanId(null);
    }
  }, [model, nodeViews]);

  const selectSearchResult = useCallback((result: SearchOption) => {
    setLookupSelection(null);
    selectNodeById(result.id);
  }, [selectNodeById]);

  const handleResourceSelect = useCallback((resourceId: string) => {
    setLookupSelection(null);
    setSelectedResourceId(resourceId);
    setActiveSpanId(null);
    selectNodeById(`resource.${resourceId}`);
  }, [selectNodeById]);

  const handleSearchSubmit = useCallback((event: SearchSubmitEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const formData = new FormData(event.currentTarget);
    const submittedQuery = String(formData.get("atlas-node-search") ?? searchQuery);
    const firstResult = buildSearchOptions(nodeViews, submittedQuery)[0];
    if (firstResult) {
      selectSearchResult(firstResult);
    }
  }, [nodeViews, searchQuery, selectSearchResult]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  const focusResourceById = useCallback((resourceId: string, spanId?: string) => {
    const resourceNodeId = `resource.${resourceId}`;
    if (nodeViews.some((node) => node.id === resourceNodeId)) {
      selectNodeById(resourceNodeId);
    } else if (model?.resources.some((resource) => resource.id === resourceId)) {
      setSelectedResourceId(resourceId);
      setActiveSpanId(null);
    }

    if (spanId) {
      setActiveSpanId(spanId);
    }
  }, [model, nodeViews, selectNodeById]);

  const handleReviewQueueFocus = useCallback((resourceId: string, spanId?: string) => {
    setLookupSelection(null);
    focusResourceById(resourceId, spanId);
  }, [focusResourceById]);

  const handleReviewQueueLocalAction = useCallback((reviewTaskId: string, label: string) => {
    setReviewQueueLocalAction({ reviewTaskId, label });
  }, []);

  const handleWorkbenchQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setWorkbenchQuery(event.target.value);
  }, []);

  const handleWorkbenchSearchSubmit = useCallback(async (event: WorkbenchSearchSubmitEvent) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submittedQuery = String(formData.get("atlas-workbench-search") ?? workbenchQuery).trim();

    if (!submittedQuery) {
      setWorkbenchSearchState(initialWorkbenchSearchState);
      return;
    }

    setWorkbenchSearchState({ status: "loading", query: submittedQuery, response: null, message: "Searching local public corpus metadata and parsed source spans." });
    try {
      const response = await searchCorpus(submittedQuery);
      setWorkbenchSearchState({ status: "success", query: submittedQuery, response, message: "Search completed through the local deterministic corpus API." });
    } catch (error: unknown) {
      const message = error instanceof CorpusAtlasClientError
        ? error.message
        : "Corpus search API unavailable.";
      setWorkbenchSearchState({ status: "error", query: submittedQuery, response: null, message });
    }
  }, [workbenchQuery]);

  const handleMetadataSearchSelect = useCallback((result: CompactAtlasMetadataSearchResult) => {
    setLookupSelection({
      kind: "metadata",
      resourceId: result.resourceId,
      title: result.title,
      focus: result
    });
    focusResourceById(result.resourceId);
  }, [focusResourceById]);

  const handleSourceSpanSearchSelect = useCallback((result: CompactAtlasSourceSpanSearchResult) => {
    setLookupSelection({
      kind: "source_span",
      resourceId: result.resourceId,
      title: result.title,
      focus: result,
      sourceSpan: sourceSpanFromSearchResult(result)
    });
    focusResourceById(result.resourceId, result.spanId);
  }, [focusResourceById]);

  const handleKeyboardSelect = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isInteractiveKeyboardTarget(event.target)) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    if (selectedNodeId) {
      selectNodeById(selectedNodeId);
      return;
    }
    const firstResourceNode = nodeViews.find((node) => node.kind === "resource") ?? nodeViews[0];
    if (firstResourceNode) {
      selectNodeById(firstResourceNode.id);
    }
  }, [nodeViews, selectNodeById, selectedNodeId]);

  return (
    <section className="graph-workbench" aria-label="Public corpus guideline graph atlas">
      <div className="graph-layout">
        <aside className="atlas-sidebar" aria-label="Atlas resource and topic navigation">
          <div className="sidebar-section">
            <p className="eyebrow">Vault</p>
            <h2>Evidence Atlas</h2>
            <span className="sidebar-caption">API-backed public corpus graph</span>
          </div>
          <nav className="atlas-nav" aria-label="Knowledgebase resources">
            {visibleResources.map((resource) => (
              <button
                key={resource.id}
                type="button"
                data-active={resource.id === selectedResource?.id}
                aria-pressed={resource.id === selectedResource?.id}
                onClick={() => handleResourceSelect(resource.id)}
              >
                <span>{resource.title}</span>
                <small>{resource.diseaseSite} · {resource.documentType}</small>
                <StatusChip tone={offlineStatusTone(surveillanceStatusByResourceId.get(resource.id)?.reviewStatus)}>
                  {offlineResourceStatusLabel(surveillanceStatusByResourceId.get(resource.id)?.changeState)}
                </StatusChip>
              </button>
            ))}
          </nav>
          <nav className="atlas-topic-nav" aria-label="Knowledgebase topics">
            <p className="eyebrow">Topics</p>
            {diseaseSiteClusters.slice(0, 10).map((cluster) => (
              <button
                key={cluster.id}
                type="button"
                data-active={cluster.id === selectedNodeId}
                aria-pressed={cluster.id === selectedNodeId}
                onClick={() => selectNodeById(cluster.id)}
              >
                {cluster.title} · {cluster.aggregateCount}
              </button>
            ))}
          </nav>
          <LayerStatusPanel model={model} loadState={loadState} surveillanceStatus={surveillanceStatus} />
        </aside>

        <div
          className="graph-canvas"
          data-testid="guideline-graph-canvas"
          data-detail={detailMode}
          tabIndex={0}
          role="application"
          aria-label="Interactive public corpus guideline graph. Hover, click, and drag nodes to inspect or pin local positions; use mouse, trackpad, or controls to pan and zoom. Zoom in to reveal node labels and provenance details."
          onKeyDown={handleKeyboardSelect}
        >
          {loadState.status === "success" && model ? (
            <SigmaCorpusGraph
              model={model}
              nodeViews={nodeViews}
              selectedNodeId={selectedNodeId}
              hoveredNodeId={hoveredNodeId}
              onNodeSelectAction={selectNodeById}
              onNodeHoverAction={setHoveredNodeId}
              onZoomLevelChangeAction={setZoomLevel}
            />
          ) : (
            <AtlasStateCard loadState={loadState} />
          )}

          <div className="graph-view-title" aria-label="Graph view status">
            <span>Graph view</span>
            <strong>{selectedNode?.title ?? selectedResource?.title ?? "Public corpus atlas"}</strong>
            <small>{detailMode === "semantic" ? "detail labels visible" : "map labels sparse"} · {loadState.status}</small>
          </div>

          <GraphSettingsPanel
            zoomLevel={zoomLevel}
            model={model}
            searchQuery={searchQuery}
            searchResults={searchResults}
            selectedNode={selectedNode}
            onSearchChange={handleSearchChange}
            onSearchSubmit={handleSearchSubmit}
            onResultSelect={selectSearchResult}
          />
          <SourceDocumentPanel
            selectedResource={selectedResource}
            sourceSpans={sourceSpans}
            activeSpanId={activeSpan?.span_id ?? null}
            coverageCount={model?.sourceSpanCoverage.count ?? 0}
            coverageNote={model?.sourceSpanCoverage.note ?? "Source-span coverage is unavailable until the API responds."}
            onSpanSelect={setActiveSpanId}
          />
          {hoveredNode ? <NodeHoverCard node={hoveredNode} /> : null}
        </div>
        <ProvenanceInspector
          node={selectedNode}
          resource={selectedResource}
          activeSpan={activeSpan}
          model={model}
          loadState={loadState}
          interpretabilityState={interpretabilityState}
          lookupSelection={lookupSelection}
          surveillanceStatus={surveillanceStatus}
          reviewQueueLocalAction={reviewQueueLocalAction}
          onReviewQueueFocus={handleReviewQueueFocus}
          onReviewQueueLocalAction={handleReviewQueueLocalAction}
        />
      </div>
      <BottomCorpusSearchWorkbench
        model={model}
        loadState={loadState}
        selectedResource={selectedResource}
        query={workbenchQuery}
        searchState={workbenchSearchState}
        onQueryChange={handleWorkbenchQueryChange}
        onSearchSubmit={handleWorkbenchSearchSubmit}
        onMetadataSelect={handleMetadataSearchSelect}
        onSourceSpanSelect={handleSourceSpanSearchSelect}
      />
    </section>
  );
}

function LayerStatusPanel({
  model,
  loadState,
  surveillanceStatus
}: {
  model: CorpusAtlasModel | null;
  loadState: AtlasLoadState;
  surveillanceStatus: CompactAtlasSurveillanceStatus | null;
}) {
  return (
    <div className="sidebar-section sidebar-section--compact">
      <p className="eyebrow">Layer status</p>
      <ul className="layer-list">
        <li><span className="layer-dot layer-dot--cyan" /> {model?.metadata.resource_node_count ?? 0} public resources</li>
        <li><span className="layer-dot layer-dot--gold" /> {model?.sourceSpanCoverage.count ?? 0} parsed-subset coverage</li>
        <li><span className="layer-dot layer-dot--violet" /> {offlineSurveillanceSummary(surveillanceStatus)}</li>
        <li><span className="layer-dot layer-dot--green" /> {loadState.status}</li>
        <li><span className="layer-dot layer-dot--red" /> No clinical advice</li>
      </ul>
    </div>
  );
}

function StatusChip({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <small className="status-chip" data-tone={tone}>{children}</small>;
}

function AtlasStateCard({ loadState }: { loadState: AtlasLoadState }) {
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

function GraphSettingsPanel({
  zoomLevel,
  model,
  searchQuery,
  searchResults,
  selectedNode,
  onSearchChange,
  onSearchSubmit,
  onResultSelect
}: {
  zoomLevel: number;
  model: CorpusAtlasModel | null;
  searchQuery: string;
  searchResults: SearchOption[];
  selectedNode: AtlasNodeView | null;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchSubmit: (event: SearchSubmitEvent) => void;
  onResultSelect: (result: SearchOption) => void;
}) {
  return (
    <aside className="graph-settings" aria-label="Graph display settings">
      <div className="graph-settings__header">
        <span className="eyebrow">Graph controls</span>
        <strong>Sigma overview</strong>
      </div>
      <form className="filter-field" role="search" onSubmit={onSearchSubmit}>
        <label htmlFor="atlas-node-search">Search resources and clusters...</label>
        <input
          id="atlas-node-search"
          name="atlas-node-search"
          type="search"
          value={searchQuery}
          onChange={onSearchChange}
          aria-label="Search public corpus graph nodes"
          placeholder="Adjuvant Radiotherapy for Invasive Breast Cancer"
        />
      </form>
      {searchResults.length > 0 ? (
        <div className="sigma-search-results" aria-label="Graph search results">
          {searchResults.map((result) => (
            <button key={result.id} type="button" onClick={() => onResultSelect(result)}>
              <span>{result.label}</span>
              <small>{result.detail}</small>
            </button>
          ))}
        </div>
      ) : null}
      <section className="graph-purpose-card" aria-label="Graph purpose and edge semantics">
        <p>The atlas maps each public resource to the metadata buckets that explain where it belongs. Pull a node to see its connected site, document type, archive state, and source-span neighbors react.</p>
        <dl>
          <div><dt>site</dt><dd>Resource grouped by disease-site metadata.</dd></div>
          <div><dt>type</dt><dd>Resource grouped by document classification.</dd></div>
          <div><dt>archive</dt><dd>Resource grouped by local archive and parse status.</dd></div>
          <div><dt>span</dt><dd>Resource linked to parsed-subset source spans when present.</dd></div>
        </dl>
      </section>
      <div className="toggle-list" aria-label="Graph filter toggles">
        <label><input type="checkbox" checked readOnly /> Metadata</label>
        <label><input type="checkbox" checked readOnly /> Source spans</label>
        <label><input type="checkbox" readOnly /> Approved only</label>
        <label><input type="checkbox" checked readOnly /> Draft nodes</label>
      </div>
      <details open>
        <summary>Groups</summary>
        <ul className="group-list">
          <li><span className="layer-dot layer-dot--cyan" /> Resources</li>
          <li><span className="layer-dot layer-dot--gold" /> Disease sites</li>
          <li><span className="layer-dot layer-dot--green" /> Document types</li>
          <li><span className="layer-dot layer-dot--red" /> Archive status</li>
        </ul>
      </details>
      <details open>
        <summary>Display</summary>
        <div className="settings-meter"><span style={{ width: `${Math.min(100, Math.max(18, zoomLevel * 48))}%` }} /> label threshold</div>
        <div className="settings-value">Zoom detail: {zoomLevel >= 1.05 ? "semantic" : "sparse map"}</div>
        <div className="settings-value">Selected: {selectedNode ? `${selectedNode.title} · ${selectedNode.aggregateCount || 1}` : "none"}</div>
      </details>
      <details>
        <summary>Corpus counts</summary>
        <div className="settings-value">Resource nodes · {model?.metadata.resource_node_count ?? 0}</div>
        <div className="settings-value">Disease-site clusters · {model?.metadata.disease_site_cluster_count ?? 0}</div>
        <div className="settings-value">Document-type clusters · {model?.metadata.document_type_cluster_count ?? 0}</div>
        <div className="settings-value">Source-span nodes · {model?.metadata.source_span_node_count ?? 0}</div>
      </details>
    </aside>
  );
}

function SourceDocumentPanel({
  selectedResource,
  sourceSpans,
  activeSpanId,
  coverageCount,
  coverageNote,
  onSpanSelect
}: {
  selectedResource: CompactAtlasResource | null;
  sourceSpans: CorpusSourceSpan[];
  activeSpanId: string | null;
  coverageCount: number;
  coverageNote: string;
  onSpanSelect: (spanId: string) => void;
}) {
  return (
    <aside className="source-document-panel" data-testid="source-document-panel" aria-label="Source document and span browser">
      <div className="source-document-panel__header">
        <span className="eyebrow">Source view</span>
        <strong>{coverageCount} parsed-subset coverage</strong>
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
            <span>{span.stable_locator}</span>
            <strong>{span.span_id}</strong>
          </button>
        )) : (
          <p className="source-span-empty">No source-span records are available for this resource in the current parsed subset output.</p>
        )}
      </div>
    </aside>
  );
}

function BottomCorpusSearchWorkbench({
  model,
  loadState,
  selectedResource,
  query,
  searchState,
  onQueryChange,
  onSearchSubmit,
  onMetadataSelect,
  onSourceSpanSelect
}: {
  model: CorpusAtlasModel | null;
  loadState: AtlasLoadState;
  selectedResource: CompactAtlasResource | null;
  query: string;
  searchState: WorkbenchSearchState;
  onQueryChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchSubmit: (event: WorkbenchSearchSubmitEvent) => void;
  onMetadataSelect: (result: CompactAtlasMetadataSearchResult) => void;
  onSourceSpanSelect: (result: CompactAtlasSourceSpanSearchResult) => void;
}) {
  const response = searchState.response;
  const hasSearched = searchState.status === "success" && Boolean(response);
  const hasResults = Boolean(response && (response.metadataResults.length > 0 || response.sourceSpanResults.length > 0));
  const resourceById = useMemo(() => new Map((model?.resources ?? []).map((resource) => [resource.id, resource])), [model]);

  return (
    <footer className="atlas-workbench" aria-label="Corpus search workbench" data-testid="atlas-workbench">
      <section className="atlas-workbench__search" aria-label="Public corpus metadata and source-span search">
        <div className="atlas-workbench__header">
          <span className="eyebrow">Corpus search</span>
          <strong>{model ? `${model.metadata.resource_node_count} public resources` : loadState.status}</strong>
          <small>{model ? `${model.sourceSpanCoverage.count} parsed-subset coverage` : "source spans pending"}</small>
        </div>
        <form className="atlas-workbench__form" role="search" aria-label="Search public corpus metadata and source spans" onSubmit={onSearchSubmit}>
          <label htmlFor="atlas-workbench-search">Metadata/source-span query</label>
          <input
            id="atlas-workbench-search"
            name="atlas-workbench-search"
            type="search"
            value={query}
            onChange={onQueryChange}
            aria-label="Search public corpus metadata and parsed source spans"
            placeholder="Search title, resource ID, disease site, or parsed excerpt"
          />
          <button type="submit" disabled={searchState.status === "loading" || loadState.status === "loading"}>Search</button>
        </form>
        <p className="atlas-workbench__model-note">{modelDisabledNote}</p>
      </section>

      <section className="atlas-workbench__results" aria-live="polite" aria-label="Corpus search results">
        <div className="atlas-workbench__status">
          <span>{selectedResource?.id ?? "resource pending"}</span>
          <span>{searchState.status === "loading" ? "searching local API" : searchState.message}</span>
          {response ? <span>{response.modelRouting}</span> : null}
        </div>

        {searchState.status === "error" ? <p className="atlas-workbench__empty">{searchState.message}</p> : null}
        {hasSearched && !hasResults ? <p className="atlas-workbench__empty">No results for this query in public metadata or parsed source spans.</p> : null}

        {response ? (
          <div className="atlas-workbench__result-grid">
            <ResultGroup title="Metadata results" count={response.metadataResultCount}>
              {response.metadataResults.length > 0 ? response.metadataResults.map((result) => (
                <button key={result.resourceId} type="button" className="atlas-workbench-result" onClick={() => onMetadataSelect(result)}>
                  <span>{result.title}</span>
                  <small>{result.locator} · {result.archiveStatus} · {result.parseStatus}</small>
                  <small>Graph focus action: resource neighborhood + trust drawer</small>
                  <small>{relationshipSummaryFromFocus(result)}</small>
                  <small>{coverageStatusCopy(result.coverageStatus)}</small>
                  <small className="wrap-anywhere">{result.resourceId}</small>
                </button>
              )) : <p className="atlas-workbench__empty">No metadata results for this query.</p>}
            </ResultGroup>

            <ResultGroup title="Source span results" count={response.sourceSpanResultCount}>
              {response.sourceSpanResults.length > 0 ? response.sourceSpanResults.map((result) => {
                const resource = resourceById.get(result.resourceId);
                return (
                  <button key={result.spanId} type="button" className="atlas-workbench-result atlas-workbench-result--span" onClick={() => onSourceSpanSelect(result)}>
                    <span>{resource?.title ?? result.resourceId}</span>
                    <small>Stable/page locator: {result.stableLocator}</small>
                    <small>{result.documentId} · source status: {result.outputStatus} · parse status: {resource?.parseStatus ?? "unknown"}</small>
                    <small>Checksum/status: {result.checksumSha256 ?? "checksum not returned"} · {result.coverageStatus}</small>
                    <small>Graph focus action: parent resource + source-span provenance drawer</small>
                    <small>{relationshipSummaryFromFocus(result)}</small>
                    {result.excerpt ? <q>{result.excerpt}</q> : <small>No excerpt returned by deterministic source-span search.</small>}
                  </button>
                );
              }) : (
                <p className="atlas-workbench__empty">
                  No source-span records returned for this query. Search is scoped to the five-document parsed subset when derived source-span records exist.
                </p>
              )}
            </ResultGroup>
          </div>
        ) : null}
      </section>
    </footer>
  );
}

function ResultGroup({ title, count, children }: { title: "Metadata results" | "Source span results"; count: number; children: React.ReactNode }) {
  return (
    <section className="atlas-workbench-group" aria-label={title}>
      <div className="atlas-workbench-group__title">
        <strong>{title}</strong>
        <span>{count}</span>
      </div>
      <div className="atlas-workbench-group__body">
        {children}
      </div>
    </section>
  );
}

function NodeHoverCard({ node }: { node: AtlasNodeView }) {
  return (
    <aside className="node-hover-card" data-testid="node-hover-card" aria-live="polite">
      <span>{node.type}</span>
      <strong>{node.title}</strong>
      <p>{node.summary}</p>
      <p>{node.sourceLabel}</p>
    </aside>
  );
}

function ProvenanceInspector({
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
  onReviewQueueLocalAction
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

  return (
    <aside
      className="node-inspector"
      data-testid="node-inspector"
      aria-label={node ? `Provenance inspector for ${node.title}` : "Provenance inspector"}
    >
      <header className="node-inspector__header">
        <p className="eyebrow">Provenance inspector</p>
        <h2>{node ? node.title : "No graph node selected"}</h2>
        <p>{node?.summary ?? loadState.message}</p>
      </header>

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
          <small>{activeSpan ? activeSpan.stable_locator : "No source-span records are available for this resource in the current parsed subset output."}</small>
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

        <div className="trust-status-grid">
          <article>
            <span>Coverage status</span>
            <strong>{coverageStatus}</strong>
            <p>{coverageStatusCopy(coverageStatus)}</p>
          </article>
          <article>
            <span>Local routing</span>
            <strong>{activeFocus?.interpretabilitySummary.modelRouting ?? interpretabilityModel?.modelRouting ?? "none-local-deterministic-search-only"}</strong>
            <p>Generated model answers stay disabled; this drawer shows deterministic metadata, graph links, and source-span provenance only.</p>
          </article>
          <article>
            <span>Offline archive status</span>
            <strong>{offlineResourceStatusLabel(selectedOfflineStatus?.changeState)}</strong>
            <p>{offlineResourceStatusCopy(selectedOfflineStatus, surveillanceStatus)}</p>
            <div className="status-chip-row" aria-label="Offline local archive status chips">
              <StatusChip tone={offlineStatusTone(selectedOfflineStatus?.reviewStatus)}>{selectedOfflineStatus?.reviewStatus ?? "local_pending"}</StatusChip>
              <StatusChip tone="neutral">changed {surveillanceStatus?.changedCount ?? 0}</StatusChip>
              <StatusChip tone="warning">missing {surveillanceStatus?.missingCount ?? 0}</StatusChip>
              <StatusChip tone="success">unchanged {surveillanceStatus?.unchangedCount ?? 0}</StatusChip>
              <StatusChip tone="warning">needs review {surveillanceStatus?.needsReviewCount ?? 0}</StatusChip>
            </div>
          </article>
        </div>

        <section className="relationship-trace" data-testid="lookup-relationship-trace" aria-label="Lookup graph relationship trace">
          <div className="relationship-trace__title">
            <strong>Why this result is connected</strong>
            <span>{activeFocus?.interpretabilitySummary.graphNeighborCount ?? relationshipRows.length} relations</span>
          </div>
          <ol>
            {relationshipRows.map((row) => (
              <li key={`${row.kind}:${row.label}`} data-relation-kind={row.kind}>
                <span>{row.kind}</span>
                <strong>{row.label}</strong>
                <small>{row.detail}</small>
              </li>
            ))}
          </ol>
        </section>

        <section className="source-span-provenance" aria-label="Active source-span provenance">
          <div>
            <span>Source-span provenance</span>
            <strong>{activeSpan?.stable_locator ?? "Source spans unavailable for this selection"}</strong>
          </div>
          <dl>
            <div>
              <dt>Parent resource</dt>
              <dd className="wrap-anywhere">{resource?.id ?? "resource pending"}</dd>
            </div>
            <div>
              <dt>Checksum/status</dt>
              <dd className="wrap-anywhere">{activeSpan ? `${activeSpan.checksum_sha256 ?? "checksum not returned"} · ${activeSpan.output_status}` : coverageStatusCopy(coverageStatus)}</dd>
            </div>
            <div>
              <dt>Stable locator</dt>
              <dd className="wrap-anywhere">{activeSpan?.stable_locator ?? "No parsed source-span locator is available for this coverage state."}</dd>
            </div>
          </dl>
        </section>

        <ReviewQueueRelation
          items={reviewQueueItems}
          resource={resource}
          sourceSpans={sourceSpansForReviewQueue(interpretabilityModel, activeSpan)}
          localAction={reviewQueueLocalAction}
          onFocus={onReviewQueueFocus}
          onLocalAction={onReviewQueueLocalAction}
        />
      </section>

      {isResourceSelection && resource ? (
        <details className="inspector-details" data-testid="resource-identifier-details">
          <summary>Resource identifiers and URL</summary>
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
        <summary>Source span locator and excerpt</summary>
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
            <dt>Quoted span</dt>
            <dd className="wrap-anywhere">{activeSpan?.excerpt ?? "No quoted span is displayed when derived source-span files are absent."}</dd>
          </div>
        </dl>
      </details>
    </aside>
  );
}

function ReviewQueueRelation({
  items,
  resource,
  sourceSpans,
  localAction,
  onFocus,
  onLocalAction
}: {
  items: CompactAtlasReviewQueueItem[];
  resource: CompactAtlasResource | null;
  sourceSpans: CorpusSourceSpan[];
  localAction: ReviewQueueLocalAction | null;
  onFocus: (resourceId: string, spanId?: string) => void;
  onLocalAction: (reviewTaskId: string, label: string) => void;
}) {
  const sourceSpanById = useMemo(() => new Map(sourceSpans.map((span) => [span.span_id, span])), [sourceSpans]);

  return (
    <section className="review-queue-relation" data-testid="review-queue-section" aria-label="Review Queue">
      <div className="relationship-trace__title">
        <strong>Review Queue</strong>
        <span>{items.length}</span>
      </div>
      <p className="review-queue-relation__note">Local evidence-review/PICO queue shell. Actions update this view only and do not write to a backend.</p>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => {
            const primarySpanId = item.sourceSpanIds[0];
            const primarySpan = primarySpanId ? sourceSpanById.get(primarySpanId) : undefined;
            const isSourceBacked = Boolean(primarySpan && item.sourceSpanIds.length > 0 && item.resourceId === resource?.id);
            const localStatus = localAction?.reviewTaskId === item.reviewTaskId ? localAction.label : null;
            const cardLabel = isSourceBacked
              ? `Focus review queue item ${item.reviewTaskId}`
              : `Blocked review queue item ${item.reviewTaskId}`;

            return (
              <li
                key={item.reviewTaskId}
                className="review-queue-card"
                data-testid={isSourceBacked ? `review-queue-card-${item.reviewTaskId}` : "review-queue-card-blocked"}
                data-blocked={isSourceBacked ? "false" : "true"}
                aria-disabled={isSourceBacked ? undefined : true}
                role={isSourceBacked ? "button" : undefined}
                tabIndex={isSourceBacked ? 0 : undefined}
                aria-label={cardLabel}
                onClick={isSourceBacked ? () => onFocus(item.resourceId, primarySpanId) : undefined}
                onKeyDown={isSourceBacked ? (event) => {
                  if (event.key !== "Enter" && event.key !== " ") {
                    return;
                  }
                  event.preventDefault();
                  onFocus(item.resourceId, primarySpanId);
                } : undefined}
              >
                <div className="review-queue-card__topline">
                  <span>{item.reviewStatus} · {item.stalenessStatus}</span>
                  <StatusChip tone={reviewQueueStatusTone(isSourceBacked, item.stalenessStatus)}>{isSourceBacked ? "source-backed" : "blocked"}</StatusChip>
                </div>
                <strong className="wrap-anywhere">{resource?.title ?? item.resourceId}</strong>
                <small className="wrap-anywhere">Task: {item.reviewTaskId}</small>
                <small className="wrap-anywhere">Source-span locator: {primarySpan?.stable_locator ?? "blocked until a returned source span backs this item"}</small>
                <small className="wrap-anywhere">Checksum/status: {primarySpan ? `${primarySpan.checksum_sha256 ?? "checksum not returned"} · ${primarySpan.output_status}` : "unbacked item blocked"}</small>
                <dl className="review-queue-pico" aria-label="PICO placeholder fields">
                  <div><dt>Population</dt><dd>{item.picoPlaceholder.population ?? "not set"}</dd></div>
                  <div><dt>Intervention</dt><dd>{item.picoPlaceholder.intervention ?? "not set"}</dd></div>
                  <div><dt>Comparator</dt><dd>{item.picoPlaceholder.comparator ?? "not set"}</dd></div>
                  <div><dt>Outcome</dt><dd>{item.picoPlaceholder.outcome ?? "not set"}</dd></div>
                </dl>
                {isSourceBacked && primarySpan?.excerpt ? <q>{primarySpan.excerpt}</q> : null}
                {!isSourceBacked ? <p className="review-queue-card__blocked-copy">Blocked local fixture state: no source-backed review content is displayed and no finding is implied.</p> : null}
                {isSourceBacked ? (
                  <div className="review-queue-actions" aria-label={`Allowed local actions for ${item.reviewTaskId}`}>
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
                ) : null}
                {localStatus ? <small role="status" className="review-queue-local-state">Local UI state: {localStatus}</small> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="review-queue-relation__empty">No source-backed local review queue items returned for this resource.</p>
      )}
    </section>
  );
}

function sourceSpansForReviewQueue(interpretabilityModel: CompactAtlasInterpretabilityModel | null, activeSpan: CorpusSourceSpan | null) {
  const spans = interpretabilityModel?.sourceSpans ?? [];
  if (!activeSpan || spans.some((span) => span.span_id === activeSpan.span_id)) {
    return spans;
  }
  return [activeSpan, ...spans];
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

function sourceSpanFromSearchResult(result: CompactAtlasSourceSpanSearchResult): CorpusSourceSpan {
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

function relationshipSummaryFromFocus(focus: CompactAtlasGraphFocusMetadata) {
  const labels = focus.edgeTypes.map(edgeTypeLabel);
  if (focus.sourceSpanIds.length > 0) {
    labels.push("resource -> source span");
  }
  if (focus.reviewTaskIds.length > 0) {
    labels.push("source span -> review item");
  }

  return `Trace: ${dedupe(labels).join(" / ") || "resource neighborhood pending"}`;
}

function buildRelationshipRows(
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
      label: activeSpan?.stable_locator ?? sourceSpanNode?.label ?? sourceSpanIds[0],
      detail: activeSpan ? `${activeSpan.span_id} · ${activeSpan.output_status}` : `${sourceSpanIds.length} source-span IDs linked by API metadata`
    });
  }

  const reviewTaskIds = dedupe([...(focus?.reviewTaskIds ?? []), ...(interpretabilityModel?.reviewTaskIds ?? [])]);
  if (reviewTaskIds.length > 0) {
    rows.push({ kind: "review item", label: `${reviewTaskIds.length} local review queue item(s)`, detail: reviewTaskIds.join(", ") });
  }

  return rows;
}

function coverageStatusFromResource(resource: CompactAtlasResource | null) {
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

function effectiveCoverageStatus(resource: CompactAtlasResource | null, lookupStatus?: string, interpretabilityStatus?: string) {
  if (lookupStatus === "source_span_ready" || lookupStatus === "partial_source_span") {
    return lookupStatus;
  }
  const resourceStatus = coverageStatusFromResource(resource);
  if (resourceStatus !== "metadata_only") {
    return resourceStatus;
  }
  return lookupStatus ?? interpretabilityStatus ?? resourceStatus;
}

function coverageStatusCopy(status: string) {
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

function offlineSurveillanceSummary(status: CompactAtlasSurveillanceStatus | null) {
  if (!status) {
    return "offline archive status pending";
  }
  return `${status.needsReviewCount ?? 0} needs review · ${status.unchangedCount ?? 0} unchanged local/archive`;
}

function offlineResourceStatusLabel(changeState?: string) {
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

function offlineStatusTone(reviewStatus?: string) {
  if (reviewStatus === "needs_review") {
    return "warning";
  }
  if (reviewStatus === "no_change") {
    return "success";
  }
  return "neutral";
}

function offlineResourceStatusCopy(
  resourceStatus: CompactAtlasSurveillanceStatus["resourceStatuses"][number] | undefined,
  surveillanceStatus: CompactAtlasSurveillanceStatus | null
) {
  if (!resourceStatus || !surveillanceStatus) {
    return "Offline/local archive comparison is pending from the local manifest fixtures; no network check is shown.";
  }
  return `Offline/local manifest comparison only: ${resourceStatus.previousStatus ?? "none"} to ${resourceStatus.currentStatus ?? "none"}; ${resourceStatus.reviewStatus}. No network check or clinical inference is shown.`;
}

function edgeTypeLabel(edgeType: string) {
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

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function selectVisibleResources(resources: CompactAtlasResource[], selectedResourceId?: string) {
  const firstResources = resources.slice(0, 24);
  if (!selectedResourceId || firstResources.some((resource) => resource.id === selectedResourceId)) {
    return firstResources;
  }

  const selectedResource = resources.find((resource) => resource.id === selectedResourceId);
  return selectedResource ? [selectedResource, ...firstResources.slice(0, 23)] : firstResources;
}

function isInteractiveKeyboardTarget(target: EventTarget) {
  return target instanceof HTMLElement && Boolean(target.closest("input, button, textarea, select, a, [role='search']"));
}

function buildClusterResourceCounts(model: CorpusAtlasModel) {
  return model.graphPayload.edges.reduce<Record<string, number>>((counts, edge) => {
    if (edge.type.startsWith("resource_to_") && edge.target) {
      counts[edge.target] = (counts[edge.target] ?? 0) + 1;
    }
    return counts;
  }, {});
}

function buildAtlasNodeViews(model: CorpusAtlasModel, clusterResourceCounts: Record<string, number>): AtlasNodeView[] {
  return [...model.graphPayload.nodes]
    .filter((node) => model.graph.hasNode(node.id))
    .sort((left, right) => nodeSortKey(left).localeCompare(nodeSortKey(right)))
    .map((node) => toAtlasNodeView(node, model, clusterResourceCounts[node.id] ?? 0));
}

function toAtlasNodeView(node: CorpusGraphNode, model: CorpusAtlasModel, aggregateCount: number): AtlasNodeView {
  const attributes = model.graph.getNodeAttributes(node.id);
  const kind = toNodeKind(attributes.nodeType);
  const group = toNodeGroup(attributes.nodeType);

  return {
    id: node.id,
    title: attributes.label,
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

function buildSearchOptions(nodeViews: AtlasNodeView[], query: string): SearchOption[] {
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
    return `${node.resource_id ?? node.id} · ${node.archive_status ?? "metadata-only"} · ${node.parse_status ?? "not-parsed"}`;
  }
  return `${node.id} · metadata projection`;
}

function nodeSortKey(node: CorpusGraphNode) {
  const typeRank = node.type === "resource" ? "1" : "0";
  return `${typeRank}:${node.type}:${node.label ?? node.title ?? node.id}`;
}
