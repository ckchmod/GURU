import React from "react";
import { GuidelineGraphCanvas } from "./components/GuidelineGraphCanvas";

export default function Home() {
  return (
    <main data-testid="app-shell" className="app-shell" aria-label="Evidence Atlas IDE workspace">
      <header className="ide-command-bar" aria-label="Workspace command and safety bar">
        <div className="ide-breadcrumb" aria-label="Current workspace path">
          <strong>GURU</strong>
          <span>/</span>
          <span>public-corpus-atlas.graph</span>
        </div>
        <div className="ide-command-palette" aria-label="Command palette">⌘K Evidence Atlas</div>
        <div className="ide-status" aria-label="Safety status">
          <span>No PHI</span>
          <span>no clinical advice</span>
          <span>public corpus metadata</span>
          <span>local-first</span>
        </div>
      </header>
      <GuidelineGraphCanvas />
    </main>
  );
}
