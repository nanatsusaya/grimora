# @grimora/design-tokens

Theming single-source-of-truth (ADR 0007). Primitives + semantic tokens will live in JSON and be
**generated** into per-platform artefacts (CSS custom properties for web, native artefacts for
Tauri/Expo); the UI consumes **only semantic tokens**, never primitives, following the ADR 0007
cascade (character › player-per-campaign › GM-campaign › player-global › rule-system-default › app-base).

## Current state (scaffold, #105-A)

The JSON → per-platform generation pipeline is **not built yet**. To unblock the `apps/web` shell,
[`tokens.css`](tokens.css) hand-authors a **minimal semantic layer** (`--gr-color-*`, `--gr-space-*`,
`--gr-font-*`) with light + dark values. It is deliberately the *semantic* tier so consumers already
follow the token-only discipline. When the generator lands it **replaces** `tokens.css` with generated
output — consumers keep importing `@grimora/design-tokens/tokens.css` unchanged.

Building the JSON SSOT + generation pipeline is tracked separately (ADR 0007 implementation, Phase 2).
