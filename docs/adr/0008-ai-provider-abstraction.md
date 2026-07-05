# ADR 0008 — AI provider abstraction (swappable, additional control layer)

- **Status:** Proposed (→ Accepted on merge of the PR for issue #7)
- **Date:** 2026-07-05
- **Deciders:** project owner + AI agents
- **Depends on:** [ADR 0003](0003-overall-architecture.md) (ports, security §6, DDD),
  [ADR 0006](0006-plugin-system.md) (AI-tools capability), [ADR 0020](0020-core-vs-plugin-boundary.md)

## Context

The AI chat is an **additional** control layer over the **same public API** — never the only way to do
something (vision, ADR 0003). It must be **provider-configurable/swappable** (Claude / OpenAI / local
**Ollama**), respect the **EU AI Act** (transparency) and **DSGVO** (data flow to third parties), and be
safe against prompt injection. This ADR fixes the provider abstraction, how tools map to the app, the
agent loop, and the safety/compliance rules. Concrete threat-model and consent detail live in ADR 0010
and ADR 0015.

## Decision

### 1. `AiProviderPort` (swappable)

A narrow **`AiProviderPort`** in core (`application/ports`): chat/completion with **tool/function
calling**, streaming, and structured output. Adapters implement it — **Claude**, **OpenAI**, **Ollama**
(local, no key). The provider is chosen by **config** per deployment/user; swapping = a new adapter with
**zero** domain changes (ADR 0003 §4). Provider API keys live only at the composition root (ADR 0003 §6),
never in domain/plugins/logs.

### 2. Tools = existing public API operations (no privileged backdoor)

AI "tools" are **descriptors over the existing public API / application use-cases** (ADR 0006 AI-tools
capability, ADR 0011). The agent can only do **what the current user could do in the UI** — same command
handlers, same **authorization** (ADR 0009), same validation. There is **no special AI path** into the
domain or database. This is what makes the AI a genuinely *additional* layer and preserves the
frontend-first invariant: every AI-triggered action is also reachable via normal UI.

### 3. Tools contributed by core + plugins (namespaced)

Core registers generic tools (create/manage character, campaign, assets, …); **rule-system plugins**
contribute rule-specific tools (ADR 0006), **namespaced by plugin id** (DDD bounded contexts, ADR 0003
§9). The tool registry is assembled from what the user has enabled and is authorized for.

### 4. Agent loop (`packages/ai-agent`)

A **provider-agnostic agent loop**: takes the user message + the authorized tool set + read-model context,
calls `AiProviderPort`, executes proposed tool calls **through the application layer** (authz + validation
enforced there), and returns results. Grounding context comes from **read models** via the same
authorization — never raw DB access. The port makes the loop **testable** with a fake adapter (ADR 0017).

### 5. EU AI Act & transparency

- AI output is **clearly labelled as AI-generated** (Art. 50 transparency).
- The user is told **which provider/model** is used and that, for non-local providers, **data is sent to a
  third party**. Local (Ollama) keeps data on-device.
- No hidden autonomous actions: the agent **proposes**, the app executes under the user's authority.

### 6. Safety

- **Prompt injection / untrusted output:** model output is **never trusted blindly**. Proposed tool calls
  are validated and authorized server-side exactly like user actions; the model cannot exceed the user's
  permissions. **Destructive/irreversible actions require explicit user confirmation.** Full threat model
  → ADR 0010.
- **Cost & abuse controls:** per-user/plan **rate limits** and **token budgets**; a cheap default model;
  local (Ollama) is free (ties to ADR 0013).
- **PII minimization:** prompts include only what is needed; sensitive data is minimized/redacted
  (with ADR 0015).

### 7. Provider config & data-flow policy

Config selects provider + model (per deployment, optionally per user), with an optional fallback chain.
Whether **external** providers are allowed is a **policy toggle** (default may be local-only until the
user consents to external data flow — decided with ADR 0015).

## Consequences

**Positive:** provider-swappable (incl. local data-sovereign option); AI is a thin, non-privileged
additional layer; AI-Act/DSGVO-aware; testable via a fake adapter; plugins extend the AI without core
changes.

**Negative / costs:** an agent loop + tool-authorization plumbing to build; tool descriptors must stay in
sync with the public API; cost/abuse controls needed; confirmation UX for destructive actions.

## Alternatives considered

- **Single hardcoded provider** (e.g. Claude only): rejected — lock-in, no local/sovereignty option.
- **Give the AI direct domain/DB access** for speed: rejected — breaks security and the frontend-first
  invariant.
- **Adopt a heavyweight agent framework as the architecture:** rejected as *architecture*; such a library,
  if used, is an **adapter detail** behind `AiProviderPort`/the agent loop, not the contract.

## References

- [ADR 0003](0003-overall-architecture.md) (ports, security §6, DDD §9), [ADR 0006](0006-plugin-system.md)
  (AI-tools capability), ADR 0009 (authorization), ADR 0010 (prompt-injection threat model), ADR 0011
  (API/tool mapping), ADR 0013 (cost controls), ADR 0015 (DSGVO/consent, external data flow), ADR 0019
  (analytics), ADR 0017 (fake-adapter tests). Issue #7.
