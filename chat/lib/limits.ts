// Single source of truth for every rate / cost limit in the chat.
//
// These numbers count DIFFERENT units on purpose — equal-looking values are
// NOT duplicates, and the relationships between them matter:
//
//   userMessagesPerHour   per-user, persisted user-role messages (DB)
//   ipRequestsPerHour     per-IP, chat POST requests (Redis)  — a coarse
//                         network backstop; MUST be >= userMessagesPerHour
//                         because one user turn can be several requests
//                         (tool-approval re-POST, regenerate), so an equal
//                         cap would trip the IP limiter first on legit use.
//   globalRequestsPerDay  ALL users combined, chat POST requests per UTC day
//                         (Redis) — the budget circuit-breaker. Per-identity
//                         caps are defeated by fresh guest ids / rotated IPs;
//                         only a global ceiling bounds total inference spend.
//                         Tune to the real inference budget via env.
//   maxOutputTokens       per-request output ceiling — bounds single-request
//                         inference cost AND structurally caps verbosity. 512
//                         matches the original gap-chat (app/api/chat.js), which
//                         stayed concise; the prior 2048 permitted the long
//                         rambling answers Apertus produces at high temperature.
//   contributionsPerDayPerIp  per-IP daily cap on the public contribution form
//                         (Redis) — these have no auth wall and write to the DB,
//                         so a low cap blunts form spam without blocking a booth
//                         full of attendees sharing an IP.
//   retentionDays         how long guest chats live before the retention cron
//                         deletes them. The SINGLE source for both the actual
//                         sweep and the privacy-page disclosure, so what we say
//                         can't drift from what we do. Server-only (env-driven);
//                         do not surface the raw number in a client component,
//                         which can't read this env and would show a stale 30.
export const LIMITS = {
  userMessagesPerHour: 10,
  ipRequestsPerHour: 30,
  globalRequestsPerDay: Number(process.env.GLOBAL_DAILY_REQUEST_CAP) || 5000,
  maxOutputTokens: 512,
  contributionsPerDayPerIp: 30,
  retentionDays: Number(process.env.RETENTION_DAYS) || 30,
} as const;
