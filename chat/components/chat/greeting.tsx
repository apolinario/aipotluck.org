"use client";

import { motion } from "framer-motion";
import { MODEL } from "@/lib/ai/model-identity";
import { Commitments } from "./commitments";

// Documented empty-state copy (Alpha launch content §1.3): a flat, declarative,
// no-first-person-warmth framing of the thesis. The model name is DERIVED from
// the actually-served model (never hardcoded) so this line and the per-answer
// provenance badge can never disagree — flip HF_MODEL and both update together.
// The first-run orientation (what/who/why-different + the three CTAs) lives in
// WelcomeOverlay, which covers this panel on first load; this is what's behind
// it once dismissed.
export const Greeting = () => {
  return (
    <div className="flex flex-col items-center px-4" key="overview">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-balance text-center font-semibold text-xl tracking-tight text-foreground md:text-2xl"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.35, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        Open-source, sovereign, community-configured.
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mt-2 max-w-prose text-balance text-center text-[13px] text-muted-foreground/80"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        Running on {MODEL.short} by the Swiss National AI Initiative. This
        prototype is served via HuggingFace; the production stack runs on
        sovereign public compute. Not a company.
      </motion.div>
      <motion.div
        animate={{ opacity: 1 }}
        initial={{ opacity: 0 }}
        transition={{ delay: 0.62, duration: 0.5 }}
      >
        <Commitments />
      </motion.div>
    </div>
  );
};
