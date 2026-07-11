// Fixture: apps/*/src UI code (outside composition/store) illegally importing the event-store adapter.
// Expected to trip the `ui-reads-read-models-only` rule (ADR 0012 §11). Never shipped.
import { storedEvents } from '../../../../packages/event-store/src/index';

export const leaked = storedEvents;
