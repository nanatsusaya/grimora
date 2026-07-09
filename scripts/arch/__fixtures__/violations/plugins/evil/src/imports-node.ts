// Fixture: a plugin illegally importing a Node builtin — plugins have no ambient authority
// (ADR 0006 §3 / ADR 0010 §3: no filesystem/network/globals). Expected to trip
// `plugins-no-node-builtins`. Never shipped.
import { readFileSync } from 'node:fs';

export const leaked = readFileSync;
