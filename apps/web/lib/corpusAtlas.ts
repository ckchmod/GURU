import { buildAtlasGraph, type AtlasApiEdge, type AtlasApiNode, type AtlasGraph } from "../app/graph/atlasGraphAdapter";

export const CORPUS_API_BASE_PATH = "/api/knowledgebase/corpus";

export type CorpusResponseState = "metadata_only" | "downloaded_unparsed" | "parsed" | "download_failed" | "parse_failed";
export type CorpusResponseStateVocabulary = Record<CorpusResponseState, string>;

export type CorpusResource = {
  resource_id: string;
  title: string;
  disease_site: string;
  resource_type: string;
  document_type?: string;
  document_status: string;
  url: string;
  source_owner?: string;
  access_date?: string;
  archive_status: string;
  parse_status: string;
  response_state: CorpusResponseState;
  raw_pdf_exposed: boolean;
};

export type CorpusResourcesResponse = {
  resources: CorpusResource[];
  count: number;
  total_count: number;
  response_state_vocabulary: CorpusResponseStateVocabulary;
};

export type CorpusGraphMetadata = {
  resource_node_count: number;
  disease_site_cluster_count: number;
  document_type_cluster_count: number;
  archive_status_cluster_count: number;
  source_span_coverage_count: number;
  source_span_node_count: number;
  source_span_coverage_note?: string;
};

export type CorpusGraphNode = AtlasApiNode & {
  disease_site?: string;
  document_type?: string;
  resource_type?: string;
  response_state?: CorpusResponseState;
  archive_status?: string;
  parse_status?: string;
};

export type CorpusGraphPayload = {
  nodes: CorpusGraphNode[];
  edges: AtlasApiEdge[];
  metadata: CorpusGraphMetadata;
};

export type CorpusSourceSpan = {
  span_id: string;
  resource_id: string;
  document_id: string;
  stable_locator: string;
  excerpt?: string;
  checksum_sha256?: string;
  output_status: string;
};

export type CorpusSourceSpansResponse = {
  source_spans: CorpusSourceSpan[];
  count: number;
  coverage_count: number;
  coverage_resource_ids: string[];
  coverage_note: string;
};

export type CorpusSearchResponse = {
  query: string;
  metadata_results: CorpusResource[];
  source_span_results: CorpusSourceSpan[];
  metadata_result_count: number;
  source_span_result_count: number;
  source_span_coverage_count: number;
  source_span_coverage_note: string;
  total_resource_count: number;
  model_routing: "none-local-deterministic-search-only";
};

export type CompactAtlasResource = {
  id: string;
  title: string;
  diseaseSite: string;
  documentType: string;
  documentStatus: string;
  responseState: CorpusResponseState;
  archiveStatus: string;
  parseStatus: string;
  url: string;
  sourceSpanCount: number;
};

export type CompactAtlasSearchResult = {
  id: string;
  title: string;
  resultType: "metadata" | "source_span";
  locator: string;
};

export type CompactAtlasMetadataSearchResult = CompactAtlasSearchResult & {
  resultType: "metadata";
  resourceId: string;
  diseaseSite: string;
  documentType: string;
  documentStatus: string;
  responseState: CorpusResponseState;
  archiveStatus: string;
  parseStatus: string;
  url: string;
};

export type CompactAtlasSourceSpanSearchResult = CompactAtlasSearchResult & {
  resultType: "source_span";
  spanId: string;
  resourceId: string;
  documentId: string;
  stableLocator: string;
  excerpt?: string;
  checksumSha256?: string;
  outputStatus: string;
};

export type CompactAtlasSearchResponse = {
  query: string;
  metadataResults: CompactAtlasMetadataSearchResult[];
  sourceSpanResults: CompactAtlasSourceSpanSearchResult[];
  metadataResultCount: number;
  sourceSpanResultCount: number;
  sourceSpanCoverageCount: number;
  sourceSpanCoverageNote: string;
  totalResourceCount: number;
  modelRouting: "none-local-deterministic-search-only";
};

export type CompactAtlasNode = {
  id: string;
  label: string;
  nodeType: string;
  resourceId?: string;
  diseaseSite?: string;
  documentType?: string;
  responseState?: CorpusResponseState;
  archiveStatus?: string;
  parseStatus?: string;
  sourceSpanIds: string[];
  x: number;
  y: number;
};

export type CompactAtlasEdge = {
  id: string;
  source: string;
  target: string;
  edgeType: string;
};

export type CorpusAtlasModel = {
  resources: CompactAtlasResource[];
  sourceSpans: CorpusSourceSpan[];
  graphPayload: CorpusGraphPayload;
  graph: AtlasGraph;
  compactNodes: CompactAtlasNode[];
  compactEdges: CompactAtlasEdge[];
  metadata: CorpusGraphMetadata;
  sourceSpanCoverage: {
    count: number;
    resourceIds: string[];
    note: string;
  };
};

type LoadCorpusAtlasOptions = {
  basePath?: string;
  signal?: AbortSignal;
  compactResourceLimit?: number;
};

type SearchCorpusOptions = {
  basePath?: string;
  signal?: AbortSignal;
};

export class CorpusAtlasClientError extends Error {
  constructor(message: string, readonly status: "api_unavailable" | "http_error") {
    super(message);
    this.name = "CorpusAtlasClientError";
  }
}

export async function loadCorpusAtlas(options: LoadCorpusAtlasOptions = {}): Promise<CorpusAtlasModel> {
  const basePath = options.basePath ?? CORPUS_API_BASE_PATH;
  const [resourcesPayload, graphPayload, sourceSpansPayload] = await Promise.all([
    fetchJson<CorpusResourcesResponse>(`${basePath}/resources`, "corpus resources", options.signal),
    fetchJson<CorpusGraphPayload>(`${basePath}/graph`, "corpus graph", options.signal),
    fetchJson<CorpusSourceSpansResponse>(`${basePath}/source-spans`, "corpus source spans", options.signal)
  ]);

  return buildCorpusAtlasModel(resourcesPayload, graphPayload, sourceSpansPayload, options.compactResourceLimit);
}

export async function searchCorpus(query: string, options: SearchCorpusOptions = {}): Promise<CompactAtlasSearchResponse> {
  const basePath = options.basePath ?? CORPUS_API_BASE_PATH;
  const params = new URLSearchParams({ q: query });
  const payload = await fetchJson<CorpusSearchResponse>(`${basePath}/search?${params.toString()}`, "corpus search", options.signal);

  return adaptSearchResponse(payload);
}

export function buildCorpusAtlasModel(
  resourcesPayload: CorpusResourcesResponse,
  graphPayload: CorpusGraphPayload,
  sourceSpansPayload: CorpusSourceSpansResponse,
  compactResourceLimit = 24
): CorpusAtlasModel {
  const sourceSpans = [...sourceSpansPayload.source_spans].sort((left, right) => left.span_id.localeCompare(right.span_id));
  const resources = adaptResourcesResponse(resourcesPayload, sourceSpans);
  const graph = buildAtlasGraph(graphPayload);
  const { compactNodes, compactEdges } = buildCompactGraph(graphPayload, graph, compactResourceLimit);

  return {
    resources,
    sourceSpans,
    graphPayload,
    graph,
    compactNodes,
    compactEdges,
    metadata: graphPayload.metadata,
    sourceSpanCoverage: {
      count: sourceSpansPayload.coverage_count,
      resourceIds: [...sourceSpansPayload.coverage_resource_ids].sort(),
      note: sourceSpansPayload.coverage_note
    }
  };
}

export function adaptResourcesResponse(resourcesPayload: CorpusResourcesResponse, sourceSpans: CorpusSourceSpan[] = []): CompactAtlasResource[] {
  const spanCounts = sourceSpans.reduce<Record<string, number>>((counts, span) => {
    counts[span.resource_id] = (counts[span.resource_id] ?? 0) + 1;
    return counts;
  }, {});

  return [...resourcesPayload.resources]
    .sort((left, right) => left.title.localeCompare(right.title))
    .map((resource) => ({
      id: resource.resource_id,
      title: resource.title,
      diseaseSite: resource.disease_site,
      documentType: resource.document_type ?? resource.resource_type,
      documentStatus: resource.document_status,
      responseState: resource.response_state,
      archiveStatus: resource.archive_status,
      parseStatus: resource.parse_status,
      url: resource.url,
      sourceSpanCount: spanCounts[resource.resource_id] ?? 0
    }));
}

export function adaptSearchResponse(payload: CorpusSearchResponse): CompactAtlasSearchResponse {
  const metadataResults = payload.metadata_results.map((resource) => ({
    id: resource.resource_id,
    title: resource.title,
    resultType: "metadata" as const,
    locator: `${resource.disease_site} / ${resource.document_type ?? resource.resource_type}`,
    resourceId: resource.resource_id,
    diseaseSite: resource.disease_site,
    documentType: resource.document_type ?? resource.resource_type,
    documentStatus: resource.document_status,
    responseState: resource.response_state,
    archiveStatus: resource.archive_status,
    parseStatus: resource.parse_status,
    url: resource.url
  }));
  const sourceSpanResults = payload.source_span_results.map((span) => ({
    id: span.span_id,
    title: span.resource_id,
    resultType: "source_span" as const,
    locator: span.stable_locator,
    spanId: span.span_id,
    resourceId: span.resource_id,
    documentId: span.document_id,
    stableLocator: span.stable_locator,
    excerpt: span.excerpt,
    checksumSha256: span.checksum_sha256,
    outputStatus: span.output_status
  }));

  return {
    query: payload.query,
    metadataResults,
    sourceSpanResults,
    metadataResultCount: payload.metadata_result_count,
    sourceSpanResultCount: payload.source_span_result_count,
    sourceSpanCoverageCount: payload.source_span_coverage_count,
    sourceSpanCoverageNote: payload.source_span_coverage_note,
    totalResourceCount: payload.total_resource_count,
    modelRouting: payload.model_routing
  };
}

function buildCompactGraph(
  graphPayload: CorpusGraphPayload,
  graph: AtlasGraph,
  compactResourceLimit: number
): { compactNodes: CompactAtlasNode[]; compactEdges: CompactAtlasEdge[] } {
  const resourceNodes = graphPayload.nodes
    .filter((node) => node.type === "resource")
    .sort((left, right) => nodeLabel(left).localeCompare(nodeLabel(right)))
    .slice(0, compactResourceLimit);
  const compactResourceNodeIds = new Set(resourceNodes.map((node) => node.id));
  const connectedClusterIds = new Set<string>();

  graphPayload.edges.forEach((edge) => {
    if (compactResourceNodeIds.has(edge.source)) {
      connectedClusterIds.add(edge.target);
    }
    if (compactResourceNodeIds.has(edge.target)) {
      connectedClusterIds.add(edge.source);
    }
  });

  const nodeIds = new Set([...compactResourceNodeIds, ...connectedClusterIds]);
  const compactNodes = graphPayload.nodes
    .filter((node) => nodeIds.has(node.id) && graph.hasNode(node.id))
    .sort((left, right) => compactNodeSort(left).localeCompare(compactNodeSort(right)))
    .map((node) => toCompactNode(node, graph));
  const compactNodeIds = new Set(compactNodes.map((node) => node.id));
  const compactEdges = graphPayload.edges
    .filter((edge) => compactNodeIds.has(edge.source) && compactNodeIds.has(edge.target))
    .sort((left, right) => edgeSortKey(left).localeCompare(edgeSortKey(right)))
    .map((edge, index) => ({
      id: edge.id ?? `${edge.source}->${edge.target}:${edge.type}:${index}`,
      source: edge.source,
      target: edge.target,
      edgeType: edge.type
    }));

  return { compactNodes, compactEdges };
}

function toCompactNode(node: AtlasApiNode, graph: AtlasGraph): CompactAtlasNode {
  const attributes = graph.getNodeAttributes(node.id);
  const record = node as AtlasApiNode & {
    disease_site?: string;
    document_type?: string;
    resource_type?: string;
    response_state?: CorpusResponseState;
    archive_status?: string;
    parse_status?: string;
  };

  return {
    id: node.id,
    label: attributes.label,
    nodeType: attributes.nodeType,
    resourceId: attributes.resourceId,
    diseaseSite: record.disease_site,
    documentType: record.document_type ?? record.resource_type,
    responseState: record.response_state,
    archiveStatus: record.archive_status,
    parseStatus: record.parse_status,
    sourceSpanIds: attributes.sourceSpanIds,
    x: attributes.x,
    y: attributes.y
  };
}

function nodeLabel(node: AtlasApiNode) {
  return node.label ?? node.title ?? node.id;
}

function compactNodeSort(node: AtlasApiNode) {
  const typeRank = node.type === "resource" ? "1" : "0";
  return `${typeRank}:${node.type}:${nodeLabel(node)}`;
}

function edgeSortKey(edge: AtlasApiEdge) {
  return edge.id ?? `${edge.source}->${edge.target}:${edge.type}`;
}

async function fetchJson<T>(url: string, label: string, signal?: AbortSignal): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new CorpusAtlasClientError(`Corpus API unavailable while loading ${label}.`, "api_unavailable");
  }

  if (!response.ok) {
    throw new CorpusAtlasClientError(`Corpus API ${label} request failed with status ${response.status}.`, "http_error");
  }

  return response.json() as Promise<T>;
}
