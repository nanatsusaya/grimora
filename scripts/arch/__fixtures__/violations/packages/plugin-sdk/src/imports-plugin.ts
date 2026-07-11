// Fixture: plugin-sdk illegally importing a concrete plugin package.
// Expected to trip the `sdk-no-plugin-leak` rule (ADR 0003 §9, ADR 0025 §7). Never shipped.
import { leaked as evilLeaked } from '../../../plugins/evil/src/index';

export const leaked = evilLeaked;
