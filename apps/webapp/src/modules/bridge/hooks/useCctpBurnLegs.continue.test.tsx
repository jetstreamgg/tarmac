/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { getAddress, type Call, type PublicClient } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionReplacedError, TransactionRevertedError } from '@/hooks/shared/useTransactionOutcome';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { BASE_BURN_AMOUNT, BASE_BURN_MINT_RECIPIENT, BASE_BURN_TX } from '../adapters/cctp/cctp.fixtures';
import { cctpL2Contracts } from '../adapters/cctp/contracts';
import { RESUME_SCAN_MAX_BLOCKS } from '../adapters/cctp/gate';
import {
  applyProgress,
  createPendingBridge,
  failBundle,
  isPendingBridgeVisible
} from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { cctpSwapStore, type UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { pendingBridgeStore } from '../store/pendingStore';
import { useCctpBurnLegs } from './useCctpBurnLegs';
import { useUnfinishedCctpSwaps } from './useUnfinishedCctpSwaps';

// The Continue card must never be offered while a burn of its swap may still land, and must come back once that burn failed.

const mocks = vi.hoisted(() => ({
  clients: {} as Record<number, unknown>,
  legs: undefined as undefined | Record<string, unknown>,
  execute: vi.fn(),
  scope: 'continue-scope'
}));

vi.mock('wagmi', () => ({
  usePublicClient: ({ chainId }: { chainId?: number }) => (chainId ? mocks.clients[chainId] : undefined)
}));
vi.mock('@/hooks', () => ({
  useTokenAllowance: ({ contractAddress }: { contractAddress?: string }) => ({
    data: contractAddress ? 0n : undefined,
    error: null,
    mutate: vi.fn()
  })
}));
vi.mock('../adapters/cctp/gate', async importOriginal => ({
  ...(await importOriginal<typeof import('../adapters/cctp/gate')>()),
  cctpBurnRefusal: async () => undefined
}));
vi.mock('./usePendingScope', () => ({ usePendingScope: () => ({ scope: mocks.scope }) }));
vi.mock('./useBridgeCallLegs', () => ({
  useBridgeCallLegs: (params: Record<string, unknown>) => {
    mocks.legs = params;
    return {
      isBatch: false,
      ready: true,
      error: null,
      execute: mocks.execute,
      reset: vi.fn(),
      stop: vi.fn()
    };
  }
}));

const BASE = 8453;
const ETHEREUM = 1;
const NOW = 1_800_000_000_000;
const AMOUNT = BASE_BURN_AMOUNT * 10n ** 12n;
const ACCOUNT = getAddress(BASE_BURN_TX.from);
const SWAP_HASH = '0x' + 'ab'.repeat(32);
const BURN_HASH = '0x' + 'cd'.repeat(32);
const RETRY_HASH = '0x' + 'ef'.repeat(32);
const RESUME: UnfinishedCctpSwap = {
  swapTxHash: SWAP_HASH,
  network: 'base',
  usdcAmount: BASE_BURN_AMOUNT,
  recipient: BASE_BURN_MINT_RECIPIENT.toLowerCase(),
  at: 0
};

let scopeSeq = 0;
const scope = () => mocks.scope;

const render = (overrides: Partial<Parameters<typeof useCctpBurnLegs>[0]> = {}) =>
  renderHook(() => ({
    legs: useCctpBurnLegs({
      enabled: true,
      from: 'base',
      chainId: BASE,
      ethereumChainId: ETHEREUM,
      account: ACCOUNT,
      recipient: BASE_BURN_MINT_RECIPIENT,
      amount: AMOUNT,
      scope: scope(),
      getCallbacks: () => ({}) as TxCallbacks,
      ...overrides
    }),
    offered: useUnfinishedCctpSwaps().map(swap => swap.swapTxHash)
  }));

const calls = () => mocks.legs!.calls as Call[];
const leg = (name: string) =>
  calls().find(call => (call as { functionName?: string }).functionName === name)!;
const legSent = (hash: string, name: string, context?: unknown) =>
  act(() =>
    (mocks.legs!.onLegSent as (hash: string, variables: object, context?: unknown) => void)(
      hash,
      leg(name),
      context
    )
  );
const legFailed = (hash: string, error: Error) =>
  act(() => (mocks.legs!.onLegFailed as ((hash: string, error: Error) => void) | undefined)?.(hash, error));
const lastRun = () => mocks.execute.mock.calls.at(-1)?.[0];

// What useBridgeLaunch records for the burn: a card keyed by its hash, or by the bundle the wallet accepted.
const route = () => {
  const resolved = resolveBridgeRoute({ from: 'base', to: 'ethereum', amount: 1n, facts: {} });
  if (resolved.status !== 'ok') throw new Error(resolved.reason);
  return resolved.route;
};
const card = (ids: { txHash?: string; bundleId?: string; callsId?: string }) =>
  act(() =>
    pendingBridgeStore.upsert(
      scope(),
      createPendingBridge({
        account: ACCOUNT,
        amount: AMOUNT,
        from: 'base',
        to: 'ethereum',
        route: route(),
        ...ids,
        now: NOW
      })
    )
  );
const burnReverted = (id: string) =>
  act(() =>
    pendingBridgeStore.update(scope(), id, entry =>
      applyProgress(entry, { kind: 'failed', reason: 'source-tx-reverted' }, NOW)
    )
  );

describe('useCctpBurnLegs: the Continue card follows its burn', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.scope = `continue-scope-${++scopeSeq}`;
    mocks.clients = { [BASE]: { chain: 'base' }, [ETHEREUM]: { chain: 'ethereum' } };
    mocks.legs = undefined;
    mocks.execute.mockReset();
  });

  it('hides the swap while its burn is pending and offers it again once the burn reverted', () => {
    const { result } = render();
    act(() => result.current.legs.execute());
    legSent(SWAP_HASH, 'swapExactIn', lastRun());
    expect(result.current.offered).toEqual([SWAP_HASH]);
    legSent(BURN_HASH, 'depositForBurn', lastRun());
    card({ txHash: BURN_HASH });
    expect(result.current.offered).toEqual([]);
    burnReverted(BURN_HASH);
    expect(result.current.offered).toEqual([SWAP_HASH]);
  });

  it('hides the swap again while the burn a Try again sent is pending, so it is never burned twice', () => {
    const { result } = render();
    act(() => result.current.legs.execute());
    legSent(SWAP_HASH, 'swapExactIn', lastRun());
    legSent(BURN_HASH, 'depositForBurn', lastRun());
    card({ txHash: BURN_HASH });
    burnReverted(BURN_HASH);
    // Try again runs the burn alone, in a new run.
    act(() => result.current.legs.execute());
    legSent(RETRY_HASH, 'depositForBurn', lastRun());
    card({ txHash: RETRY_HASH });
    expect(result.current.offered).toEqual([]);
    burnReverted(RETRY_HASH);
    expect(result.current.offered).toEqual([SWAP_HASH]);
  });

  it('keeps the link between the swap and its burn across a reload', () => {
    const { result } = render();
    act(() => result.current.legs.execute());
    legSent(SWAP_HASH, 'swapExactIn', lastRun());
    legSent(BURN_HASH, 'depositForBurn', lastRun());
    card({ txHash: BURN_HASH });
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));
    expect(result.current.offered).toEqual([]);
    burnReverted(BURN_HASH);
    expect(result.current.offered).toEqual([SWAP_HASH]);
  });

  it('hides a continued swap while its bundle is pending and offers it again once the bundle failed', () => {
    cctpSwapStore.record(scope(), RESUME);
    const { result } = render({ resume: RESUME, batch: true });
    act(() => result.current.legs.execute());
    act(() => (mocks.legs!.onCallsSent as (id: string, context?: unknown) => void)('calls-1', lastRun()));
    card({ bundleId: 'bundle-1', callsId: 'calls-1' });
    expect(result.current.offered).toEqual([]);
    act(() => pendingBridgeStore.update(scope(), 'bundle-1', entry => failBundle(entry, 'reverted', NOW)));
    expect(result.current.offered).toEqual([SWAP_HASH]);
  });

  it('drops a swap whose own receipt reverted or was replaced, also after the modal closed', () => {
    const { result } = render();
    act(() => result.current.legs.execute());
    legSent(SWAP_HASH, 'swapExactIn', lastRun());
    legFailed(SWAP_HASH, new TransactionRevertedError());
    expect(result.current.offered).toEqual([]);

    legSent(RETRY_HASH, 'swapExactIn', lastRun());
    legFailed(RETRY_HASH, new TransactionReplacedError(new Error('replaced')));
    expect(result.current.offered).toEqual([]);
  });

  it('keeps a swap when another leg failed', () => {
    const { result } = render();
    act(() => result.current.legs.execute());
    legSent(SWAP_HASH, 'swapExactIn', lastRun());
    legFailed(BURN_HASH, new TransactionRevertedError());
    legFailed('', new TransactionRevertedError());
    expect(result.current.offered).toEqual([SWAP_HASH]);
  });

  describe('on Continue', () => {
    const { psm3 } = cctpL2Contracts('base');
    const preflight = (client: object) =>
      (mocks.legs!.preflight as (client: PublicClient) => Promise<Error | undefined>)(client as PublicClient);

    it('drops a swap the chain shows reverted', async () => {
      cctpSwapStore.record(scope(), RESUME);
      const { result } = render({ resume: RESUME });
      const refusal = await act(() =>
        preflight({ getTransactionReceipt: async () => ({ status: 'reverted', blockNumber: 1n }) })
      );
      expect(refusal?.message).toMatch(/swap of this bridge failed/);
      expect(result.current.offered).toEqual([]);
    });

    it('keeps a swap it refuses for another reason', async () => {
      cctpSwapStore.record(scope(), RESUME);
      const { result } = render({ resume: RESUME });
      const receipt = { status: 'success', blockNumber: 1n, from: ACCOUNT, to: psm3 };
      const tooOld = await act(() =>
        preflight({
          getTransactionReceipt: async () => receipt,
          getBlockNumber: async () => 1n + RESUME_SCAN_MAX_BLOCKS
        })
      );
      expect(tooOld?.message).toMatch(/too old/);
      const notOwn = await act(() =>
        preflight({ getTransactionReceipt: async () => ({ ...receipt, to: ACCOUNT }) })
      );
      expect(notOwn?.message).toMatch(/not a bridge of this account/);
      expect(result.current.offered).toEqual([SWAP_HASH]);
    });
  });

  // B6: the Failed card of a burn goes once the burn retrying it is sent; Activity keeps it.
  describe('the failed burn card', () => {
    const cards = () =>
      pendingBridgeStore
        .getSnapshot(scope())
        .filter(bridge => isPendingBridgeVisible(bridge, NOW))
        .map(bridge => bridge.txHash ?? bridge.callsId);
    const stored = () =>
      pendingBridgeStore.getSnapshot(scope()).map(bridge => bridge.txHash ?? bridge.callsId);
    const failedBurn = () => {
      const { result } = render();
      act(() => result.current.legs.execute());
      legSent(SWAP_HASH, 'swapExactIn', lastRun());
      legSent(BURN_HASH, 'depositForBurn', lastRun());
      card({ txHash: BURN_HASH });
      burnReverted(BURN_HASH);
      return result;
    };

    it('stays while nothing retried it', () => {
      const result = failedBurn();
      act(() => result.current.legs.execute());
      expect(cards()).toEqual([BURN_HASH]);
    });

    it('goes once a Try again sends a new burn, and stays in Activity', () => {
      const result = failedBurn();
      act(() => result.current.legs.execute());
      legSent(RETRY_HASH, 'depositForBurn', lastRun());
      card({ txHash: RETRY_HASH });
      expect(cards()).toEqual([RETRY_HASH]);
      expect(stored()).toEqual([RETRY_HASH, BURN_HASH]);
    });

    it('goes once Continue sends a new burn', () => {
      failedBurn();
      const { result } = render({ resume: RESUME });
      act(() => result.current.legs.execute());
      legSent(RETRY_HASH, 'depositForBurn', lastRun());
      expect(cards()).toEqual([]);
    });

    it('goes once Continue sends a bundle', () => {
      failedBurn();
      const { result } = render({ resume: RESUME, batch: true });
      act(() => result.current.legs.execute());
      act(() => (mocks.legs!.onCallsSent as (id: string, context?: unknown) => void)('calls-1', lastRun()));
      expect(cards()).toEqual([]);
    });

    it('never closes a burn that may still land', () => {
      const { result } = render();
      act(() => result.current.legs.execute());
      legSent(SWAP_HASH, 'swapExactIn', lastRun());
      legSent(BURN_HASH, 'depositForBurn', lastRun());
      card({ txHash: BURN_HASH });
      act(() => result.current.legs.execute());
      legSent(RETRY_HASH, 'depositForBurn', lastRun());
      expect(cards()).toEqual([BURN_HASH]);
    });
  });
});
