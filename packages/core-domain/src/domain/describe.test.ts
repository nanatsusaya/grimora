/**
 * `describeEvent` tests (ADR 0017 §1), focused on the ADR 0023 §6 graceful-degradation contract: a
 * personal field (a character/campaign name) renders with its value when revealed, and renders the
 * **intent without the value** ("Character created") when the subject may not be revealed — the redacted
 * branch that a future erasure/authorization simply flips on, already exercised here.
 */

import { describe, expect, it } from 'bun:test';
import type { EntityId } from '@grimora/shared-types';
import { describeEvent } from './describe';
import type { CampaignCreated, CharacterCreated, StoredEvent } from './events';

const characterCreated: StoredEvent = {
  type: 'character.created',
  version: 1,
  payload: {
    name: 'Alrik',
    campaignId: 'campaign-1' as EntityId,
    ownerId: 'user-owner' as EntityId,
    ruleSystemId: 'dsa5',
    pluginId: 'org.grimora.dsa5',
    pluginVersion: '0.0.0',
  } satisfies CharacterCreated['payload'],
};

const campaignCreated: StoredEvent = {
  type: 'campaign.created',
  version: 1,
  payload: {
    name: 'The Northlands',
    ownerId: 'user-owner' as EntityId,
  } satisfies CampaignCreated['payload'],
};

describe('describeEvent — personal-field redaction (ADR 0023 §6)', () => {
  it('renders the name when the subject is revealable (default)', () => {
    expect(describeEvent(characterCreated)).toBe('Character "Alrik" created');
    expect(describeEvent(campaignCreated)).toBe('Campaign "The Northlands" created');
  });

  it('renders intent without the value when the name is redacted', () => {
    const hide = () => false;
    expect(describeEvent(characterCreated, hide)).toBe('Character created');
    expect(describeEvent(campaignCreated, hide)).toBe('Campaign created');
  });
});

describe('describeEvent — nonPersonal events render unchanged', () => {
  it('renders an attribute set from purely mechanical data', () => {
    const event: StoredEvent = {
      type: 'character.attributeSet',
      version: 2,
      payload: { attributeId: 'COU', value: 14 },
    };
    // A redacting predicate must not affect nonPersonal rendering.
    expect(describeEvent(event, () => false)).toBe('Attribute COU set to 14');
  });
});
