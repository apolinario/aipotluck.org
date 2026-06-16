import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

export const guestRegex = /^guest-\d+$/;

export const DUMMY_PASSWORD = generateDummyPassword();

// The documented launch starter prompts (Alpha launch content §1.3) — each is
// chosen to demonstrate one facet of the thesis: provenance, honest limits, and
// open-web search. They replace the upstream ai-chatbot defaults.
export const suggestions = [
  // → provenance / governance framing
  "I work in humanitarian policy in Geneva. Can this help me understand AI governance frameworks affecting public institutions?",
  // → honest limits
  "A farmer in Rwanda is asking about drought-resistant crops for this season. What can you actually help with, and where are your limits?",
  // → open-web search (trips the recency detector → search affordance)
  "I need the current status of the EU AI Act for a policy briefing next week. How do you find that?",
];
