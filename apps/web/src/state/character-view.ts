/**
 * The **reactive character-sheet view store** for `apps/web` (#105-D) — the hand-rolled, dependency-free
 * one-way-reactivity layer the owner chose for ADR 0012 §3.
 *
 * The loop is: a UI action calls a **core use case** (never domain logic in the view, ADR 0008 §2) → the
 * use case appends events to the local OPFS event store → we run the `characterSheet` **projection** to
 * update the read model → we re-query the read model and **notify** subscribers → React re-renders. The
 * view reads state **exclusively** through the `ReadModelStorePort` (ADR 0012 §2/§11), never the event
 * store or core internals.
 *
 * It exposes the `subscribe` / `getSnapshot` pair React's `useSyncExternalStore` needs. `getSnapshot`
 * returns a **referentially stable** view-model — a fresh object is built only when state actually changes
 * — so React neither misses an update nor loops.
 *
 * The only persisted view state is *which* character/campaign is currently open (`localStorage`), so a
 * reload re-opens the same sheet from the durable read model (the #105-B persistence proof); the sheet
 * data itself is never duplicated here.
 */

import {
  CHARACTER_INDEX,
  CHARACTER_INDEX_KEY,
  CHARACTER_SHEET,
  type CharacterIndex,
  type CharacterIndexEntry,
  type CharacterSheet,
  createCampaign as createCampaignCommand,
  createCharacterWithAttributes as createCharacterCommand,
  rollCheck as rollCheckCommand,
  runCharacterSheetProjection,
  setAttribute as setAttributeCommand,
} from '@grimora/core-domain';
import type { EntityId } from '@grimora/shared-types';
import type { AppComposition } from '../composition/composition-root';
import { evaluateSyncGuard, getAccountBinding } from '../composition/offline-identity';

/** `localStorage` key for the currently-open campaign (created once, reused across reloads). */
const CAMPAIGN_KEY = 'grimora.current-campaign';
/** `localStorage` key for the currently-open character, so a reload re-opens the same sheet. */
const CHARACTER_KEY = 'grimora.current-character';

/** The rule system this milestone binds characters to (loaded at the composition root, #105-D). */
const RULE_SYSTEM_ID = 'dsa5';

/**
 * Starting trait values stamped on a freshly-created character so the sheet immediately shows the full
 * attribute set and every computed derived value / usable check. All **eight** DSA5 attributes are seeded
 * (not just the three the earlier skeleton set), so that any trait referencing them resolves rather than
 * showing a missing input — e.g. the Body Control check reads CON, which the three-attribute skeleton
 * never set. Values sit within the DSA5 bounds (attributes 8–20, skills 0–25); a real character-creation
 * flow is out of scope for this minimal milestone.
 */
const STARTING_TRAITS: readonly (readonly [string, number])[] = [
  ['COU', 12],
  ['SGC', 12],
  ['INT', 12],
  ['CHA', 12],
  ['DEX', 12],
  ['AGI', 12],
  ['CON', 12],
  ['STR', 12],
  ['PERCEPTION', 6],
  ['BODY_CONTROL', 6],
];

/** The immutable snapshot the UI renders. A new object is built only on an actual state change. */
export interface CharacterViewModel {
  /** why: false until the stores are open and the initial projection/query ran — lets the UI show boot state */
  readonly ready: boolean;
  /** the currently-open character's sheet, or undefined if none has been created yet */
  readonly sheet?: CharacterSheet;
  /**
   * all known characters (from the read-model index) so the UI can offer a picker — notably to open a
   * character that arrived via cloud **pull** (#107 slice 3b) and so has a sheet but is not the local
   * "current" one. Empty until the first projection runs.
   */
  readonly characters: readonly CharacterIndexEntry[];
  /** the last command's error code (e.g. an out-of-bounds attribute), shown inline; cleared on success */
  readonly error?: string;
}

/** The reactive store surface consumed by `useSyncExternalStore` plus the UI's command actions. */
export interface CharacterView {
  /**
   * Subscribe to state changes.
   * @param listener  called (with no args) whenever {@link getSnapshot} would return a new value
   * @returns         an unsubscribe function
   */
  subscribe(listener: () => void): () => void;
  /**
   * The current view model — referentially stable between changes (safe for `useSyncExternalStore`).
   * @returns the current {@link CharacterViewModel}
   */
  getSnapshot(): CharacterViewModel;
  /**
   * Open the stores, catch the projection up, and load the persisted character (if any). Call once on boot.
   * @returns resolves when the initial state is loaded and `ready` is true
   */
  init(): Promise<void>;
  /**
   * Create a campaign (once) + a DSA5 character with starting traits, and open its sheet.
   * @param name  the new character's name
   * @returns     resolves when the sheet is created and shown
   */
  createCharacter(name: string): Promise<void>;
  /**
   * Open an existing character from the index (the picker) — makes it the current character (persisted so a
   * reload re-opens it) and shows its sheet. This is how a character pulled from another device (#107 slice
   * 3b) becomes visible: it has a read-model sheet but was never the local "current" one.
   * @param characterId  the id of the character to open (from {@link CharacterViewModel.characters})
   * @returns            resolves when the sheet is shown
   */
  openCharacter(characterId: EntityId): Promise<void>;
  /**
   * Clear the current selection so the create form reappears — the "New character" affordance, so a user
   * who already has a sheet open can start another (without it, the picker could only ever list one
   * locally-created character). Purely local view state; creates nothing until the form is submitted.
   * @returns resolves once the create form is shown
   */
  newCharacter(): Promise<void>;
  /**
   * Set one trait value on the open character (a `character.setAttribute` command).
   * @param attributeId  the trait id (e.g. `COU`, `PERCEPTION`)
   * @param value        the new value; a rule-bounds violation surfaces as `error`, not a throw
   * @returns            resolves when the projection + sheet have updated
   */
  setTrait(attributeId: string, value: number): Promise<void>;
  /**
   * Roll the DSA5 perception check on the open character (appends a `character.checkRolled` event).
   * @returns resolves when the roll is stored and the history has updated
   */
  rollPerception(): Promise<void>;
  /**
   * Run a cloud sync (#107 slice 3): push local events, pull the account's cloud events + apply them
   * locally, and — if the pull applied anything — re-run the projection and refresh the open sheet so the
   * UI reflects cloud updates. Best-effort: a transport/auth failure is reported, never thrown. Also runs
   * automatically when a session becomes current (login / cookie-restore).
   * @returns a non-sensitive summary: whether both halves succeeded, and how many events were pushed/pulled
   */
  syncNow(): Promise<{ readonly ok: boolean; readonly pushed: number; readonly pulled: number }>;
}

/**
 * Create the reactive character-sheet view over a wired composition.
 * @param composition  the offline composition (command ports + read store + device identity)
 * @returns            the {@link CharacterView} store
 */
export function createCharacterView(composition: AppComposition): CharacterView {
  const { deps, reads, actor } = composition;
  const projectionDeps = { events: deps.events, reads, rules: deps.rules };

  const listeners = new Set<() => void>();
  let model: CharacterViewModel = { ready: false, characters: [] };

  /** Replace the model with a patched copy and notify subscribers (the single write path). */
  function setModel(patch: Partial<CharacterViewModel>): void {
    model = { ...model, ...patch };
    for (const listener of listeners) listener();
  }

  /** Run the projection so the read model reflects all events appended so far (idempotent, checkpointed). */
  async function project(): Promise<void> {
    await runCharacterSheetProjection(projectionDeps);
  }

  /** Re-query the open character's sheet from the read model **only** and publish it. */
  async function refresh(characterId: EntityId): Promise<void> {
    const sheet = await reads.get<CharacterSheet>(CHARACTER_SHEET, characterId);
    setModel({ sheet, error: undefined });
  }

  /** Re-query the character index (all known characters) and publish it for the picker. */
  async function loadCharacters(): Promise<void> {
    const index = await reads.get<CharacterIndex>(CHARACTER_INDEX, CHARACTER_INDEX_KEY);
    setModel({ characters: index?.characters ?? [] });
  }

  /** The currently-open character id from local view state, or undefined. */
  function currentCharacterId(): EntityId | undefined {
    return (localStorage.getItem(CHARACTER_KEY) as EntityId | null) ?? undefined;
  }

  /**
   * Push local events to the cloud, pull the account's cloud events + apply them locally, and re-project +
   * refresh the open sheet when the pull applied anything. A closure (not just the exposed method) so the
   * login subscription in `init` can invoke it directly. Best-effort — never throws into the caller.
   */
  async function runSync(): Promise<{ ok: boolean; pushed: number; pulled: number }> {
    await composition.ready;
    // Account-binding safety gate (#185, audit F-01, ADR 0012 §13): this device's local store belongs to the
    // account it first bound to; syncing while signed into a *different* account would stamp its local events
    // with the wrong cloud `owner_id` (ADR 0024 §2) and mix that account's pulled events into this store. So
    // on a binding/session mismatch we block BOTH halves (never push, never pull) and surface it, rather than
    // silently misattributing data. The full account-switch model (partition/migrate) is tracked in #185.
    const guard = evaluateSyncGuard(getAccountBinding(), await composition.auth.getSession());
    if (!guard.allowed) {
      setModel({ error: `sync-blocked:${guard.reason}` });
      return { ok: false, pushed: 0, pulled: 0 };
    }
    const push = await composition.sync.pushPending();
    const pull = await composition.sync.pullPending();
    const pushed = push.ok ? push.value.accepted : 0;
    const pulled = pull.ok ? pull.value.pulled : 0;
    if (pulled > 0) {
      // Cloud events landed in the local log → catch the read model up, refresh the picker (a pulled
      // cross-device character now appears in it), and re-publish the open sheet so a change synced from
      // elsewhere becomes visible (the projection is idempotent, so this is safe to re-run).
      await project();
      await loadCharacters();
      const characterId = currentCharacterId();
      if (characterId) await refresh(characterId);
    }
    return { ok: push.ok && pull.ok, pushed, pulled };
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot() {
      return model;
    },

    async init() {
      await composition.ready;
      // Catch the read model up to the durable event log, then re-open the persisted character (if any) —
      // this is what makes a reloaded character reappear from OPFS.
      await project();
      await loadCharacters();
      const characterId = currentCharacterId();
      if (characterId) await refresh(characterId);
      setModel({ ready: true });
      // Auto-sync whenever a session becomes current (fresh login, or a cookie-restore on boot): push local
      // work and pull the account's cloud events. Best-effort and fire-and-forget — a failed/offline sync
      // must never break the local-first UI. The subscription lives for the app's (single view's) lifetime.
      composition.auth.onSessionChange((session) => {
        if (session) void runSync().catch(() => undefined);
      });
    },

    async createCharacter(name) {
      await composition.ready;
      let campaignId = localStorage.getItem(CAMPAIGN_KEY) as EntityId | null;
      if (!campaignId) {
        campaignId = deps.ids.newId();
        const created = await createCampaignCommand(deps, {
          campaignId,
          name: 'Local campaign',
          actor,
        });
        if (!created.ok) {
          setModel({ error: `campaign: ${created.error.code}` });
          return;
        }
        localStorage.setItem(CAMPAIGN_KEY, campaignId);
      }

      // Create the character AND its starting traits in one atomic append (#191): a failure part-way
      // through no longer leaves a half-created character in the log (which the old create-then-loop could).
      const characterId = deps.ids.newId();
      const created = await createCharacterCommand(deps, {
        characterId,
        name,
        campaignId,
        ruleSystemId: RULE_SYSTEM_ID,
        actor,
        attributes: STARTING_TRAITS,
      });
      if (!created.ok) {
        setModel({ error: `character: ${created.error.code}` });
        return;
      }

      localStorage.setItem(CHARACTER_KEY, characterId);
      await project();
      await loadCharacters();
      await refresh(characterId);
    },

    async openCharacter(characterId) {
      localStorage.setItem(CHARACTER_KEY, characterId);
      await refresh(characterId);
    },

    async newCharacter() {
      localStorage.removeItem(CHARACTER_KEY);
      setModel({ sheet: undefined, error: undefined });
    },

    async setTrait(attributeId, value) {
      const characterId = currentCharacterId();
      if (!characterId) return;
      const set = await setAttributeCommand(deps, { characterId, attributeId, value, actor });
      if (!set.ok) {
        // A bounds violation is expected user error, not a crash — surface it inline and keep the sheet.
        setModel({ error: `${attributeId}: ${set.error.code}` });
        return;
      }
      await project();
      await refresh(characterId);
    },

    async rollPerception() {
      const characterId = currentCharacterId();
      if (!characterId) return;
      const rolled = await rollCheckCommand(deps, { characterId, checkId: 'perception', actor });
      if (!rolled.ok) {
        setModel({ error: `roll: ${rolled.error.code}` });
        return;
      }
      await project();
      await refresh(characterId);
    },

    syncNow() {
      return runSync();
    },
  };
}
