# ADR 0007 — Theming architecture (design tokens as single source of truth)

- **Status:** Proposed (→ Accepted on merge of the PR for issue #6)
- **Date:** 2026-07-05
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0002](0002-tech-stack-and-tooling.md) (modern CSS), [ADR 0003](0003-overall-architecture.md)
  (design-tokens module, presentation), [ADR 0006](0006-plugin-system.md) (theme capability),
  [ADR 0020](0020-core-vs-plugin-boundary.md) (sheet shell). **Feeds:** ADR 0016 (a11y/i18n).

## Context

A **base theme, extensible with further themes** (vision), across **web + native** (React Native has no
CSS). Themes are a **plugin capability** (ADR 0006). The owner wants themes overridable at multiple
scopes — including a **GM setting a campaign theme for all players, which a player may override for
themselves**, and even a **per-displayed-hero** look. No runtime CSS-in-JS (ADR 0002).

This ADR is the **authoritative** detail for the theme-resolution cascade sketched in ADR 0006 §9.

## Decision

### 1. A theme = a set of design tokens (SSOT)

A **theme is a set of design tokens** (JSON): color, typography, spacing, radius, elevation, motion,
etc. Tokens are the **single source of truth**; every platform artifact is generated from them. The
`packages/design-tokens` module (ADR 0003 §3) owns the tokens + generators.

### 2. Token tiers (semantic indirection)

**Primitive** tokens (raw palette/scales) → **semantic/alias** tokens (role-based: `color.bg.default`,
`color.surface`, `color.text.accent`, `color.border`, state variants) → optional **component** tokens.
UI consumes **semantic** tokens, never primitives — so re-theming is just swapping the alias mapping,
and plugin-defined sheets re-theme automatically.

### 3. Cross-platform generation (no runtime CSS-in-JS)

A build step transforms the token JSON into per-platform artifacts from one SSOT:
- **Web:** CSS custom properties, using `@layer`, `light-dark()` and container queries; a theme is a
  named set of CSS variables applied by scoping (a `data-theme` attribute / class on a subtree).
- **Native (Expo/RN):** typed theme objects / StyleSheet consumed via a theme provider.

Because web themes are CSS-variable sets scoped to a subtree, **different scopes can render different
themes on the same screen** (e.g. one hero card themed differently) without re-rendering the world.

### 4. Themes as core base + plugins

The **base theme** ships with the app (core). Further themes are **theme plugins** (ADR 0006 theme
capability); a **rule-system plugin may ship a recommended default theme**. All expose the same
semantic-token contract, so they are interchangeable.

### 5. Theme resolution cascade (authoritative)

The **effective theme for a rendered view** is resolved **most-specific / most-personal wins**, top
first:

1. **Character (displayed hero) override** — set by the character's owner for that hero's view.
2. **Player's explicit override in this campaign** — a player choosing their own theme for this
   campaign; **this overrides the GM's campaign theme for that player**.
3. **GM's campaign theme** — set by the game master for the campaign; applies to **all players** by
   default (overrides players' *global* preferences, but not their explicit per-campaign override in #2).
4. **Player's global preference** — the user's personal default outside a GM-themed campaign.
5. **Rule-system default theme** — recommended by the active rule-system plugin.
6. **App base theme.**

This encodes the owner's rule: *the GM sets the campaign look for everyone (#3), any player may opt out
for themselves (#2), and an individual hero can look distinct (#1).* Resolution happens **at render
time** from the active context (which hero/campaign is shown and who is viewing).

### 6. Where overrides are stored

- **App base / rule-system default:** static (app / plugin manifest).
- **User global preference:** on the user profile.
- **GM campaign theme:** a setting on the **campaign** aggregate (visible to all members).
- **Player per-campaign override:** on the **campaign-membership** (user×campaign).
- **Per-character override:** a property of the **character** aggregate.

Entity-scoped choices (campaign, membership, character) are ordinary state changes → event-sourced
(ADR 0004); the user global preference is a profile setting.

### 7. Accessibility & modes

- **Light/dark/high-contrast** are token variants (via `light-dark()` / `prefers-color-scheme`); a theme
  declares which modes it supports. Themes **must meet WCAG 2.2 AA contrast** (enforced with ADR 0016).
- Motion tokens respect `prefers-reduced-motion`.

### 8. Theming the plugin-defined character sheet

The character-sheet **shell** is core (ADR 0020) and renders the plugin-defined layout via UI slots
using **semantic tokens** — so a plugin's sheet re-themes with the active theme **without the plugin
hardcoding any colors**. Plugins may expose optional component-token hooks for rule-specific flourishes.

## Consequences

**Positive:** one SSOT → consistent web+native look; deep per-context personalization (system/user/GM/
player/hero); themes and plugins decoupled; a11y-aware; no runtime CSS-in-JS cost; scoped CSS variables
allow different themes on one screen.

**Negative / costs:** a token-generation pipeline and the cascade resolver must be built and maintained;
theme authors must map **semantic** tokens (not primitives); the many override scopes need clear UI and
the unambiguous precedence above.

## Alternatives considered

- **Runtime CSS-in-JS** (styled-components/emotion): rejected — perf cost, no native story, contradicts
  ADR 0002.
- **Separate per-platform themes (no SSOT):** rejected — guaranteed drift.
- **Single global theme only:** rejected — contradicts the multi-scope override requirement.
- **Campaign theme always wins (no player opt-out):** rejected per owner — players may override for
  themselves (#2 > #3).

## References

- [ADR 0002](0002-tech-stack-and-tooling.md) (modern CSS), [ADR 0003](0003-overall-architecture.md)
  (`design-tokens`, presentation), [ADR 0006](0006-plugin-system.md) (theme capability, §9 cascade
  sketch — refined here), [ADR 0004](0004-event-sourcing-cqrs.md) (override storage), ADR 0016 (a11y/i18n),
  [ADR 0020](0020-core-vs-plugin-boundary.md) (sheet shell). Issue #6.
