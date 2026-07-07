// Fixture: shared-types (the leaf) illegally importing an adapter package.
// Expected to trip `shared-types-is-a-leaf` (ADR 0003 §3). Never shipped.
import { storedEvents } from '../../event-store/src/index';

export const leaked = storedEvents;
