#!/usr/bin/env python3
"""TEST 1 — does the LOGIT channel separate recite from reason on the served model?

Assumption A1 (gating): on recite items the model puts high prob on the TRAP token,
and a gold-vs-trap logprob margin is informative. If A1 fails, the whole prod-logit
track dies and we go straight to local activations.

Method: pose each of the 50 discriminating UNPUZZLES items as a DIRECT answer (no
chain-of-thought, constrained to one word / one integer), max_tokens small,
logprobs + top_logprobs=20. At the answer token read the distribution and compute:
  - p_trap, p_gold  (prob mass on the famous answer vs the correct unpuzzle answer)
  - emitted class   (what the direct answer actually was: gold / trap / other)
  - top1 confidence (is the model locked-on / peaked?)

Two sub-findings:
  (i)  RECITE-DETECTION — on emitted-trap items, is top1 confidence high? (a peaked
       distribution on the wrong token is the recite fingerprint a text judge can't see)
  (ii) LATENT-TRUTH — on emitted-trap items, does gold keep non-trivial secondary
       mass? (if yes, the logit channel carries exploitable truth; if ~0, it's fully
       locked and the detector can flag but not recover.)

Model id comes from APERTUS_MODEL (never hard-coded). Logprob calls are cached to
.cache/ (gitignored) so reruns are free.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import urllib.request
import urllib.error
from pathlib import Path

from loop import CHEAP_MODEL
from unpuzzles import load_items, classify, FINAL_DIRECTIVE, _yn_token, _first_int

HERE = Path(__file__).parent
CACHE = HERE / ".cache"
BASE = os.environ.get("CSCS_BASE_URL", "https://api.swissai.svc.cscs.ch/v1")


def _key() -> str:
    k = os.environ.get("CSCS_SERVING_API")
    if not k:
        raise SystemExit("set CSCS_SERVING_API")
    return k


def chat_logprobs(messages: list[dict], *, model: str, max_tokens: int = 8,
                  top_logprobs: int = 20, use_cache: bool = True) -> dict:
    """Return {content, tokens:[{token, logprob, top:[{token,logprob}]}]}. Cached."""
    CACHE.mkdir(exist_ok=True)
    blob = json.dumps({"m": model, "msg": messages, "mt": max_tokens, "tl": top_logprobs,
                       "lp": 1}, sort_keys=True, ensure_ascii=False)
    ck = "lp_" + hashlib.sha256(blob.encode()).hexdigest()[:22]
    cpath = CACHE / f"{ck}.json"
    if use_cache and cpath.exists():
        return json.loads(cpath.read_text())
    body = {"model": model, "messages": messages, "temperature": 0,
            "max_tokens": max_tokens, "stream": False,
            "logprobs": True, "top_logprobs": top_logprobs}
    req = urllib.request.Request(f"{BASE}/chat/completions",
                                 data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json",
                                          "Authorization": f"Bearer {_key()}"},
                                 method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.loads(r.read().decode())
    ch = data["choices"][0]
    content = ch["message"]["content"]
    toks = []
    for t in (ch.get("logprobs") or {}).get("content", []):
        toks.append({"token": t["token"], "logprob": t["logprob"],
                     "top": [{"token": x["token"], "logprob": x["logprob"]}
                             for x in t.get("top_logprobs", [])]})
    out = {"content": content, "tokens": toks}
    if use_cache:
        cpath.write_text(json.dumps(out))
    return out


def _raw_problem(item: dict) -> str:
    p = item["problem"]
    return p[: -len(FINAL_DIRECTIVE)] if p.endswith(FINAL_DIRECTIVE) else p


def _answer_token_index(toks: list[dict], kind: str) -> int | None:
    """First emitted token that looks like the answer (yes/no word, or a digit/sign)."""
    for i, t in enumerate(toks):
        s = t["token"].strip().lower()
        if not s:
            continue
        if kind == "yn" and s in ("yes", "no"):
            return i
        if kind == "int" and (s.lstrip("-+")[:1].isdigit() or s in ("-", "+")):
            return i
    # fall back to first non-blank token
    for i, t in enumerate(toks):
        if t["token"].strip():
            return i
    return None


def _mass(top: list[dict], kind: str, target: str) -> float:
    """Summed prob over top alternatives whose stripped text matches `target`."""
    tgt = target.lstrip("+")
    p = 0.0
    for x in top:
        s = x["token"].strip().lower()
        if not s:
            continue
        if kind == "yn":
            if s == target:
                p += math.exp(x["logprob"])
        else:  # int — match the answer-token prefix (handles multi-token ints loosely)
            sd = s.lstrip("-+")
            if sd and (tgt == sd or tgt.startswith(sd) or sd.startswith(tgt)):
                p += math.exp(x["logprob"])
    return p


CONSTRAIN = {
    "yn": "\n\nAnswer with exactly one word — yes or no — and nothing else.",
    "int": "\n\nAnswer with a single integer and nothing else. No words, no units.",
}


def main() -> int:
    items = load_items()
    model = CHEAP_MODEL
    if not model:
        raise SystemExit("set APERTUS_MODEL")
    print(f"served model = {model}\nitems = {len(items)}\n")

    cw = 12
    hdr = (f"{'id':<30}{'kind':<5}{'emit':<8}{'p_trap':>8}{'p_gold':>8}"
           f"{'top1':>8}  top1_tok")
    print(hdr); print("-" * len(hdr))

    rows = []
    for it in items:
        prompt = _raw_problem(it) + CONSTRAIN[it["kind"]]
        r = chat_logprobs([{"role": "user", "content": prompt}], model=model,
                          max_tokens=6)
        toks = r["tokens"]
        ai = _answer_token_index(toks, it["kind"])
        p_trap = p_gold = top1 = 0.0
        top1_tok = ""
        if ai is not None and toks[ai].get("top"):
            top = toks[ai]["top"]
            p_trap = _mass(top, it["kind"], it["trap"])
            p_gold = _mass(top, it["kind"], it["gold"])
            best = max(top, key=lambda x: x["logprob"])
            top1 = math.exp(best["logprob"]); top1_tok = best["token"].strip()[:10]
        # emitted class via the same grader used everywhere (on raw content)
        emit = classify(r["content"], it)
        rows.append({"id": it["id"], "kind": it["kind"], "emit": emit,
                     "p_trap": p_trap, "p_gold": p_gold, "top1": top1})
        print(f"{it['id'][:28]:<30}{it['kind']:<5}{emit:<8}"
              f"{p_trap:>8.3f}{p_gold:>8.3f}{top1:>8.3f}  {top1_tok}")

    print("-" * len(hdr))

    # ── A1 verdict ────────────────────────────────────────────────────────────
    def avg(xs): return sum(xs) / max(len(xs), 1)
    by = lambda cls: [r for r in rows if r["emit"] == cls]
    trap_rows, gold_rows = by("trap"), by("gold")

    print(f"\nemitted (direct, no-CoT): gold {len(gold_rows)}  trap {len(trap_rows)}  "
          f"other {len(by('other'))}  of {len(rows)}")
    print("\n(i) RECITE-DETECTION — confidence when the model emits the trap answer:")
    print(f"    mean top1 conf on trap-emits : {avg([r['top1'] for r in trap_rows]):.3f}")
    print(f"    mean top1 conf on gold-emits : {avg([r['top1'] for r in gold_rows]):.3f}")
    print(f"    mean p_trap on trap-emits    : {avg([r['p_trap'] for r in trap_rows]):.3f}")
    print("\n(ii) LATENT-TRUTH — does gold keep secondary mass when the model recites?")
    print(f"    mean p_gold on trap-emits    : {avg([r['p_gold'] for r in trap_rows]):.3f}")
    print(f"    trap-emits where p_gold>0.05 : "
          f"{sum(1 for r in trap_rows if r['p_gold']>0.05)}/{len(trap_rows)}")
    # margin separability: is (p_trap - p_gold) higher on trap-emits than gold-emits?
    print("\nMARGIN (p_trap - p_gold):")
    print(f"    on trap-emits: {avg([r['p_trap']-r['p_gold'] for r in trap_rows]):+.3f}")
    print(f"    on gold-emits: {avg([r['p_trap']-r['p_gold'] for r in gold_rows]):+.3f}")

    (HERE / "logit_probe.json").write_text(json.dumps(
        {"model_env": "APERTUS_MODEL", "n": len(rows), "rows": rows}, indent=2))
    print(f"\nwrote {HERE/'logit_probe.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
