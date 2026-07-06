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

## Nächste Schritte (in dieser Reihenfolge)

1. **Conformance-Harness-PR mergen** (#9) — danach `main` syncen & Branch löschen.
2. **Weitere ADRs**: ADR 0011–0017 (Issues #13–#19), ADR 0019 (Analytics/Telemetry, #23).
   Alles unter **Epic #1** (Phase-1-Architektur). Epic #10 = Phase 2 Kern-Engine (blocked).
   Die Harness-Regeln parallel erweitern, sobald `core-domain`/Adapter/Plugins tatsächlich entstehen
   (die vorausschauenden Regeln greifen dann automatisch).

### Offene Follow-ups aus ADR 0010

- ✅ **Private Vulnerability Reporting** aktiviert (Owner, 2026-07-06).
- ⬜ **`SECURITY.md`** im Repo-Root anlegen (verweist auf PVR, „keine öffentlichen Issues für
  Sicherheitslücken", unterstützte Versionen).
- ⬜ **Dependabot security updates** aktivieren (Repo-Setting; Secret-Scanning + Push-Protection sind
  bereits an) — gehört zur CI-Dependency-Scanning-Anforderung aus ADR 0010 §7.

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
