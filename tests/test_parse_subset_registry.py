from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_CORPUS = ROOT / "resources" / "registry" / "ahs-guru-public-corpus.json"
PARSE_SUBSET = ROOT / "resources" / "registry" / "ahs-guru-parse-subset.json"


def load_rows(path: Path) -> list[dict[str, object]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload["rows"]
    assert isinstance(rows, list)
    return rows


def test_parse_subset_selects_five_unique_public_corpus_rows() -> None:
    corpus_rows = load_rows(PUBLIC_CORPUS)
    subset_rows = load_rows(PARSE_SUBSET)
    corpus_by_id = {row["resource_id"]: row for row in corpus_rows}
    selected_ids = [row["resource_id"] for row in subset_rows]

    assert len(corpus_rows) == 198
    assert len(subset_rows) == 5
    assert len(set(selected_ids)) == 5
    assert set(selected_ids) <= set(corpus_by_id)
    assert {row["disease_site"] for row in subset_rows} >= {"breast", "central-nervous-system", "cutaneous"}
    assert len({row["resource_type"] for row in subset_rows}) >= 2


def test_public_corpus_limits_derive_graph_to_parse_subset() -> None:
    corpus_rows = load_rows(PUBLIC_CORPUS)
    subset_ids = {row["resource_id"] for row in load_rows(PARSE_SUBSET)}
    derive_ids = {
        row["resource_id"]
        for row in corpus_rows
        if "derive_graph" in row.get("allowed_use", [])
    }

    assert derive_ids == subset_ids


def test_parse_subset_notes_are_metadata_only() -> None:
    banned_phrases = [
        "source span:",
        "quoted span:",
        "recommendation paragraph",
        "raw pdf content",
        "patient-specific advice:",
    ]
    selector_text = PARSE_SUBSET.read_text(encoding="utf-8").lower()

    for phrase in banned_phrases:
        assert phrase not in selector_text
