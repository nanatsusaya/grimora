/**
 * Explicit, documented placeholders for ADR-mandated fitness functions that are **not yet assertable**
 * because the code they would check does not exist yet (#76's own instruction: "implement what is
 * assertable now, mark the rest pending" — so no accepted ADR silently claims a check exists when it
 * doesn't, ADR 0003 §9 / ADR 0015 §10 / ADR 0024 §9). Each is `test.skip` with the reason and the exact
 * trigger that turns it into a real assertion — visible in `bun run arch` output as **skipped**, not
 * silently absent, and not a false "pass".
 */
import { test } from 'bun:test';

test.skip('consent gate (ADR 0015 §3/§10): the external AiProviderPort is reachable only via a ConsentPort-gated use case', () => {
  // Blocked on ConsentPort not existing yet (docs/ports-catalog.md: "Not yet implemented", #73).
  // Once a use case wires ConsentPort before calling the external AiProviderPort adapter, this
  // becomes a call-graph scan (ts-morph, mirroring default-deny.test.ts's `policy.can` scan) over
  // that use case, asserting it reaches `consent.*` before the AI provider call.
});

test.skip('realtime/presence never persisted (ADR 0024 §9): no realtime/presence adapter writes to EventStorePort/ReadModelStorePort', () => {
  // Blocked on RealtimePort/a realtime adapter not existing yet (docs/ports-catalog.md: "Not yet
  // implemented" — after the sync adapter, #107). Once a realtime adapter package exists, this
  // becomes a `.dependency-cruiser.cjs` import rule: forbid that adapter's path from importing
  // `packages/event-store/` or `packages/cqrs-read/` (mirroring `adapters-no-cross-adapter`).
});
