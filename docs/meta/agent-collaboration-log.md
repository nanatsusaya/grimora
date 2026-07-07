# Agent collaboration log

A running journal of **how** the owner and AI agents work together on Grimora — separate from the ADRs
(`docs/adr/`, which record architecture decisions) and `docs/STATUS.md` (which records project state).
This exists because a primary goal of the Grimora project is the owner's own skill-building in directing
and cross-checking AI coding agents; the RPG platform is the vehicle, not the sole point (see the
project's `MEMORY.md`/`owner_goal_agent_learning` note for agents picking this up cold).

**What goes here:** genuinely methodological moments — cross-checks against another model/agent, owner
corrections with their rationale, workflow experiments and their outcome. **What does not go here:**
routine task execution (that's what commit history and `STATUS.md` are for).

**Entry template:**

```
## YYYY-MM-DD — Short title

**Trigger:** how the topic came up.
**Action / method:** what was actually done.
**Impact:** what changed as a result (or didn't).
**Lessons learned:** what this suggests for next time, if anything.
```

This is a **living doc** — direct commits to `main` are allowed (CLAUDE.md, "Delivery workflow & PRs").

---

> **Backfill note.** The entries dated 2026-07-05 to 2026-07-06 below were reconstructed retroactively
> (on 2026-07-07) by the foundational session that authored ADRs 0001–0008 and 0020 — this log did not
> yet exist while that work happened. They are the project's *origin* methodology moments. The 2026-07-05
> date is anchored by the session's first-message timestamp (10:57Z) and the Accepted dates recorded in
> the ADR files; the 2026-07-06 rulebook-research date is inferred ("(date approximate)").

## 2026-07-05 — Project genesis: the founding brief

**What Grimora is for (the project goal).** Grimora exists to be an **engine-agnostic tabletop-RPG
platform**: a rule-system-*independent* core that manages characters, campaigns, NPCs/monsters and the
rules themselves, auto-generates figures (predefined + random values), binds image/asset libraries, runs
**offline-first with cloud sync** across web → iOS/Android → desktop, is extensible by third parties via
**plugins and themes** (frontend and backend each independently), carries user management + secure login,
persists via **Event Sourcing + CQRS** (except master data), and complies with current EU/German law.
Concrete rule systems are **plugins**; *Das Schwarze Auge 5* (DSA5) is the first, used only as the
reference example — the platform is meant to support, in principle, *any* RPG rule system. Everything is
documented as it is decided (ADRs), tickets are AI-workable, **bugs come before features**, and the whole
stack must run entirely on **localhost** as cheaply as possible. A parallel, equally-real goal is the
**owner's own skill-building in directing and cross-checking AI coding agents** — Grimora is the case
study for that (see this log's intro and the `owner_goal_agent_learning` memory).

**Trigger:** The owner's very first message to the project — a single, dense specification of the whole
vision (quoted verbatim below as the historical record; original German, unedited).

**Action / method:** Before any implementation, the owner asked for three deliverables — 100+ name
proposals, a hosting breakdown, and a list of the access/information I'd need — i.e. *plan and de-risk
first, build second*. I produced all three (the name list → **Grimora** was chosen; hosting → an EU
free-tier stack; the access list), and only then entered the architecture-as-ADRs phase.

**Impact:** Every later decision traces back to a requirement in this brief; these requirements *are* the
invariants the ADRs formalize (engine-agnostic core, plugin system, offline-first + ES/CQRS, multi-
platform, legal compliance, frontend-first control, bugs-before-features, document-everything).

**Lessons learned:** A founding brief this complete is worth preserving verbatim and returning to — it is
the ground truth against which scope creep and "did we honor the original intent?" can be checked. The
owner's instinct to demand a plan + hosting + access breakdown *before* code set the deliberate,
decide-then-build cadence the project still follows.

<details>
<summary>The founding prompt, verbatim (2026-07-05, original German)</summary>

> Ich möchte eine sehr komplexe Anwendung für das Rollenspiel Das Schwarze Auge im 5. Regelwerk entwickeln.
>
> * Diese Anwendung soll Charaktere verwaltbar machen
> * Den Spielleiter helfen Kampanien zu schreiben, und verwalten
> * Die Regeln des Rollenspiel Systems sollen einsehbar, verwaltbar und erweiterbar sein
> * Das alles soll online gespeichert und gehostet werden
> * Alles soll in einem Backend gespeichert werden und per API ansprechbar sein
> * Ich möchte am Anfang eine Webseite dafür haben, später soll es um Apps im iOS und Android Store erweitert werden und sogar als Desktop/Mac Anwendung nutzbar sein
> * Die Anwendung soll ein Basis Theme erhalten, aber um weitere Themes erweiterbar sein
> * Die Anwendung soll so gestaltet sein, dass andere Nutzer eigene PlugIns dafür schreiben können
> * Es braucht eine Nutzerverwaltung
> * Es braucht eine sichern Login
> * Das Backend soll erweiterbar sein, ohne das das Frontend angepasst werden muss
> * Das Frontend soll erweiterbar sein, ohne dass man das Backend anpassen muss
> * Die Anwendung soll Charaktere automatisch generieren können, welche mit vordefinierten Werten und mit eher zufälligen Werten
> * Die Anwendung soll Gegner in Form von Charakteren und Monster mit vordefinierten Werten und mit eher zufälligen Werten
> * Charaktere und Monster sollen Bilder und andere Assets zugeordnet werden, die man verwenden kann
> * Schließlich soll in den Anwendungen ein KI Chat angebunden werden. Indem man mit dem Bot schreibt sollen alle wesentlichen Funktionen der Anwendung mit dem Bot nutzbar sein. Anlegen neuer Helden, Anlegen neuer Kampanien, verwalten dieser Kampanien und Helden, verwalten der Anwendung.
> * Die Anwendung soll eine Vielzahl an vorgefertigten Assets bereit halten, insbesondere Bilder die man verwenden kann für Charaktere, Gegner, Monster, Maps, usw.
> * ACHTUNG: wichtig! Die Kernimplementierung der Anwendung soll unabhängig von dem Regelwerk Das Schwarze Auge 5. Regelwerkt implementiert werden. Das DSA 5. Regelwerk soll per PlugIn System hinzugefügt werden. Die Idee soll sein, dass die Anwendung theoretisch jede Form von Rollenspiel Regelsystem unterstützt. Im speziellen werden wir aber mit Das Schwarze Auge 5. Regelwerkt anfangen als Muster Beispiel.
> * Die Anwendung soll bei fehlender Internetverbindung lokal alles speichern, und bei wieder aktiver Internetverbindung sich wieder mit dem Server synchronisieren.
> * Abgesehen von Stammdaten sollen die Daten per Event Sourcing gespeichert werden, als Datenbank Architektur soll eine CQRS Muster verwendet werden.
> * Das Repository soll in GitHub liegen.
> * Die Anwendung soll alle aktuellen und demnächst ratifizierten Gesetzte beachten: DSGVO, AI EU Act, EU Cyber Resilience Act, usw.
> * Alles soll exakt Dokumentiert werden als Markdownfile in einem eigenen Ordner. Jede Entscheidung und der einsatz jeder Technologie soll festgehalten werden in einem entsprechenden review markdown File.
> * Die Anwendung braucht entsprechendes Logging, fortschrittliches Error Handling, sowohl im Frontend als auch Backend
> * Tickets sollen in GitHub angelegt werden und von KI Agenten bearbeitbar sein.
> * Die Anwendung soll gelintet werden, braucht ausgiebige Tests in allen wesentlichen formen.
> * Es braucht ein ausgiebigen Architektur Plan.
> * Die Anwendung muss nicht auf einmal fertig gebaut werden, sondern es soll ein schritt für schritt plan entwickelt werden, wie die Anwendung entwickelt werden soll und diese sollen in form von Tickets festgehalten und stückweise abgearbeitet werden.
> * Dabei ist wichtig, dass die Anwendung Bugs immer voranging abarbeitet, bevor es neue feature und Änderungen an der Software umsetzt.
> * Das gesamte Projekt soll durch KI Agenten entwickelt und verwaltet werden
> * Es soll ein Plan ausgearbeitet werden, wie und wo diese Anwendung am besten so kostengünstig wie möglich gehostet wird
> * Das Projekt soll komplett Localhost
>
> Das ist ein Großes Projekt.
> Ich brauche von dir bevor wir mit der Implementierung anfangen:
>
> * ein paar Vorschläge für den Namen des Projekts (liste mindestens 100 auf)
> * eine Aufschlüsselung wo und wie das Projekt gehostet werden soll
> * eine Auflistung, welche Informationen und Zugänge du brauchst für dieses Projekt

</details>

## 2026-07-05 — Kickoff correction: AI chat is a *secondary* control layer (frontend-first)

**Trigger:** My initial project plan positioned an AI chat as a primary way to drive the app.

**Action / method:** The owner corrected the framing before any code: *"der KI Chat ist eine zusätzliche
Steuerung, die Funktionen sollen in erster Linie durch Frontend eingaben steuerbar sein."* Rather than
treat this as a feature note, I promoted it to a load-bearing **invariant** and threaded it through the
architecture: every AI action must go through the same public API/use-cases the UI uses (no privileged AI
path), so the AI is genuinely *additional*.

**Impact:** Became a cross-ADR invariant — ADR 0003 (vision/ports), ADR 0008 §2 ("tools = existing public
API, no backdoor"), and later the whole plugin AI-tools model. It also constrains every future inbound
adapter (a future MCP server is "just another adapter over the same registry").

**Lessons learned:** The owner corrects *framing/invariants* at kickoff, not just details. Capturing a
one-sentence correction as an explicit, named invariant (and enforcing it structurally) pays off far more
than treating it as a passing preference — get the invariants stated before drafting ADRs.

## 2026-07-05 — Owner fixed the stack and asked me to *verify, not assert* (bun/biome)

**Trigger:** My plan leaned on a prior project (AdLessFeed) as a stack reference.

**Action / method:** Owner rejected the reference outright — *"Das AdLessFeed ist keine gute Referenz!"* —
and specified the stack (Node/TS, bun-Monorepo + Turborepo, Supabase, React Native/Expo, biome, modern
CSS). Crucially, they did **not** just decree it: they asked me to *check* whether bun could replace pnpm
and whether biome was actually better (*"Prüfe ob wir bun verwenden können… Ich bevorzuge biome, prüfe ob
das besser ist"*). I evaluated both against primary sources (Expo's official bun monorepo support; biome
2.0 type-aware linting) and confirmed both — with the one caveat that `eslint-plugin-react-hooks` has no
biome equivalent, so a minimal ESLint config stays. Recorded as ADR 0002 with the cited evaluations.

**Impact:** Stack decisions in ADR 0002 rest on verified capability, not assertion; the react-hooks caveat
was caught up front instead of in CI later.

**Lessons learned:** The owner treats my recommendations as *proposals to be evidenced*, and expects a
"prove it with primary sources" pass before a decision is written down — including surfacing the caveat
that complicates the clean answer. Default to citing sources for tool/library capability claims.

## 2026-07-05 — Reprioritization: architecture-as-ADRs before feature tickets

**Trigger:** I proposed a set of Phase-1 *feature* tickets as the next step.

**Action / method:** Owner pushed back and reordered priorities: the architecture must be worked out
**first** as ADRs, **tested against the code** (conformance harness), **flexible enough for large future
refactorings**, with **technologies staying swappable** — *"ist das nicht wichtiger als dein phase 1 ticket
vorschlag?"* I re-scoped all of Phase 1 to ADR authoring + the conformance-harness ticket (#9) ahead of any
core-engine code.

**Impact:** Set the entire working rhythm of the project (one ADR per PR, harness gating Phase 2). The
STATUS/roadmap "implementation-blocking ADRs first" ordering descends from this.

**Lessons learned:** The owner optimizes for long-term changeability over early feature velocity. When
unsure whether to *build* something or *decide/document* it first, decide-and-document — that is the house
style here, and it is deliberate.

## 2026-07-05 — Owner expanded ADR 0003 with a security-by-design checklist and invited disagreement

**Trigger:** Mid-drafting ADR 0003 (overall architecture), the owner asked whether "security by design"
belonged already in 0003, and supplied a large checklist of concerns, adding: *"Ich selber glaube das wir
alle brauchen. Oder bist du anderer Meinung?"*

**Action / method:** I treated the "or do you disagree?" literally — went through the checklist item by
item with a reasoned agree/keep/defer for each rather than accepting the list wholesale, and folded the
agreed items into ADR 0003 §6 (security & privacy by design). Also confirmed `apps/api` as a real backend
composition root in the same pass (the owner had flagged an ambiguous comment).

**Impact:** ADR 0003 gained a first-class security-and-privacy §6 (later deepened by ADR 0009/0010) instead
of security being an afterthought; the module map became unambiguous about the API.

**Lessons learned:** When the owner brings a checklist and explicitly invites pushback, the *expected*
response is a per-item reasoned judgement (including "defer this to a later ADR"), not blanket acceptance —
agreement-by-default would waste the invitation.

## 2026-07-05 — Owner-driven sequencing: settle the core/plugin boundary (0020) *before* the plugin contract (0006)

**Trigger:** I was about to write the plugin-system ADR (0006). The owner wanted the *boundary principle*
(what is core vs. what is plugin) recorded first.

**Action / method:** Wrote ADR 0020 (core-vs-plugin boundary) first, and — at the owner's explicit request —
built in a **revisability clause** for boundary cases (combat/initiative/status/inventory/bestiary =
"core scaffold + plugin rules, explicitly revisable") rather than pretending the boundary was final. Then
**revised** the already-drafted ADR 0006 to sit on top of 0020.

**Impact:** 0020 accepted before 0006; 0006 rewritten to reference the meta-model boundary. Downstream ADRs
(0007 theming, 0008 AI tools) could then lean on a stable boundary vocabulary.

**Lessons learned:** The owner sequences *foundational-principle* ADRs ahead of the *contract* ADRs that
depend on them, and wants uncertainty written *into* boundary decisions (an explicit "we may revise this")
instead of false finality. Order ADRs by dependency of principle, not by convenience of drafting.

## 2026-07-05 — Owner overrode ADR immutability and set the amendment-governance rule

**Trigger:** The owner wanted DDD folded into ADR 0003 — but 0003 was already `Accepted`, and the process
rule (ADR 0001) said Accepted ADRs are immutable.

**Action / method:** Instead of forcing a superseding ADR, the owner *changed the process rule itself*:
*"ich überschreibe einmal die Regel, dass ein Accepted ADR unveränderlich ist… Solche Veränderungen an
Accepted ADRs kann nur ich erlauben zukünftig."* I amended ADR 0001 to allow **owner-authorized**
amendments, required each to be logged in an *Amendments* section, then applied that to add DDD as ADR 0003
§9. This standing rule later propagated into CLAUDE.md and the project memory.

**Impact:** A durable governance rule the whole project now runs on (two documented direct-to-main
exceptions exist today — the ADR accept-flip and *this very meta-log* — both descend from that governance
posture).

**Lessons learned:** Process rules are owner-owned and the owner may change them deliberately. When an
Accepted ADR needs a change, the correct move is to *ask the owner*, then record an Amendment — never
silently edit, and never auto-spawn a superseding ADR without checking which path the owner wants.

## 2026-07-05 — Owner's "can it answer X?" question surfaced an architecture gap (ES ≠ analytics)

**Trigger:** The owner asked, in plain domain terms, whether the design could answer questions like *how
often do users log in / update characters — alone, or during a game session?*

**Action / method:** This exposed that Event Sourcing records **writes (state changes)**, not **reads/usage
telemetry** — so those questions can't be answered by replaying the event log alone. Rather than overload
the event log, I added envelope `context` metadata (sessionId / deviceId / online / participantsPresent) to
ADR 0004 §11 and opened a *separate* planned ADR 0019 for analytics/telemetry.

**Impact:** Analytics was cleanly separated from the domain event log from the start, avoiding a common
event-sourcing anti-pattern (stuffing usage tracking into domain events).

**Lessons learned:** A concrete "can the current design answer *this specific question*?" from the owner is
a cheap, high-yield way to stress-test an architecture *before* any code exists. Invite these; treat a
"no" as a design signal, not a defect to hide.

## 2026-07-06 — Comparative rulebook research to ground the core/plugin boundary ("take your time") *(date approximate)*

**Trigger:** To ground ADR 0020, the owner asked me to study seven rule systems (DSA5, D&D 5e, Pathfinder 2e,
Shadowrun, Star Wars FFG, Vampire, HeXXen 1733) and derive what is *genuinely universal* — probing pointedly:
is "characters with names and attributes" universal, or is the only commonality "there are characters and
NPCs"? — and explicitly: *"Lass dir ruhig Zeit."*

**Action / method:** Produced `docs/research/rule-systems-comparison.md` (a 7-system comparison table) and
derived the boundary from the evidence: the universal core is a *generic trait meta-model* (typed,
plugin-populated slots) + orchestration; the concrete attributes/skills/formulas/**dice mechanic** are
plugin. That evidence base became ADR 0020.

**Impact:** The core/plugin boundary — the single most load-bearing decision for an engine-agnostic platform
— rests on a documented comparison, not on generalizing from DSA5 alone.

**Lessons learned:** An explicit *"take your time"* from the owner is license to do real comparative research
for a foundational decision, not to produce a fast plausible answer. For "what is universal across X?"
questions, the honest method is to actually survey several X and write the comparison down.

## 2026-07-07 — Establishing the meta-log itself

**Trigger:** After finishing ADR 0021 (Rules Execution), the owner named the project's actual primary
goal explicitly: learning to work with AI agents, with Grimora as the case study. They asked for (a) a
running log of methodology decisions and their impact, (b) an assessment of an existing practice
(repeatedly asking ChatGPT for a second opinion on project state and showing the answer to Claude), and
(c) feedback on their own collaboration style.

**Action / method:** Proposed this log's structure and scope; recommended it stay a low-friction living
doc (direct-commit, not PR-gated) logging only methodological moments, not every session — owner
confirmed both via `AskUserQuestion`. Documented the direct-commit exception in `CLAUDE.md` alongside the
existing ADR accept-flip exception, and saved a `user`-type memory (`owner_goal_agent_learning`) so future
sessions pick up this framing without being re-told.

**Impact:** New repo convention (`docs/meta/`) + a durable memory entry; this file now exists.

**Lessons learned:** Meta/process requests from the owner (not just "build X") are a first-class category
of work here, not a distraction — worth recognizing and acting on proactively rather than waiting to be
asked to formalize them.

## 2026-07-07 — Cross-model review pattern: assessment

**Trigger:** Owner asked whether "show Claude a second opinion from ChatGPT" is a good method, and what
alternatives exist.

**Action / method:** Assessed the existing practice against one concrete data point already in
`docs/STATUS.md` — the 2026-07-07 external ADR review that produced ADRs 0021–0024 and a roadmap
reprioritization. Identified the method's real value (a model without this session's accumulated context
catches things the primary agent may have rationalized away) and its blind spot (routing the critique
*through* the critiqued agent for a fairness check risks defensive or over-corrective bias). Proposed
complementary methods: native fresh-context subagents (no tool switch needed), falsifiable/specific
questions instead of open "what do you think", explicit adversarial framing, and rubric-based review
reusing the existing ADR self-review checklist (`.claude/skills/grimora-adr-author/adr-review-checklist.md`)
for comparability over time.

**Impact:** No process change yet — recommendation given, no commitment made by the owner to adopt a
specific alternative. Revisit and log the outcome once one of these is actually tried on a real decision.

**Lessons learned:** n/a yet — pending a real trial.

## 2026-07-07 — Owner correction: `RollResult.outcome` as an i18n key (ADR 0021, O3)

**Trigger:** While resolving ADR 0021's open questions, the owner accepted the recommended "opaque,
plugin-defined outcome" default (O3) but asked whether the human-readable part could be an i18n key
rendered per-need, rather than a literal string.

**Action / method:** Confirmed this is consistent with (and should reuse) two patterns already Accepted
elsewhere in the project — `AppError.messageKey` (ADR 0009 §1) and event `describe()` (ADR 0004 §10) —
and folded it into ADR 0021 §2 as `RollResult.outcome`'s `labelKey`, rather than treating it as a
deviation from the recommendation.

**Impact:** ADR 0021's roll-result shape is more consistent with the rest of the codebase's i18n
convention than the original draft was; a real substantive improvement from the owner, not a rubber stamp
of the AI-drafted default.

**Lessons learned:** The owner catches cross-cutting consistency issues (i18n conventions used
elsewhere) that a single-ADR-scoped drafting pass can miss even after checking the directly-referenced
ADRs — a concrete argument for keeping the owner in the loop on Decision-section wording, not just on the
Open Questions, for anything touching a pattern that recurs across multiple ADRs.
