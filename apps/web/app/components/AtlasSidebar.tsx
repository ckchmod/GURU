import React from "react";
import type { CompactAtlasResource, CompactAtlasSurveillanceStatus, CorpusAtlasModel } from "../../lib/corpusAtlas";
import { loadStateLabel, offlineResourceStatusLabel, offlineStatusTone, offlineSurveillanceSummary } from "./GraphWorkbenchHelpers";
import { StatusChip } from "./GraphWorkbenchShared";
import type { AtlasLoadState, AtlasNodeView } from "./GraphWorkbenchTypes";

export function AtlasSidebar({
  visibleResources,
  selectedResource,
  selectedNodeId,
  diseaseSiteClusters,
  model,
  loadState,
  surveillanceStatus,
  surveillanceStatusByResourceId,
  onResourceSelect,
  onNodeSelect,
  onCollapse,
  onDismiss
}: {
  visibleResources: CompactAtlasResource[];
  selectedResource: CompactAtlasResource | null;
  selectedNodeId: string | null;
  diseaseSiteClusters: AtlasNodeView[];
  model: CorpusAtlasModel | null;
  loadState: AtlasLoadState;
  surveillanceStatus: CompactAtlasSurveillanceStatus | null;
  surveillanceStatusByResourceId: Map<string, CompactAtlasSurveillanceStatus["resourceStatuses"][number]>;
  onResourceSelect: (resourceId: string) => void;
  onNodeSelect: (nodeId: string) => void;
  onCollapse: () => void;
  onDismiss: () => void;
}) {
  return (
    <aside className="atlas-sidebar" aria-label="Atlas resource and topic navigation">
      <div className="sidebar-section">
        <div className="panel-header-row">
          <p className="eyebrow">Vault</p>
          <div className="panel-header-actions" aria-label="Vault panel controls">
            <button type="button" onClick={onCollapse}>Collapse Vault panel</button>
            <button type="button" onClick={onDismiss}>Dismiss Vault panel</button>
          </div>
        </div>
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
            onClick={() => onResourceSelect(resource.id)}
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
            onClick={() => onNodeSelect(cluster.id)}
          >
            {cluster.title} · {cluster.aggregateCount}
          </button>
        ))}
      </nav>
      <LayerStatusPanel model={model} loadState={loadState} surveillanceStatus={surveillanceStatus} />
    </aside>
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
        <li><span className="layer-dot layer-dot--green" /> {loadStateLabel(loadState.status)}</li>
        <li><span className="layer-dot layer-dot--red" /> No clinical advice</li>
      </ul>
    </div>
  );
}
