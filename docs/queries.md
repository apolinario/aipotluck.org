# Ecosystem Map: Query Framework

**Primary purpose:** Drive Current AI's technical roadmap. The roadmap is the headline output. Everything else is the data foundation that makes the roadmap defensible and lets others build on it.

**Design principle:** Every query below is a function over the data model. If we can't answer it from the underlying data, the data model is incomplete. Treat this list as a spec for what the map must store.

---

## Tier 0 — Roadmap queries (the headline)

These directly produce or justify Current AI's technical roadmap. They run first; they render first.

**0.1 What would it take to ship?** Given a target product spec (e.g. "Claude-equivalent assistant with web search, file upload, multimodal input, 128k context"), return: the minimum viable composition of open-source components, the integration gaps, the missing components, and the maintenance risks. *This is the potluck thesis as a query.*

**0.2 Where should Current AI invest next?** Rank candidate investments by: distance-to-closing-a-gap, leverage (how many downstream products benefit), fragility reduction, and dollar efficiency. Output: a ranked, dated roadmap with rationale traceable to underlying data.

**0.3 What's the smallest credible end-to-end open stack for use case Y?** For a given use case — consumer assistant, sovereign government deployment, scientific research workflow — return the shoppable list: components, costs, integration work, and named maintainers to fund.

**0.4 Potluck composition.** Given a target stack (e.g. the chat.publicai.co spec) and a set of candidate countries, return a per-country contribution plan: which repos, organizations, HF artifacts, maintainers, and compute they could each plausibly bring, such that the union covers the stack with minimal duplication and no orphan layers. Output is a seating chart for the table — who brings the protein, who brings the sides, who brings the playlist. Flags layers no participating country can cover (which become Current AI's funding targets), and layers where multiple countries overlap (negotiation surface for who leads).

---

## Tier 1 — Composition & substitutability

The hard part. The market-map-of-logos problem. These queries are why repos are not products.

**1.1 Dependency graph, whitebox.** For an OSS project: actual code-level dependencies, transitively.

**1.2 Dependency graph, blackbox / spec-level.** For a closed product: inferred functional dependencies — what would you need to replicate this from the outside?

**1.3 Substitutability.** For any node X, what are the viable alternatives, and for which use cases does each win? *(The "Product Hunt for OSS AI" question.)*

**1.4 Interoperability / integration cost.** For any two nodes, do they actually compose, or is there glue code in the way? Quantified where possible (hours, lines, known forks). The seam visibility that existing maps miss entirely.

**1.5 Off-the-shelf ceiling.** If you assembled today's best-of-breed open components, how close do you get to GPT-5 / Claude / Gemini, per capability? Direct input to 0.1.

**1.6 Cost-to-build and cost-to-run.** For a given component or assembled stack: realistic training cost, fine-tuning cost, inference cost per million tokens, infra footprint, and ops headcount. The honest number, not the marketing number. "You can ship this" is meaningless without "and here's what it costs to run at 10k DAU."

---

## Tier 2 — Gap & state-of-play

**2.1 Per-layer competitiveness.** Where is open source ahead, at parity, or behind closed options — by stack layer and by capability?

**2.2 Openness depth.** Per node: weights / code / training data / methodology / evals — which are actually open, under what license, with what governance? Surfaces "open-washing."

**2.3 License & governance posture.** Apache vs. AGPL vs. source-available-pretending-to-be-OSS vs. open-weights-closed-data. Critical for any downstream commercial or sovereign use.

**2.4 Momentum / what's hot this week.** Trending repos by stars, commits, downloads, HF model pulls, citations, and social signal — filterable by layer and by maturity. Surfaces emergent components before they show up in formal maps. Also a reason for technical users to come back to the site weekly.

---

## Tier 3 — Trust, fragility & people

**3.1 Maintainer health / bus factor.** Per node: active maintainers, funding sources, commit cadence, truck factor. The Log4Shell question. Direct input for STF grant targeting.

**3.2 Trust signals.** Per node: contributor count and diversity, institutional backing (company / university / foundation), funding durability, security track record, release discipline, downstream adoption. The "why should I depend on this?" composite. Distinct from 3.1 — bus factor is one input among several.

**3.3 Provenance.** Where did this repo come from — country, company, university, community, individual? Inferred from web search, commit metadata, author affiliations, funding disclosures. Feeds the sovereignty narrative directly: which parts of the stack come from where, and what does that imply for any given government's risk profile.

**3.4 Beneficiary analysis.** Who actually captures value from this repo? Big platforms reselling it, sovereign deployments, SMEs, individual developers, academic researchers? Measured via downstream dependency patterns, commercial fork activity, deployment signals, and citation patterns. Answers the political question — "is this open source serving the commons or subsidizing incumbents?" — load-bearing for Current AI's public-interest framing.

**3.5 Adversarial / fragility analysis.** Which 3–10 repos, if acquired-and-shuttered or captured, would most damage the open AI stack? A roadmap output, not edgelord cosplay — the answer names what to harden, fork, or duplicate.

**3.6 People graph.** Core researchers and devs by area: where they've been, where they are now, what they're shipping. Talent flow is leading-indicator data.

---

## Tier 4 — Onboarding

**4.1 Builder pathways.** For a [new / experienced] dev: where to learn, build reputation, earn money, create value — hackathons, repos, labs, programs.

---

## Tier 5 — Geography & contribution

The map needs a coherent geographic lens. Provenance (3.3) tells you *where things came from*; this tier tells you *what each country could bring forward*.

**5.1 Country contribution profile.** For any given country, return the leading contributions across categories: top three repos, top three organizations (companies / universities / labs / foundations), top three Hugging Face artifacts (models, datasets, spaces), top three individual contributors, and top three institutional funders or programs. Filterable by stack layer. The country one-pager — what every government delegation should be able to pull up about itself before a summit conversation.

**5.2 Potluck composition.** *(Cross-listed from 0.4.)* The multi-country version: given a target stack and a set of countries, return an allocation that covers the stack. Lives in Tier 0 because it's a roadmap query, listed here because it's the geographic query that closes the loop.

**5.3 Sovereignty exposure.** For a given country deploying a given stack: which components depend on infrastructure, maintainers, or licenses controlled by other jurisdictions? The flip side of 5.1 — not what you can give, but what you currently rely on. Falls out of dependency graph (1.1) crossed with provenance (3.3).

---

## Implications for the data model

To answer the above, the map must store, per node:

- Identity, layer, license, governance model
- Openness vector (weights / code / data / methodology / evals)
- Dependency edges (in and out)
- Substitutes and known integration pairs (with cost / quality)
- Maintainer roster, funding sources, activity signals
- Capability benchmarks tied to use cases
- People affiliations over time
- Provenance (country, institution, funding source)
- Hugging Face artifacts as first-class nodes alongside GitHub repos
- Cost data (training, fine-tuning, inference, ops)

Tier 0 queries are compositions of Tiers 1–3 and 5. If the underlying tiers are clean, the roadmap writes itself — and any technical user pinging the API can write their own analyses.