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

> **Backfill note.** The entries dated 2026-07-06 below were reconstructed retroactively (on 2026-07-07,
> by a third session) from a manually-exported transcript of the second working session — this log did
> not exist yet while that work happened, and the second session ended before it could be asked to
> self-backfill (unlike the first session, which was still live and backfilled its own history directly;
> see the note above). Dates are anchored by the ADR `Accepted` dates recorded in the ADR files (0009,
> 0010 on 2026-07-06; 0011 on 2026-07-07, the session's last working item before "Feierabend").

## 2026-07-06 — Owner amended an Accepted ADR immediately rather than deferring the fix

**Trigger:** The owner asked a structural question before continuing with ADR 0009 — if most features
live in plugins and a future MCP server must expose the whole app to an AI agent, don't plugins need
their own well-defined API? — and asked to be corrected if the reasoning was flawed.

**Action / method:** The reasoning was checked against ADR 0003/0006/0008/0020: the premise (plugins
carry most features) was correct, but the conclusion didn't hold — the project had already solved this
differently (a single tool registry over the public API, plugins register in-process via the SDK, no
per-plugin network surface). What was missing was that MCP itself was never named anywhere as a consumer
of that registry. Proposed noting this as a future refinement in the still-unwritten ADR 0011. The owner
overruled that: *"Meinst du nicht, wir sollten das in die adr 0008 schreiben? Ich kann eine änderung
nachträglich immernoch bewilligen."* — i.e. amend the already-`Accepted` ADR 0008 now, using the
owner-authorization path (ADR 0001), rather than let a known gap sit unrecorded until 0011's turn.

**Impact:** ADR 0008 gained §8 (MCP as a future additional inbound adapter over the existing tool
registry) same-day, as an owner-authorized amendment (PR #30) — instead of the clarification waiting,
unrecorded, for ADR 0011 (which didn't land until the next day).

**Lessons learned:** When a real gap in an Accepted ADR surfaces mid-conversation, my default was to
defer the fix to "the ADR that will own this eventually" — the owner's instinct was the opposite: fix the
record now, using the amendment mechanism that exists exactly for this, rather than carry a known-but-
unrecorded gap forward. Don't default to deferral when a lightweight, correct fix (an amendment) is
already available.

## 2026-07-06 — Deliberately open-ended legal research brief ("also check what I haven't thought of")

**Trigger:** Before ADR 0010, the owner asked for research on DSGVO, AI Act, CRA and accessibility law —
then explicitly widened the brief: *"Auch alles was mir hier spontan nicht einfällt, möchte ich dass du
mit beachtest, sprich mach eine entsprechende online recheche."* Also asked about legal specifics of
hosting under a `.game` domain.

**Action / method:** Ran a broad web-research pass beyond the named laws and surfaced regulations the
owner hadn't asked about by name (DSA notice-and-action, NIS2, EU Data Act, JMStV/youth protection,
Fernabsatzrecht/Widerrufsbutton, the Digital Fairness Act proposal) plus the `.game`-TLD question.
Recommended against folding all of it into ADR 0010 directly — proposed a separate, living
`docs/legal/eu-de-compliance-matrix.md` reference table instead, so ADR 0010 and the later ADR 0015
could each cite it without duplicating the research.

**Impact:** `docs/legal/eu-de-compliance-matrix.md` (PR #32) — surfaced the Impressumspflicht gap (later
assessed as the single most time-sensitive finding, independent of revenue/company size) that a
narrower, DSGVO-only research pass would likely have missed.

**Lessons learned:** An explicitly open-ended research instruction ("also whatever I haven't thought of")
is a signal to widen the search past the named list, not just research the named items more thoroughly —
and a wide research result belongs in a dedicated reference doc, not stuffed into the ADR that triggered it.

## 2026-07-06 — Caught: `STATUS.md` had never actually been committed

**Trigger:** The owner asked, independently of the ADR 0010 track, whether `STATUS.md`'s content should
be moved into `CLAUDE.md`.

**Action / method:** The answer was no (the two files have different half-lives — `CLAUDE.md` stable
rules vs. `STATUS.md` living state — and merging them would force `CLAUDE.md` to churn every session).
While setting up `CLAUDE.md` via the `/init` skill and having it reference `docs/STATUS.md`, it surfaced
that `STATUS.md` was **git-untracked** — it had existed only as a local file and was never actually part
of any commit, meaning a fresh checkout would have had `CLAUDE.md` pointing at a file that didn't exist.

**Impact:** `STATUS.md` was committed for the first time in the same PR (#33) that added `CLAUDE.md` —
a real, silent gap (not a hypothetical one) caught only because a different, unrelated question happened
to touch the same file.

**Lessons learned:** "Is X tracked/committed?" is worth checking explicitly whenever a file that *feels*
foundational turns out to matter to a new decision — a file can look load-bearing in every session's
context while never having actually entered version control.

## 2026-07-06 — ADR 0010's O1–O5, explained in German, and a correction on the reporting channel

**Trigger:** The owner didn't understand five open-question bullets in PR #36 (ADR 0010) and asked for a
plain-German walkthrough with background, alternatives and a recommendation for each.

**Action / method:** Explained each (sandbox timing, crypto-shredding vs. tombstones, field-vs-transparent
encryption, Impressum/JMStV routing, vulnerability-reporting channel) in accessible terms before the
owner decided. On O5, the owner asked whether public GitHub issues could serve as the vulnerability
report channel — corrected this: public issues would disclose a zero-day before a fix exists; recommended
GitHub's **Private Vulnerability Reporting** instead, explained why, and the owner adopted it and enabled
it that session.

**Impact:** All five decisions were made informed (not rubber-stamped from an unreadable bullet list), and
a plausible-but-actually-unsafe process choice (public issues for security reports) was caught before it
became the documented convention.

**Lessons learned:** When open questions get a "I don't understand this" back, re-explaining accessibly
*before* the owner decides is the right move over re-stating the same bullets more tersely — and a
follow-up question from the owner ("can we just use X?") should be evaluated on its own merits, not
treated as an implicit approval to fold in.

## 2026-07-06 — Conformance harness: an honesty check, not just a green run

**Trigger:** Issue #9's acceptance criterion said the harness must make "a deliberate boundary violation"
fail, not just pass on clean code.

**Action / method:** After the harness reported green on the real (still mostly-empty) module tree, a
real violation was injected on purpose — a `core-domain` file importing `node:fs` — to confirm `bun run
arch` actually turns red (exit 1, clear message) before removing it again and committing.

**Impact:** The harness's core guarantee was verified empirically, not just asserted from the fixture
tests, before PR #37 was opened.

**Lessons learned:** For any gate whose entire purpose is "fail when it should," a green run on legitimate
code proves nothing about whether it actually catches the bad case — the honest verification is to
briefly introduce the bad case for real and watch it fail, matching this project's later "verify, don't
assert" habit (see the bun/biome entry above) applied to infrastructure, not just claims.

## 2026-07-07 — The external ChatGPT ADR review: a real cross-check, partially adopted

**Trigger:** The owner pasted a long, unprompted review — obtained by asking ChatGPT to evaluate the
Accepted ADRs (0001–0010, 0020) and judge what's missing — and asked whether the plan needed to change
as a result.

**Action / method:** Read the review in full and checked every claim against the actual ADR text rather
than accepting or dismissing it wholesale. Agreed with several real findings (no ADR owns rules/dice
execution; the testing-strategy ADR was sequenced too late for an event-sourced system; a "walking
skeleton" validation gate was missing; AI-consent didn't account for other players' data leaking into a
GM's prompt; crypto-shredding needed to reconcile with human-readable event descriptions). Explicitly
pushed back on the review's scale: it proposed ten new ADRs (0021–0030); assessed that as over-fitted to
a "cover every conceivable gap" reviewer incentive rather than this project's actual solo/pre-revenue
stage, and also flagged an internal tension in the review itself (it says "don't start Phase 2 until many
ADRs exist" and separately "build a walking skeleton first" — resolved by pulling the skeleton *forward*
with only the truly-blocking ADRs, rather than writing all ten speculatively).

**Impact:** Four net-new ADRs (0021–0024, not ten), `docs/STATUS.md`'s roadmap reprioritized, two
"cheap wins" captured immediately (a `shared-types` leaf-guard fitness function; the AI-consent
resource-scoping gap noted against ADR 0015's issue) — all recorded in `docs/STATUS.md`'s "External ADR
review" section already, but the *reasoning process* (what was kept vs. rejected, and why) lived only in
this transcript until now.

**Lessons learned:** This is the clearest positive data point yet for the owner's cross-model-review
habit — it surfaced a real, load-bearing gap (Rules Execution, later written as ADR 0021) that no amount
of re-reading the existing ADRs solo would likely have caught, because the gap was an *absence*, not an
error in what existed. But the value came from treating the review as a set of individually-checkable
claims, not a verdict to accept or reject in bulk — the "ten new ADRs" framing would have been actively
harmful (analysis paralysis) if adopted wholesale instead of triaged against project stage.

## 2026-07-07 — A second ChatGPT review (of `CLAUDE.md` itself) caught referencing a stale snapshot

**Trigger:** The owner ran the same cross-check pattern again, this time asking ChatGPT to review
`CLAUDE.md` for agent-guardrail gaps, and pasted the result.

**Action / method:** Before adopting anything, re-read the *current* `CLAUDE.md` (post-PR-#49) and
checked the review's claims against it — found that roughly half the suggestions were already implemented,
with one clear tell: the review claimed `arch` was missing from the mandatory-checks list, but it had
been part of the Definition of Done for a while. That is strong evidence the review was working from a
cached/earlier fetch of the file, not its current state. Adopted only the genuinely net-new items (7 of
~10 proposed guardrail rules) rather than the full block, and explicitly credited the review's own
closing caution ("don't let this file balloon into a shadow-ADR") as the reason to be selective rather
than exhaustive.

**Impact:** `CLAUDE.md` gained a tight, 7-rule "Agent guardrails" section (PR #50) instead of a
near-doubling of its size; a follow-up "is CLAUDE.md too big now?" question led to measuring it in actual
tokens/lines rather than going on feel, and a targeted trim (PR #51, 232→217 lines, no rule lost).

**Lessons learned:** A cross-model review's *inputs* need the same scrutiny as its conclusions — a
plausible-sounding critique built on stale context will confidently recommend re-adding things that
already exist. Always re-read the current state of what's being reviewed before comparing it against
external feedback, not just after.

## 2026-07-07 — Skills proposal skepticism: owner and agent independently converged on "build one, not forty"

**Trigger:** The owner had separately asked ChatGPT whether specific Claude Code skills should be added
to the project, got back a list of ~40 candidate skills, and brought it in already skeptical: *"Die
Ergebnis liste ist sehr lang und ich bin bei der liste skeptisch."*

**Action / method:** Rather than defer to the owner's skepticism or the list's volume, worked out an
independent, falsifiable criterion first: `CLAUDE.md` holds always-on invariants loaded every session;
Skills are on-demand, situational, multi-step *procedures* — a rule that must hold on every change belongs
in `CLAUDE.md`, not a Skill that might not trigger. Applying that test to all ~40 proposals showed most
either duplicated guardrails already in `CLAUDE.md` or overlapped with built-in `/code-review` and
`/security-review`. Only one proposal (`grimora-adr-author`) was a genuine multi-step, situationally-
triggered procedure not already covered — recommended building only that one.

**Impact:** `.claude/skills/grimora-adr-author/` (PR #55) — the project's only Skill at the time, later
reused directly for ADR 0021. Session ended with a noted-but-deferred idea for a second Skill
(`/feierabend`, a session-close checklist) rather than building it immediately.

**Lessons learned:** The owner's skepticism was the right instinct, but the useful response wasn't
agreeing or disagreeing with the *feeling* — it was finding a sharp test (always-on rule vs. on-demand
procedure) that could evaluate all 40 items mechanically and explain *why* most should be rejected, not
just that they should be. A named criterion generalizes to the next tooling proposal; "that list feels
too long" doesn't.

## 2026-07-07 — Periodic ticket-hygiene self-audit, prompted by the owner asking three plain questions

**Trigger:** After a run of merged PRs, the owner asked three simple questions about the GitHub issue
backlog: are the open tickets still current, are they content-wise adequate, and is anything foreseeably
missing that isn't ticketed yet?

**Action / method:** Pulled every open issue and checked it against actual repo state rather than trusting
issue metadata at face value — found the four ADR issues created earlier that same session (#41–#44) were
orphaned (not linked as Epic sub-issues, no labels, no milestone, unlike every other ticket) and that
their priority labels didn't match the just-reprioritized roadmap; found ADR 0011's ticket (#13) was
thinner than the project's current knowledge (didn't cross-reference decisions made since it was written).
Fixed all four findings (metadata, sub-issue links, enriched #13, a new backlog-tracking Epic #52 for
trigger-gated topics) in one pass rather than only answering the three questions narratively.

**Impact:** Epic #1 went from undercounting sub-issues (11/19) to a complete, accurate 23; ADR 0011's
ticket was "Definition-of-Ready"-complete before work started on it; deferred backlog topics got one
visible home (#52) instead of living only as prose in `STATUS.md`.

**Lessons learned:** A periodic "is our tracking still honest?" audit — not tied to any specific PR or
ADR — surfaced real drift (orphaned tickets, stale priorities) that no single task would have caught,
because each individual PR only touches the tickets it's working on, never the backlog as a whole.

## 2026-07-07 — Meta-log established: owner names AI-agent learning as the real goal

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

## 2026-07-07 — Owner-directed architecture-validation pass before writing the gate ADR (0022)

**Trigger:** After ADR 0017 merged, I proposed jumping straight to *writing* ADR 0022 (the walking-skeleton
gate). The owner redirected: *"mach erstmal die Architektur-Validierung, schau genau hin, lass dir dabei
zeit"* — do the validation first, look closely, take your time — and floated combining it with a
`/code-review ultra`.

**Action / method:** First assessed the `/code-review ultra` suggestion honestly and declined it as the
wrong fit here: I can't self-launch it (user-triggered/billed), and it reviews a *code diff* — on clean
`main` with essentially no code it would have nothing to chew on; this was a design/ADR-consistency
audit, not a code review. Did the validation inline instead: re-read the three ADRs not fresh in context
(0001/0007/0008), traced the ten-step golden use case (issue #42) through all 14 accepted ADRs, ran the
full local chain to confirm the foundation was actually green (not just assumed), and produced **seven
ranked findings (F1–F7) plus one positive** — deliberately framed as individually-checkable seams, not a
single verdict. Then wrote ADR 0022 with every finding folded into a Decision section.

**Impact:** ADR 0022 (accepted, PR #60) resolved a real cross-ADR tension — ADR 0017 §1 calls the walking
skeleton "the canonical first E2E suite," but that needs `apps/web`/ADR 0012 which is still `Planned`, so
the skeleton was scoped to a core/backend slice with the UI-E2E deferred (F1). Two latent seams became
explicit skeleton assertions instead of future surprises: the `shared-types` event-envelope extension
(F3) and — the subtler one — that a rebased/synced roll **carries** its stored result rather than
re-rolling (F4), which neither ADR 0021 nor 0005 states outright. And F2 kept the skeleton from silently
freezing the public plugin-SDK contract (→ provisional-v0 shapes + a dedicated freeze ADR, 0022 R3).

**Lessons learned:** The owner's instinct to insert an *explicit validation pass before* writing the gate
ADR beat my instinct to write the ADR immediately — a fresh re-read + end-to-end trace across the *whole*
accepted set (not just the ADRs a new one directly references) surfaces cross-ADR tensions a
single-ADR-scoped drafting pass structurally cannot. Also a useful data point for the project's
cross-check methodology (cf. the earlier "Cross-model review pattern: assessment" entry): a
**self-driven** validation — fresh re-read, concrete use-case trace, run-the-chain-to-confirm — is a
viable substitute for an external cross-check when the artifact is *design docs, not code*; the
deep-review tooling (`/code-review ultra`) is for code diffs, and naming that mismatch out loud is part
of picking the right method rather than the nearest-labeled one.

## 2026-07-08 — First real code: the walking skeleton (ADRs → implementation)

**Trigger:** With the blocking ADRs accepted (0011, 0021, 0017) and the gate defined (0022), the owner
said to build the walking skeleton (#61) — the project's first transition from *writing decisions* to
*writing code* against them.

**Action / method:** Built the thin vertical slice as four packages (`plugin-sdk`, `core-domain`,
`plugins/dsa5`, an `apps/skeleton-walk` composition root + a runnable `walk`), driven directly by the
harness rules and the ADRs rather than by re-deriving structure: e.g. the dependency-cruiser `core-no-adapters`
rule (which permits `core-domain → plugin-sdk`) settled where the plugin-contract types live. Validated
via ADR 0017's layers *and* by running the `walk` end-to-end (not just tests). All six ADR 0022 §9 pass
criteria green.

**Impact:** The gate did exactly what it was for — building against **real code** surfaced two things no
amount of ADR review had: (1) a **conformance-harness over-application** — the "single public entry
(`src/index.ts`)" fitness function wrongly applied to app composition roots (executable entries, not
imported libraries), now exempted for `apps/*`; and (2) a **linter-caught design smell** — the formula
`if`-node used a `then` property, which makes an object *thenable* (breaks `await`); biome's
`noThenProperty` flagged it, so it was renamed `whenTrue`/`whenFalse`. Both are exactly the "abstract
consistency ≠ buildable" risk the walking skeleton (ADR 0022 context) was created to catch. Merged as
PR #64; unblocks the plugin-SDK v0 freeze ADR (#62).

**Lessons learned:** A validation gate that *writes code* (not just a paper review) pays for itself the
moment the code meets the tooling: the harness and the linter each caught a real defect that the ADRs,
being prose, could not. Concretely for this project's method — leaning on the *already-enforced* rules
(the dependency-cruiser config) to make structural decisions is faster and more consistent than
re-arguing them, and "run the thing end-to-end, don't just pass tests" (CLAUDE.md's verify habit)
remained the highest-signal check — the runnable `walk` is what makes the slice legibly *work*, not just
be green.

## 2026-07-09 — Parallel cross-model audit of the whole accepted-ADR set

**Trigger:** After a critical self-review caught real gaps in ADR 0015 *only when the owner asked me to
recheck* (not on my first pass), the owner ran **two external models in parallel** — ChatGPT and Claude
Fable — over **all 16 accepted ADRs** and handed me both reports to evaluate ("would you agree? is it
worth addressing? be maximally critical"). This is the first *parallel, whole-corpus* external cross-check
in the project (earlier entries were single-reviewer or self-driven).

**Action / method:** Rather than accept or dismiss either report wholesale, I **verified the checkable
claims against the actual code and ADRs** before judging. That separation mattered:
- **Confirmed true** (against source): the formula AST has no `floor/ceil/round/mod` and unspecified `div`
  (`formula.ts`); the harness ships exactly 9 dependency rules, so ADR 0025 §7's "Added to the harness"
  was false; ADR 0004 §2 "metadata … no PII" is wrong (`actorId/deviceId/sessionId` are pseudonymous
  personal data); ADR 0021↔code drift (`diceTerm` vs `dice`); ADR 0003 plugin-dep wording vs. harness.
- **Confirmed false:** ChatGPT's loudest P0 — "the ADR index is broken, 0011/0015/0017/0021/0022 still
  Planned" — is factually wrong against `main` (all Accepted); its "make the index CI-blocking" ask is
  already implemented (`adr-index.test.ts`). A confidently-wrong flagship finding is itself a signal about
  how much to weight that reviewer's framing.
- **Convergence as signal:** where *both* independent models flagged the same thing — sync-trust
  (event-push without semantic validation), crypto-shred **key distribution** in offline multi-device,
  roll-seed **predictability**, metadata-PII — confidence is high; those became the priority set.

**Impact:** Four **owner-authorized amendments** to accepted ADRs (ADR 0001 route, recorded in each
*Amendments* section), split by kind: two errata (0025 §7 false-status; 0021 code drift) and three
substantive corrections (0021 formula-set extension `floor/ceil/round/mod` + `div` semantics; 0004
metadata-PII; 0015 Art. 49 vs. SCC/DPF transfer mechanism). Two implementation tickets (#75 formula-AST,
#76 the missing fitness functions). The **distributed-systems gates** (sync trust, key management, seed
fairness, sub-stream visibility, checkpoint backfill) were routed into the now-**pulled-forward** ADR 0023
(privacy/keys/metadata) and ADR 0024 (realtime/sync-trust), ahead of 0012/0014 — because both reviewers
independently judged them Phase-2 blockers, not backlog.

**Lessons learned:** (1) The gap the owner named is real and methodological: my walking-skeleton gate +
single-ADR-scoped reviews validated the **static** architecture and the **single-device** golden path, but
the **distributed** reality (multi-device sync trust, per-subject key distribution, seed predictability)
was never exercised — so those holes survived until a whole-corpus read hit them. A gate only catches what
it *runs*. (2) **Parallel** cross-model review beats serial/single: two independent reads let convergence
act as a confidence filter and let one model's confident error (the "broken index" P0) be caught by
checking source rather than by trusting the reviewer. (3) The agent's value-add on a review dump is
**verification, not deference** — checking each claim against the code reclassified roughly a third of the
findings (false, already-done, or over-stated for the project's stage) and kept the response from
amplifying an authoritative-sounding but wrong P0.

## 2026-07-09 — Owner's provenance question ("when did we decide Next.js?") caught an unjustified inherited decision

**Trigger:** While resolving ADR 0012's open questions (web rendering & frontend state), the owner
accepted all three recommendations but then asked a question that was not about the current ADR at all:
*"wann haben wir entschieden, dass wir Next.js verwenden werden?"* — where and when was the web framework
actually chosen?

**Action / method:** Rather than retroactively justify Next.js, I checked the record and reported what was
actually there: ADR 0002 listed `Web = Next.js` as a bare Decision bullet with **no rationale and no
alternatives** — its "Evaluated alternatives" section covered only pnpm and ESLint. So unlike bun and
biome (which the owner had explicitly made me *verify against primary sources* at kickoff — see the
2026-07-05 "verify, not assert" entry), the framework had been carried by inertia since the first stack
ADR, never evidenced. The owner then authorized doing the comparison the original ADR had skipped: an
objective survey of the major frontend frameworks — *not* just Next vs. Vite, but React Router 7,
TanStack Start, SvelteKit, Nuxt/Vue, SolidStart, Qwik and Angular — recommend two or three, and amend
ADR 0002 if the conclusion differed. Grounded in verified July-2026 sources, the analysis showed
Next.js's headline strength (SSR/RSC) goes **unused** by an offline-first PWA that is client-rendered
against the local store (ADR 0005/0012), while its weight and static-export/offline friction remain →
recommended **Vite + React** (keeps React/RN alignment for shared view-model logic, first-class PWA
tooling, largest ecosystem/AI-assist corpus). The owner chose it and authorized the amendment.

**Impact:** ADR 0002 amended (PR #87) with the rationale + alternatives it had always lacked (Next.js →
Vite + React); ADR 0012 was written on the corrected stack; ADR 0011 §9 and later `hosting.md` (PR #88)
were synced off the stale "Next.js". A decision implicit since 2026-07-05 became explicit and
evidence-backed — and changed in the process.

**Lessons learned:** A *provenance* question ("when did we decide X?") is a distinct, high-yield audit
tool from a *correctness* question ("is X right?") — it targets decisions inherited by inertia, which a
correctness review can miss precisely because they look settled. The tell here was an **asymmetry in
rigor within a single ADR**: in ADR 0002, the choices the owner had pushed to verify (bun/biome) were
well-evidenced, while the one he had not (the web framework) had no rationale at all — so "which of our
'decisions' were ever actually *decided*?" is worth asking periodically across the accepted set. And the
honest answer to the question is to read the record and report the gap plainly ("it was never
justified"), not to construct a justification after the fact.

## 2026-07-09 — Second cross-model round, now *code-verified*: it found a bug in my own ADR

**Trigger:** The owner ran the same parallel cross-model pattern a second time (ChatGPT + Claude Fable
over the whole repo at the ADR-run's end) and pasted both reports, asking for my assessment and whether
anything needed fixing before Phase 2. Unlike the first round (2026-07-07, mostly prose over ADR text),
**both models this time were code-grounded** — Fable cited `file:line`, ChatGPT linked raw source — so
the reports made concrete, checkable claims about the actual code, not just the ADRs.

**Action / method:** I applied the now-established discipline — **verify every checkable claim against
the source before judging** — and read ~12 real files (`.dependency-cruiser.cjs`, the arch tests,
`character.ts`, `use-cases.ts`, `sync-harness.ts`, `fakes.ts`, `events.ts`, `describe.ts`, `ports.ts`,
`shared-types`). The results, and what made this round different from the last:
- **No confidently-false flagship this time.** The first round's loudest claim (ChatGPT's "the index is
  broken") was factually wrong; here every load-bearing claim I checked was **true against source** — a
  signal the reviews were trustworthy, so I could act on the convergent core rather than triage half of
  it away.
- **The strongest finding was an *interaction seam*, not an error inside one ADR.** Fable's C10: ADR 0024
  §4 hides rolls by **stream routing**, but a roll's seed sequence folds only from its owning aggregate's
  stream (`character.ts applyCharacter`), so routing a hidden roll off that stream would **reuse the
  seed**. Two ADRs each internally correct; their *combination* wrong. Only a whole-corpus read finds
  that — the class of gap a single-ADR review structurally cannot.
- **A finding hit my *own* work.** ADR 0014 §2 (which I had written days earlier) claimed the fitness
  functions were "already enforced by CI" — the exact overclaim ADR 0025 §7 had been amended for the day
  before. I **conceded and corrected it** rather than defend it; the author being the reviewee is not a
  reason to weight the finding less.

**Impact:** Four PRs (#89 harness scope-holes — plugin→plugin/plugin→node/deep-import/secrets-port-path;
#90 CI reproducibility — bun+action pinning; #91 owner-authorized ADR amendments — the C10 seed×visibility
seam in 0024 §4 + 0021 §3, and the 0014 §2 erratum; #93 doc accuracy + skeleton boundaries), plus #76
expanded and a new #92 (the ADR 0023 skeleton-classification refactor, previously unticketed), plus an
**explicit Phase-1 close-out cut** in `STATUS.md`. The owner added a standing steer — **"explizit ist
immer besser als implizit"** — which reshaped *how* each fix was made: every latent assumption the review
found was also **stated at its site** (the seed/stream invariant in code and ADR, the harness's
"import-boundaries-only" reach, the secrets-port layout contract, the existence-oracle convention, the
`replicate` version-uniqueness gap).

**Lessons learned:** (1) A **code-verified** external review is a materially higher-signal instrument than
a prose one — the claims are falsifiable against source, and the verification pass, though it reclassified
nothing as false this time, is exactly what let me *trust the convergence* and catch the one finding that
landed on my own ADR. (2) **Interaction seams between two separately-correct ADRs** are a distinct failure
mode from errors within an ADR; parallel whole-corpus review is the tool that surfaces them, extending the
prior round's "a gate only catches what it runs". (3) The owner's **"explicit > implicit"** rule is a
strong general principle for AI-agent-legible code: the assumptions a fresh model (or a future agent)
trips on are precisely the unstated ones, so encoding them at the site is cheap insurance — and it turned
a defect-fixing batch into a documentation-hardening one. (4) Being the author of a flagged artifact is
not grounds to discount the flag; conceding my own ADR 0014 §2 error kept the review honest.

## 2026-07-09 — Third cross-model round, aimed at *documentation quality* — it exposed an ambiguity in our own rule

**Trigger:** The owner restated a long-standing standard — *"jede funktion, jeder parameter, jeder typ und
auch jedes property eines types [soll] angemessen dokumentiert werden … Es soll nicht sagen, was passiert,
sondern warum"* — and asked me to judge, against exactly that bar, whether the walking-skeleton's dummy
code was already adequately documented. He had put the same question to ChatGPT and Claude Fable and pasted
both reviews, asking whether I agreed and where to adjust. Same parallel cross-model pattern as the two
prior rounds, but pointed for the first time at **code-comment quality against the owner's own written
standard**, not at the ADRs/architecture.

**Action / method:** Applied the now-established verify-not-defer discipline — re-read ~15 source files
under the documentation lens before judging — and confirmed both reviews were accurate against source
(again no confidently-false flagship). The value-add was **disentangling three problems the reviews
conflated**: (1) genuinely *missing* coverage, (2) *what-not-why* comments that paraphrase the code, and
(3) real *contract gaps* where the missing doc hid a load-bearing invariant — the standout being that
`EventStorePort.readStream/readAll` are **exclusive** on `fromVersion`/`fromPosition`, which the projection
checkpoint silently depends on. But the more consequential finding sat *upstream of the code*: the standard
itself was **ambiguous** — CLAUDE.md said "never single-line `/** … */`", which could mean *headers* must be
multi-line, or that *every property doc* must be too. Rather than silently pick a reading and patch comments
to match, I surfaced the ambiguity to the owner as an explicit choice (`AskUserQuestion`): he chose the
**refined** reading (multi-line headers + `@param` always; property docs may be single-line but must carry
the *why/contract*, not restate the type) and a **lightweight machine check**. I then (a) rewrote the
CLAUDE.md rule to state that explicitly, and (b) built a `ts-morph` fitness function that enforces the
**presence** half — it enumerated exactly **32** violations, which became the objective worklist — then
fixed all 32 plus the verified contract-whys.

**Impact:** Two PRs, merged 2026-07-10: **#95** (CLAUDE.md rule disambiguated + a stale "only shared-types
has real code" line fixed) and **#96** (`doc-conformance.test.ts` wired into `bun run arch`, now 22 checks,
plus the full doc pass across ~15 files). A previously **subjective** quality bar ("is this documented
enough?") became a **measurable gate** for the checkable half, while the *why-not-what* judgement was
deliberately **left to review** — the check asserts presence, not semantics, and its own header says so, to
avoid pretending a machine can grade comment quality.

**Lessons learned:** (1) A cross-model review aimed at *the code against a stated standard* (not the
architecture) is a distinct, useful instrument — and its highest-value output here was not a code fix but
the discovery that **our own rule was ambiguous**. The right response to a rule a review trips on is to
**sharpen the rule and, where possible, machine-enforce it**, not just patch the instances — the previous
day's **"explizit > implizit"** applied one level up, to the *standard* itself rather than only the code.
(2) Splitting a fuzzy "quality" bar into a **machine-checkable half (presence)** and a **review-only half
(why-vs-what)** is more honest than either pretending a linter can judge semantics or leaving the whole
thing to feel — encode the objective floor as a gate so it cannot erode, keep the subjective ceiling a
human/agent call, and *say which is which at the check's site*. (3) Verify-not-defer held for a third round:
reading the files myself before judging is what let me separate the three conflated problem-classes and
locate the one contract gap (`readStream` exclusivity) that actually mattered, instead of treating the
review as a flat to-do list.

## 2026-07-10 — Owner probed for placation ("is this getue?") and I retracted my own proposed rule

**Trigger:** Asked to review whether my standing instructions should change, I proposed institutionalizing
the owner's earlier "explizit > implizit" steer as a new always-loaded CLAUDE.md rule (and had just added a
cross-model-review memory). The owner challenged it directly: would the rule *"lead to a visibly better
result, or is it just nice getue to placate me?"*

**Action / method:** I treated it as a real challenge, not a cue to defend my proposal — and **retracted the
CLAUDE.md rule**. Honest reassessment: a universal maxim ("explicit over implicit") is something every
competent agent already believes, gates nothing, is unfalsifiable, and overlaps existing *specific* rules
(the doc "why-not-what" rule, ADR governance) — so writing it down was unlikely to change behaviour. Its one
demonstrated behavioural effect had come from the owner stating it **live**, plus concrete mechanisms (the
doc-conformance check, harness assertions, in-situ invariants), not from a bullet. I kept only the items
with teeth: the cross-model-review **memory** (changes behaviour: verify-not-defer) and a concrete
`Closes #NN`-not-in-a-code-span caveat (PR #98 — prevents a real recurring bug, cf. issue #16).

**Impact:** The proposed rule was dropped; a named filter emerged for what belongs in CLAUDE.md — *does
writing it down change what an agent does?* Universal maxims fail it; checkable, trigger-attached rules
pass. CLAUDE.md stayed lean instead of gaining a platitude that dilutes its load-bearing rules.

**Lessons learned:** (1) A stated owner preference is **not** automatically a rule to enshrine — "turn every
steer into a bullet" is itself a bad heuristic that bloats the always-loaded file. (2) The owner actively
probes for sycophancy/placation, and the right response is honest reassessment **even against my own
proposal**; conceding "yes, that was closer to getue" is higher-value to a learning owner (see
[[owner-goal-agent-learning]]) than a confident defence. (3) The generalizable test — only write a rule
when it changes behaviour, and split a quality bar into a machine-checkable floor (encode as a gate) vs. a
review-only judgement — mirrors the doc-conformance split from the day before.

## 2026-07-10 — Owner: "be more attentive to your instructions" after an un-asked ADR amendment

**Trigger:** Kicking off Phase-2 implementation, I settled the offline-session-identity *question* with the
owner (via a multiple-choice), then went straight on to draft, commit and PR an **amendment to an Accepted
ADR** (0012 §13) — without a separate ask. The owner: *"Solltest du mich vor einem ADR-Amendment nicht
explizit um Erlaubnis bitten?"*, and after I acknowledged it: *"Sei aber aufmerksamer mit deinen
Anweisungen."*

**Action / method:** I conceded the miss rather than defending it, and named the actual error precisely:
answering the underlying product question is **not** authorization for the ADR-amendment *mechanism* —
CLAUDE.md lists "amending an Accepted ADR" as its own stop-and-ask trigger, independent of the content
decision. Saved it as a `feedback` memory ([[feedback-adr-amendment-needs-explicit-ask]]) generalized to
the whole stop-and-ask list. Then I **applied it live** on the next tickets: for #103 I surfaced the
native-vs-both-backends *scope* fork (it deviated from the ticket's written AC) before building; for #92 I
stopped and got the owner's pick on the **Redactable-wrapper design** *before* writing the new plugin-SDK
privacy contract (a public-API-defining change on the same list). Both were genuine forks, not reflexive
check-ins — #104 and #75, which had no open decisions, I ran straight through.

**Impact:** Recalibrated where the ask-line sits: the split is not "big vs small change" but "is this on the
stop-and-ask list (public API/SDK contract, Accepted-ADR amendment, core-vs-plugin boundary, …)" — and
answering an adjacent question never migrates a listed action off the list. Net effect this session: one
retroactive miss, then two correctly-surfaced decisions and two correctly-uninterrupted implementations.

**Lessons learned:** (1) Two checkpoints that look like one: settling a decision's **content** and getting
authorization for the **mechanism** that enshrines it are separate — collapsing them is how a stop-and-ask
trigger gets skipped. (2) "Be more attentive" is a calibration signal, not a command to ask about
everything — the correct response is a *sharper filter* (the CLAUDE.md list), demonstrated by continuing to
run decision-free tickets without interruption while stopping on the two that genuinely defined contracts.
(3) Concede a real miss plainly; it is worth more to a learning owner than a defence (cf. the prior day's
"getue" retraction, [[owner-goal-agent-learning]]).
