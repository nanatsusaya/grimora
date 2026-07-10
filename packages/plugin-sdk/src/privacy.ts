/**
 * Event-payload **privacy classification** — the additive plugin-SDK surface ADR 0023 §2 mandates
 * (allowed within the frozen `0.x` line, ADR 0025 §1). Classification is **data, not convention**: every
 * field of every event payload (core *and* plugin) declares a {@link PrivacyClass}, so the external-AI
 * egress filter (ADR 0023 §7), erasure (§5) and graceful degradation (§6) can act on *declared* ownership
 * rather than fragile value heuristics.
 *
 * This module carries the **classification vocabulary** and the **render-side redaction types**
 * (`Redactable`/`RedactedView`) that make ADR 0023 §6/§8's "render intent without the value" a
 * **compile-time** obligation. It introduces **no** crypto or persistence — field-encryption is the
 * `CryptoPort`'s job (ADR 0010 §5), wired when that adapter exists.
 *
 * **Provisional v0** (ADR 0022 §3) — additive to the ADR 0025 frozen surface.
 */

import { err, ok, type Result } from '@grimora/shared-types';
import type { PluginError } from './behaviour';

/**
 * The declared privacy class of one payload field (ADR 0023 §2). A closed set, mirroring the closed
 * error-category precedent — extend only by amendment/superseding ADR.
 *
 * `subjectRef` on the personal classes **names the payload field that carries the owning subject's id**
 * (e.g. `personal('ownerId')` on a `name` field says "this name belongs to whoever the `ownerId` field
 * identifies"). This lets the egress filter / erasure resolve the concrete subject from the same payload,
 * and lets a single event own fields for **several** subjects, each independently erasable (§2/§5).
 */
export type PrivacyClass =
  | { readonly kind: 'nonPersonal' }
  | { readonly kind: 'personal'; readonly subjectRef: string }
  | { readonly kind: 'personalFreeText'; readonly subjectRef: string };

/**
 * The classification-vocabulary builder plugins and core use to tag fields (ADR 0023 §2). Sugar that
 * emits {@link PrivacyClass} data; the returned literal `kind`s let {@link RedactedView} discriminate
 * `nonPersonal` (pass-through) from personal (redactable) fields at the type level.
 */
export const privacy = {
  /** Structural/rules data (trait ids, dice pips, versions, ids-as-pseudonyms): plaintext, queryable. */
  nonPersonal: { kind: 'nonPersonal' } as { readonly kind: 'nonPersonal' },
  /** A discrete personal datum (a name, an avatar id) owned by the subject the `subjectRef` field names. */
  personal: (subjectRef: string): { readonly kind: 'personal'; readonly subjectRef: string } => ({
    kind: 'personal',
    subjectRef,
  }),
  /** Free text authored by `subjectRef` that may mention third parties (§7 R1) — treated as personal. */
  personalFreeText: (
    subjectRef: string,
  ): { readonly kind: 'personalFreeText'; readonly subjectRef: string } => ({
    kind: 'personalFreeText',
    subjectRef,
  }),
} as const;

/**
 * A **complete** per-field classification of a payload: every key of `TPayload` **must** be present
 * (the mapped type strips optionality with `-?`), so a `satisfies PrivacyClassification<P>` on a core
 * classification const makes an **unclassified field a compile error** — ADR 0023 §2/§8 fail-fast, by
 * construction, for statically-typed core payloads. Plugin (runtime-shaped) payloads get the same
 * guarantee at load via {@link validateClassification}.
 */
export type PrivacyClassification<TPayload> = {
  readonly [K in keyof TPayload]-?: PrivacyClass;
};

/**
 * A field value that may be **unavailable** — erased, or the reader lacks authorization / the key
 * (ADR 0023 §6). Any code rendering a personal field must branch on `present`, so it **cannot** hard-require
 * the value: "render the intent when absent" becomes a compile-time obligation, not a convention (§8).
 */
export type Redactable<T> =
  | { readonly present: true; readonly value: T }
  | { readonly present: false };

/**
 * Wrap an **available** personal value as a present {@link Redactable}.
 * @param value  the personal value that is authorized + decryptable in this context
 * @returns      a present redactable carrying `value`
 */
export const reveal = <T>(value: T): Redactable<T> => ({ present: true, value });

/**
 * The **absent** {@link Redactable} — an erased / unauthorized / undecryptable personal field.
 * @returns  a redactable carrying no value
 */
export const redacted = <T>(): Redactable<T> => ({ present: false });

/**
 * The render-side view of a payload under a classification `TClass`: `nonPersonal` fields pass through
 * unchanged; every personal field becomes a {@link Redactable}. The discrimination is at the **type
 * level** — which is why callers must pass the *narrowly-typed* classification const (via
 * `typeof THE_CONST`, not the widened `PrivacyClassification<P>`), so each field's literal `kind` is
 * visible here.
 */
export type RedactedView<TPayload, TClass extends PrivacyClassification<TPayload>> = {
  readonly [K in keyof TPayload]: TClass[K]['kind'] extends 'nonPersonal'
    ? TPayload[K]
    : Redactable<TPayload[K]>;
};

/**
 * Build the {@link RedactedView} of a payload from its classification (ADR 0023 §6): `nonPersonal` fields
 * pass through; personal fields become present iff `canReveal(subjectRef)` — i.e. the reader is authorized
 * and the value is decryptable/not-erased. **Fail-safe:** a field with no classification is treated as
 * personal and redacted, never leaked (ADR 0023 §2). This is the one controlled place that wraps, so all
 * downstream rendering must branch on `present`.
 * @param payload         the raw event payload
 * @param classification  the payload's per-field classification (pass `typeof THE_CONST` for narrow types)
 * @param canReveal       predicate: may the subject named by a field's `subjectRef` be shown here?
 * @returns               the view with personal fields wrapped as {@link Redactable}
 */
export function redactView<TPayload, TClass extends PrivacyClassification<TPayload>>(
  payload: TPayload,
  classification: TClass,
  canReveal: (subjectRef: string) => boolean,
): RedactedView<TPayload, TClass> {
  const out: Record<string, unknown> = {};
  const classes = classification as Record<string, PrivacyClass>;
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    const cls = classes[key];
    if (cls?.kind === 'nonPersonal') {
      out[key] = value;
    } else if (cls && canReveal(cls.subjectRef)) {
      out[key] = reveal(value);
    } else {
      // Personal-and-not-revealable, or (fail-safe) unclassified → never expose the value.
      out[key] = redacted();
    }
  }
  return out as RedactedView<TPayload, TClass>;
}

/**
 * Runtime fail-fast for **plugin-supplied** payloads whose shape is only known at load time (core payloads
 * are covered at compile time by {@link PrivacyClassification}). Every field named in `fieldNames` must
 * have a class, or loading fails — the ADR 0023 §2/§8 "unclassified field → fails to load", in the style
 * of the ADR 0006 §3 Definition-API validation.
 * @param fieldNames      the payload's field names (from the plugin's event/trait Definition API)
 * @param classification  the classification the plugin declared for that payload
 * @returns               ok, or a `PluginError` naming the first unclassified field
 */
export function validateClassification(
  fieldNames: readonly string[],
  classification: Readonly<Record<string, PrivacyClass>>,
): Result<void, PluginError> {
  for (const name of fieldNames) {
    if (!Object.hasOwn(classification, name)) {
      return err({
        code: 'sdk.privacy.unclassified_field',
        messageKey: 'plugin.privacy.unclassified_field',
        category: 'Validation',
      });
    }
  }
  return ok(undefined);
}
