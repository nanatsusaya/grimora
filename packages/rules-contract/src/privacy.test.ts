/**
 * Privacy-surface tests (ADR 0017 §1): the classification vocabulary emits the expected data, the
 * runtime loader **fails fast** on an unclassified field (ADR 0023 §2/§8), and `redactView` wraps
 * personal fields as `Redactable` while passing `nonPersonal` through (ADR 0023 §6).
 */

import { describe, expect, it } from 'bun:test';
import { type PrivacyClassification, privacy, redactView, validateClassification } from './privacy';

interface SamplePayload {
  readonly name: string;
  readonly campaignId: string;
}

const classification = {
  name: privacy.personal('ownerId'),
  campaignId: privacy.nonPersonal,
} satisfies PrivacyClassification<SamplePayload>;

describe('privacy vocabulary', () => {
  it('emits classification data with the naming subjectRef', () => {
    expect(privacy.nonPersonal).toEqual({ kind: 'nonPersonal' });
    expect(privacy.personal('ownerId')).toEqual({ kind: 'personal', subjectRef: 'ownerId' });
    expect(privacy.personalFreeText('ownerId')).toEqual({
      kind: 'personalFreeText',
      subjectRef: 'ownerId',
    });
  });
});

describe('validateClassification (runtime fail-fast for plugin payloads)', () => {
  it('accepts a payload whose every field is classified', () => {
    const result = validateClassification(['name', 'campaignId'], classification);
    expect(result.ok).toBe(true);
  });

  it('fails to load when a field is unclassified', () => {
    const result = validateClassification(['name', 'campaignId', 'secret'], classification);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('sdk.privacy.unclassified_field');
      expect(result.error.category).toBe('Validation');
    }
  });
});

describe('redactView', () => {
  const payload: SamplePayload = { name: 'Alrik', campaignId: 'campaign-1' };

  it('passes nonPersonal through and reveals personal fields when authorized', () => {
    const view = redactView(payload, classification, () => true);
    // nonPersonal is a plain value; personal is a present Redactable.
    expect(view.campaignId).toBe('campaign-1');
    expect(view.name).toEqual({ present: true, value: 'Alrik' });
  });

  it('redacts personal fields when the subject may not be revealed', () => {
    const view = redactView(payload, classification, () => false);
    expect(view.campaignId).toBe('campaign-1');
    expect(view.name).toEqual({ present: false });
  });

  it('passes the field-named subjectRef to the reveal predicate', () => {
    const seen: string[] = [];
    redactView(payload, classification, (subjectRef) => {
      seen.push(subjectRef);
      return true;
    });
    expect(seen).toEqual(['ownerId']);
  });
});
