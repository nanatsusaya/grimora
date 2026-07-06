# Wiederkehrende Wartungsaufgaben

Standing operational checks — **im Repo getrackt (geräteunabhängig)**, damit sie unabhängig vom
verwendeten Rechner erhalten bleiben. Claude prüft diese Liste **zu Session-Beginn**; ist eine
Aufgabe fällig (Intervall seit „zuletzt geprüft" verstrichen) und arbeiten wir gerade am Projekt,
führt Claude sie proaktiv aus und **aktualisiert danach das Datum hier per Commit**.

> Verweisstelle: `CLAUDE.md` (Working conventions) zeigt auf diese Datei, damit der Check zuverlässig
> in den Kontext geladen wird.

## Aktive Aufgaben

### Dependabot `bun.lock` — Workspace-Bug beobachten (wöchentlich)

- **Intervall:** wöchentlich, gekoppelt an gemeinsame Projektarbeit (kein unbeaufsichtigter Cron).
- **Zuletzt geprüft:** **2026-07-07** · **nächste Prüfung fällig ab: 2026-07-14**.
- **Kontext:** Dependabot aktualisiert `bun.lock` in bun-**Workspace**-Monorepos nicht
  ([dependabot/dependabot-core#14223](https://github.com/dependabot/dependabot-core/issues/14223); vgl.
  auch #11602), daher scheitern JS/TS-Version-Update-PRs an `bun install --frozen-lockfile`. Deshalb ist
  `.github/dependabot.yml` auf **github-actions only** beschränkt (PR #47); JS-Sicherheitslücken deckt
  **Dependabot alerts** ab, Routine-JS-Updates laufen manuell via `bun update`.
- **Prüfen:** Status von dependabot-core#14223 (geschlossen/gefixt?) —
  z. B. `gh issue view 14223 --repo dependabot/dependabot-core --json state,title` oder WebFetch. Im
  Zweifel empirisch: temporär einen `bun`-Ökosystem-Block eintragen und beobachten, ob ein
  Dependabot-PR die `bun.lock` mitzieht.
- **Wenn gefixt → Aktion:** `package-ecosystem: "bun"`-Block in `.github/dependabot.yml` wieder
  aufnehmen (wöchentlich, minor/patch gruppiert), Workaround-Notizen in `dependabot.yml` + `STATUS.md`
  anpassen, und diese Aufgabe hier auf „erledigt" setzen bzw. entfernen. Als Branch + PR.
- **Nach jeder Prüfung:** das „Zuletzt geprüft"-Datum oben aktualisieren (Commit), samt kurzer
  Fund-Notiz falls relevant.
