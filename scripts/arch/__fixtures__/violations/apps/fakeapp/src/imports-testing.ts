// Fixture: a production app (not apps/skeleton-walk) illegally importing core-domain's /testing subpath.
// Expected to trip the `testing-subpath-production-guard` rule (ADR 0017 R1). Never shipped.
import { fakePolicy } from '../../../packages/core-domain/src/testing/index';

export const leaked = fakePolicy;
