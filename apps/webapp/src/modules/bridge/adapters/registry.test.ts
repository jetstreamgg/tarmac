import { describe, expect, it } from 'vitest';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { createPendingBridge } from '../model/pendingTransitions';
import type { BridgeNetworkId } from '../model/networks';
import { MOCK_STAGE_MS } from './mockAdapter';
import { getBridgeAdapter } from './registry';

const NOW = 1_700_000_000_000;

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

  it('never reports a real Ethereum to Arbitrum deposit as arrived on a timer', async () => {
    const bridge = pending('ethereum', 'arbitrum');
    expect(bridge.routeKind).toBe('native');
    await expect(getBridgeAdapter('native').checkProgress(bridge, later)).resolves.toBeNull();
  });

  it('keeps the other native routes on the mock until their adapters land', async () => {
    const bridge = pending('ethereum', 'base');
    await expect(getBridgeAdapter('native').checkProgress(bridge, later)).resolves.toEqual({
      kind: 'arrived'
    });
  });
});
