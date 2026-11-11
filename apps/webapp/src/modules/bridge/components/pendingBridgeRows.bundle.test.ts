import { i18n } from '@lingui/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { NO_VALUE } from '@/lib/constants';
import { canDismiss, createPendingBridge, failBundle } from '../model/pendingTransitions';
import { nativeDepositRoute } from '../model/resolveRoute';
import type { PendingBridge } from '../model/types';
import { buildPendingBridgeRows } from './pendingBridgeRows';

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;
const HASH = '0x00000000000000000000000000000000000000000000000000000000000000d1';

const bundle = createPendingBridge({
  account: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f',
  amount: 5n * 10n ** 18n,
  from: 'ethereum',
  to: 'base',
  route: nativeDepositRoute('base'),
  bundleId: 'bundle-1',
  now: NOW
});

// What the card shows: its status, arrival and transaction cells, and whether it offers Dismiss (PendingBridges.tsx).
const seen = (bridge: PendingBridge, now: number) => {
  const rows = buildPendingBridgeRows(bridge, now, 1);
  const value = (cell: (typeof rows)[number][number]) => ('value' in cell ? cell.value : undefined);
  return {
    status: value(rows[1][0]),
    arrival: value(rows[1][1]),
    transaction: rows[2][1],
    dismiss: canDismiss(bridge, now)
  };
};

describe('pending card of a wallet bundle with no hash yet', () => {
  it('shows it confirming on Ethereum, with no Dismiss, up to 29 minutes', () => {
    for (const at of [0, MINUTE, 29 * MINUTE]) {
      expect(seen(bundle, NOW + at)).toEqual({
        status: 'Pending',
        arrival: NO_VALUE,
        transaction: { kind: 'text', label: 'Transaction', value: 'Confirming on Ethereum' },
        dismiss: false
      });
    }
  });

  it('shows it not found on Ethereum yet, with Dismiss, from 30 minutes', () => {
    for (const at of [30 * MINUTE, 31 * MINUTE, 24 * 60 * MINUTE]) {
      expect(seen(bundle, NOW + at)).toEqual({
        status: 'Pending',
        arrival: NO_VALUE,
        transaction: { kind: 'text', label: 'Transaction', value: 'Not found on Ethereum yet' },
        dismiss: true
      });
    }
  });

  it('links its deposit and never offers Dismiss once the hash is found', () => {
    const found = {
      ...bundle,
      txHash: HASH,
      startedAt: NOW + 31 * MINUTE,
      etaAt: bundle.etaAt + 31 * MINUTE
    };
    const card = seen(found, NOW + 32 * MINUTE);
    expect(card.transaction).toMatchObject({ kind: 'link', label: 'Transaction', href: expect.any(String) });
    expect(card.transaction).not.toHaveProperty('value', 'Not found on Ethereum yet');
    expect(card.arrival).not.toBe(NO_VALUE);
    expect(card.dismiss).toBe(false);
  });

  it('shows a failed bundle as failed, with no transaction and no Dismiss', () => {
    const failed = failBundle(bundle, 'source-tx-reverted', NOW + MINUTE);
    expect(seen(failed, NOW + 31 * MINUTE)).toEqual({
      status: 'Failed',
      arrival: NO_VALUE,
      transaction: { kind: 'text', label: 'Transaction', value: NO_VALUE },
      dismiss: false
    });
  });
});
