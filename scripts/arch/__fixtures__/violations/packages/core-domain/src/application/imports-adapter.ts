// Fixture: core-domain (Application layer) illegally importing an adapter package.
// Expected to trip the `core-no-adapters` rule (ADR 0003 §2.2–2.3). Never shipped.
import { storedEvents } from '../../../event-store/src/index';

export const leaked = storedEvents;
