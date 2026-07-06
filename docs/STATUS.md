# Grimora — Projektstatus & nächste Schritte

> Lebende Handoff-Notiz zwischen Arbeits-Sessions. Zuletzt aktualisiert: **2026-07-06**.
> Verbindliche Architektur steht in den ADRs (`docs/adr/`); diese Datei ist nur die Fortschritts-/Übergabe-Übersicht.
> Stabile Arbeitsregeln (nicht der aktuelle Stand) stehen in `CLAUDE.md`.

## Wo wir stehen

- **Phase 0 (Fundament):** ✅ abgeschlossen — Monorepo-Gerüst (bun + Turborepo + biome),
  `tsconfig.base.json` (strict), CI (`.github/workflows/ci.yml`), `docker-compose` (Postgres + MinIO
  + self-hosted Auth via `gotrue` + optional Ollama), `packages/shared-types`, ADR-/`docs/legal/`-Struktur.
- **Phase 1 (Architektur als ADRs):** 🟡 läuft — das architektonische Fundament wird als ADRs
  erarbeitet und einzeln per PR gemergt. **10 ADRs Accepted** (0001–0010 + 0020). Das erste
  Implementierungs-Ticket (Conformance-Harness, #9) ist umgesetzt (`scripts/arch/` +
  `.dependency-cruiser.cjs`, als CI-`arch`-Step verdrahtet) — PR offen.
- **Repo-Zustand:** `main` synchron mit `origin/main`. `LICENSE` (MIT) liegt im Repo-Root. Alle
  gemergten Branches sind aufgeräumt (nur `main` verbleibt lokal wie remote).

### Angenommene ADRs (Accepted)

| ADR | Thema |
| --- | --- |
| 0001 | ADR-Prozess (+ Owner-autorisierte Amendments) |
| 0002 | Tech-Stack & Tooling (bun/biome/Supabase/Expo) |
| 0003 | Gesamtarchitektur: Hexagonal / Ports & Adapters + DDD (§9) + Security-by-Design (§6) |
| 0004 | Event Sourcing & CQRS |
| 0005 | Persistenz & Offline-first-Sync |
| 0006 | Plugin-System (Multi-Plugin-Aktivierung, Theme-Cascade) |
| 0007 | Theming (Design-Tokens SSOT, GM/Player/Hero-Cascade) |
| 0008 | KI-Provider-Abstraktion (Default Claude Haiku, extern erst nach Consent; §8 MCP als Future-Adapter) |
| 0009 | Cross-cutting: Error-Taxonomie, Logging (pino+Sentry), Auth (Supabase Cloud + self-hosted GoTrue), RBAC (Owner/GM/Player/Spectator) |
| 0010 | Security & Privacy by Design (STRIDE-Threat-Model, Plugin-Sandbox, `SecretsPort`/`CryptoPort`, Crypto-Shredding für DSGVO-Löschung, Security-Fitness-Functions für #9) |
| 0020 | Core-vs-Plugin-Grenze (regel-agnostisches Meta-Modell) |

### Neu: EU/DE-Compliance-Matrix

`docs/legal/eu-de-compliance-matrix.md` (PR #32) — lebende Tabelle aller recherchierten EU/DE-Regelungen
(DSGVO-Transfers, AI-Act Art. 50, Cyber Resilience Act, BFSG, DSA, NIS2, Data Act, Widerrufsbutton,
JMStV, Digital Fairness Act) mit Anwendbarkeits-Einschätzung, Frist und federführender ADR. Zwei
Fristen sind kurzfristig: **AI-Act Art. 50** (Chatbot-Offenlegung) am **2. Aug 2026**, **Widerrufsbutton**
ab **19. Jun 2026**. Zwei Themen (Widerrufsbutton, JMStV) haben noch keine federführende ADR — offene
Lücke für ADR 0010/0015.

## Nächste Schritte (revidierte Reihenfolge)

Reihenfolge nach externem ADR-Review (2026-07-07, s. u.) **umpriorisiert** — nicht mehr stur numerisch,
sondern implementierungs-blockierende ADRs zuerst. Alles unter **Epic #1**; Epic #10 = Phase 2
Kern-Engine (blocked).

1. **ADR 0011 — API-Design & Contracts** (#13) — entsperrt UI/AI/Sync/MCP/Error-Mapping. **← nächster Fokus.**
2. **ADR 0021 — Rules Execution: Formel/Würfel/deterministische Runtime** (#41, neu) — vor Plugin-SDK v0
   & DSA5; hängt an der Sandbox-Frage (DSL vs. beliebiger TS-Code).
3. **ADR 0017 — Testing-Strategie** (#19) — vorgezogen; muss vor Event-Store/Sync/SDK-Code stehen.
4. **ADR 0022 — Walking Skeleton / Golden Use Cases** (#42, neu) — dünner Durchstich als
   Architektur-Validierung, bevor breit Phase-2-Code entsteht.
5. **ADR 0015 — Compliance-Ops + Consent** (#17) — früh (Impressum-Lücke, AI-Consent-Scoping = Constraint E).
6. **ADR 0012** (#14, vor `apps/web`) · **ADR 0014** (#16, vor Cloud-Sync/echten Nutzern).
7. **Backlog mit Auslöser** (nicht jetzt blockierend, trigger-gebunden): ADR 0023 Event-Payload-Privacy
   (#43, vor echten Aggregaten), ADR 0024 Realtime/Presence (#44), ADR 0013 Perf-Budgets (#15),
   ADR 0019 Analytics (#23), ADR 0016 a11y/i18n (#18); ferner Asset-Pipeline, Plugin-Registry/Signing,
   Authz-Matrix-Tiefe, Conflict/Undo-UX, Search, Notifications, Monetization, Mobile-Security, Plugin-DX.

Die Harness-Regeln (#9, gemergt) parallel erweitern, sobald `core-domain`/Adapter/Plugins tatsächlich
entstehen (die vorausschauenden Regeln greifen dann automatisch).

### Externes ADR-Review (2026-07-07) — Einordnung & Konsequenzen

Ein externes Review bewertete die accepted ADRs (0001–0010, 0020) als **überdurchschnittlich starkes
Fundament bei den statischen Architekturgrenzen**, mit echten Lücken beim *Laufzeitverhalten*. Daraus
abgeleitet (bewusst **nicht** die vollen ~10 vorgeschlagenen ADRs — vieles ist für ein Solo-/pre-revenue-
Projekt trigger-gebundenes Backlog):

- **Neue ADRs angelegt:** 0021 Rules Execution (#41), 0022 Walking Skeleton (#42),
  0023 Event-Payload-Privacy (#43), 0024 Realtime/Presence (#44).
- **Umpriorisiert:** 0011 API & 0017 Testing vorgezogen; Walking Skeleton als Phase-2-Eintritts-Gate.
- **Festgehaltene Constraints:**
  - *A:* Conformance-Harness um `shared-types`-Leaf-Guard erweitert (kein Import anderer Pakete) —
    eigener PR (`feat/arch-shared-types-guard`).
  - *D:* Event-Description-API muss bei crypto-geshredderten Feldern **graceful degradieren** → in #43.
  - *E:* AI-Consent muss **ressourcen-/gruppenbezogen** sein (fremde Spielerdaten im Prompt) → in #17.

### Follow-ups aus ADR 0010

- ✅ **Private Vulnerability Reporting** aktiviert (Owner, 2026-07-06).
- ✅ **`SECURITY.md`** im Repo-Root (verweist auf PVR, „keine öffentlichen Issues für
  Sicherheitslücken", unterstützte Versionen) — PR (chore/adr-0010-followups).
- ✅ **`.github/dependabot.yml`** — **nur `github-actions`** (wöchentlich). JS/TS-Version-Updates
  bewusst *nicht* über Dependabot: es aktualisiert `bun.lock` in bun-Workspace-Monorepos nicht
  ([dependabot-core#14223](https://github.com/dependabot/dependabot-core/issues/14223)), daher scheitert
  jeder JS-PR an `--frozen-lockfile`. JS-Sicherheitslücken deckt **Dependabot alerts** ab;
  Routine-Freshening manuell via `bun update`.
- ✅ **Owner-Toggle:** **Dependabot alerts** + **security updates** aktiviert (Owner, 2026-07-07,
  org-weit). Secret-Scanning + Push-Protection ebenfalls an → Dependency-Scanning-Gate aus ADR 0010 §7
  abgedeckt.

## Arbeits-Workflow pro ADR

1. Branch `adr/NNNN-slug` von aktuellem `main`.
2. ADR-Datei schreiben; Index-Zeile in `docs/adr/README.md` auf **Proposed** setzen.
3. PR öffnen (`Closes #<issue>`) mit den offenen Review-Fragen an den Owner.
4. Owner reviewt & merged.
5. `main` synchronisieren, Status **Proposed → Accepted** (ADR-Datei + Index), Branch löschen.

## Wichtige Randbedingungen (dürfen nicht verletzt werden)

- **Accepted ADRs** dürfen nur mit **ausdrücklicher Owner-Freigabe** geändert werden → Eintrag in der
  *Amendments*-Section (ADR 0001).
- **Bugs vor Features.**
- **DSA5-Plugin:** nur Mechanik/Struktur, **keine** urheberrechtlich geschützten Ulisses-Inhalte
  (`docs/legal/dsa5-content-boundary.md`).
- **`rulebooks/`** ist git-ignoriert (nur README getrackt) — Regelwerk-PDFs **niemals** committen.
- **Secrets/API-Keys** nur am Composition Root, nie in Domain/Plugins/Logs.
- **KI:** externe Provider erst nach Consent; KI hat keinen privilegierten Pfad (Tools = öffentliche API).

## Verweise

- Architektur-Entscheidungen: `docs/adr/` (Index: `docs/adr/README.md`)
- Vision/Roadmap/Hosting: `docs/vision.md`, `docs/roadmap.md`, `docs/hosting.md`
- Regelsystem-Vergleich: `docs/research/rule-systems-comparison.md`
- EU/DE-Rechtslage: `docs/legal/eu-de-compliance-matrix.md`
- Stabile Arbeitsregeln für Claude Code: `CLAUDE.md`
- GitHub-Backlog: Epic #1 (Phase 1), Epic #10 (Phase 2, blocked)
