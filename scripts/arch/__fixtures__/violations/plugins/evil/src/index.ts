// Fixture: a plugin illegally importing core internals instead of only the plugin SDK.
// Expected to trip the `plugins-only-sdk` rule (ADR 0003 §2.4 / ADR 0006 §1). Never shipped.
import { coreValue } from '../../../packages/core-domain/src/index';

export const leaked = coreValue;
