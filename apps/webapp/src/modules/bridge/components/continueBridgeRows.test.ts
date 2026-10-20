import { i18n } from '@lingui/core';
import { beforeAll, describe, expect, it } from 'vitest';
import type { UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { bridgeTxHref } from './pendingBridgeRows';
import { buildContinueBridgeRows } from './continueBridgeRows';

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const OTHER = '0x2222222222222222222222222222222222222222';
const SWAP: UnfinishedCctpSwap = {
  swapTxHash: '0x5a00000000000000000000000000000000000000000000000000000000000b7c',
  network: 'optimism',
  usdcAmount: 250n * 10n ** 6n,
  recipient: ACCOUNT,
  at: 0
};

describe('buildContinueBridgeRows', () => {
  it("pairs the cells as a pending bridge card does, with the swap's network and tx", () => {
    expect(buildContinueBridgeRows(SWAP, ACCOUNT, 1)).toEqual([
      [
        { kind: 'network', label: 'Source', network: 'optimism' },
        { kind: 'network', label: 'Destination', network: 'ethereum' }
      ],
      [
        { kind: 'status', label: 'Status', status: 'pending', value: 'Not bridged' },
        { kind: 'text', label: 'Bridge type', value: 'CCTP' }
      ],
      [
        {
          kind: 'link',
          label: 'Swap transaction',
          value: '0x5a00...0b7c',
          href: bridgeTxHref('optimism', SWAP.swapTxHash, 1)
        }
      ]
    ]);
  });

  // Continuing sends to the swap's recipient, so the card says who that is when it isn't the user.
  it('names a recipient other than the connected account', () => {
    const rows = buildContinueBridgeRows({ ...SWAP, recipient: OTHER }, ACCOUNT, 1);
    expect(rows[2]?.[1]).toEqual({ kind: 'text', label: 'Recipient', value: '0x2222...2222' });
  });

  it('names no recipient for the account itself, in any case', () => {
    expect(buildContinueBridgeRows(SWAP, ACCOUNT.toUpperCase().replace('0X', '0x'), 1)[2]).toHaveLength(1);
  });
});
