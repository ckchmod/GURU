/**
 * Seed TypeScript types for the CCA GURU guideline graph and source-span provenance model.
 *
 * Every claim-like node (Recommendation, Citation, EvidenceItem, FundingRule,
 * ReviewDecision, ModelTrace) MUST reference at least one SourceSpan.
 * No source span means no claim. Draft status is not approved status.
 */

export type NodeType =
  | "Guideline"
  | "GuidelineVersion"
  | "Recommendation"
  | "PICOQuestion"
  | "SourceDocument"
  | "SourceSpan"
  | "Citation"
  | "EvidenceItem"
  | "FundingRule"
  | "WorkflowTask"
  | "ReviewDecision"
  | "ModelTrace";

export type NodeStatus = "draft" | "under_review" | "approved" | "superseded" | "deprecated";

export type OutputStatus = "draft" | "under_review" | "approved";

export type ReviewStatus = "unreviewed" | "under_review" | "reviewer_approved" | "rejected";

export type RecommendationStrength =
  | "strong_for"
  | "conditional_for"
  | "strong_against"
  | "conditional_against"
  | "consensus"
  | "no_recommendation";

export type Certainty = "high" | "moderate" | "low" | "very_low";

export type StudyDesign =
  | "systematic_review"
  | "rct"
  | "observational"
  | "expert_opinion"
  | "modeling"
  | "case_series"
  | "unknown";

export type LicenseStatus =
  | "unknown"
  | "public_domain"
  | "cc_by"
  | "cc_by_nc"
  | "cc_by_sa"
  | "proprietary"
  | "subscription"
  | "government_open"
  | "restricted";

export type TaskType = "review" | "extract" | "update" | "validate" | "triage" | "publish";

export type ReviewDecisionValue = "accept" | "revise" | "reject" | "defer";

export type RelationType =
  | "has_version"
  | "has_recommendation"
  | "has_pico"
  | "has_evidence"
  | "has_citation"
  | "has_source_span"
  | "has_funding_rule"
  | "has_task"
  | "has_review_decision"
  | "has_model_trace"
  | "cites"
  | "supports"
  | "contradicts"
  | "updates"
  | "replaces"
  | "derived_from"
  | "reviewed_by"
  | "funded_by"
  | "depends_on";

/**
 * Provenance metadata carried by every node.
 * For claim-like nodes, source_span_ids must be non-empty.
 */
export interface Provenance {
  source_span_ids: string[];
  generated_by: string;
  model_version?: string;
  reviewer?: string;
  review_status?: ReviewStatus;
  output_status: OutputStatus;
  timestamp: string; // ISO 8601 date-time
}

export interface BaseNode {
  id: string;
  node_type: NodeType;
  label: string;
  status: NodeStatus;
  created_at: string; // ISO 8601 date-time
  updated_at: string; // ISO 8601 date-time
  provenance: Provenance;
}

export interface GuidelineNode extends BaseNode {
  node_type: "Guideline";
  title: string;
  jurisdiction: string;
  disease_site?: string;
  topic?: string;
}

export interface GuidelineVersionNode extends BaseNode {
  node_type: "GuidelineVersion";
  version: string;
  effective_date: string; // ISO 8601 date
  guideline_id: string;
}

export interface RecommendationNode extends BaseNode {
  node_type: "Recommendation";
  recommendation_text: string;
  strength: RecommendationStrength;
  certainty?: Certainty;
  /** MANDATORY. A Recommendation without source spans is not a valid claim. */
  source_span_ids: string[];
  pico_ids?: string[];
}

export interface PICOQuestionNode extends BaseNode {
  node_type: "PICOQuestion";
  population: string;
  intervention: string;
  comparison?: string;
  outcome: string;
}

export interface SourceDocumentNode extends BaseNode {
  node_type: "SourceDocument";
  title: string;
  owner: string;
  access_date: string; // ISO 8601 date
  access_path: string;
  license_status: LicenseStatus;
  checksum_sha256?: string;
  version_or_date?: string;
}

export interface SourceSpanNode extends BaseNode {
  node_type: "SourceSpan";
  span_id: string;
  source_document_id: string;
  access_date: string; // ISO 8601 date
  /** Section, paragraph, or stable fragment locator within the source document. */
  stable_locator: string;
  /** Exact quoted text from the source document. */
  quoted_span: string;
  /** SHA-256 checksum of the quoted excerpt bytes. */
  excerpt_checksum: string;
  prompt_or_model_version?: string;
  reviewer?: string;
  review_status?: ReviewStatus;
  timestamp?: string; // ISO 8601 date-time
  output_status?: OutputStatus;
}

export interface CitationNode extends BaseNode {
  node_type: "Citation";
  citation_text: string;
  /** MANDATORY. A Citation without source spans is not anchored. */
  source_span_ids: string[];
}

export interface EvidenceItemNode extends BaseNode {
  node_type: "EvidenceItem";
  evidence_text: string;
  study_design: StudyDesign;
  /** MANDATORY. Evidence without source spans is not a valid claim. */
  source_span_ids: string[];
}

export interface FundingRuleNode extends BaseNode {
  node_type: "FundingRule";
  rule_text: string;
  /** MANDATORY. A FundingRule without source spans is not a valid claim. */
  source_span_ids: string[];
}

export interface WorkflowTaskNode extends BaseNode {
  node_type: "WorkflowTask";
  task_type: TaskType;
  description: string;
  assignee: string;
  due_date?: string; // ISO 8601 date
}

export interface ReviewDecisionNode extends BaseNode {
  node_type: "ReviewDecision";
  decision: ReviewDecisionValue;
  rationale: string;
  /** MANDATORY. A ReviewDecision without source spans is not a valid claim. */
  source_span_ids: string[];
}

export interface ModelTraceNode extends BaseNode {
  node_type: "ModelTrace";
  model_name: string;
  model_version: string;
  /** Checksum or stable hash of the model input. */
  input_digest: string;
  output_text: string;
  /** MANDATORY. A ModelTrace without source spans is not a valid claim. */
  source_span_ids: string[];
  gpu_seconds?: number;
  cost_ledger_id?: string;
}

export type GraphNode =
  | GuidelineNode
  | GuidelineVersionNode
  | RecommendationNode
  | PICOQuestionNode
  | SourceDocumentNode
  | SourceSpanNode
  | CitationNode
  | EvidenceItemNode
  | FundingRuleNode
  | WorkflowTaskNode
  | ReviewDecisionNode
  | ModelTraceNode;

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: RelationType;
  weight?: number;
  created_at?: string; // ISO 8601 date-time
}

export interface GuidelineGraph {
  graph_version: string; // semver
  generated_at: string; // ISO 8601 date-time
  nodes: GraphNode[];
  edges: GraphEdge[];
}
