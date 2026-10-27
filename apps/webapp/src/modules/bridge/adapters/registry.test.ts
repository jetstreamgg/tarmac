import { describe, expect, it } from 'vitest';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { createPendingBridge } from '../model/pendingTransitions';
import type { BridgeNetworkId } from '../model/networks';
import { MOCK_STAGE_MS, mockAdapter } from './mockAdapter';
import { getBridgeAdapter } from './registry';
import type { AdapterContext } from './types';

const NOW = 1_700_000_000_000;
// No chain to read: a real deposit must not move on its own.
const NO_CHAINS: AdapterContext = { getClient: () => undefined };

const pending = (from: BridgeNetworkId, to: BridgeNetworkId) => {
  const result = resolveBridgeRoute({ from, to, amount: 1n, facts: { cctp: { isOpen: true } } });
  if (result.status !== 'ok') throw new Error(result.reason);
  return createPendingBridge({
    account: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    amount: 1n,
    from,
    to,
    route: result.route,
    txHash: '0xsource',
    now: NOW
  });
};

describe('getBridgeAdapter', () => {
  const later = NOW + MOCK_STAGE_MS * 100;

  it.each(['arbitrum', 'base', 'optimism', 'unichain'] as const)(
    'never reports a real Ethereum to %s deposit as arrived on a timer',
    async to => {
      const bridge = pending('ethereum', to);
      expect(bridge.routeKind).toBe('native');
      await expect(getBridgeAdapter('native').checkProgress(bridge, later, NO_CHAINS)).resolves.toBeNull();
    }
  );

  it('keeps native withdrawals on the mock until their adapters land', async () => {
    const bridge = pending('base', 'ethereum');
    const progress = await getBridgeAdapter('native').checkProgress(bridge, later, NO_CHAINS);
    expect(progress).not.toBeNull();
    expect(progress).toEqual(await mockAdapter.checkProgress(bridge, later, NO_CHAINS));
  });

  it.each(['arbitrum', 'base', 'optimism', 'unichain'] as const)(
    'never reports a real %s to Ethereum CCTP bridge as arrived on a timer',
    async from => {
      const bridge = pending(from, 'ethereum');
      expect(bridge.routeKind).toBe('cctp');
      await expect(getBridgeAdapter('cctp').checkProgress(bridge, later, NO_CHAINS)).resolves.toBeNull();
    }
  );

  // Only an L2 to Ethereum CCTP bridge is ever recorded; a stored entry for any other pair is not a mock.
  it('never moves a CCTP bridge stored for another pair on a timer', async () => {
    const bridge = { ...pending('base', 'ethereum'), from: 'ethereum' as const, to: 'base' as const };
    await expect(getBridgeAdapter('cctp').checkProgress(bridge, later, NO_CHAINS)).resolves.toBeNull();
  });
});
