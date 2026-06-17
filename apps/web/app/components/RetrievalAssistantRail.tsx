import React, { useEffect, useMemo } from "react";
import type {
  CompactAtlasMetadataSearchResult,
  CompactAtlasResource,
  CompactAtlasSourceSpanSearchResult,
  CorpusConversationCitation,
  CorpusConversationTurnRequest,
  CorpusConversationTurnResponse,
  CorpusAtlasModel,
  CorpusWorkbenchTraceSourceRecord,
  CorpusWorkbenchTraceStep
} from "../../lib/corpusAtlas";
import {
  coverageStatusCopy,
  edgeTypeLabel,
  formatCount,
  formatSourceSpanLabel,
  metadataAvailableLabel,
  optionalRankScore,
  relationshipSummaryFromFocus,
  sourceSpanGraphPathLabel,
  sourceSpanProvenance,
  traceStepSummary
} from "./GraphWorkbenchHelpers";
import { CopyMetadataButton } from "./GraphWorkbenchShared";
import type {
  AtlasLoadState,
  ExplainSelectionTraceState,
  LookupSelection,
  RetrievalGraphEvidenceState,
  WorkbenchSearchState,
  WorkbenchSearchSubmitEvent,
  WorkbenchTraceState
} from "./GraphWorkbenchTypes";

type SelectedContextQuestionSubmitEvent = {
  preventDefault: () => void;
  currentTarget: HTMLFormElement;
};

export type SelectedSourceContext = {
  sourceSpanId: string;
  displayLabel: string;
  stableLocator: string;
  resourceId?: string;
  selectedNodeId?: string;
  sourceDocumentId?: string;
  excerpt?: string;
};

export type SelectedContextAssistantTurnState = {
  status: "idle" | "loading" | "success" | "error";
  request: CorpusConversationTurnRequest | null;
  response: CorpusConversationTurnResponse | null;
  message: string;
};

export type AnswerCitationFocusMode = "none" | "transient" | "pinned";

type RetrievalTraceEntry = "metadata result" | "source-span result" | "blocked source-span context" | "provenance drawer focus";

type RetrievalTerminalStateModel = {
  query: string;
  highlightedResources: string[];
  highlightedSourceSpans: string[];
  selectedGraphPath: string;
  selectedSourceSpanContext: string;
  blockedEvidenceLabel: string | null;
  traceEntries: RetrievalTraceEntry[];
  graphFocusNodeId: string;
  graphResourceNodeId: string;
  graphContextNodeIds: string[];
  graphPathNodeIds: string[];
  edgeTypes: string[];
  focusMode: RetrievalGraphEvidenceState["focusMode"];
  retrievalMode: string;
  metadataResults: CompactAtlasMetadataSearchResult[];
  sourceSpanResults: CompactAtlasSourceSpanSearchResult[];
  selectedMetadataResult: CompactAtlasMetadataSearchResult | null;
  selectedSourceSpanResult: CompactAtlasSourceSpanSearchResult | null;
  rawTrace: unknown;
};

export function RetrievalAssistantRail({
  model,
  loadState,
  selectedResource,
  lookupSelection,
  retrievalEvidence,
  query,
  searchState,
  traceState,
  explainSelectionState,
  selectedSourceContext,
  selectedContextQuestion,
  selectedContextAssistantTurnState,
  canExplainSelection,
  explainSelectionHasSourceSpan,
  onQueryChange,
  onSearchSubmit,
  onMetadataSelect,
  onSourceSpanSelect,
  onSelectedContextQuestionChange,
  onSelectedContextQuestionSubmit,
  onAnswerCitationHover,
  onAnswerCitationLeave,
  onAnswerCitationFocus,
  onAnswerCitationBlur,
  onAnswerCitationClick,
  answerCitationFocusMode,
  hasSelectedSourceSpanContext,
  height,
  heightState,
  onExplainSelection,
  onResizeStart,
  onCollapse,
  onDismiss
}: {
  model: CorpusAtlasModel | null;
  loadState: AtlasLoadState;
  selectedResource: CompactAtlasResource | null;
  lookupSelection: LookupSelection | null;
  retrievalEvidence: RetrievalGraphEvidenceState | null;
  query: string;
  searchState: WorkbenchSearchState;
  traceState: WorkbenchTraceState;
  explainSelectionState: ExplainSelectionTraceState;
  selectedSourceContext: SelectedSourceContext | null;
  selectedContextQuestion: string;
  selectedContextAssistantTurnState: SelectedContextAssistantTurnState;
  canExplainSelection: boolean;
  explainSelectionHasSourceSpan: boolean;
  onQueryChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchSubmit: (event: WorkbenchSearchSubmitEvent) => void;
  onMetadataSelect: (result: CompactAtlasMetadataSearchResult) => void;
  onSourceSpanSelect: (result: CompactAtlasSourceSpanSearchResult) => void;
  onSelectedContextQuestionChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSelectedContextQuestionSubmit: (event: SelectedContextQuestionSubmitEvent) => void;
  onAnswerCitationHover: (citation: CorpusConversationCitation) => void;
  onAnswerCitationLeave: () => void;
  onAnswerCitationFocus: (citation: CorpusConversationCitation) => void;
  onAnswerCitationBlur: () => void;
  onAnswerCitationClick: (citation: CorpusConversationCitation) => void;
  answerCitationFocusMode: AnswerCitationFocusMode;
  hasSelectedSourceSpanContext: boolean;
  height: number;
  heightState: "default" | "resized";
  onExplainSelection: () => void;
  onResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  onCollapse: () => void;
  onDismiss: () => void;
}) {
  const response = searchState.response;
  const resultsRef = React.useRef<HTMLElement | null>(null);
  const hasSearched = searchState.status === "success" && Boolean(response);
  const hasResults = Boolean(response && (response.metadataResults.length > 0 || response.sourceSpanResults.length > 0));
  const canSubmitQuestion = hasSelectedSourceSpanContext && selectedContextQuestion.trim().length > 0 && selectedContextAssistantTurnState.status !== "loading";
  const answerMode = selectedContextAssistantTurnState.response?.answer_mode ?? (hasSelectedSourceSpanContext ? "selected_context_cited_draft" : "refusal");
  const gatewayOutcome = selectedContextAssistantTurnState.response?.gateway_decision.outcome ?? (selectedContextAssistantTurnState.status === "error" ? "unavailable" : "none");
  const resourceById = useMemo(() => new Map((model?.resources ?? []).map((resource) => [resource.id, resource])), [model]);
  const terminalState = useMemo(
    () => buildRetrievalTerminalState(response, lookupSelection, selectedResource, retrievalEvidence),
    [lookupSelection, response, retrievalEvidence, selectedResource]
  );

  useEffect(() => {
    if (resultsRef.current) {
      resultsRef.current.scrollTop = 0;
    }
  }, [response?.query, searchState.status]);

  return (
    <div
      className="assistant-rail"
      data-testid="assistant-rail"
      data-resizable="vertical"
      data-min-height="20vh"
      data-max-height="55vh"
      data-height-state={heightState}
      data-answer-mode={answerMode}
      data-gateway-outcome={gatewayOutcome}
      data-raw-output-included={String(selectedContextAssistantTurnState.response?.raw_output_included ?? false)}
      data-citation-focus-mode={answerCitationFocusMode}
      style={{ "--assistant-rail-height": `${height}px` } as React.CSSProperties}
    >
      <div
        className="assistant-rail__resize-handle"
        role="separator"
        aria-label="Resize assistant rail"
        aria-orientation="horizontal"
        aria-valuemin={20}
        aria-valuemax={55}
        aria-valuenow={height}
        onPointerDown={onResizeStart}
      />
      <div className="assistant-rail__toolbar" aria-label="Assistant rail controls">
        <strong>Source Context Assistant</strong>
        <div className="panel-header-actions">
          <button type="button" onClick={onCollapse}>Collapse assistant rail</button>
          <button type="button" onClick={onDismiss}>Dismiss assistant rail</button>
        </div>
      </div>
      <footer className="atlas-workbench" aria-label="Corpus search workbench" data-testid="atlas-workbench">
      <section className="atlas-workbench__search" aria-label="Find source context">
        <div className="atlas-workbench__header">
          <span className="eyebrow">Find source context</span>
          <strong>{model ? `${model.metadata.resource_node_count} public resources` : loadState.status}</strong>
          <small>{model ? `${model.sourceSpanCoverage.count} parsed-subset coverage` : "source spans pending"}</small>
        </div>
        <form className="atlas-workbench__form" role="search" aria-label="Search public corpus metadata and source spans" onSubmit={onSearchSubmit}>
          <label htmlFor="atlas-workbench-search">Find source context</label>
          <input
            id="atlas-workbench-search"
            name="atlas-workbench-search"
            type="search"
            value={query}
            onChange={onQueryChange}
            aria-label="Search public corpus metadata and parsed source spans"
            placeholder="Search title, resource ID, disease site, or parsed excerpt"
          />
          <button type="submit" disabled={searchState.status === "loading" || loadState.status === "loading"}>Find source context</button>
        </form>
        <dl className="atlas-workbench__context" aria-label="Selected resource context">
          <div><dt>Selected resource context</dt><dd className="wrap-anywhere">{selectedResource?.title ?? "resource pending"}</dd></div>
          <div><dt>Graph focus / trust path</dt><dd>Search hits focus the graph, trust drawer, and source-span provenance when available.</dd></div>
        </dl>
        <p className="atlas-workbench__model-note">Selected-context draft answers are local-gateway bounded, source-span scoped, and not approved guidance. No external large-language-model routing is shown as enabled.</p>
        <form className="selected-context-assistant" aria-label="Selected-context assistant" onSubmit={onSelectedContextQuestionSubmit}>
          <label htmlFor="selected-context-assistant-input">Ask about selected source</label>
          <textarea
            id="selected-context-assistant-input"
            aria-label="Ask about selected source"
            disabled={!hasSelectedSourceSpanContext}
            value={selectedContextQuestion}
            onChange={onSelectedContextQuestionChange}
            placeholder={hasSelectedSourceSpanContext ? "Ask a concise source-backed question" : "Select a source-backed graph item to ask."}
          />
          <button type="submit" disabled={!canSubmitQuestion}>{selectedContextAssistantTurnState.status === "loading" ? "Asking selected source" : "Ask about selected source"}</button>
          <p>{hasSelectedSourceSpanContext && selectedSourceContext ? `Selected source context: ${selectedSourceContext.displayLabel}. Draft answer for selected source context only; not medical advice.` : "Select a source-backed graph item to ask."}</p>
          <SelectedContextAssistantOutput
            state={selectedContextAssistantTurnState}
            selectedSourceContext={selectedSourceContext}
            answerCitationFocusMode={answerCitationFocusMode}
            onCitationHover={onAnswerCitationHover}
            onCitationLeave={onAnswerCitationLeave}
            onCitationFocus={onAnswerCitationFocus}
            onCitationBlur={onAnswerCitationBlur}
            onCitationClick={onAnswerCitationClick}
          />
        </form>
        <details className="inspector-details assistant-trace-details" data-testid="assistant-trace-details">
          <summary>Trace details</summary>
          <div className="atlas-workbench__form atlas-workbench__explain-action" aria-label="Selected source trace action">
            <button
              type="button"
              onClick={onExplainSelection}
              disabled={!canExplainSelection || explainSelectionState.status === "loading"}
            >
              Run selected-source trace
            </button>
            <span>
              {canExplainSelection
                ? explainSelectionHasSourceSpan
                  ? "Source-span-backed selection: trace details include digests, gateway outcome, verifier status, warnings, and evidence IDs."
                  : "Selection lacks validated source-span context; trace details will render a blocked trace only."
                : "Select a source-backed graph item before running trace details."}
            </span>
          </div>
        </details>
      </section>

      <section ref={resultsRef} className="atlas-workbench__results" aria-live="polite" aria-label="Source context results">
        <div className="atlas-workbench__status">
          <span>Source context results</span>
          <span>{searchState.status === "loading" ? "searching local API" : searchState.message}</span>
          {response ? <span>{response.modelRouting}</span> : null}
        </div>

        {searchState.status === "error" ? <p className="atlas-workbench__empty">{searchState.message}</p> : null}
        {hasSearched && !hasResults ? <p className="atlas-workbench__empty">No results for this query in public metadata or parsed source spans.</p> : null}

        {response ? (
          <div className="atlas-workbench__result-grid">
            <ResultGroup title="Metadata retrieval" count={response.metadataResultCount}>
              {response.metadataResults.length > 0 ? response.metadataResults.map((result) => (
                <button key={result.resourceId} type="button" className="atlas-workbench-result" onClick={() => onMetadataSelect(result)}>
                  <span>{result.title}</span>
                  <small>{result.locator} · {result.archiveStatus} · {result.parseStatus}</small>
                  <small>Graph focus action: resource neighborhood + trust drawer</small>
                  <small>{relationshipSummaryFromFocus(result)}</small>
                  <small>{coverageStatusCopy(result.coverageStatus)}</small>
                  <small className="wrap-anywhere">Resource identifier available in retrieval metadata details</small>
                </button>
              )) : <p className="atlas-workbench__empty">No metadata results for this query.</p>}
            </ResultGroup>

            <ResultGroup title="Source-span retrieval" count={response.sourceSpanResultCount}>
              {response.sourceSpanResults.length > 0 ? response.sourceSpanResults.map((result) => {
                const resource = resourceById.get(result.resourceId);
                return (
                  <button key={result.spanId} type="button" className="atlas-workbench-result atlas-workbench-result--span" onClick={() => onSourceSpanSelect(result)}>
                    <span>{resource?.title ?? result.resourceId}</span>
                    <small>Source span: {formatSourceSpanLabel(result.stableLocator)}</small>
                    <small>Source status: {result.outputStatus} · parse status: {resource?.parseStatus ?? "unknown"}</small>
                    <small>Checksum {metadataAvailableLabel(result.checksumSha256).toLowerCase()} · {result.coverageStatus}</small>
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

        {terminalState ? <RetrievalTerminalState state={terminalState} onMetadataSelect={onMetadataSelect} onSourceSpanSelect={onSourceSpanSelect} /> : null}
        <details className="inspector-details assistant-output-trace-details" data-testid="assistant-output-trace-details">
          <summary>Trace details</summary>
          <WorkbenchTraceTerminal traceState={traceState} retrievalEvidence={retrievalEvidence} />
          <ExplainSelectionTraceTerminal explainState={explainSelectionState} />
        </details>
      </section>
      </footer>
    </div>
  );
}

function SelectedContextAssistantOutput({
  state,
  selectedSourceContext,
  answerCitationFocusMode,
  onCitationHover,
  onCitationLeave,
  onCitationFocus,
  onCitationBlur,
  onCitationClick
}: {
  state: SelectedContextAssistantTurnState;
  selectedSourceContext: SelectedSourceContext | null;
  answerCitationFocusMode: AnswerCitationFocusMode;
  onCitationHover: (citation: CorpusConversationCitation) => void;
  onCitationLeave: () => void;
  onCitationFocus: (citation: CorpusConversationCitation) => void;
  onCitationBlur: () => void;
  onCitationClick: (citation: CorpusConversationCitation) => void;
}) {
  const [selectedCitationId, setSelectedCitationId] = React.useState<string | null>(null);
  const response = state.response;
  const safeDraftFragments = response && isSafeDraftAnswer(response) ? response.answer_fragments : [];
  const selectedCitation = response?.citations.find((citation) => citation.source_span_id === selectedCitationId)
    ?? response?.citations[0]
    ?? null;

  useEffect(() => {
    setSelectedCitationId(null);
  }, [response, selectedSourceContext?.sourceSpanId]);

  if (!selectedSourceContext) {
    return <p className="selected-context-assistant__state">No selected source-backed context. Select a source-backed graph item to ask.</p>;
  }

  if (state.status === "loading") {
    return <p className="selected-context-assistant__state" role="status">Requesting cited draft from {selectedSourceContext.displayLabel}.</p>;
  }

  if (state.status === "error") {
    return (
      <section className="selected-context-answer selected-context-answer--unavailable" data-testid="selected-context-unavailable" aria-label="Selected-context generation unavailable">
        <strong>Generation unavailable for the selected source context.</strong>
        <p>{state.message}</p>
        <p>Selected context remains {selectedSourceContext.displayLabel}; no draft answer was generated.</p>
      </section>
    );
  }

  if (!response) {
    return <p className="selected-context-assistant__state">Ask one question about {selectedSourceContext.displayLabel}; no transcript or answer is stored.</p>;
  }

  if (response.status === "unavailable") {
    return (
      <section className="selected-context-answer selected-context-answer--unavailable" data-testid="selected-context-unavailable" aria-label="Selected-context generation unavailable">
        <strong>Generation unavailable for the selected source context.</strong>
        <p>Gateway outcome: {response.gateway_decision.outcome}; reason: {response.gateway_decision.reason_code ?? response.reason_code ?? "not returned"}.</p>
        <p>Selected context remains {selectedSourceContext.displayLabel}; no draft answer was generated.</p>
      </section>
    );
  }

  if (response.status !== "draft" || safeDraftFragments.length === 0) {
    return (
      <section className="selected-context-answer selected-context-answer--refusal" data-testid="selected-context-refusal" aria-label="Selected-context refusal">
        <strong>{refusalMessage(response.reason_code)}</strong>
        <p>No answer fragments are shown for refused, unsupported, or unsafe selected-context prompts.</p>
      </section>
    );
  }

  return (
    <section className="selected-context-answer" data-testid="selected-context-answer" aria-label="Cited selected-context draft answer">
      <p className="selected-context-answer__notice">Draft answer for selected source context only; not medical advice.</p>
      <div className="selected-context-answer__fragments">
        {safeDraftFragments.map((fragment) => (
          <article key={fragment.fragment_id} className="selected-context-answer__fragment">
            <p>{fragment.text}</p>
          </article>
        ))}
      </div>
      <div className="selected-context-answer__citations" aria-label="Answer citations">
        {response.citations.map((citation) => (
          <button
            key={citation.source_span_id}
            type="button"
            className="selected-context-answer__citation"
            data-testid="selected-context-citation"
            data-citation-label={citation.display_label}
            data-citation-focus-mode={answerCitationFocusMode}
            onPointerEnter={() => onCitationHover(citation)}
            onPointerLeave={onCitationLeave}
            onFocus={() => onCitationFocus(citation)}
            onBlur={onCitationBlur}
            onClick={() => {
              setSelectedCitationId(citation.source_span_id);
              onCitationClick(citation);
            }}
          >
            Show citation {citation.display_label}
          </button>
        ))}
      </div>
      {selectedCitation ? <CitationContext citation={selectedCitation} /> : null}
    </section>
  );
}

function CitationContext({ citation }: { citation: CorpusConversationCitation }) {
  return (
    <section className="selected-context-answer__citation-context" aria-label="Concise citation provenance context">
      <strong>Why this draft answer is grounded</strong>
      <p>{citation.display_label} supports the visible draft fragment. The quoted source context is shown here; exact source identifiers stay in metadata controls.</p>
      <q>{citation.quoted_span}</q>
      <details className="inspector-details" data-testid="citation-metadata-details">
        <summary>Show citation metadata</summary>
        <CopyMetadataButton label="citation metadata" value={JSON.stringify(citation, null, 2)} />
        <dl>
          <div><dt>Source span ID</dt><dd className="wrap-anywhere">{citation.source_span_id}</dd></div>
          <div><dt>Stable locator</dt><dd className="wrap-anywhere">{citation.stable_locator}</dd></div>
          <div><dt>Source document</dt><dd className="wrap-anywhere">{citation.source_document_id}</dd></div>
          <div><dt>Excerpt digest</dt><dd className="wrap-anywhere">{citation.excerpt_digest}</dd></div>
        </dl>
      </details>
    </section>
  );
}

function isSafeDraftAnswer(response: CorpusConversationTurnResponse) {
  if (response.status !== "draft" || response.answer_mode !== "selected_context_cited_draft") {
    return false;
  }
  const citationsBySpanId = new Map(response.citations.map((citation) => [citation.source_span_id, citation]));
  return response.answer_fragments.length > 0 && response.answer_fragments.every((fragment) => (
    !fragment.unsupported
    && fragment.source_span_ids.length > 0
    && fragment.source_span_ids.every((sourceSpanId) => citationsBySpanId.get(sourceSpanId)?.answer_fragment_ids.includes(fragment.fragment_id))
  ));
}

function refusalMessage(reasonCode?: string | null) {
  if (reasonCode === "unsupported_advice_like_prompt") {
    return "I cannot answer patient-specific advice or treatment-choice prompts.";
  }
  if (reasonCode === "missing_validated_source_span_context") {
    return "Select a source-backed graph item to ask.";
  }
  return "I cannot answer this selected-context question safely.";
}

function RetrievalTerminalState({
  state,
  onMetadataSelect,
  onSourceSpanSelect
}: {
  state: RetrievalTerminalStateModel;
  onMetadataSelect: (result: CompactAtlasMetadataSearchResult) => void;
  onSourceSpanSelect: (result: CompactAtlasSourceSpanSearchResult) => void;
}) {
  return (
    <section
      className="atlas-workbench-group"
      aria-label="Retrieval terminal state"
      data-testid="retrieval-terminal-state"
      data-selected-query={state.query}
      data-highlighted-resource-ids={state.highlightedResources.join(",") || "none"}
      data-highlighted-source-span-ids={state.highlightedSourceSpans.join(",") || "none"}
      data-graph-focus-node-id={state.graphFocusNodeId}
      data-graph-resource-node-id={state.graphResourceNodeId}
      data-graph-context-node-ids={state.graphContextNodeIds.join(",") || "none"}
      data-graph-path-node-ids={state.graphPathNodeIds.join(",") || "none"}
      data-focus-mode={state.focusMode}
      data-blocked-reason={state.blockedEvidenceLabel ?? "none"}
    >
      <div className="atlas-workbench-group__title">
        <strong>Retrieval terminal state</strong>
        <span>{state.retrievalMode}</span>
      </div>
      <dl className="atlas-workbench__context" aria-label="Retrieval terminal state fields">
        <div><dt>Query text</dt><dd className="wrap-anywhere">{state.query || "no submitted query"}</dd></div>
        <div><dt>Highlighted resources</dt><dd className="wrap-anywhere">Highlighted resources: {formatCount(state.highlightedResources.length, "public resource")}</dd></div>
        <div><dt>Highlighted source spans</dt><dd className="wrap-anywhere">Highlighted source spans: {formatCount(state.highlightedSourceSpans.length, "source span")}</dd></div>
        <div><dt>Selected source-span context</dt><dd>{state.selectedSourceSpanContext}</dd></div>
        <div><dt>Selected graph path</dt><dd className="wrap-anywhere">Selected graph path: {state.selectedGraphPath}</dd></div>
        <div><dt>Graph focus</dt><dd className="wrap-anywhere">Focus ready; {formatCount(state.graphContextNodeIds.length, "context node")}</dd></div>
        <div><dt>Graph path nodes</dt><dd className="wrap-anywhere">{formatCount(state.graphPathNodeIds.length, "path/context node")}</dd></div>
        <div><dt>Graph focus mode</dt><dd>{state.focusMode}</dd></div>
        <div><dt>Graph edge context</dt><dd className="wrap-anywhere">{state.edgeTypes.map(edgeTypeLabel).join(" / ") || "resource neighborhood pending"}</dd></div>
        <div><dt>Retrieval trace</dt><dd>Retrieval trace entries: {state.traceEntries.join(", ")}</dd></div>
        {state.blockedEvidenceLabel ? <div><dt>Blocked reason</dt><dd>{state.blockedEvidenceLabel}</dd></div> : null}
      </dl>
      <p className="atlas-workbench__model-note">Only selected-context cited draft answers are allowed. The graph shows visual evidence for retrieval; draft metadata and source spans are not approved guidance.</p>
      <TerminalResultGroup title="Retrieved resources" count={state.metadataResults.length}>
        {state.metadataResults.length > 0 ? state.metadataResults.map((result, index) => (
          <TerminalMetadataResult key={result.resourceId} result={result} index={index} selected={result.resourceId === state.selectedMetadataResult?.resourceId} onSelect={onMetadataSelect} />
        )) : <p className="atlas-workbench__empty">No metadata resources in the current terminal trace.</p>}
      </TerminalResultGroup>
      <TerminalResultGroup title="Source-span hits" count={state.sourceSpanResults.length}>
        {state.sourceSpanResults.length > 0 ? state.sourceSpanResults.map((result, index) => (
          <TerminalSourceSpanResult key={result.spanId} result={result} index={index} selected={result.spanId === state.selectedSourceSpanResult?.spanId} onSelect={onSourceSpanSelect} />
        )) : <p className="atlas-workbench__empty">Metadata-only / blocked: no source span returned, so no claim text is rendered.</p>}
      </TerminalResultGroup>
      <details className="inspector-details">
        <summary>Raw local deterministic retrieval trace metadata and copy controls</summary>
        <CopyMetadataButton label="retrieval metadata" value={JSON.stringify(state.rawTrace, null, 2)} />
        <pre className="wrap-anywhere">{JSON.stringify(state.rawTrace, null, 2)}</pre>
      </details>
    </section>
  );
}

function WorkbenchTraceTerminal({
  traceState,
  retrievalEvidence
}: {
  traceState: WorkbenchTraceState;
  retrievalEvidence: RetrievalGraphEvidenceState | null;
}) {
  const trace = traceState.response;
  const warningLabels = trace?.warnings ?? [];

  return (
    <section
      className="atlas-workbench-group atlas-workbench-trace"
      aria-label="Task 6 workbench trace"
      data-testid="workbench-trace-terminal"
      data-trace-status={traceState.status}
      data-command-label={trace?.command_label ?? "none"}
      data-gateway-outcome={trace?.gateway_decision.outcome ?? "none"}
      data-abstention-status={trace?.abstention_status ?? "none"}
      data-citation-verifier-status={trace?.citation_verifier_status ?? "none"}
    >
      <div className="atlas-workbench-group__title">
        <strong>Workbench trace</strong>
        <span>{traceState.status === "loading" ? "loading" : trace?.model_routing ?? traceState.message}</span>
      </div>
      {traceState.status === "error" ? <p className="atlas-workbench__empty">{traceState.message}</p> : null}
      {trace ? (
        <>
          <dl className="atlas-workbench__context" aria-label="Workbench trace fields">
            <div><dt>Command label</dt><dd className="wrap-anywhere">{trace.command_label}</dd></div>
            <div><dt>Trace query</dt><dd className="wrap-anywhere">{trace.query || "empty query"}</dd></div>
            <div><dt>Graph focus</dt><dd className="wrap-anywhere">{retrievalEvidence?.focusMode ?? "no retrieval focus"}</dd></div>
            <div><dt>Graph context</dt><dd className="wrap-anywhere">{formatCount(retrievalEvidence?.graphPathNodeIds.length ?? 0, "path/context node")}</dd></div>
            <div><dt>Source spans used/rejected</dt><dd>{trace.source_ids_used.length} used / {trace.source_ids_rejected.length} rejected</dd></div>
            <div><dt>Gateway decision</dt><dd className="wrap-anywhere">{trace.gateway_decision.outcome}; allowed: {String(trace.gateway_decision.allowed)}; reason: {trace.gateway_decision.reason_code ?? "none"}; external API used: {String(trace.gateway_decision.external_api_used)}</dd></div>
            <div><dt>Model class</dt><dd>{trace.model_class}</dd></div>
            <div><dt>Citation verifier status</dt><dd>{trace.citation_verifier_status}</dd></div>
            <div><dt>Warnings</dt><dd>{warningLabels.length > 0 ? warningLabels.join(", ") : "none"}</dd></div>
            <div><dt>Abstention</dt><dd>{String(trace.abstained)} · {trace.abstention_status} · no claim: {String(trace.no_claim)}</dd></div>
          </dl>
          <p className="atlas-workbench__model-note">Only selected-context cited draft answers are allowed; whole-corpus answers remain unavailable.</p>
          <div className="atlas-workbench-trace__grid">
            <TraceRecordGroup title="Retrieval steps" count={trace.retrieval_steps.length}>
              {trace.retrieval_steps.map((step) => <TraceStepRow key={step.step_id} step={step} />)}
            </TraceRecordGroup>
            <TraceRecordGroup title="Source spans used" count={trace.source_ids_used.length}>
              {trace.source_ids_used.length > 0 ? trace.source_ids_used.map((record) => <TraceSourceRecordRow key={record.evidence_id} record={record} />) : <p className="atlas-workbench__empty">No source spans used by this trace.</p>}
            </TraceRecordGroup>
            <TraceRecordGroup title="Source spans rejected" count={trace.source_ids_rejected.length}>
              {trace.source_ids_rejected.length > 0 ? trace.source_ids_rejected.map((record) => <TraceSourceRecordRow key={record.evidence_id} record={record} />) : <p className="atlas-workbench__empty">No rejected source-span or metadata context records.</p>}
            </TraceRecordGroup>
          </div>
          <details className="inspector-details">
            <summary>Raw local workbench trace metadata and copy controls</summary>
            <CopyMetadataButton label="workbench trace" value={JSON.stringify(trace, null, 2)} />
            <pre className="wrap-anywhere">{JSON.stringify(trace, null, 2)}</pre>
          </details>
        </>
      ) : traceState.status === "idle" ? (
        <p className="atlas-workbench__empty">{traceState.message}</p>
      ) : null}
    </section>
  );
}

function ExplainSelectionTraceTerminal({ explainState }: { explainState: ExplainSelectionTraceState }) {
  const trace = explainState.response;
  const warnings = trace?.warnings ?? [];
  const sourceSpanIds = trace?.source_span_ids ?? (explainState.request?.source_span_id ? [explainState.request.source_span_id] : []);

  return (
    <section
      className="atlas-workbench-group atlas-workbench-trace"
      aria-label="Selected source trace"
      data-testid="explain-selection-trace-terminal"
      data-trace-status={explainState.status}
      data-command-label={trace?.command_label ?? "none"}
      data-gateway-outcome={trace?.gateway_decision.outcome ?? "none"}
      data-runner-status={trace?.runner_status ?? "none"}
      data-citation-verifier-status={trace?.model_trace.citation_verifier_status ?? "none"}
      data-raw-output-included={trace ? String(trace.raw_output_included) : "none"}
    >
      <div className="atlas-workbench-group__title">
        <strong>Selected source trace</strong>
        <span>{explainState.status === "loading" ? "loading" : trace?.model_routing ?? explainState.message}</span>
      </div>
      {explainState.status === "error" ? <p className="atlas-workbench__empty">{explainState.message}</p> : null}
      {trace ? (
        <>
          <dl className="atlas-workbench__context" aria-label="Selected source trace fields">
            <div><dt>Command label</dt><dd className="wrap-anywhere">{trace.command_label}</dd></div>
            <div><dt>Selected graph node</dt><dd className="wrap-anywhere">Selection metadata available in trace details</dd></div>
            <div><dt>Selected node type</dt><dd>{trace.selected_node_type}</dd></div>
            <div><dt>Selected resource</dt><dd className="wrap-anywhere">Resource metadata available in trace details</dd></div>
            <div><dt>Selected source spans</dt><dd className="wrap-anywhere">{formatCount(sourceSpanIds.length, "source span")}</dd></div>
            <div><dt>Context digest</dt><dd className="wrap-anywhere">Digest available in trace details</dd></div>
            <div><dt>Output digest</dt><dd className="wrap-anywhere">Digest available in trace details</dd></div>
            <div><dt>Runner status</dt><dd>{trace.runner_status}</dd></div>
            <div><dt>Gateway outcome</dt><dd className="wrap-anywhere">{trace.gateway_decision.outcome}; allowed: {String(trace.gateway_decision.allowed)}; reason: {trace.gateway_decision.reason_code ?? "none"}; external API used: {String(trace.gateway_decision.external_api_used)}</dd></div>
            <div><dt>Citation/verifier status</dt><dd>{trace.model_trace.citation_verifier_status}</dd></div>
            <div><dt>raw_output_included</dt><dd>{String(trace.raw_output_included)}</dd></div>
            <div><dt>Warnings</dt><dd>{warnings.length > 0 ? warnings.join(", ") : "none"}</dd></div>
            <div><dt>Evidence records</dt><dd className="wrap-anywhere">{formatCount(trace.evidence_ids.length, "evidence record")}</dd></div>
            <div><dt>Safety boundary</dt><dd>no claim: {String(trace.no_claim)}; selected-source trace only</dd></div>
          </dl>
          <p className="atlas-workbench__model-note">Only selected-context cited draft answers are allowed; whole-corpus answers remain unavailable. Selected-source trace details show command metadata only; raw model text is withheld by default.</p>
          <div className="atlas-workbench-trace__grid">
            <TraceRecordGroup title="Source spans used" count={trace.source_ids_used.length}>
              {trace.source_ids_used.length > 0 ? trace.source_ids_used.map((record) => <TraceSourceRecordRow key={record.evidence_id} record={record} />) : <p className="atlas-workbench__empty">No source spans used by this explain-selection trace.</p>}
            </TraceRecordGroup>
            <TraceRecordGroup title="Source spans rejected" count={trace.source_ids_rejected.length}>
              {trace.source_ids_rejected.length > 0 ? trace.source_ids_rejected.map((record) => <TraceSourceRecordRow key={record.evidence_id} record={record} />) : <p className="atlas-workbench__empty">No rejected source-span or metadata context records.</p>}
            </TraceRecordGroup>
          </div>
          <details className="inspector-details">
            <summary>Raw selected-source trace metadata and copy controls</summary>
            <CopyMetadataButton label="selected source trace" value={JSON.stringify(trace, null, 2)} />
            <pre className="wrap-anywhere">{JSON.stringify(trace, null, 2)}</pre>
          </details>
        </>
      ) : explainState.status === "idle" ? (
        <p className="atlas-workbench__empty">{explainState.message}</p>
      ) : null}
    </section>
  );
}

function TraceRecordGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
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

function TraceStepRow({ step }: { step: CorpusWorkbenchTraceStep }) {
  return (
    <article className="atlas-workbench-trace-row">
      <span>{step.step_id}</span>
      <small className="wrap-anywhere">{traceStepSummary(step)}</small>
    </article>
  );
}

function TraceSourceRecordRow({ record }: { record: CorpusWorkbenchTraceSourceRecord }) {
  return (
    <article className="atlas-workbench-trace-row">
      <span>{record.stable_locator ? formatSourceSpanLabel(record.stable_locator) : record.resource_id ? "Resource metadata record" : "Evidence record"}</span>
      <small className="wrap-anywhere">{record.status} · {record.reason ?? "accepted"} · {record.stable_locator ? "locator available in metadata details" : "stable locator unavailable"}</small>
      <details className="inspector-details">
        <summary>Trace source metadata details and copy controls</summary>
        <CopyMetadataButton label="trace source record" value={JSON.stringify(record, null, 2)} />
        <dl>
          <div><dt>Source span ID</dt><dd className="wrap-anywhere">{record.source_span_id ?? "none"}</dd></div>
          <div><dt>Resource ID</dt><dd className="wrap-anywhere">{record.resource_id ?? "none"}</dd></div>
          <div><dt>Evidence ID</dt><dd className="wrap-anywhere">{record.evidence_id}</dd></div>
          <div><dt>Stable locator</dt><dd className="wrap-anywhere">{record.stable_locator ?? "none"}</dd></div>
        </dl>
      </details>
    </article>
  );
}

function TerminalResultGroup({ title, count, children }: { title: "Retrieved resources" | "Source-span hits"; count: number; children: React.ReactNode }) {
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

function TerminalMetadataResult({
  result,
  index,
  selected,
  onSelect
}: {
  result: CompactAtlasMetadataSearchResult;
  index: number;
  selected: boolean;
  onSelect: (result: CompactAtlasMetadataSearchResult) => void;
}) {
  const rankScore = optionalRankScore(result, index);
  return (
    <button type="button" className="atlas-workbench-result" aria-label={`Metadata terminal result ${result.resourceId}`} data-active={selected ? "true" : undefined} onClick={() => onSelect(result)}>
      <span>{result.title}</span>
      <small>{rankScore} · {result.documentType} · {result.documentStatus} · {result.diseaseSite}</small>
      <small>{result.archiveStatus} · {result.parseStatus} · {result.responseState}</small>
      <small className="wrap-anywhere">Resource identifier available in retrieval metadata details</small>
      <small className="wrap-anywhere">Graph focus ready; {formatCount(result.neighborNodeIds.length, "context node")}</small>
      <small>{result.sourceSpanIds.length > 0 ? `Linked source spans: ${formatCount(result.sourceSpanIds.length, "source span")}` : "metadata-only blocked: source spans are absent from this hit"}</small>
      <small>{coverageStatusCopy(result.coverageStatus)}</small>
    </button>
  );
}

function TerminalSourceSpanResult({
  result,
  index,
  selected,
  onSelect
}: {
  result: CompactAtlasSourceSpanSearchResult;
  index: number;
  selected: boolean;
  onSelect: (result: CompactAtlasSourceSpanSearchResult) => void;
}) {
  const provenance = sourceSpanProvenance(result);
  return (
    <button type="button" className="atlas-workbench-result atlas-workbench-result--span" aria-label={`Source-span terminal result ${result.spanId}`} data-active={selected ? "true" : undefined} onClick={() => onSelect(result)}>
      <span>{formatSourceSpanLabel(result.stableLocator)}</span>
      <small>{optionalRankScore(result, index)} · source status: {result.outputStatus}</small>
      <small className="wrap-anywhere">Source-span and parent identifiers available in retrieval metadata details</small>
      <small className="wrap-anywhere">Source document metadata {metadataAvailableLabel(provenance.sourceDocumentId).toLowerCase()}</small>
      <small>Checksum {metadataAvailableLabel(provenance.excerptChecksum).toLowerCase()} · {result.outputStatus}</small>
      <small>Prompt/model version: {provenance.promptOrModelVersion}</small>
      <small>Reviewer: {provenance.reviewer} · {provenance.reviewStatus} · {provenance.timestamp}</small>
      <small className="wrap-anywhere">Graph path/trust context: {sourceSpanGraphPathLabel(result)}</small>
      {result.excerpt ? <q>{result.quotedSpan ?? result.excerpt}</q> : <small>Source-span record returned without an allowed excerpt; no claim text is rendered.</small>}
    </button>
  );
}

function ResultGroup({ title, count, children }: { title: "Metadata retrieval" | "Source-span retrieval"; count: number; children: React.ReactNode }) {
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

function buildRetrievalTerminalState(
  response: WorkbenchSearchState["response"],
  lookupSelection: LookupSelection | null,
  selectedResource: CompactAtlasResource | null,
  retrievalEvidence: RetrievalGraphEvidenceState | null
): RetrievalTerminalStateModel | null {
  if (!response) {
    return null;
  }

  const selectedMetadataResult = lookupSelection?.kind === "metadata"
    ? response.metadataResults.find((result) => result.resourceId === lookupSelection.resourceId) ?? null
    : null;
  const selectedSourceSpanResult = lookupSelection?.kind === "source_span"
    ? response.sourceSpanResults.find((result) => result.spanId === lookupSelection.sourceSpan?.span_id) ?? null
    : null;
  const selectedResourceResult = selectedResource
    ? response.metadataResults.find((result) => result.resourceId === selectedResource.id) ?? null
    : null;
  const selectedEvidenceSourceSpanResult = retrievalEvidence?.selectedSourceSpanId
    ? response.sourceSpanResults.find((result) => result.spanId === retrievalEvidence.selectedSourceSpanId) ?? null
    : null;
  const selectedEvidenceMetadataResult = retrievalEvidence?.selectedResourceId
    ? response.metadataResults.find((result) => result.resourceId === retrievalEvidence.selectedResourceId) ?? null
    : null;
  const selectedTerminalSourceSpanResult = selectedSourceSpanResult ?? selectedEvidenceSourceSpanResult;
  const selectedTerminalMetadataResult = selectedMetadataResult ?? selectedEvidenceMetadataResult ?? selectedResourceResult;
  const focus = selectedTerminalSourceSpanResult ?? selectedTerminalMetadataResult ?? response.sourceSpanResults[0] ?? response.metadataResults[0] ?? null;
  const resourceId = retrievalEvidence?.selectedResourceId ?? focus?.resourceId ?? selectedResource?.id ?? null;
  const sourceSpanIds = retrievalEvidence?.highlightedSourceSpanIds ?? (selectedTerminalSourceSpanResult
    ? [selectedTerminalSourceSpanResult.spanId]
    : selectedTerminalMetadataResult?.sourceSpanIds ?? []);
  const reviewTaskIds = focus?.reviewTaskIds ?? [];
  const isMetadataBlocked = Boolean(resourceId && sourceSpanIds.length === 0);
  const selectedGraphPath = selectedTerminalSourceSpanResult
    ? sourceSpanGraphPathLabel(selectedTerminalSourceSpanResult)
    : resourceId
      ? "Resource"
      : "no graph focus selected";

  return {
    query: response.query,
    highlightedResources: retrievalEvidence?.highlightedResourceIds ?? (resourceId ? [resourceId] : []),
    highlightedSourceSpans: sourceSpanIds,
    selectedGraphPath,
    selectedSourceSpanContext: selectedTerminalSourceSpanResult ? formatSourceSpanLabel(selectedTerminalSourceSpanResult.stableLocator) : "Selected source-span context: metadata-only / blocked",
    blockedEvidenceLabel: retrievalEvidence?.blockedReason ?? (isMetadataBlocked ? "Blocked evidence label: metadata-only, no source span returned" : null),
    traceEntries: selectedTerminalSourceSpanResult
      ? ["metadata result", "source-span result", "provenance drawer focus"]
      : ["metadata result", "blocked source-span context", "provenance drawer focus"],
    graphFocusNodeId: retrievalEvidence?.graphFocusNodeId ?? focus?.focusNodeId ?? "no-focus-node",
    graphResourceNodeId: retrievalEvidence?.graphResourceNodeId ?? focus?.resourceNodeId ?? (resourceId ? `resource.${resourceId}` : "no-resource-node"),
    graphContextNodeIds: retrievalEvidence?.graphContextNodeIds ?? focus?.neighborNodeIds ?? [],
    graphPathNodeIds: retrievalEvidence?.graphPathNodeIds ?? [],
    edgeTypes: retrievalEvidence?.edgeTypes ?? focus?.edgeTypes ?? [],
    focusMode: retrievalEvidence?.focusMode ?? (selectedTerminalSourceSpanResult ? "source-span-parent-fallback" : "metadata-only-blocked"),
    retrievalMode: response.modelRouting,
    metadataResults: response.metadataResults,
    sourceSpanResults: response.sourceSpanResults,
    selectedMetadataResult: selectedTerminalMetadataResult,
    selectedSourceSpanResult: selectedTerminalSourceSpanResult,
    rawTrace: {
      query: response.query,
      model_routing: response.modelRouting,
      counts: {
        metadata_results: response.metadataResultCount,
        source_span_results: response.sourceSpanResultCount,
        source_span_coverage: response.sourceSpanCoverageCount,
        total_resources: response.totalResourceCount
      },
      selected: {
        kind: lookupSelection?.kind ?? "none",
        resource_id: resourceId,
        source_span_ids: sourceSpanIds,
        review_task_ids: reviewTaskIds,
        graph_path: selectedGraphPath,
        graph_path_node_ids: retrievalEvidence?.graphPathNodeIds ?? [],
        focus_mode: retrievalEvidence?.focusMode ?? null,
        blocked_reason: isMetadataBlocked ? "metadata-only, no source span returned" : null
      },
      graph_focus: focus ? {
        focus_node_id: focus.focusNodeId,
        resource_node_id: focus.resourceNodeId,
        neighbor_node_ids: focus.neighborNodeIds,
        edge_types: focus.edgeTypes,
        coverage_status: focus.coverageStatus
      } : null
    }
  };
}
