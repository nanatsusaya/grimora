// Fixture: a plugin illegally importing **another plugin's** internals — a hard boundary
// (ADR 0010 §3: "never another plugin's namespace/state"). Expected to trip `plugins-only-sdk`
// (its `to` now includes `plugins/`, with a self-exception for the plugin's own files). Never shipped.
import { otherPluginValue } from '../../other/src/index';

export const stolen = otherPluginValue;
