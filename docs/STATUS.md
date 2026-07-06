# Grimora — Projektstatus & nächste Schritte

> Lebende Handoff-Notiz zwischen Arbeits-Sessions. Zuletzt aktualisiert: **2026-07-06**.
> Verbindliche Architektur steht in den ADRs (`docs/adr/`); diese Datei ist nur die Fortschritts-/Übergabe-Übersicht.
> Stabile Arbeitsregeln (nicht der aktuelle Stand) stehen in `CLAUDE.md`.

## Wo wir stehen

- **Phase 0 (Fundament):** ✅ abgeschlossen — Monorepo-Gerüst (bun + Turborepo + biome),
  `tsconfig.base.json` (strict), CI (`.github/workflows/ci.yml`), `docker-compose` (Postgres + MinIO
  + self-hosted Auth via `gotrue` + optional Ollama), `packages/shared-types`, ADR-/`docs/legal/`-Struktur.
- **Phase 1 (Architektur als ADRs):** 🟡 läuft — das architektonische Fundament wird als ADRs
  erarbeitet und einzeln per PR gemergt.
- **Repo-Zustand:** `main` synchron mit `origin/main`; PR #32 (`docs/legal/eu-de-compliance-matrix.md`)
  offen, wartet auf Merge.

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
| 0020 | Core-vs-Plugin-Grenze (regel-agnostisches Meta-Modell) |

### Neu: EU/DE-Compliance-Matrix

`docs/legal/eu-de-compliance-matrix.md` (PR #32) — lebende Tabelle aller recherchierten EU/DE-Regelungen
(DSGVO-Transfers, AI-Act Art. 50, Cyber Resilience Act, BFSG, DSA, NIS2, Data Act, Widerrufsbutton,
JMStV, Digital Fairness Act) mit Anwendbarkeits-Einschätzung, Frist und federführender ADR. Zwei
Fristen sind kurzfristig: **AI-Act Art. 50** (Chatbot-Offenlegung) am **2. Aug 2026**, **Widerrufsbutton**
ab **19. Jun 2026**. Zwei Themen (Widerrufsbutton, JMStV) haben noch keine federführende ADR — offene
Lücke für ADR 0010/0015.

## Nächste Schritte (in dieser Reihenfolge)

Die **coding-blockierenden** ADRs zuerst — danach ist Phase 2 (echter Kern-Code) startklar:

1. **PR #32 mergen** (Compliance-Matrix) — kein Blocker, aber sollte vor ADR 0010 rein, da ADR 0010
   direkt darauf referenziert.
2. **ADR 0010** — Security & Privacy by Design (Threat-Model, Plugin-Sandbox) · Issue #12 — soll laut
   Owner-Vorgabe explizit auf DSGVO/AI-Act/CRA/BFSG **und** die übrigen Matrix-Punkte eingehen.
3. **Conformance-Harness** — Architektur-Konformität automatisiert in CI prüfen · Issue #9
   (erstes Implementierungs-Ticket; prüft u. a. Dependency-Regel & ADR-Index)

**Danach / geplant:** ADR 0011–0017 (Issues #13–#19), ADR 0019 (Analytics/Telemetry, #23).
Alles unter **Epic #1** (Phase-1-Architektur). Epic #10 = Phase 2 Kern-Engine (blocked).

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
