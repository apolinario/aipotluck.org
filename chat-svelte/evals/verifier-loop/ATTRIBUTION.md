# Third-party data attribution

## UNPUZZLES

The `unpuzzles` evaluation uses the **UNPUZZLES** dataset from
[google-deepmind/unpuzzles_and_simple_reasoning](https://github.com/google-deepmind/unpuzzles_and_simple_reasoning).

- **Data license:** CC-BY 4.0
- **Code license (their repo):** Apache-2.0
- **Citation:** Malek, Wang, et al. (2025), *Frontier LLMs Still Struggle with
  Simple Reasoning Tasks*, arXiv:2507.07313.

The dataset is fetched on demand by `fetch_unpuzzles.sh` into the gitignored
`data/` directory; it is not redistributed in this repository. Each UNPUZZLE is
a premise-altered version of a classic puzzle whose famous answer no longer
applies — a clean probe for the "recite the memorised answer" failure mode.
