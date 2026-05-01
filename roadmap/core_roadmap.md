# Core roadmap

(Intro paragraphs are omitted in the UI; keep this heading for authoring context if you want. Optional directives on a step include `@period:Q1 26`, `@label:…`, `@label-color`, `@highlight`, `@status`.)

1. `ml-training-and-tuning` Establish eval-ready checkpoints and data contracts before feature work freezes. @highlight:red @label:Swiss AI @period:Q1 26
   - Align with legal on training data posture, retention, and opt-out flows.
   - Lock the fine-tuning loop behind offline evaluation gates—not “looks good on chat alone.”
   - Most schedule slips start here—treat scope freeze as seriously as architecture choices.

2. `developer-agent-workbench` Put the iteration surface in engineers’ hands; MCP-backed tools cut time-to-patch. @label:Mozilla @period:Q1 26
   - Pilot with two squads; measure median time from bug report to landed fix.
   - Require internal dogfood before broader third-party tool scopes ship.
   - If agents are not relieving toil mid-stream, downstream serving budgets will swell.

3. `inference-and-serving` Harden throughput, cost knobs, and rollback semantics before attaching any external SLA. @label:Public AI @period:Q2 26
   ^ Load-shape and SLO drafts before you promise uptime
   - Run load tests with traffic mixes that mimic real chat + batch peaks.
   - Draft SLOs and on-call ownership while error budgets still feel cheap.

4. `observability-for-llm-apps` Wire traces and eval signals so regressions surface in hours, not release trains. @label:Finland (CSCS) @period:Q3 26
   - Stand up shadow-mode pipelines alongside production—not as a someday migration.
   - Tie evaluation dashboards to incidents with explicit owners.

5. `foundation-to-edge-stack` Optional vertical audits from kernels through on-device stacks—for SKU teams that genuinely ship edge binaries. @label:Mozilla @period:Q4 26
   - Useful as a parity check; don’t spin a second program unless binaries actually ship offline.
