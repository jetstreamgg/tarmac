import { i18n } from '@lingui/core';
import { describe, expect, it } from 'vitest';
import { stakeLtvTooltipCopy } from './StakeLtvInfoTooltip';

i18n.load('en', {});
i18n.activate('en');

describe('stakeLtvTooltipCopy', () => {
  it('names the oracle cap read on chain', () => {
    const [definition, note] = stakeLtvTooltipCopy(25_000_000_000_000_000n);
    expect(definition).toBe("Your debt as a share of your collateral's value.");
    expect(note).toContain('capped SKY price, which never goes above $0.025.');
    expect(note).toContain('same Oracle which is used during the borrowing process');
  });

  it('never invents a figure while the cap is unknown', () => {
    const [, note] = stakeLtvTooltipCopy(undefined);
    expect(note).toContain('capped SKY price, which has a maximum value set by the protocol.');
    expect(note).not.toMatch(/\$\d/);
  });
});
