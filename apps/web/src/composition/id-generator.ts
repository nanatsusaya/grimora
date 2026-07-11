/**
 * Production `IdGeneratorPort` for `apps/web`: **UUIDv7** ids (RFC 9562 §5.7), as the port documents for
 * production (the test fake `createSequentialIdGenerator` stays deterministic for tests).
 *
 * **Why v7, not `crypto.randomUUID()` (v4):** UUIDv7 embeds a 48-bit Unix-millisecond timestamp in its
 * high bits, so ids generated over time sort in creation order. That time-ordering is the property we
 * want for event and aggregate ids in an event-sourced store (ADR 0004): k-sortable ids keep index
 * locality and make id order a sensible tie-break, which a purely random v4 would not give.
 *
 * The generator is hand-rolled (no dependency) because v7 is a small, well-specified bit layout and the
 * repo favours a tiny reviewable implementation over a dependency for something this self-contained.
 */

import type { IdGeneratorPort } from '@grimora/core-domain';
import type { EntityId } from '@grimora/shared-types';

/** Bytes 6 and 8 carry the version/variant bits; masking constants named for RFC 9562 §5.7 clarity. */
const VERSION_7 = 0x70;
const VARIANT_10 = 0x80;

/**
 * Build one UUIDv7 string for a given millisecond timestamp. Split out from {@link createUuidV7IdGenerator}
 * so it is **deterministic and unit-testable** with an injected time (ADR 0017) — the only nondeterminism
 * left is the random tail, whose bits the tests deliberately do not assert.
 * @param timestampMs  the 48-bit Unix time in milliseconds to embed (defaults to now)
 * @returns            a canonical `8-4-4-4-12` lowercase UUIDv7 string
 */
export function uuidV7(timestampMs: number = Date.now()): string {
  const bytes = new Uint8Array(16);

  // Bytes 0..5: the 48-bit timestamp, most-significant byte first. `Math.floor(ms / 2**(8*k))` shifts by
  // whole bytes without bitwise ops (which are 32-bit and would overflow a 48-bit value).
  for (let i = 0; i < 6; i++) {
    bytes[i] = Math.floor(timestampMs / 2 ** (8 * (5 - i))) & 0xff;
  }

  // Bytes 6..15: random. `crypto.getRandomValues` is present on the main thread, in workers, and in Bun.
  crypto.getRandomValues(bytes.subarray(6));

  // Overwrite the version nibble (high 4 bits of byte 6) and the variant bits (high 2 bits of byte 8).
  bytes[6] = ((bytes[6] as number) & 0x0f) | VERSION_7;
  bytes[8] = ((bytes[8] as number) & 0x3f) | VARIANT_10;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
}

/**
 * The production id generator: a fresh time-ordered UUIDv7 per call.
 * @returns an `IdGeneratorPort` whose `newId()` yields UUIDv7 `EntityId`s
 */
export function createUuidV7IdGenerator(): IdGeneratorPort {
  return {
    newId(): EntityId {
      return uuidV7() as EntityId;
    },
  };
}
