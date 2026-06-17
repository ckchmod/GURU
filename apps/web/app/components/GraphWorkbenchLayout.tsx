import React from "react";
import type { WorkbenchPanelMode } from "./GraphWorkbenchTypes";

export function GraphWorkbenchLayout({
  atlasSidebar,
  graphCanvas,
  provenancePanel,
  retrievalRail,
  vaultPanelMode,
  provenancePanelMode,
  vaultWidth,
  provenanceWidth,
  onVaultResizeStart,
  onProvenanceResizeStart,
  onExpandVault,
  onExpandProvenance,
  onShowVault,
  onShowProvenance
}: {
  atlasSidebar: React.ReactNode;
  graphCanvas: React.ReactNode;
  provenancePanel: React.ReactNode;
  retrievalRail: React.ReactNode;
  vaultPanelMode: WorkbenchPanelMode;
  provenancePanelMode: WorkbenchPanelMode;
  vaultWidth: number;
  provenanceWidth: number;
  onVaultResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  onProvenanceResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  onExpandVault: () => void;
  onExpandProvenance: () => void;
  onShowVault: () => void;
  onShowProvenance: () => void;
}) {
  const layoutStyle = {
    "--graph-left-column": vaultPanelMode === "dismissed" ? "0rem" : vaultPanelMode === "collapsed" ? "2.75rem" : `${vaultWidth}px`,
    "--graph-left-handle": vaultPanelMode === "visible" ? "0.5rem" : "0rem",
    "--graph-right-column": provenancePanelMode === "dismissed" ? "0rem" : provenancePanelMode === "collapsed" ? "2.75rem" : `${provenanceWidth}px`,
    "--graph-right-handle": provenancePanelMode === "visible" ? "0.5rem" : "0rem"
  } as React.CSSProperties;

  return (
    <section className="graph-workbench" aria-label="Public corpus guideline graph atlas" style={layoutStyle}>
      <div className="graph-layout" data-vault-state={vaultPanelMode} data-provenance-state={provenancePanelMode}>
        {vaultPanelMode === "visible" ? <div className="graph-layout__panel graph-layout__panel--left">{atlasSidebar}</div> : null}
        {vaultPanelMode === "collapsed" ? <CollapsedPanelButton side="left" label="Expand Vault panel" onClick={onExpandVault}>Vault</CollapsedPanelButton> : null}
        {vaultPanelMode === "visible" ? (
          <ResizeHandle
            label="Resize Vault panel"
            value={vaultWidth}
            min={208}
            max={360}
            side="left"
            onPointerDown={onVaultResizeStart}
          />
        ) : null}
        <div className="graph-layout__main">
          {graphCanvas}
        </div>
        {provenancePanelMode === "visible" ? (
          <ResizeHandle
            label="Resize Provenance panel"
            value={provenanceWidth}
            min={240}
            max={460}
            side="right"
            onPointerDown={onProvenanceResizeStart}
          />
        ) : null}
        {provenancePanelMode === "visible" ? <div className="graph-layout__panel graph-layout__panel--right">{provenancePanel}</div> : null}
        {provenancePanelMode === "collapsed" ? <CollapsedPanelButton side="right" label="Expand Provenance panel" onClick={onExpandProvenance}>Trust</CollapsedPanelButton> : null}
        {vaultPanelMode === "dismissed" || provenancePanelMode === "dismissed" ? (
          <div className="graph-panel-reopen-tray" aria-label="Dismissed workbench panels">
            {vaultPanelMode === "dismissed" ? <button type="button" onClick={onShowVault}>Show Vault panel</button> : null}
            {provenancePanelMode === "dismissed" ? <button type="button" onClick={onShowProvenance}>Show Provenance panel</button> : null}
          </div>
        ) : null}
      </div>
      {retrievalRail}
    </section>
  );
}

function ResizeHandle({
  label,
  value,
  min,
  max,
  side,
  onPointerDown
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  side: "left" | "right";
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className={`graph-resize-handle graph-resize-handle--${side}`}
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      data-testid={`${side === "left" ? "vault" : "provenance"}-resize-handle`}
      onPointerDown={onPointerDown}
    />
  );
}

function CollapsedPanelButton({
  side,
  label,
  children,
  onClick
}: {
  side: "left" | "right";
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <aside className={`graph-collapsed-panel graph-collapsed-panel--${side}`} aria-label={`${children} panel collapsed`}>
      <button type="button" aria-label={label} onClick={onClick}>{children}</button>
    </aside>
  );
}

export function GraphCanvasViewport({
  title,
  subtitle,
  children,
  graphSearchVisible,
  sourceViewVisible,
  onShowGraphSearch,
  onShowSourceView,
  onCloseTransientPanels,
  onKeyDown
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  graphSearchVisible: boolean;
  sourceViewVisible: boolean;
  onShowGraphSearch: () => void;
  onShowSourceView: () => void;
  onCloseTransientPanels: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as Element | null;
    if (target?.closest(".graph-settings, .source-document-panel, .node-hover-card, .graph-view-title, .graph-canvas-panel-tray")) {
      return;
    }
    onCloseTransientPanels();
  };

  return (
    <div
      className="graph-canvas"
      data-testid="guideline-graph-canvas"
      tabIndex={0}
      role="application"
      aria-label="Interactive public corpus guideline graph with live pan, zoom, selection, and local node positioning."
      onPointerDown={handlePointerDown}
      onKeyDown={onKeyDown}
    >
      {children}
      {!graphSearchVisible || !sourceViewVisible ? (
        <div className="graph-canvas-panel-tray" aria-label="Hidden graph overlays">
          {!graphSearchVisible ? <button type="button" onClick={onShowGraphSearch}>Show Graph Search</button> : null}
          {!sourceViewVisible ? <button type="button" onClick={onShowSourceView}>Show Source View</button> : null}
        </div>
      ) : null}
      <div className="graph-view-title" aria-label="Graph view status">
        <span>Graph view</span>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </div>
    </div>
  );
}
