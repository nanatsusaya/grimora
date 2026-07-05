/**
 * @grimora/shared-types — foundational types shared across the whole monorepo.
 *
 * Kept dependency-free and framework-agnostic on purpose: this package is imported by the
 * rule-agnostic core, the plugin SDK, the offline sync layer, and every app.
 */

/** Nominal ("branded") typing helper to prevent mixing structurally identical ids. */
export type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };

/** Stable identifier for any entity (aggregate) in the system. */
export type EntityId = Brand<string, "EntityId">;

/** ISO-8601 timestamp string. */
export type IsoTimestamp = Brand<string, "IsoTimestamp">;

/**
 * The append-only event envelope — the atom of the Event Sourcing / CQRS core.
 * Concrete event `type`s and `payload`s are defined by the core domain and by plugins.
 */
export interface EventEnvelope<TType extends string = string, TPayload = unknown> {
  /** Unique id of this event occurrence. */
  readonly id: EntityId;
  /** Id of the aggregate (e.g. a character, campaign) this event belongs to. */
  readonly aggregateId: EntityId;
  /** Discriminating event type, e.g. "character.created". */
  readonly type: TType;
  /** Monotonically increasing version within the aggregate (1-based). */
  readonly version: number;
  /** When the event occurred (device clock; sync reconciles ordering). */
  readonly occurredAt: IsoTimestamp;
  /** Event-specific data. */
  readonly payload: TPayload;
}

/** A lightweight success/failure result type used instead of throwing for expected errors. */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
