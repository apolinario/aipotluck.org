"""The Wikipedia citation-reason taxonomy (Redi et al. 2019, arXiv:1902.11116,
Table 1 — "Reasons why citations are needed"). Authoritative codebook: the CSV
vote codes 1-8 map to these in table order (verified against the vote
distribution — code 7 "Historical" is the majority class, matching the paper).

This is the LABEL SPACE for a classification task, not domain world-knowledge
injected to get an answer — giving the model the set of categories it is
choosing among is legitimate (you cannot classify into an unknown taxonomy).
"""
from __future__ import annotations

# code -> (short name, definition verbatim-ish from Table 1)
TAXONOMY: dict[int, tuple[str, str]] = {
    1: ("quotation",   "The statement appears to be a direct quotation or close paraphrase of a source."),
    2: ("statistics",  "The statement contains statistics or data."),
    3: ("controversial", "The statement contains surprising or potentially controversial claims (e.g. a conspiracy theory)."),
    4: ("opinion",     "The statement contains a person's subjective opinion or idea about something."),
    5: ("private_life", "The statement contains claims about a person's private life (e.g. date of birth, relationship status)."),
    6: ("scientific",  "The statement contains technical or scientific claims."),
    7: ("historical",  "The statement contains general or historical facts that are not common knowledge."),
    8: ("other",       "The statement requires a citation for a reason not covered by the categories above."),
}

NAME_BY_CODE = {c: n for c, (n, _) in TAXONOMY.items()}
CODE_BY_NAME = {n: c for c, (n, _) in TAXONOMY.items()}
NAMES = [n for _, (n, _) in sorted(TAXONOMY.items())]

# Product-relevant collapse: a chat/provenance system handles these differently.
# Factual-checkable claims -> retrieve & cite. Opinion/controversial -> attribute
# & hedge. Reported as a SECONDARY view (it is our grouping, flagged as such),
# never as the primary gold.
FACTUAL = {"quotation", "statistics", "private_life", "scientific", "historical"}
ATTRIBUTE = {"opinion", "controversial"}


def names_block(with_defs: bool) -> str:
    """The category list shown to the model (names only, or names + definitions)."""
    if with_defs:
        return "\n".join(f"- {n}: {d}" for _, (n, d) in sorted(TAXONOMY.items()))
    return "\n".join(f"- {n}" for n in NAMES)
