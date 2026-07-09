/**
 * @grimora/shared-types — foundational types shared across the whole monorepo.
 *
 * Kept dependency-free and framework-agnostic on purpose: this package is imported by the
 * rule-agnostic core, the plugin SDK, the offline sync layer, and every app. The architecture
 * harness (`shared-types-is-a-leaf`, ADR 0003 §3) enforces that it imports no other workspace
 * package, so domain/adapter/plugin vocabulary can never creep into this leaf.
 *
 * What belongs here: only *truly generic* concepts (the Shared Kernel, ADR 0003 §9) — ids, the
 * event-sourcing envelope infrastructure (ADR 0004 §2), and the `Result` type. Rule-system or
 * domain vocabulary lives in `core-domain`; the plugin contract lives in `plugin-sdk`.
 */

/** Nominal ("branded") typing helper to prevent mixing structurally identical ids. */
export type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };

/** Stable identifier for any entity (aggregate) in the system. */
export type EntityId = Brand<string, 'EntityId'>;

/**
 * A timestamp — kept as an **ISO-8601 string** (not a `Date` or epoch number) on purpose, so the whole
 * event envelope stays trivially JSON-serializable for the append-only log and for insert-only sync
 * across devices (ADR 0004 §2 / ADR 0005 §3), with a stable textual form that never drifts by timezone.
 */
export type IsoTimestamp = Brand<string, 'IsoTimestamp'>;

/**
 * Situational correlation data attached to an event's metadata (ADR 0004 §2/§11).
 *
 * This exists so a change can later be attributed to the circumstances it happened in (alone vs.
 * during a live session) WITHOUT turning the domain event store into an analytics store. Its
 * identifiers (`sessionId`, `deviceId`) are **pseudonymous personal data** — **not** "non-personal"
 * (ADR 0004 §2 amendment 2026-07-09, ADR 0023 §3): opaque, stable pseudonyms re-identifiable only via
 * the relational account store and erased by destroying that mapping — never a person's name/email, and
 * never behavioural analytics (that is ADR 0019, consent-gated). It is generic event-sourcing
 * infrastructure — not domain or plugin vocabulary — which is why it is allowed in this leaf package
 * (ADR 0022 §4 note to the leaf-guard).
 */
export interface EventContext {
  /** Live play-session this change happened during, if any (a pseudonymous id, ADR 0023 §3). */
  readonly sessionId?: EntityId;
  /** Device that produced the change — a **stable pseudonym** for multi-device correlation
   * (pseudonymous personal data, ADR 0023 §3), never a person's identity. */
  readonly deviceId?: string;
  /** Whether the producing device was online at the time. */
  readonly online?: boolean;
  /** How many participants were present in the session (a count, not a roster). */
  readonly participantsPresent?: number;
}

/**
 * Provenance/audit metadata carried by every event (ADR 0004 §2). Holds **pseudonymous personal data**
 * (`actorId`/`deviceId`/`sessionId`) — **not** free personal payload: these are opaque, stable
 * pseudonyms re-identifiable only through the relational account store and erased by destroying that
 * mapping (ADR 0023 §3). They deliberately stay **plaintext** because provenance, causal ordering and
 * authorization-on-replay need them, so they are handled by **pseudonymisation**, not the per-subject
 * crypto-shredding that covers personal *payload* data (ADR 0010 §6). Operational/behavioural detail
 * belongs in logs (ADR 0009 §2), never here. *(Corrected 2026-07-09: the earlier "holds no PII" was
 * wrong — ADR 0004 §2 amendment; the metadata identifiers are pseudonymous personal data.)*
 */
export interface EventMetadata {
  /** The actor (user) on whose authority the change was made — a pseudonymous user id (ADR 0023 §3). */
  readonly actorId?: EntityId;
  /** Correlates all events/logs produced by one request or interaction. */
  readonly correlationId?: string;
  /** The event/command that directly caused this one (a causation chain). */
  readonly causationId?: string;
  /** Situational context for later correlation (not telemetry) — see {@link EventContext}. */
  readonly context?: EventContext;
}

/**
 * The append-only event envelope — the atom of the Event Sourcing / CQRS core (ADR 0004 §2).
 * Concrete event `type`s and `payload`s are defined by the core domain and by plugins.
 *
 * `version` is the per-aggregate, 1-based causal order; a store-assigned global `position` lives on
 * {@link PersistedEvent}, not here (the deliberate `version`-vs-`position` split, ADR 0004 §2).
 */
export interface EventEnvelope<TType extends string = string, TPayload = unknown> {
  /**
   * Globally-unique id of this event occurrence. Generated as a **UUIDv7** via `IdGeneratorPort`
   * (ADR 0004 §2) so it is time-ordered — which helps global ordering and idempotent sync
   * (dedup-by-`id`, ADR 0005 §3).
   */
  readonly id: EntityId;
  /** Id of the aggregate (e.g. a character, campaign) this event belongs to. */
  readonly aggregateId: EntityId;
  /** The aggregate stream's type, e.g. "character", "campaign" (ADR 0004 §2). */
  readonly aggregateType: string;
  /** Discriminating event type, e.g. "character.created". */
  readonly type: TType;
  /** Monotonically increasing version within the aggregate (1-based). */
  readonly version: number;
  /**
   * Payload schema version of this event **type**, for upcasting old payloads to the current shape
   * on read before the domain/projections see them (ADR 0004 §6).
   */
  readonly schemaVersion: number;
  /** When the event occurred (device clock; sync reconciles ordering). */
  readonly occurredAt: IsoTimestamp;
  /** Provenance/audit metadata — see {@link EventMetadata}. Optional to keep test/fixture events terse. */
  readonly metadata?: EventMetadata;
  /** Event-specific data. */
  readonly payload: TPayload;
}

/**
 * A persisted event: an {@link EventEnvelope} plus the store-assigned, monotonic **`position`** —
 * a global sequence *within one store* (ADR 0004 §2). `position` is store-local, **not** a
 * cross-device global order; ADR 0005 reconciles ordering across stores. Projections and sync read
 * in `position` order.
 */
export interface PersistedEvent<TType extends string = string, TPayload = unknown>
  extends EventEnvelope<TType, TPayload> {
  /** Store-local global sequence position (assigned on append). */
  readonly position: number;
}

/** A lightweight success/failure result type used instead of throwing for expected errors. */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/**
 * Wrap a success value as a `Result` — the ok-path constructor callers use instead of returning a bare
 * value, so success and failure share one return type that the caller must narrow before use.
 * @param value  the success payload
 * @returns      an `ok` result carrying `value`
 */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
/**
 * Wrap an expected failure as a `Result` — used instead of `throw` for anticipated errors (validation,
 * conflicts, not-found), so the failure is part of the type and cannot be silently ignored (ADR 0009 §1).
 * @param error  the failure value (typically an `AppError`)
 * @returns      an `err` result carrying `error`
 */
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
