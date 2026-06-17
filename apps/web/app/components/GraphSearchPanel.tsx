import React from "react";
import type { CorpusAtlasModel } from "../../lib/corpusAtlas";
import type { AtlasNodeView, SearchOption, SearchSubmitEvent } from "./GraphWorkbenchTypes";

export function GraphSearchPanel({
  model,
  searchQuery,
  searchResults,
  selectedNode,
  onSearchChange,
  onSearchSubmit,
  onResultSelect,
  onClose
}: {
  model: CorpusAtlasModel | null;
  searchQuery: string;
  searchResults: SearchOption[];
  selectedNode: AtlasNodeView | null;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchSubmit: (event: SearchSubmitEvent) => void;
  onResultSelect: (result: SearchOption) => void;
  onClose: () => void;
}) {
  return (
    <aside className="graph-settings" aria-label="Graph search and corpus context" data-testid="graph-search-panel">
      <div className="graph-settings__header">
        <div>
          <span className="eyebrow">Graph search</span>
          <strong>{selectedNode?.type ?? "Corpus graph"}</strong>
        </div>
        <button type="button" className="panel-icon-button" onClick={onClose}>Close Graph Search</button>
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
      <section className="graph-context-card" aria-label="Graph corpus context">
        <div><span>Resources</span><strong>{model?.metadata.resource_node_count ?? 0}</strong></div>
        <div><span>Source-span nodes</span><strong>{model?.metadata.source_span_node_count ?? 0}</strong></div>
        <div><span>Selected</span><strong>{selectedNode ? `${selectedNode.title} · ${selectedNode.aggregateCount || 1}` : "none"}</strong></div>
      </section>
    </aside>
  );
}
