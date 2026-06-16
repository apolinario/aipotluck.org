// The six commitments (Ayah's value framework + the "collaboration" 6th, per
// Julie's Web UX spec). Titles only — the supporting copy in the spec is partly
// stale (it claims safety "runs every session" and names a specific next model),
// so we show the values, not those overclaims. Laura/team own the final wording.
// (Partner names dropped as redundant — the actual partners are on the map.)
const COMMITMENTS = [
  "Safe",
  "Ethical",
  "Human-flourishing",
  "Multilingual",
  "A public utility",
  "A collaboration",
];

export function Commitments() {
  return (
    <div className="mt-3 flex max-w-md flex-col items-center gap-1 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/50">
        We are
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 font-mono text-[11px] text-muted-foreground/70">
        {COMMITMENTS.map((c, i) => (
          <span className="flex items-center gap-x-1.5" key={c}>
            <span>{c}</span>
            {i < COMMITMENTS.length - 1 && (
              <span className="text-muted-foreground/30">·</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
