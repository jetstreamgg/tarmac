import { i18n } from '@lingui/core';
import { describe, expect, it } from 'vitest';
import { formatSimulationErrorMessage } from './simulationErrorMessage';

i18n.load('en', {});
i18n.activate('en');

describe('formatSimulationErrorMessage', () => {
  it('formats the dust floor into the raw min-borrow message', () => {
    expect(formatSimulationErrorMessage('Minimum borrow amount is 30000', 30000n * 10n ** 18n)).toBe(
      'Minimum borrow amount is 30,000'
    );
  });

  it('passes every other message through untouched', () => {
    expect(
      formatSimulationErrorMessage('Amount exceeds the available debt ceiling', 30000n * 10n ** 18n)
    ).toBe('Amount exceeds the available debt ceiling');
  });

  it('passes the raw message through when the dust floor is unknown', () => {
    expect(formatSimulationErrorMessage('Minimum borrow amount is 30000', undefined)).toBe(
      'Minimum borrow amount is 30000'
    );
  });

  it('stays undefined for no message', () => {
    expect(formatSimulationErrorMessage(undefined, 30000n * 10n ** 18n)).toBeUndefined();
  });
});
