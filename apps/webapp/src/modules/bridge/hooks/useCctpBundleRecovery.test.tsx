/**
 * @vitest-environment happy-dom
 */
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPendingBridge } from '../model/pendingTransitions';
import { cctpWithdrawalRoute, nativeDepositRoute } from '../model/resolveRoute';
import type { BridgeNetworkId } from '../model/networks';
import { pendingBridgeStore } from '../store/pendingStore';
import { useCctpBundleRecovery } from './useCctpBundleRecovery';

// The burn of a CCTP wallet bundle the wallet never reports is looked for on
// its L2 soon after the send, and nothing is read while no such card waits.

const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const MINUTE = 60_000;

const mocks = vi.hoisted(() => ({
  scope: 'cctp-bundle-0',
  recover: vi.fn(async (_: { network: string; client: unknown }) => true)
}));

vi.mock('wagmi', () => ({ useConfig: () => ({}) }));
vi.mock('wagmi/actions', () => ({
  getClient: (_: unknown, { chainId }: { chainId: number }) => ({ extend: () => ({ chainId }) })
}));
vi.mock('./usePendingScope', () => ({
  usePendingScope: () => ({ account: ACCOUNT, scope: mocks.scope, familyChainId: 1 })
}));
vi.mock('../tracking/recoverCctpBundles', () => ({ recoverCctpBundles: mocks.recover }));

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient() }, children);

let scopes = 0;
let bundles = 0;

const bundle = (from: BridgeNetworkId, to: BridgeNetworkId = 'ethereum') => {
  const id = `bundle-${++bundles}`;
  pendingBridgeStore.upsert(
    mocks.scope,
    createPendingBridge({
      account: ACCOUNT,
      amount: 5n * 10n ** 18n,
      from,
      to,
      route: from === 'ethereum' ? nativeDepositRoute('base') : cctpWithdrawalRoute(from),
      bundleId: id,
      callsId: '0xcalls',
      now: Date.now()
    })
  );
  return id;
};

const networksRead = () => mocks.recover.mock.calls.map(([args]) => args.network);
const mount = async () => {
  renderHook(() => useCctpBundleRecovery(), { wrapper });
  await vi.advanceTimersByTimeAsync(0);
};

describe('useCctpBundleRecovery', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_700_000_000_000 });
    localStorage.clear();
    mocks.scope = `cctp-bundle-${++scopes}`;
    mocks.recover.mockReset();
    mocks.recover.mockResolvedValue(true);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("looks for the burn on the bundle's L2 within 2 minutes of the send", async () => {
    bundle('base');
    await mount();
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    expect(networksRead()).toEqual(['base']);
    expect(mocks.recover.mock.calls[0][0]).toMatchObject({ scope: mocks.scope, account: ACCOUNT });
    expect(mocks.recover.mock.calls[0][0].client).toEqual({ chainId: 8453 });
  });

  it('looks again 6, 14 and 30 minutes after the send, then every 30 minutes', async () => {
    bundle('base');
    await mount();
    const readBy = async (minute: number, elapsed: number) => {
      await vi.advanceTimersByTimeAsync((minute - elapsed) * MINUTE);
      return mocks.recover.mock.calls.length;
    };
    expect(await readBy(1, 0)).toBe(0);
    expect(await readBy(2, 1)).toBe(1);
    expect(await readBy(5, 2)).toBe(1);
    expect(await readBy(6, 5)).toBe(2);
    expect(await readBy(13, 6)).toBe(2);
    expect(await readBy(14, 13)).toBe(3);
    expect(await readBy(29, 14)).toBe(3);
    expect(await readBy(30, 29)).toBe(4);
    expect(await readBy(59, 30)).toBe(4);
    expect(await readBy(60, 59)).toBe(5);
  });

  it('looks at once on a load that finds a bundle sent minutes ago', async () => {
    bundle('optimism');
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    await mount();
    expect(networksRead()).toEqual(['optimism']);
  });

  it('looks 2 minutes later when the L2 could not be read', async () => {
    bundle('base');
    mocks.recover.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('rpc down'));
    await mount();
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    expect(mocks.recover).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    expect(mocks.recover).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    expect(mocks.recover).toHaveBeenCalledTimes(3);
    // Read at last: the next look waits for its mark.
    await vi.advanceTimersByTimeAsync(6 * MINUTE);
    expect(mocks.recover).toHaveBeenCalledTimes(3);
  });

  it('reads only the L2s a bundle waits on', async () => {
    bundle('base');
    bundle('arbitrum');
    await mount();
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    expect(networksRead().sort()).toEqual(['arbitrum', 'base']);
  });

  it('starts looking when a bundle is sent after the page loaded', async () => {
    await mount();
    await vi.advanceTimersByTimeAsync(20 * MINUTE);
    expect(mocks.recover).not.toHaveBeenCalled();
    act(() => void bundle('unichain'));
    await vi.advanceTimersByTimeAsync(2 * MINUTE + 1);
    expect(networksRead()).toEqual(['unichain']);
  });

  it('reads nothing for a deposit bundle or once the card has its hash', async () => {
    bundle('ethereum', 'base');
    const id = bundle('base');
    await mount();
    await vi.advanceTimersByTimeAsync(2 * MINUTE);
    expect(mocks.recover).toHaveBeenCalledTimes(1);
    act(() => void pendingBridgeStore.resolveBundle(mocks.scope, id, `0x${'ab'.repeat(32)}`));
    await vi.advanceTimersByTimeAsync(60 * MINUTE);
    expect(mocks.recover).toHaveBeenCalledTimes(1);
  });
});
