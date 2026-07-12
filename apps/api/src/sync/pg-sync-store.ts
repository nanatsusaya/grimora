/**
 * The server-side cloud event ingestion over Supabase Postgres (#107, ADR 0005 §3) — the durable
 * counterpart the `SyncPort` (PR A) is the client of. `push` is insert-only and idempotent; `pull` serves
 * an owner's events after a checkpoint. Every operation is **owner-scoped**: the caller's account id
 * (verified from the JWT, ADR 0024 §2) is stamped as `owner_id` on insert and filters every read — the
 * hard tenancy boundary, with the table's RLS as defense-in-depth (see the migration).
 *
 * Uses `postgres` (postgres.js — node-compatible per ADR 0027) against the direct connection string. Only
 * the composition root constructs it (with the secret `DATABASE_URL`); the HTTP layer sees the interface.
 */

import type { SyncPullPage, SyncPushResult } from '@grimora/core-domain';
import type { EntityId, EventEnvelope, IsoTimestamp, PersistedEvent } from '@grimora/shared-types';
import postgres from 'postgres';

/** A row of the `events` table as read back (snake_case columns from Postgres). */
interface EventRow {
  readonly id: string;
  readonly aggregate_id: string;
  readonly aggregate_type: string;
  readonly type: string;
  readonly version: number | string;
  readonly schema_version: number | string;
  readonly occurred_at: string | Date;
  readonly payload: unknown;
  readonly metadata: unknown;
  readonly position: number | string;
}

/** The cloud ingestion surface the sync endpoints call. */
export interface SyncStore {
  /**
   * Ingest a batch insert-only for one owner; each event resolves independently (ADR 0011 §7 partial
   * success): `accepted` (+ cloud position), `duplicate` (id already present — idempotent), or `conflict`
   * (a stale/taken per-aggregate `version`).
   * @param ownerId  the authenticated account id — stamped as `owner_id`, never client-claimed (ADR 0024 §2)
   * @param events   the event envelopes to replicate (the cloud assigns each a canonical `position`)
   * @returns        a per-event {@link SyncPushResult}
   */
  push(ownerId: string, events: readonly EventEnvelope[]): Promise<readonly SyncPushResult[]>;
  /**
   * Read an owner's events after a checkpoint, in canonical `position` order (ADR 0005 §3). Owner-scoped;
   * stream-scoped visibility (ADR 0024 §4 routing) is a later refinement.
   * @param ownerId        the authenticated account id whose events to return
   * @param sincePosition  **exclusive** lower bound — return events with `position > sincePosition`
   * @returns              a {@link SyncPullPage} (events + the new checkpoint)
   */
  pull(ownerId: string, sincePosition: number): Promise<SyncPullPage>;
  /** Close the connection pool (composition-root teardown). */
  close(): Promise<void>;
}

/** Map a persisted `events` row back to a domain {@link PersistedEvent}. */
function rowToEvent(row: EventRow): PersistedEvent {
  return {
    id: row.id as EntityId,
    aggregateId: row.aggregate_id as EntityId,
    aggregateType: row.aggregate_type,
    type: row.type,
    version: Number(row.version),
    schemaVersion: Number(row.schema_version),
    occurredAt: new Date(row.occurred_at).toISOString() as IsoTimestamp,
    payload: row.payload,
    metadata: (row.metadata ?? undefined) as PersistedEvent['metadata'],
    position: Number(row.position),
  };
}

/**
 * Build the Postgres-backed sync store.
 * @param databaseUrl  the direct Postgres connection string (secret; from the composition root)
 * @returns            a {@link SyncStore}
 */
export function createPgSyncStore(databaseUrl: string): SyncStore {
  const sql = postgres(databaseUrl);

  return {
    async push(ownerId, events) {
      const results: SyncPushResult[] = [];
      for (const event of events) {
        try {
          // `on conflict (id) do nothing` makes a re-pushed id an idempotent no-op (returns no row). A
          // clash on the OTHER unique key (aggregate_id, version) is NOT swallowed by that clause — it
          // raises 23505, caught below as a version conflict → the client rebases (ADR 0005 §4).
          const rows = await sql<{ position: number | string }[]>`
            insert into events
              (id, aggregate_id, aggregate_type, type, version, schema_version, occurred_at,
               payload, metadata, owner_id)
            values
              (${event.id}, ${event.aggregateId}, ${event.aggregateType}, ${event.type}, ${event.version},
               ${event.schemaVersion}, ${event.occurredAt},
               ${sql.json(event.payload as Parameters<typeof sql.json>[0])},
               ${event.metadata ? sql.json(event.metadata as Parameters<typeof sql.json>[0]) : null},
               ${ownerId})
            on conflict (id) do nothing
            returning position`;
          if (rows.length > 0) {
            results.push({ id: event.id, status: 'accepted', position: Number(rows[0]?.position) });
          } else {
            results.push({ id: event.id, status: 'duplicate' });
          }
        } catch (error) {
          if ((error as { code?: string }).code === '23505') {
            const current = await sql<{ v: number }[]>`
              select coalesce(max(version), 0)::int as v
              from events where owner_id = ${ownerId} and aggregate_id = ${event.aggregateId}`;
            results.push({
              id: event.id,
              status: 'conflict',
              currentVersion: Number(current[0]?.v),
            });
          } else {
            throw error;
          }
        }
      }
      return results;
    },

    async pull(ownerId, sincePosition) {
      const rows = await sql<EventRow[]>`
        select id, aggregate_id, aggregate_type, type, version, schema_version, occurred_at,
               payload, metadata, position
        from events
        where owner_id = ${ownerId} and position > ${sincePosition}
        order by position asc`;
      const events = rows.map(rowToEvent);
      // Owner-scoped pull returns *all* of the owner's events after the checkpoint (no stream filter yet),
      // so the highest returned position is the new checkpoint; empty → the checkpoint does not move.
      const checkpoint =
        events.length > 0 ? (events[events.length - 1] as PersistedEvent).position : sincePosition;
      return { events, checkpoint };
    },

    async close() {
      await sql.end();
    },
  };
}
