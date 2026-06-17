# Graph Canvas UX

## Corrected intent after design rejection

The graph canvas is the visual center of GURU. The corrected direction is an Evidence Atlas IDE: compact chrome, graph-first workspace, Obsidian-like network surface, provenance-aware floating panels, selected-context assistant rail, retrieval trace evidence, citation-linked graph/source highlighting, and dense expert-review affordances. It must not become a generic dashboard, SaaS landing page, static diagram, PDF assistant, chat-first interface, whole-corpus chatbot, or full RAG product.

The previous big marketing-style header was rejected. Do not place a large hero, oversized title block, or generic web-app card stack above the graph. The graph should be visible immediately and should occupy most of the viewport.

## Aesthetic direction

- **Tone**: dark IDE vault, Obsidian-like graph field, cyan source-span signal lines, and compact clinical-evidence tooling.
- **Typography**: compact IDE sans and monospace surfaces; avoid landing-page display typography as the primary voice.
- **Composition**: thin command/status bar, left atlas/source rail, central graph canvas, floating filter/settings panel, floating selected-node inspector, concise provenance/review panels, and bottom selected-context assistant rail.
- **Texture**: gridded graph field, many small colored circular nodes, thin subdued edges, sparse overlapping labels, subtle node glow, panel seams, and high-contrast focus rings.
- **Anti-pattern**: no large marketing header, no hero panel above the graph, no chatbot centerpiece, no generic SaaS dashboard cards, no whole-corpus chat, and no full RAG answer mode.
- **Interpretability boundary**: graph-linked retrieval and selected-context draft answers are source-backed only where validated source spans exist. Draft answer fragments require citations to the selected source span; patient advice, approved guidance, uncited fragments, raw output, and broad corpus answers remain blocked.

## Obsidian-like graph map standard

The default graph view must feel like a dense vault map, not a handful of explanatory cards. The first impression should be a dark charcoal graph field with many small connected dots, clusters, thin link lines, sparse high-priority labels, and compact vault chrome. Large card-like nodes are reserved for inspectors or hover surfaces, not the graph field itself.

Zoom is part of the information architecture. At zoomed-out/default scale, labels should be sparse and limited to anchors or high-priority synthetic nodes. As the user zooms in, additional labels, node type/group metadata, and provenance cues can appear. Selection and hover should reveal detail immediately, even when the global zoom level remains low.

The right-side overlay should resemble Obsidian Graph View settings: filter input, toggles, collapsible Groups/Display/Forces rows, and compact status controls. It floats over the graph rather than turning the product into a three-column dashboard.

## Interaction standards

- Pan and zoom must be smooth through pointer, wheel/trackpad, and visible controls.
- Fit-view and minimap, or an equivalent orientation aid, must be present once the graph exceeds a single screen.
- Hovering a node shows a compact card with title, type, and short summary.
- Selecting a node opens a persistent inspector or trust/provenance drawer with source/provenance fields when validated source spans exist, and honest metadata-only, parse-failed, or download-failed status when they do not.
- Submitting a retrieval query should focus and highlight matching resources, source spans, path/context nodes, and provenance fields without generating all-corpus answer prose.
- The assistant rail accepts questions only after a source-backed context is selected. It posts allowlisted selected-context fields through `loadCorpusConversationTurn()`, shows concise cited draft fragments when every fragment cites the selected source span, and shows no fragments for no-context, broad-context, patient-advice, gateway-unavailable, or uncited responses.
- Citation chips use readable labels such as `Page 1 · Span 1`. Hover/focus creates transient graph/source highlighting; click pins the citation focus and opens Source View at the cited span.
- Source-span retrieval hits should fall back to their parent resource when the graph lacks source-span nodes, while the terminal and trust drawer keep source-span IDs, stable locator, checksum/status, and reviewer metadata visible where available.
- Zoom changes detail density through React Flow viewport state or an equivalent real graph viewport signal; do not fake zoom detail with static CSS alone.
- Nodes must be keyboard focusable, with visible focus states and an accessible name.
- Reduced-motion users must not receive animated edge motion or long transitions.
- The command surface should stay compact: breadcrumbs, local/synthetic status, and command-palette placeholder are acceptable; marketing copy is not.
- Left/right/bottom panels should be resizable within bounds and dismissible where transient. Reload should reset panel and assistant state rather than persisting layout or conversation history.
- Raw source-span IDs, stable locators, source-document IDs, checksums, raw node IDs, and workflow/review IDs belong behind details/copy controls, not in primary labels.
- Offline surveillance chips may show local manifest comparison status only. They must not imply live crawling, live reachability checks, clinical inference, or recommendation-impact diff.
- Evidence-review cards may show draft workflow metadata and local-only actions such as `inspect_source`, `mark_needs_review_local`, and `link_source_local`. Cards without validated `source_span_ids` must stay blocked and must not show claim text.

## Safety and fixture standards

- Prototype data must be synthetic and non-clinical.
- No PHI, patient-specific advice, or real guideline recommendations may appear in graph fixtures.
- Every claim-like future node requires source-span metadata before it can move beyond placeholder status.
- Placeholder provenance fields should make missing source document, stable locator, quoted span/checksum, reviewer status, and output status visible.
- Public corpus UI copy must state that only selected-context cited draft answers are allowed. Whole-corpus chat, approved clinical guidance, patient-specific advice, uncited answer fragments, raw output, and assistant history persistence remain unavailable.

## Current graph prototype

The current production graph uses Sigma.js and Graphology under `apps/web/` with deterministic ForceAtlas and noverlap layout, a compact IDE command bar, left atlas/source rail, central dense graph canvas, floating Graph View settings panel, selected-node inspector, source provenance drawer, selected-context assistant rail, offline/local status chips, custom small-dot atlas nodes, thin subdued edges, hover summaries, keyboard focus support, zoom-driven detail density, reduced-motion CSS, and citation-linked graph/source highlighting. It is a graph-linked retrieval, provenance, and selected-context cited-draft surface, not a whole-corpus generated-answer system. Roadmap items such as recommendation-impact diff, consensus workflow, Alberta-local overlays, and computable compiler views are not part of this milestone.
