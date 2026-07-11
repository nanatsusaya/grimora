/**
 * Top-level component of the `apps/web` PWA shell — at #105-D the **first user-visible Grimora app**.
 *
 * It renders a minimal but real character-sheet flow (create character → view/edit traits → roll a check)
 * driven entirely through the reactive read-model view store (`state/character-view.ts`): the component
 * holds only thin ephemeral state (the new-character name field) and otherwise reads via
 * `useSyncExternalStore` (ADR 0012 §3/§4). All writes go through core use cases; nothing here touches the
 * event store or domain logic (ADR 0008 §2). Composed from `@grimora/ui` components + semantic design
 * tokens only (ADR 0007) — deliberately plain pending a later visual-design decision (owner, 2026-07-11).
 */

import { AppShell, Button, Field } from '@grimora/ui';
import { useState, useSyncExternalStore } from 'react';
import { clearAppCacheAndReload } from './clear-app-cache';
import type { CharacterView } from './state/character-view';

/** The DSA5 traits this minimal sheet lets the user edit (attributes 8–20, the PER skill 0–25). */
const EDITABLE_TRAITS: readonly {
  readonly id: string;
  readonly min: number;
  readonly max: number;
}[] = [
  { id: 'COU', min: 8, max: 20 },
  { id: 'AGI', min: 8, max: 20 },
  { id: 'INT', min: 8, max: 20 },
  { id: 'PER', min: 0, max: 25 },
];

/**
 * The application shell + character-sheet flow.
 * @param props       the component props
 * @param props.view  the reactive character-sheet view store (from the composition root)
 * @returns           the current screen, rendered from the view model
 */
export function App({ view }: { readonly view: CharacterView }) {
  const model = useSyncExternalStore(view.subscribe, view.getSnapshot);
  const [name, setName] = useState('Alrik');
  const sheet = model.sheet;

  return (
    <AppShell title="Grimora">
      {!model.ready ? (
        <p>opening local storage…</p>
      ) : (
        <>
          {model.error && (
            <p data-testid="error" style={{ color: 'var(--gr-color-text)' }}>
              ⚠ {model.error}
            </p>
          )}

          {!sheet ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void view.createCharacter(name.trim() || 'Alrik');
              }}
            >
              <Field label="Name">
                <input
                  aria-label="Name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  style={{ fontFamily: 'var(--gr-font-sans)' }}
                />
              </Field>
              <Button type="submit" onClick={() => undefined}>
                Create character
              </Button>
            </form>
          ) : (
            <section data-testid="character-sheet">
              <h2 data-testid="character-name" style={{ marginTop: 0 }}>
                {sheet.name}
              </h2>

              <h3>Traits</h3>
              {EDITABLE_TRAITS.map((trait) => (
                <Field key={trait.id} label={trait.id}>
                  <input
                    type="number"
                    aria-label={trait.id}
                    min={trait.min}
                    max={trait.max}
                    value={sheet.attributes[trait.id] ?? ''}
                    onChange={(event) => {
                      // Only commit values already within the trait's rule bounds: a partly-typed number
                      // (e.g. "1" on the way to "14") would otherwise fire a command that fails the use-case
                      // bounds check and flash a transient error. The use-case stays the real gate.
                      const next = Number.parseInt(event.target.value, 10);
                      if (!Number.isNaN(next) && next >= trait.min && next <= trait.max) {
                        void view.setTrait(trait.id, next);
                      }
                    }}
                    style={{ fontFamily: 'var(--gr-font-sans)', width: '5rem' }}
                  />
                </Field>
              ))}

              <h3>Derived</h3>
              {Object.entries(sheet.derived).map(([id, value]) => (
                <Field key={id} label={id}>
                  <span data-testid={`derived-${id}`}>{value}</span>
                </Field>
              ))}

              <h3>History</h3>
              <ul data-testid="history">
                {sheet.history.map((line, index) => (
                  // The history is an append-only, ordered list of pre-rendered lines; index is a stable key.
                  // biome-ignore lint/suspicious/noArrayIndexKey: ordered append-only log, index is stable
                  <li key={index}>{line}</li>
                ))}
              </ul>

              <Button onClick={() => void view.rollPerception()}>Roll perception</Button>
            </section>
          )}
        </>
      )}

      {/*
       * Maintenance action, always available (even while the stores are still opening). Clears the
       * service-worker/asset caches and reloads so a stale shell can be flushed from the UI without
       * DevTools (see `clear-app-cache.ts`). It does NOT delete the local character data or device
       * identity — only the code/shell caches.
       */}
      <footer
        style={{
          marginTop: 'var(--gr-space-lg)',
          paddingTop: 'var(--gr-space-md)',
          borderTop: '1px solid var(--gr-color-border)',
        }}
      >
        <Button onClick={() => void clearAppCacheAndReload()}>Clear cache &amp; reload</Button>
      </footer>
    </AppShell>
  );
}
