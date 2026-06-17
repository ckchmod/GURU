"use client";

import React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  CorpusAtlasClientError,
  loadCorpusConversationTurn,
  loadCorpusExplainSelection,
  loadCorpusAtlas,
  loadCorpusInterpretability,
  loadCorpusWorkbenchTrace,
  searchCorpus,
  type CompactAtlasMetadataSearchResult,
  type CompactAtlasSourceSpanSearchResult,
  type CorpusConversationCitation,
  type CorpusSourceSpan
} from "../../lib/corpusAtlas";
import { AtlasSidebar } from "./AtlasSidebar";
import { GraphSearchPanel } from "./GraphSearchPanel";
import { GraphCanvasViewport, GraphWorkbenchLayout } from "./GraphWorkbenchLayout";
import {
  buildAtlasNodeViews,
  buildClusterResourceCounts,
  buildExplainSelectionRequest,
  buildRetrievalGraphEvidenceState,
  buildSearchOptions,
  formatSourceSpanLabel,
  isInteractiveKeyboardTarget,
  selectVisibleResources,
  sourceSpanFromSearchResult,
  sourceSpanGraphNodeIds
} from "./GraphWorkbenchHelpers";
import { AtlasStateCard, NodeHoverCard } from "./GraphWorkbenchShared";
import {
  type AtlasLoadState,
  type ExplainSelectionTraceState,
  type InterpretabilityLoadState,
  type LookupSelection,
  type ReviewQueueLocalAction,
  type RetrievalGraphEvidenceState,
  type SearchOption,
  type SearchSubmitEvent,
  type SelectNodeOptions,
  type WorkbenchPanelMode,
  type WorkbenchSearchState,
  type WorkbenchSearchSubmitEvent,
  type WorkbenchTraceState
} from "./GraphWorkbenchTypes";
import { ProvenancePanel } from "./ProvenancePanel";
import { RetrievalAssistantRail, type AnswerCitationFocusMode, type SelectedContextAssistantTurnState, type SelectedSourceContext } from "./RetrievalAssistantRail";
import type { SigmaCorpusGraphProps } from "./SigmaCorpusGraph";
import { SourceViewPanel } from "./SourceViewPanel";

export type { AtlasNodeKind, AtlasNodeView, RetrievalGraphEvidenceState } from "./GraphWorkbenchTypes";

const SigmaCorpusGraph = dynamic<SigmaCorpusGraphProps>(
  () => import("./SigmaCorpusGraph").then((module) => module.SigmaCorpusGraph),
  {
    ssr: false,
    loading: () => <div className="sigma-atlas-loading" role="status">Loading Sigma corpus graph</div>
  }
);

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

const initialWorkbenchTraceState: WorkbenchTraceState = {
  status: "idle",
  query: "",
  response: null,
  message: "Run a retrieval query to inspect the local workbench trace."
};

const initialExplainSelectionTraceState: ExplainSelectionTraceState = {
  status: "idle",
  request: null,
  response: null,
  message: "Select a source-backed graph item, then run trace details for command metadata."
};

const initialSelectedContextAssistantTurnState: SelectedContextAssistantTurnState = {
  status: "idle",
  request: null,
  response: null,
  message: "Select source-span context, then ask one source-backed question."
};

type SelectedContextQuestionSubmitEvent = {
  preventDefault: () => void;
  currentTarget: HTMLFormElement;
};

type AnswerCitationGraphFocus = {
  citation: CorpusConversationCitation;
  mode: Exclude<AnswerCitationFocusMode, "none">;
  resourceId: string | null;
  selectedNodeId: string | null;
};

const minVaultWidth = 208;
const maxVaultWidth = 360;
const defaultVaultWidth = 248;
const minProvenanceWidth = 240;
const maxProvenanceWidth = 460;
const defaultProvenanceWidth = 296;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function eventCoordinate(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function defaultAssistantRailHeight() {
  return 260;
}

export function GuidelineGraphCanvas() {
  const [loadState, setLoadState] = useState<AtlasLoadState>(initialLoadState);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [activeSpanId, setActiveSpanId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [workbenchQuery, setWorkbenchQuery] = useState("");
  const [workbenchSearchState, setWorkbenchSearchState] = useState<WorkbenchSearchState>(initialWorkbenchSearchState);
  const [workbenchTraceState, setWorkbenchTraceState] = useState<WorkbenchTraceState>(initialWorkbenchTraceState);
  const [explainSelectionTraceState, setExplainSelectionTraceState] = useState<ExplainSelectionTraceState>(initialExplainSelectionTraceState);
  const [selectedContextQuestion, setSelectedContextQuestion] = useState("");
  const [selectedContextAssistantTurnState, setSelectedContextAssistantTurnState] = useState<SelectedContextAssistantTurnState>(initialSelectedContextAssistantTurnState);
  const [answerCitationGraphFocus, setAnswerCitationGraphFocus] = useState<AnswerCitationGraphFocus | null>(null);
  const [interpretabilityState, setInterpretabilityState] = useState<InterpretabilityLoadState>(initialInterpretabilityState);
  const [lookupSelection, setLookupSelection] = useState<LookupSelection | null>(null);
  const [reviewQueueLocalAction, setReviewQueueLocalAction] = useState<ReviewQueueLocalAction | null>(null);
  const [vaultPanelMode, setVaultPanelMode] = useState<WorkbenchPanelMode>("visible");
  const [provenancePanelMode, setProvenancePanelMode] = useState<WorkbenchPanelMode>("visible");
  const [reviewPanelMode, setReviewPanelMode] = useState<WorkbenchPanelMode>("visible");
  const [assistantRailMode, setAssistantRailMode] = useState<WorkbenchPanelMode>("visible");
  const [graphSearchVisible, setGraphSearchVisible] = useState(true);
  const [sourceViewVisible, setSourceViewVisible] = useState(true);
  const [vaultWidth, setVaultWidth] = useState(defaultVaultWidth);
  const [provenanceWidth, setProvenanceWidth] = useState(defaultProvenanceWidth);
  const [assistantRailHeight, setAssistantRailHeight] = useState(defaultAssistantRailHeight);
  const [assistantRailHeightState, setAssistantRailHeightState] = useState<"default" | "resized">("default");

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
  const retrievalGraphEvidence = useMemo(
    () => buildRetrievalGraphEvidenceState(workbenchSearchState.response, lookupSelection, selectedResource, selectedNode, activeSpan, model),
    [activeSpan, lookupSelection, model, selectedNode, selectedResource, workbenchSearchState.response]
  );
  const answerCitationGraphEvidence = useMemo(
    () => buildAnswerCitationGraphEvidenceState(answerCitationGraphFocus, model),
    [answerCitationGraphFocus, model]
  );
  const activeRetrievalGraphEvidence = answerCitationGraphEvidence ?? retrievalGraphEvidence;
  const explainSelectionRequest = useMemo(
    () => buildExplainSelectionRequest(retrievalGraphEvidence, selectedNode, selectedResource, activeSpan),
    [activeSpan, retrievalGraphEvidence, selectedNode, selectedResource]
  );
  const selectedSourceContext = useMemo<SelectedSourceContext | null>(() => {
    if (!activeSpan) {
      return null;
    }

    const sourceSpanSelected = lookupSelection?.kind === "source_span"
      || selectedNode?.kind === "sourceSpan"
      || retrievalGraphEvidence?.selectedSourceSpanId === activeSpan.span_id;
    if (!sourceSpanSelected) {
      return null;
    }

    return {
      sourceSpanId: activeSpan.span_id,
      displayLabel: formatSourceSpanLabel(activeSpan.stable_locator),
      stableLocator: activeSpan.stable_locator,
      resourceId: activeSpan.resource_id,
      selectedNodeId: retrievalGraphEvidence?.graphFocusNodeId ?? selectedNode?.id ?? `resource.${activeSpan.resource_id}`,
      sourceDocumentId: activeSpan.document_id,
      excerpt: activeSpan.excerpt
    };
  }, [activeSpan, lookupSelection?.kind, retrievalGraphEvidence?.graphFocusNodeId, retrievalGraphEvidence?.selectedSourceSpanId, selectedNode?.id, selectedNode?.kind]);

  useEffect(() => {
    setSelectedContextQuestion("");
    setSelectedContextAssistantTurnState(initialSelectedContextAssistantTurnState);
    setAnswerCitationGraphFocus(null);
  }, [selectedSourceContext?.sourceSpanId]);

  useEffect(() => {
    setAnswerCitationGraphFocus(null);
  }, [selectedContextAssistantTurnState.response]);

  const clearUnpinnedAnswerCitationFocus = useCallback(() => {
    setAnswerCitationGraphFocus((current) => current?.mode === "pinned" ? current : null);
  }, []);

  const closeTransientPanels = useCallback(() => {
    setGraphSearchVisible(false);
    setSourceViewVisible(false);
    clearUnpinnedAnswerCitationFocus();
  }, [clearUnpinnedAnswerCitationFocus]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      setGraphSearchVisible(false);
      setSourceViewVisible(false);
      clearUnpinnedAnswerCitationFocus();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [clearUnpinnedAnswerCitationFocus]);

  const handleVaultResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = eventCoordinate(event.clientX, 0);
    const startWidth = vaultWidth;
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextX = eventCoordinate(moveEvent.clientX, startX);
      setVaultWidth(clamp(startWidth + nextX - startX, minVaultWidth, maxVaultWidth));
    };
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }, [vaultWidth]);

  const handleProvenanceResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = eventCoordinate(event.clientX, 0);
    const startWidth = provenanceWidth;
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextX = eventCoordinate(moveEvent.clientX, startX);
      setProvenanceWidth(clamp(startWidth - (nextX - startX), minProvenanceWidth, maxProvenanceWidth));
    };
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }, [provenanceWidth]);

  const handleAssistantRailResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = eventCoordinate(event.clientY, 0);
    const startHeight = assistantRailHeight;
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const minHeight = Math.round(window.innerHeight * 0.2);
      const maxHeight = Math.round(window.innerHeight * 0.55);
      const nextY = eventCoordinate(moveEvent.clientY, startY);
      setAssistantRailHeight(clamp(startHeight + startY - nextY, minHeight, maxHeight));
      setAssistantRailHeightState("resized");
    };
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }, [assistantRailHeight]);

  const selectNodeById = useCallback((nodeId: string, options: SelectNodeOptions = {}) => {
    if (!model) {
      return;
    }

    const nextNode = nodeViews.find((node) => node.id === nodeId);
    if (!nextNode) {
      return;
    }

    if (!options.preserveLookupSelection) {
      setLookupSelection(null);
    }
    setSelectedNodeId(nextNode.id);
    if (nextNode.resourceId) {
      setSelectedResourceId(nextNode.resourceId);
      setActiveSpanId(nextNode.kind === "sourceSpan" ? nextNode.id : null);
    } else if (nextNode.kind === "sourceSpan") {
      setActiveSpanId(nextNode.id);
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

  const focusResourceById = useCallback((resourceId: string, spanId?: string, options: SelectNodeOptions = {}) => {
    const resourceNodeId = `resource.${resourceId}`;
    const representedSpanNodeId = spanId && model ? sourceSpanGraphNodeIds(model, [spanId])[0] : undefined;
    if (representedSpanNodeId && nodeViews.some((node) => node.id === representedSpanNodeId)) {
      selectNodeById(representedSpanNodeId, options);
    } else if (nodeViews.some((node) => node.id === resourceNodeId)) {
      selectNodeById(resourceNodeId, options);
    } else if (model?.resources.some((resource) => resource.id === resourceId)) {
      setSelectedResourceId(resourceId);
      if (!options.preserveLookupSelection) {
        setLookupSelection(null);
      }
    }

    setSelectedResourceId(resourceId);
    setActiveSpanId(spanId ?? null);
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

  const handleSelectedContextQuestionChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSelectedContextQuestion(event.target.value);
  }, []);

  const handleSelectedContextQuestionSubmit = useCallback(async (event: SelectedContextQuestionSubmitEvent) => {
    event.preventDefault();
    const question = selectedContextQuestion.trim();

    if (!selectedSourceContext) {
      setSelectedContextAssistantTurnState({
        status: "idle",
        request: null,
        response: null,
        message: "Select a source-backed graph item to ask."
      });
      return;
    }

    if (!question) {
      setSelectedContextAssistantTurnState({
        status: "idle",
        request: null,
        response: null,
        message: "Enter one concise question for the selected source context."
      });
      return;
    }

    const request = {
      question,
      source_span_id: selectedSourceContext.sourceSpanId,
      selected_node_id: selectedSourceContext.selectedNodeId,
      resource_id: selectedSourceContext.resourceId
    };

    setSelectedContextAssistantTurnState({
      status: "loading",
      request,
      response: null,
      message: "Requesting a cited draft from selected source context only."
    });

    try {
      const response = await loadCorpusConversationTurn(request);
      setSelectedContextAssistantTurnState({
        status: "success",
        request,
        response,
        message: response.status === "draft"
          ? "Cited draft returned for the selected source context."
          : response.status === "unavailable"
            ? "Generation is unavailable for the selected source context."
            : "The selected-context assistant refused this question."
      });
    } catch (error: unknown) {
      const message = error instanceof CorpusAtlasClientError
        ? error.message
        : "Corpus conversation turn API unavailable.";
      setSelectedContextAssistantTurnState({
        status: "error",
        request,
        response: null,
        message
      });
    }
  }, [selectedContextQuestion, selectedSourceContext]);

  const handleWorkbenchSearchSubmit = useCallback(async (event: WorkbenchSearchSubmitEvent) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submittedQuery = String(formData.get("atlas-workbench-search") ?? workbenchQuery).trim();

    if (!submittedQuery) {
      setWorkbenchSearchState(initialWorkbenchSearchState);
      setWorkbenchTraceState(initialWorkbenchTraceState);
      setExplainSelectionTraceState(initialExplainSelectionTraceState);
      return;
    }

    setWorkbenchSearchState({ status: "loading", query: submittedQuery, response: null, message: "Searching local public corpus metadata and parsed source spans." });
    setWorkbenchTraceState({ status: "loading", query: submittedQuery, response: null, message: "Loading local workbench trace metadata." });
    try {
      const [searchResponse, traceResponse] = await Promise.all([
        searchCorpus(submittedQuery),
        loadCorpusWorkbenchTrace(submittedQuery)
      ]);
      setWorkbenchSearchState({ status: "success", query: submittedQuery, response: searchResponse, message: "Search completed through the local deterministic corpus API." });
      setWorkbenchTraceState({ status: "success", query: submittedQuery, response: traceResponse, message: "Workbench trace completed through the local deterministic corpus API." });
    } catch (error: unknown) {
      const message = error instanceof CorpusAtlasClientError
        ? error.message
        : "Corpus search API unavailable.";
      setWorkbenchSearchState({ status: "error", query: submittedQuery, response: null, message });
      setWorkbenchTraceState({ status: "error", query: submittedQuery, response: null, message });
    }
  }, [workbenchQuery]);

  const handleMetadataSearchSelect = useCallback((result: CompactAtlasMetadataSearchResult) => {
    setLookupSelection({
      kind: "metadata",
      resourceId: result.resourceId,
      title: result.title,
      focus: result
    });
    focusResourceById(result.resourceId, undefined, { preserveLookupSelection: true });
  }, [focusResourceById]);

  const handleSourceSpanSearchSelect = useCallback((result: CompactAtlasSourceSpanSearchResult) => {
    setLookupSelection({
      kind: "source_span",
      resourceId: result.resourceId,
      title: result.title,
      focus: result,
      sourceSpan: sourceSpanFromSearchResult(result)
    });
    focusResourceById(result.resourceId, result.spanId, { preserveLookupSelection: true });
  }, [focusResourceById]);

  const buildAnswerCitationFocus = useCallback((citation: CorpusConversationCitation, mode: Exclude<AnswerCitationFocusMode, "none">): AnswerCitationGraphFocus => ({
    citation,
    mode,
    resourceId: selectedSourceContext?.resourceId ?? selectedResource?.id ?? null,
    selectedNodeId: selectedSourceContext?.selectedNodeId ?? retrievalGraphEvidence?.graphFocusNodeId ?? selectedNode?.id ?? null
  }), [retrievalGraphEvidence?.graphFocusNodeId, selectedNode?.id, selectedResource?.id, selectedSourceContext?.resourceId, selectedSourceContext?.selectedNodeId]);

  const handleAnswerCitationHover = useCallback((citation: CorpusConversationCitation) => {
    setAnswerCitationGraphFocus((current) => current?.mode === "pinned" ? current : buildAnswerCitationFocus(citation, "transient"));
  }, [buildAnswerCitationFocus]);

  const handleAnswerCitationFocus = useCallback((citation: CorpusConversationCitation) => {
    setAnswerCitationGraphFocus((current) => current?.mode === "pinned" ? current : buildAnswerCitationFocus(citation, "transient"));
  }, [buildAnswerCitationFocus]);

  const handleAnswerCitationClick = useCallback((citation: CorpusConversationCitation) => {
    const nextFocus = buildAnswerCitationFocus(citation, "pinned");
    setAnswerCitationGraphFocus(nextFocus);
    if (nextFocus.resourceId) {
      focusResourceById(nextFocus.resourceId, citation.source_span_id, { preserveLookupSelection: true });
    } else {
      setActiveSpanId(citation.source_span_id);
    }
    setSourceViewVisible(true);
  }, [buildAnswerCitationFocus, focusResourceById]);

  const handleExplainSelection = useCallback(async () => {
    if (!explainSelectionRequest) {
      setExplainSelectionTraceState({
        status: "idle",
        request: null,
        response: null,
        message: "Trace details need a selected graph resource, graph node, or source-span-backed result."
      });
      return;
    }

    setExplainSelectionTraceState({
      status: "loading",
      request: explainSelectionRequest,
      response: null,
      message: explainSelectionRequest.source_span_id
        ? "Running selected-source trace details for the source-span context."
        : "Running trace details as a blocked metadata-only trace."
    });

    try {
      const response = await loadCorpusExplainSelection(explainSelectionRequest);
      setExplainSelectionTraceState({
        status: "success",
        request: explainSelectionRequest,
        response,
        message: "Selected-source trace details returned metadata from the local corpus API."
      });
    } catch (error: unknown) {
      const message = error instanceof CorpusAtlasClientError
        ? error.message
        : "Corpus selected-source trace API unavailable.";
      setExplainSelectionTraceState({ status: "error", request: explainSelectionRequest, response: null, message });
    }
  }, [explainSelectionRequest]);

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
    <GraphWorkbenchLayout
      atlasSidebar={(
        <AtlasSidebar
          visibleResources={visibleResources}
          selectedResource={selectedResource}
          selectedNodeId={selectedNodeId}
          diseaseSiteClusters={diseaseSiteClusters}
          model={model}
          loadState={loadState}
          surveillanceStatus={surveillanceStatus}
          surveillanceStatusByResourceId={surveillanceStatusByResourceId}
          onResourceSelect={handleResourceSelect}
          onNodeSelect={selectNodeById}
          onCollapse={() => setVaultPanelMode("collapsed")}
          onDismiss={() => setVaultPanelMode("dismissed")}
        />
      )}
      graphCanvas={(
        <GraphCanvasViewport
          title={selectedNode?.title ?? selectedResource?.title ?? "Public corpus atlas"}
          subtitle={selectedNode?.type ?? "public corpus graph"}
          graphSearchVisible={graphSearchVisible}
          sourceViewVisible={sourceViewVisible}
          onShowGraphSearch={() => setGraphSearchVisible(true)}
          onShowSourceView={() => setSourceViewVisible(true)}
          onCloseTransientPanels={closeTransientPanels}
          onKeyDown={handleKeyboardSelect}
        >
          {loadState.status === "success" && model ? (
            <SigmaCorpusGraph
              model={model}
              nodeViews={nodeViews}
              selectedNodeId={selectedNodeId}
              hoveredNodeId={hoveredNodeId}
              retrievalEvidence={activeRetrievalGraphEvidence}
              onNodeSelectAction={selectNodeById}
              onNodeHoverAction={setHoveredNodeId}
              onZoomLevelChangeAction={() => undefined}
            />
          ) : (
            <AtlasStateCard loadState={loadState} />
          )}

          {graphSearchVisible ? (
            <GraphSearchPanel
              model={model}
              searchQuery={searchQuery}
              searchResults={searchResults}
              selectedNode={selectedNode}
              onSearchChange={handleSearchChange}
              onSearchSubmit={handleSearchSubmit}
              onResultSelect={selectSearchResult}
              onClose={() => setGraphSearchVisible(false)}
            />
          ) : null}
          {sourceViewVisible ? (
            <SourceViewPanel
              selectedResource={selectedResource}
              sourceSpans={sourceSpansForSourceView(sourceSpans, activeSpan)}
              activeSpanId={activeSpan?.span_id ?? null}
              coverageCount={model?.sourceSpanCoverage.count ?? 0}
              coverageNote={model?.sourceSpanCoverage.note ?? "Source-span coverage is unavailable until the API responds."}
              onSpanSelect={setActiveSpanId}
              onClose={() => setSourceViewVisible(false)}
            />
          ) : null}
          {hoveredNode ? <NodeHoverCard node={hoveredNode} /> : null}
        </GraphCanvasViewport>
      )}
      provenancePanel={(
        <ProvenancePanel
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
          reviewPanelMode={reviewPanelMode}
          onCollapse={() => setProvenancePanelMode("collapsed")}
          onDismiss={() => setProvenancePanelMode("dismissed")}
          onCollapseReview={() => setReviewPanelMode("collapsed")}
          onDismissReview={() => setReviewPanelMode("dismissed")}
          onShowReview={() => setReviewPanelMode("visible")}
        />
      )}
      retrievalRail={assistantRailMode === "visible" ? (
        <RetrievalAssistantRail
          model={model}
          loadState={loadState}
          selectedResource={selectedResource}
          lookupSelection={lookupSelection}
          retrievalEvidence={activeRetrievalGraphEvidence}
          query={workbenchQuery}
          searchState={workbenchSearchState}
          traceState={workbenchTraceState}
          explainSelectionState={explainSelectionTraceState}
          selectedSourceContext={selectedSourceContext}
          selectedContextQuestion={selectedContextQuestion}
          selectedContextAssistantTurnState={selectedContextAssistantTurnState}
          canExplainSelection={Boolean(explainSelectionRequest)}
          explainSelectionHasSourceSpan={Boolean(explainSelectionRequest?.source_span_id)}
          hasSelectedSourceSpanContext={Boolean(selectedSourceContext)}
          onQueryChange={handleWorkbenchQueryChange}
          onSearchSubmit={handleWorkbenchSearchSubmit}
          onMetadataSelect={handleMetadataSearchSelect}
          onSourceSpanSelect={handleSourceSpanSearchSelect}
          onSelectedContextQuestionChange={handleSelectedContextQuestionChange}
          onSelectedContextQuestionSubmit={handleSelectedContextQuestionSubmit}
          onAnswerCitationHover={handleAnswerCitationHover}
          onAnswerCitationLeave={clearUnpinnedAnswerCitationFocus}
          onAnswerCitationFocus={handleAnswerCitationFocus}
          onAnswerCitationBlur={clearUnpinnedAnswerCitationFocus}
          onAnswerCitationClick={handleAnswerCitationClick}
          answerCitationFocusMode={answerCitationGraphFocus?.mode ?? "none"}
          onExplainSelection={handleExplainSelection}
          height={assistantRailHeight}
          heightState={assistantRailHeightState}
          onResizeStart={handleAssistantRailResizeStart}
          onCollapse={() => setAssistantRailMode("collapsed")}
          onDismiss={() => setAssistantRailMode("dismissed")}
        />
      ) : assistantRailMode === "collapsed" ? (
        <div className="assistant-rail assistant-rail--collapsed" data-testid="assistant-rail" data-height-state="collapsed" data-resizable="vertical" data-min-height="20vh" data-max-height="55vh">
          <button type="button" onClick={() => setAssistantRailMode("visible")}>Expand assistant rail</button>
          <button type="button" onClick={() => setAssistantRailMode("dismissed")}>Dismiss assistant rail</button>
        </div>
      ) : (
        <div className="assistant-rail-reopen" aria-label="Dismissed assistant rail">
          <button type="button" onClick={() => setAssistantRailMode("visible")}>Show assistant rail</button>
        </div>
      )}
      vaultPanelMode={vaultPanelMode}
      provenancePanelMode={provenancePanelMode}
      vaultWidth={vaultWidth}
      provenanceWidth={provenanceWidth}
      onVaultResizeStart={handleVaultResizeStart}
      onProvenanceResizeStart={handleProvenanceResizeStart}
      onExpandVault={() => setVaultPanelMode("visible")}
      onExpandProvenance={() => setProvenancePanelMode("visible")}
      onShowVault={() => setVaultPanelMode("visible")}
      onShowProvenance={() => setProvenancePanelMode("visible")}
    />
  );
}

function buildAnswerCitationGraphEvidenceState(focus: AnswerCitationGraphFocus | null, model: NonNullable<AtlasLoadState["model"]> | null): RetrievalGraphEvidenceState | null {
  if (!focus || !model) {
    return null;
  }

  const sourceSpanNodeIds = sourceSpanGraphNodeIds(model, [focus.citation.source_span_id]);
  const resourceNodeId = focus.resourceId ? `resource.${focus.resourceId}` : null;
  const graphFocusNodeId = sourceSpanNodeIds[0] ?? focus.selectedNodeId ?? resourceNodeId;
  const graphContextNodeIds = [resourceNodeId, focus.selectedNodeId].filter((nodeId): nodeId is string => Boolean(nodeId && nodeId !== graphFocusNodeId));

  return {
    query: `Answer citation ${focus.citation.display_label}`,
    highlightedResourceIds: focus.resourceId ? [focus.resourceId] : [],
    highlightedSourceSpanIds: [focus.citation.source_span_id],
    representedSourceSpanNodeIds: sourceSpanNodeIds,
    selectedResourceId: focus.resourceId,
    selectedSourceSpanId: focus.citation.source_span_id,
    graphFocusNodeId,
    graphResourceNodeId: resourceNodeId,
    graphContextNodeIds,
    graphPathNodeIds: [resourceNodeId, ...sourceSpanNodeIds, ...graphContextNodeIds].filter((nodeId): nodeId is string => Boolean(nodeId)),
    edgeTypes: sourceSpanNodeIds.length > 0 ? ["resource_to_source_span"] : [],
    focusMode: sourceSpanNodeIds.length > 0 ? "source-span-node" : "source-span-parent-fallback",
    blockedReason: null
  };
}

function sourceSpansForSourceView(sourceSpans: CorpusSourceSpan[], activeSpan: CorpusSourceSpan | null) {
  if (!activeSpan || sourceSpans.some((span) => span.span_id === activeSpan.span_id)) {
    return sourceSpans;
  }
  return [activeSpan, ...sourceSpans];
}
