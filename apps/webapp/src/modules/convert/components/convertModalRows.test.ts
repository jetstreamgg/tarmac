import { i18n } from '@lingui/core';
import { describe, expect, it } from 'vitest';
import { buildConvertModalRows } from './convertModalRows';

// The `t` macro resolves against the global i18n singleton (not React context).
i18n.load('en', {});
i18n.activate('en');

describe('buildConvertModalRows', () => {
  it('matches the Figma review-modal contract (486:32223): ids, labels, order and values', () => {
    const rows = buildConvertModalRows({
      originSymbol: 'USDS',
      targetSymbol: 'USDC',
      network: 'Ethereum',
      networkFee: '–'
    });

    expect(rows).toEqual([
      { kind: 'rate', id: 'rate', label: 'Rate', value: '1.00 USDS = 1.00 USDC' },
      { kind: 'network', id: 'network', label: 'Network', value: 'Ethereum' },
      { kind: 'plain', id: 'slippage', label: 'Slippage', value: '0.00%' },
      { kind: 'plain', id: 'fee', label: 'Fee', value: '$0.00' },
      { kind: 'plain', id: 'networkFee', label: 'Network fee', value: '–' }
    ]);
  });

  it('flips token symbols with the direction', () => {
    const rows = buildConvertModalRows({
      originSymbol: 'USDC',
      targetSymbol: 'USDS',
      network: 'Base',
      networkFee: '–'
    });

    expect(rows[0].value).toBe('1.00 USDC = 1.00 USDS');
    expect(rows[1].value).toBe('Base');
  });
});
