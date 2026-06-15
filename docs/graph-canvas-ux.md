# Graph Canvas UX

## Corrected intent after design rejection

The graph canvas is the visual center of the GURU Guideline Graph Workbench. The corrected direction is an Evidence Atlas IDE: compact chrome, graph-first workspace, Obsidian-like network surface, provenance-aware side panels, and dense expert-review affordances. It must not become a generic dashboard, SaaS landing page, static diagram, PDF assistant, or chat-first interface.

The previous big marketing-style header was rejected. Do not place a large hero, oversized title block, or generic web-app card stack above the graph. The graph should be visible immediately and should occupy most of the viewport.

## Aesthetic direction

- **Tone**: dark IDE vault, Obsidian-like graph field, cyan source-span signal lines, and compact clinical-evidence tooling.
- **Typography**: compact IDE sans and monospace surfaces; avoid landing-page display typography as the primary voice.
- **Composition**: thin command/status bar, left atlas/source rail, central graph canvas, right provenance inspector, optional bottom trace strip.
- **Texture**: gridded graph field, minimap, luminous curved edges, subtle node glow, panel seams, and high-contrast focus rings.
- **Anti-pattern**: no large marketing header, no hero panel above the graph, no chatbot centerpiece, no generic SaaS dashboard cards.

## Interaction standards

- Pan and zoom must be smooth through pointer, wheel/trackpad, and visible controls.
- Fit-view and minimap, or an equivalent orientation aid, must be present once the graph exceeds a single screen.
- Hovering a node shows a compact card with title, type, and short summary.
- Selecting a node opens a persistent inspector with source/provenance placeholder fields.
- Nodes must be keyboard focusable, with visible focus states and an accessible name.
- Reduced-motion users must not receive animated edge motion or long transitions.
- The command surface should stay compact: breadcrumbs, local/synthetic status, and command-palette placeholder are acceptable; marketing copy is not.

## Safety and fixture standards

- Prototype data must be synthetic and non-clinical.
- No PHI, patient-specific advice, or real guideline recommendations may appear in graph fixtures.
- Every claim-like future node requires source-span metadata before it can move beyond placeholder status.
- Placeholder provenance fields should make missing source document, stable locator, quoted span/checksum, reviewer status, and output status visible.

## Current Task 6 corrected prototype

The corrected scaffold uses React Flow under `apps/web/` with a compact IDE command bar, left atlas navigation rail, central graph canvas, right selected-node inspector, bottom evidence trace strip, custom atlas nodes, curved labeled edges, controls, minimap, hover summaries, provenance placeholders, keyboard focus support, and reduced-motion CSS. The fixture nodes are synthetic workflow/evidence/provenance placeholders only.
