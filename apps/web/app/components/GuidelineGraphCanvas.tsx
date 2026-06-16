"use client";

import React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  CorpusAtlasClientError,
  loadCorpusAtlas,
  searchCorpus,
  type CompactAtlasMetadataSearchResult,
  type CompactAtlasResource,
  type CompactAtlasSearchResponse,
  type CompactAtlasSourceSpanSearchResult,
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
    return model.sourceSpans.filter((span) => span.resource_id === selectedResource.id);
  }, [model, selectedResource]);
  const activeSpan = sourceSpans.find((span) => span.span_id === activeSpanId) ?? sourceSpans[0] ?? null;
  const visibleResources = useMemo(() => model ? selectVisibleResources(model.resources, selectedResource?.id) : [], [model, selectedResource]);
  const diseaseSiteClusters = useMemo(() => {
    if (!model) {
      return [];
    }
    return nodeViews
      .filter((node) => node.group === "diseaseSites")
      .sort((left, right) => right.aggregateCount - left.aggregateCount || left.title.localeCompare(right.title));
  }, [model, nodeViews]);

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
    selectNodeById(result.id);
  }, [selectNodeById]);

  const handleResourceSelect = useCallback((resourceId: string) => {
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
    focusResourceById(result.resourceId);
  }, [focusResourceById]);

  const handleSourceSpanSearchSelect = useCallback((result: CompactAtlasSourceSpanSearchResult) => {
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
          <LayerStatusPanel model={model} loadState={loadState} />
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

function LayerStatusPanel({ model, loadState }: { model: CorpusAtlasModel | null; loadState: AtlasLoadState }) {
  return (
    <div className="sidebar-section sidebar-section--compact">
      <p className="eyebrow">Layer status</p>
      <ul className="layer-list">
        <li><span className="layer-dot layer-dot--cyan" /> {model?.metadata.resource_node_count ?? 0} public resources</li>
        <li><span className="layer-dot layer-dot--gold" /> {model?.sourceSpanCoverage.count ?? 0} parsed-subset coverage</li>
        <li><span className="layer-dot layer-dot--green" /> {loadState.status}</li>
        <li><span className="layer-dot layer-dot--red" /> No clinical advice</li>
      </ul>
    </div>
  );
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
  loadState
}: {
  node: AtlasNodeView | null;
  resource: CompactAtlasResource | null;
  activeSpan: CorpusSourceSpan | null;
  model: CorpusAtlasModel | null;
  loadState: AtlasLoadState;
}) {
  const isResourceSelection = node?.kind === "resource";
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
