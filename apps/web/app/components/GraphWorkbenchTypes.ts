import type {
  CompactAtlasGraphFocusMetadata,
  CompactAtlasInterpretabilityModel,
  CompactAtlasSearchResponse,
  CorpusExplainSelectionRequest,
  CorpusExplainSelectionTraceResponse,
  CorpusWorkbenchTraceResponse,
  CorpusSourceSpan,
  CorpusAtlasModel
} from "../../lib/corpusAtlas";

export type AtlasNodeKind = "resource" | "cluster" | "archive" | "sourceSpan";
export type AtlasNodeGroup = "resources" | "diseaseSites" | "documents" | "archive" | "provenance";
export type DetailPriority = "high" | "normal";
export type LoadStatus = "loading" | "success" | "empty" | "error";
export type SearchStatus = "idle" | "loading" | "success" | "error";

export type AtlasNodeData = {
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

export type RetrievalGraphEvidenceState = {
  query: string;
  highlightedResourceIds: string[];
  highlightedSourceSpanIds: string[];
  representedSourceSpanNodeIds: string[];
  selectedResourceId: string | null;
  selectedSourceSpanId: string | null;
  graphFocusNodeId: string | null;
  graphResourceNodeId: string | null;
  graphContextNodeIds: string[];
  graphPathNodeIds: string[];
  edgeTypes: string[];
  focusMode: "metadata-query-hit" | "metadata-only-blocked" | "source-span-node" | "source-span-parent-fallback";
  blockedReason: string | null;
};

export type SearchOption = {
  id: string;
  label: string;
  detail: string;
};

export type SearchSubmitEvent = {
  preventDefault: () => void;
  stopPropagation: () => void;
  currentTarget: HTMLFormElement;
};

export type WorkbenchSearchSubmitEvent = {
  preventDefault: () => void;
  currentTarget: HTMLFormElement;
};

export type ReviewQueueLocalAction = {
  reviewTaskId: string;
  label: string;
};

export type AtlasLoadState = {
  status: LoadStatus;
  model: CorpusAtlasModel | null;
  message: string;
};

export type WorkbenchSearchState = {
  status: SearchStatus;
  query: string;
  response: CompactAtlasSearchResponse | null;
  message: string;
};

export type InterpretabilityLoadState = {
  status: SearchStatus;
  resourceId: string | null;
  model: CompactAtlasInterpretabilityModel | null;
  message: string;
};

export type WorkbenchTraceState = {
  status: SearchStatus;
  query: string;
  response: CorpusWorkbenchTraceResponse | null;
  message: string;
};

export type ExplainSelectionTraceState = {
  status: SearchStatus;
  request: CorpusExplainSelectionRequest | null;
  response: CorpusExplainSelectionTraceResponse | null;
  message: string;
};

export type LookupSelection = {
  kind: "metadata" | "source_span";
  resourceId: string;
  title: string;
  focus: CompactAtlasGraphFocusMetadata;
  sourceSpan?: CorpusSourceSpan;
};

export type SelectNodeOptions = {
  preserveLookupSelection?: boolean;
};

export type WorkbenchPanelMode = "visible" | "collapsed" | "dismissed";

export const modelDisabledNote = "Only selected-context cited draft answers are allowed; whole-corpus answers remain unavailable.";
