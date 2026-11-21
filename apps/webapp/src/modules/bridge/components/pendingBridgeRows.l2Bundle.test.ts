import { i18n } from '@lingui/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { createPendingBridge } from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import type { BridgeNetworkId } from '../model/networks';
import { buildPendingBridgeRows } from './pendingBridgeRows';

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;

const l2Bundle = (from: BridgeNetworkId) => {
  const result = resolveBridgeRoute({ from, to: 'ethereum', amount: 1n, facts: {} });
  if (result.status !== 'ok') throw new Error(result.reason);
  return createPendingBridge({
    account: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f',
    amount: 1n,
    from,
    to: 'ethereum',
    route: result.route,
    bundleId: 'bundle-1',
    now: NOW
  });
};

const transaction = (from: BridgeNetworkId, at: number) =>
  buildPendingBridgeRows(l2Bundle(from), NOW + at, 1)
    .flat()
    .find(cell => cell.label === 'Transaction');

// The bundle was sent on the L2, so that is where its transaction is looked for (review bug 13).
describe('pending card of an L2 bundle with no hash yet', () => {
  it.each([
    ['base', 'Base'],
    ['arbitrum', 'Arbitrum One']
  ] as const)('names %s, the network it was sent on', (from, name) => {
    expect(transaction(from, MINUTE)).toMatchObject({ value: `Confirming on ${name}` });
    expect(transaction(from, 30 * MINUTE)).toMatchObject({ value: `Not found on ${name} yet` });
  });
});
