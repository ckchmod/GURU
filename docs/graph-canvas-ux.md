# Graph Canvas UX

## Corrected intent after design rejection

The graph canvas is the visual center of GURU. The corrected direction is an Evidence Atlas IDE: compact chrome, graph-first workspace, Obsidian-like network surface, provenance-aware floating panels, retrieval trace evidence, and dense expert-review affordances. It must not become a generic dashboard, SaaS landing page, static diagram, PDF assistant, chat-first interface, or generated-answer RAG product.

The previous big marketing-style header was rejected. Do not place a large hero, oversized title block, or generic web-app card stack above the graph. The graph should be visible immediately and should occupy most of the viewport.

## Aesthetic direction

- **Tone**: dark IDE vault, Obsidian-like graph field, cyan source-span signal lines, and compact clinical-evidence tooling.
- **Typography**: compact IDE sans and monospace surfaces; avoid landing-page display typography as the primary voice.
- **Composition**: thin command/status bar, left atlas/source rail, central graph canvas, floating filter/settings panel, floating selected-node inspector, optional bottom trace strip.
- **Texture**: gridded graph field, many small colored circular nodes, thin subdued edges, sparse overlapping labels, subtle node glow, panel seams, and high-contrast focus rings.
- **Anti-pattern**: no large marketing header, no hero panel above the graph, no chatbot centerpiece, no generic SaaS dashboard cards.
- **Interpretability boundary**: graph-linked retrieval is provenance and trace evidence only, source-backed where validated source spans exist. Generated answers remain disabled.

## Obsidian-like graph map standard

The default graph view must feel like a dense vault map, not a handful of explanatory cards. The first impression should be a dark charcoal graph field with many small connected dots, clusters, thin link lines, sparse high-priority labels, and compact vault chrome. Large card-like nodes are reserved for inspectors or hover surfaces, not the graph field itself.

Zoom is part of the information architecture. At zoomed-out/default scale, labels should be sparse and limited to anchors or high-priority synthetic nodes. As the user zooms in, additional labels, node type/group metadata, and provenance cues can appear. Selection and hover should reveal detail immediately, even when the global zoom level remains low.

The right-side overlay should resemble Obsidian Graph View settings: filter input, toggles, collapsible Groups/Display/Forces rows, and compact status controls. It floats over the graph rather than turning the product into a three-column dashboard.

## Interaction standards

- Pan and zoom must be smooth through pointer, wheel/trackpad, and visible controls.
- Fit-view and minimap, or an equivalent orientation aid, must be present once the graph exceeds a single screen.
- Hovering a node shows a compact card with title, type, and short summary.
- Selecting a node opens a persistent inspector or trust/provenance drawer with source/provenance fields when validated source spans exist, and honest metadata-only, parse-failed, or download-failed status when they do not.
- Submitting a retrieval query should focus and highlight matching resources, source spans, path/context nodes, and provenance fields without generating answer prose.
- Source-span retrieval hits should fall back to their parent resource when the graph lacks source-span nodes, while the terminal and trust drawer keep source-span IDs, stable locator, checksum/status, and reviewer metadata visible where available.
- Zoom changes detail density through React Flow viewport state or an equivalent real graph viewport signal; do not fake zoom detail with static CSS alone.
- Nodes must be keyboard focusable, with visible focus states and an accessible name.
- Reduced-motion users must not receive animated edge motion or long transitions.
- The command surface should stay compact: breadcrumbs, local/synthetic status, and command-palette placeholder are acceptable; marketing copy is not.
- Offline surveillance chips may show local manifest comparison status only. They must not imply live crawling, live reachability checks, clinical inference, or recommendation-impact diff.
- Evidence-review cards may show draft workflow metadata and local-only actions such as `inspect_source`, `mark_needs_review_local`, and `link_source_local`. Cards without validated `source_span_ids` must stay blocked and must not show claim text.

## Safety and fixture standards

- Prototype data must be synthetic and non-clinical.
- No PHI, patient-specific advice, or real guideline recommendations may appear in graph fixtures.
- Every claim-like future node requires source-span metadata before it can move beyond placeholder status.
- Placeholder provenance fields should make missing source document, stable locator, quoted span/checksum, reviewer status, and output status visible.
- Public corpus UI copy must state that generated answers remain disabled.

## Current graph prototype

The current production graph uses Sigma.js and Graphology under `apps/web/` with deterministic ForceAtlas and noverlap layout, a compact IDE command bar, left atlas/source rail, central dense graph canvas, floating Graph View settings panel, selected-node inspector, source provenance drawer, bottom metadata/source-span retrieval terminal, offline/local status chips, custom small-dot atlas nodes, thin subdued edges, hover summaries, keyboard focus support, zoom-driven detail density, and reduced-motion CSS. It is a graph-linked retrieval and provenance surface, not a generated-answer system. Roadmap items such as recommendation-impact diff, consensus workflow, Alberta-local overlays, and computable compiler views are not part of this milestone.
