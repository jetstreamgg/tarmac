import { i18n } from '@lingui/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { StUsdsBlockedReason, StUsdsSelectionReason } from '@/hooks';
import { getProviderMessage } from './providerNotice';

const message = (rateDifferencePercent: number, blocked?: StUsdsBlockedReason) =>
  getProviderMessage(
    StUsdsSelectionReason.CURVE_ONLY_AVAILABLE,
    rateDifferencePercent,
    'withdraw',
    blocked,
    undefined,
    i18n
  );

describe('getProviderMessage, Curve-only with no native blocked reason (APP-509)', () => {
  beforeAll(() => {
    i18n.load('en', {});
    i18n.activate('en');
  });

  it('names the premium instead of calling native unavailable', () => {
    expect(message(-1.25)).toBe('Routing through Curve with a 1.25% premium');
  });

  it('names a better rate', () => {
    expect(message(0.5)).toBe('Routing through Curve for a better rate (+0.50%)');
  });

  it('keeps the unavailable copy when there is no rate to compare', () => {
    expect(message(0)).toBe('Routing through Curve - native withdrawals unavailable');
  });

  it('leaves the blocked-reason copy alone', () => {
    expect(message(-1.25, StUsdsBlockedReason.LIQUIDITY_EXHAUSTED)).toBe(
      'Routing through Curve with a 1.25% premium, as the liquidity is exhausted'
    );
  });
});
