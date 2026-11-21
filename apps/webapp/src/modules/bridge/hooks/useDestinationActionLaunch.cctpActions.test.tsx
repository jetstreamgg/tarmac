/**
 * @vitest-environment happy-dom
 */
import { act, renderHook as renderHookIn, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { createElement, type ReactNode } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionRefusedError, TransactionRevertedError } from '@/hooks/shared/useTransactionOutcome';
import type { TransactionConfig, TxCallbacks } from '@/modules/ui/context/transactionContract';
import { confirmedClaimTxHashes, type ConvertOfferReader } from '../adapters/cctp/convert';
import { applyProgress, createPendingBridge, recordAction } from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { isCctpSpendOpen } from '../store/openCctpSpends';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { useDestinationActionLaunch } from './useDestinationActionLaunch';

// A CCTP claim or convert signs other legs around its own: only the action's leg records it, and a later leg's failure never undoes an action that mined.

const queryClient = new QueryClient();
const renderHook = <Result,>(hook: () => Result) =>
  renderHookIn(hook, {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
  });

type LegsParams = {
  enabled: boolean;
  getCallbacks: () => TxCallbacks;
  onLegSent?: (hash: string, variables: { functionName: string }, context?: unknown) => void;
  onLegFailed?: (hash: string) => void;
  onLegPrompt?: (variables: { functionName: string }, context?: unknown) => (() => void) | undefined;
};
type LegsMock = {
  params?: LegsParams;
  ready: boolean;
  execute: (context?: unknown) => void;
  dropCheck?: () => void;
  client?: ConvertOfferReader;
};
const legsResult = (legs: LegsMock) => ({
  calls: [],
  isBatch: false,
  ready: legs.ready,
  error: null,
  execute: legs.execute,
  reset: () => undefined,
  dropCheck: legs.dropCheck ?? (() => undefined),
  client: legs.client
});

const mocks = vi.hoisted(() => ({
  address: '',
  isSafe: false,
  modalOpen: true,
  launched: [] as TransactionConfig[],
  onError: (() => undefined) as (error: Error) => void,
  claim: { ready: true, execute: () => undefined } as LegsMock,
  convert: { ready: true, execute: () => undefined } as LegsMock
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: mocks.address, chainId: 1 }),
  useChainId: () => 1,
  useChains: () => [{ id: 1 }, { id: 8453 }]
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useIsSafeWallet: () => mocks.isSafe,
  useSafeWalletStatus: () => (mocks.isSafe ? 'safe' : 'not-safe')
}));
vi.mock('@/hooks/wallet/useIsSafeApp', () => ({ useIsSafeApp: () => false }));
vi.mock('@/modules/ui/hooks/engineLaunch', () => ({
  useShouldUseBatch: () => false,
  useBatchSupportPending: () => false
}));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: (config: TransactionConfig) => mocks.launched.push(config),
    updateModalContent: vi.fn(),
    txCallbacks: {
      onMutate: vi.fn(),
      onStart: vi.fn(),
      onSuccess: vi.fn(),
      onError: (error: Error) => mocks.onError(error)
    },
    txStatus: 'idle',
    isModalOpen: mocks.modalOpen,
    isMinimized: false,
    activeSessionId: undefined,
    restore: vi.fn()
  })
}));
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({ canSwitchChain: true, handleSwitchChain: vi.fn() })
}));
vi.mock('@/modules/ui/hooks/useResetUnfinishedRunOnClose', () => ({
  useResetUnfinishedRunOnClose: () => undefined
}));
vi.mock('./useOpStackReplayLegs', () => ({
  useOpStackReplayLegs: () => ({
    ready: false,
    error: null,
    execute: () => undefined,
    reset: () => undefined
  })
}));
vi.mock('./useArbitrumRedeemLegs', () => ({
  useArbitrumRedeemLegs: () => ({
    ready: false,
    error: null,
    execute: () => undefined,
    reset: () => undefined
  })
}));
vi.mock('./useCctpClaimLegs', () => ({
  CCTP_CLAIM_FUNCTION: 'receiveMessage',
  useCctpClaimLegs: (params: LegsParams) => {
    mocks.claim.params = params;
    return legsResult(mocks.claim);
  }
}));
vi.mock('./useCctpConvertLegs', () => ({
  useCctpConvertLegs: (params: LegsParams) => {
    mocks.convert.params = params;
    return legsResult(mocks.convert);
  }
}));
// A native withdrawal's Ethereum legs; this file launches none.
vi.mock('./useNativeWithdrawalActionLegs', () => ({
  useNativeWithdrawalActionLegs: () => ({
    ready: false,
    error: null,
    execute: () => undefined,
    reset: () => undefined
  })
}));
vi.mock('../adapters/mockAdapter', () => ({ runMockLegs: () => new Promise<string>(() => undefined) }));

const NOW = 1_800_000_000_000;
const ROUTE_DATA = { cctpMessage: '0xmessage', cctpAttestation: '0xattestation' };
const MINTED = 100n * 10n ** 6n;
let accountSeq = 0;
const scope = () => pendingScopeKey({ account: mocks.address, familyChainId: 1 });
const stored = () => pendingBridgeStore.getSnapshot(scope()).find(entry => entry.id === '0xburn')!;
const actionsOf = (action: string) => stored().actions.filter(done => done.action === action);

const seed = ({ claimed }: { claimed: boolean }) => {
  const resolved = resolveBridgeRoute({
    from: 'base',
    to: 'ethereum',
    amount: 1n,
    facts: { cctp: { isOpen: true } }
  });
  if (resolved.status !== 'ok' || resolved.route.kind !== 'cctp') throw new Error('no CCTP route');
  const ready = applyProgress(
    createPendingBridge({
      account: mocks.address,
      amount: 100n * 10n ** 18n,
      from: 'base',
      to: 'ethereum',
      route: resolved.route,
      txHash: '0xburn',
      now: NOW
    }),
    { kind: 'ready', nextAction: 'claim', routeData: ROUTE_DATA },
    NOW
  );
  pendingBridgeStore.upsert(
    scope(),
    claimed ? recordAction(ready, { action: 'claim', txHash: '0xclaim', at: NOW }) : ready
  );
  return stored();
};

const confirm = () => act(() => mocks.launched.at(-1)!.onConfirm!());
const leg = (callbacks: TxCallbacks, functionName: string, hash: string) => {
  callbacks.onMutate({ functionName });
  callbacks.onStart(hash);
};

describe('useDestinationActionLaunch: the legs around a CCTP action', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  beforeEach(() => {
    mocks.address = `0x${(6000 + ++accountSeq).toString(16).padStart(40, '0')}`;
    mocks.isSafe = false;
    mocks.modalOpen = true;
    mocks.launched = [];
    mocks.claim = { ready: true, execute: vi.fn() };
    mocks.convert = { ready: true, execute: vi.fn() };
    mocks.onError = vi.fn();
  });

  describe('the review of a convert (Figma 94 to 96)', () => {
    it('opens on the review conversion, with the conversion on its wallet screen', () => {
      const card = seed({ claimed: true });
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card, 'convert', MINTED / 2n));
      const config = mocks.launched.at(-1)!;
      expect(config.skipReview).toBeFalsy();
      expect(config.title).toBe('Review conversion');
      expect(config.transactionTitle).toBe('Review conversion');
      expect(config.transactionContent).toMatchObject({ props: { amount: MINTED / 2n, bridged: MINTED } });
      expect(config.transactionScreenContent).toMatchObject({
        props: { from: { symbol: 'USDC', amount: '50.00' }, to: { symbol: 'USDS', amount: '50.00' } }
      });
      expect(config.steps).toEqual([
        expect.objectContaining({ label: 'Convert', tokenSymbol: 'USDC', targetTokenSymbol: 'USDS' })
      ]);
    });

    it('leaves a claim straight on its Confirm', () => {
      const card = seed({ claimed: false });
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card, 'claim'));
      const config = mocks.launched.at(-1)!;
      expect(config.skipReview).toBe(true);
      expect(config.title).toBe('Confirm');
    });
  });

  describe('a convert after its approve', () => {
    it('toasts the Figma success copy', () => {
      const card = seed({ claimed: true });
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card, 'convert', MINTED));
      expect(mocks.launched.at(-1)!.toast?.success).toBe('Funds converted successfully!');
    });

    it('is not recorded by the approve, so a sale rejected after it can be sent again', () => {
      const card = seed({ claimed: true });
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card, 'convert', MINTED));
      confirm();
      const callbacks = mocks.convert.params!.getCallbacks();
      leg(callbacks, 'approve', '0xapprove');
      expect(actionsOf('convert')).toEqual([]);
      callbacks.onMutate({ functionName: 'sellGem' });
      callbacks.onError(new Error('User rejected the request.'));
      expect(actionsOf('convert')).toEqual([]);
      expect(result.current.canLaunch(stored(), 'convert')).toBe(true);
    });

    it('is recorded by its sale, also from a Safe', () => {
      mocks.isSafe = true;
      const card = seed({ claimed: true });
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card, 'convert', MINTED));
      confirm();
      const callbacks = mocks.convert.params!.getCallbacks();
      leg(callbacks, 'approve', '0xapprove');
      leg(callbacks, 'sellGem', '0xsell');
      expect(actionsOf('convert')).toEqual([
        { action: 'convert', txHash: '0xsell', at: expect.any(Number), status: 'sent', safe: true }
      ]);
    });
  });

  describe('a claim followed by its approve and sale', () => {
    it('stays claimed under the receive hash when the sale reverts', () => {
      const card = seed({ claimed: false });
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card, 'claim'));
      confirm();
      const callbacks = mocks.claim.params!.getCallbacks();
      leg(callbacks, 'receiveMessage', '0xreceive');
      leg(callbacks, 'approve', '0xapprove');
      leg(callbacks, 'sellGem', '0xsell');
      callbacks.onError(new TransactionRevertedError(), '0xsell');
      expect(actionsOf('claim')).toEqual([{ action: 'claim', txHash: '0xreceive', at: expect.any(Number) }]);
      expect(stored().status).toBe('claimed');
      expect(result.current.canLaunch(stored(), 'claim')).toBe(false);
    });

    // A sale signed and then mined after a reload must still be read, or the claim reads as unsold.
    describe('the legs a claim run sends after its claim', () => {
      // As the engine does: every leg it sends reaches `onLegSent` with its run's context.
      const sentLeg = (functionName: string, hash: string, callbacks?: TxCallbacks) => {
        if (callbacks) callbacks.onMutate({ functionName });
        mocks.claim.params!.onLegSent!(
          hash,
          { functionName },
          vi.mocked(mocks.claim.execute).mock.calls.at(-1)?.[0]
        );
        callbacks?.onStart(hash);
      };
      const start = () => {
        const card = seed({ claimed: false });
        const { result } = renderHook(() => useDestinationActionLaunch());
        act(() => result.current.launch(card, 'claim'));
        confirm();
        const callbacks = mocks.claim.params!.getCallbacks();
        act(() => {
          sentLeg('receiveMessage', '0xreceive', callbacks);
          sentLeg('approve', '0xapprove', callbacks);
        });
        return callbacks;
      };

      it('keeps the sale on the claim as soon as it is sent, until the run confirms it', () => {
        const callbacks = start();
        act(() => sentLeg('sellGem', '0xsell', callbacks));
        expect(actionsOf('claim')).toEqual([
          {
            action: 'claim',
            txHash: '0xreceive',
            at: expect.any(Number),
            nextLegTxHash: '0xsell',
            nextLegAt: expect.any(Number)
          }
        ]);
        act(() => callbacks.onSuccess('0xsell', 7n));
        expect(actionsOf('claim')).toEqual([
          { action: 'claim', txHash: '0xreceive', at: expect.any(Number), bundleTxHashes: ['0xsell'] }
        ]);
      });

      it('keeps a sale signed after the modal closed, which its Confirm no longer hears', () => {
        start();
        act(() => sentLeg('sellGem', '0xsell'));
        expect(actionsOf('claim')).toMatchObject([{ txHash: '0xreceive', nextLegTxHash: '0xsell' }]);
      });

      it('forgets a sale that reverted or was replaced, which sold nothing', () => {
        const callbacks = start();
        act(() => sentLeg('sellGem', '0xsell', callbacks));
        act(() => mocks.claim.params!.onLegFailed!('0xsell'));
        expect(actionsOf('claim')).toEqual([
          { action: 'claim', txHash: '0xreceive', at: expect.any(Number) }
        ]);
      });

      it('keeps no leg for a Safe, whose legs report Safe tx hashes', () => {
        mocks.isSafe = true;
        const callbacks = start();
        act(() => sentLeg('sellGem', '0xsafe-sell', callbacks));
        expect(actionsOf('claim').some(done => done.nextLegTxHash)).toBe(false);
      });
    });

    // A convert of the card sells the same USDC: it refuses while the claim's sale may still be signed.
    it.each([false, true])(
      "holds the card while its claim's sale prompt is open, and hands the card to its convert (Safe: %s)",
      isSafe => {
        mocks.isSafe = isSafe;
        const card = seed({ claimed: false });
        const { result } = renderHook(() => useDestinationActionLaunch());
        act(() => result.current.launch(card, 'claim'));
        confirm();
        const run = vi.mocked(mocks.claim.execute).mock.calls.at(-1)?.[0];
        const prompt = mocks.claim.params!.onLegPrompt!;
        expect(prompt({ functionName: 'receiveMessage' }, run)).toBeUndefined();
        expect(prompt({ functionName: 'approve' }, run)).toBeUndefined();
        const release = prompt({ functionName: 'sellGem' }, run)!;
        expect(isCctpSpendOpen(scope(), card.id)).toBe(true);
        release();
        expect(isCctpSpendOpen(scope(), card.id)).toBe(false);

        pendingBridgeStore.update(scope(), card.id, current =>
          recordAction(current, { action: 'claim', txHash: '0xclaim', at: NOW })
        );
        act(() => result.current.launch(stored(), 'convert', MINTED));
        expect(mocks.convert.params).toMatchObject({ scope: scope(), bridgeId: card.id });
      }
    );

    // A wallet that runs the bundle as separate transactions (APP-637): its sale must stay readable.
    it('keeps every transaction of a claim bundle run apart, under one claim', () => {
      const card = seed({ claimed: false });
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card, 'claim'));
      confirm();
      const callbacks = mocks.claim.params!.getCallbacks();
      callbacks.onMutate(undefined);
      callbacks.onStart(undefined);
      callbacks.onSuccess('0xreceive', 7n, ['0xreceive', '0xapprove', '0xsell']);
      expect(actionsOf('claim')).toEqual([
        {
          action: 'claim',
          txHash: '0xreceive',
          at: expect.any(Number),
          bundleTxHashes: ['0xapprove', '0xsell']
        }
      ]);
      expect(confirmedClaimTxHashes(stored())).toEqual(['0xreceive', '0xapprove', '0xsell']);
      expect(stored().status).toBe('claimed');
    });

    it('keeps the claim sent from a Safe when the sale reverts, for the tracker to settle', () => {
      mocks.isSafe = true;
      const card = seed({ claimed: false });
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card, 'claim'));
      confirm();
      const callbacks = mocks.claim.params!.getCallbacks();
      leg(callbacks, 'receiveMessage', '0xsafe-receive');
      leg(callbacks, 'sellGem', '0xsafe-sell');
      callbacks.onError(new TransactionRevertedError(), '0xsell-on-chain');
      expect(actionsOf('claim')).toEqual([
        { action: 'claim', txHash: '0xsafe-receive', at: expect.any(Number), status: 'sent', safe: true }
      ]);
    });
  });

  // Q17 (Figma 93): a claim whose receive mined but whose sale didn't converts on Try again, never sends the claim twice.
  describe("Try again after a claim's sale failed", () => {
    const usdcOf = (balance: bigint, { sold = false }: { sold?: boolean } = {}): ConvertOfferReader => ({
      getTransactionReceipt: vi.fn(async () => ({
        status: sold ? 'reverted' : 'success',
        logs: []
      })) as never,
      readContract: vi.fn(async () => balance) as never
    });
    const saleReverted = () => {
      const card = seed({ claimed: false });
      const hook = renderHook(() => useDestinationActionLaunch());
      act(() => hook.result.current.launch(card, 'claim'));
      confirm();
      const callbacks = mocks.claim.params!.getCallbacks();
      leg(callbacks, 'receiveMessage', '0xreceive');
      leg(callbacks, 'approve', '0xapprove');
      leg(callbacks, 'sellGem', '0xsell');
      callbacks.onError(new TransactionRevertedError(), '0xsell');
      mocks.onError = vi.fn();
      return hook;
    };

    it('opens the conversion of the USDC the claim left, capped by what the wallet holds', async () => {
      mocks.claim.client = usdcOf(MINTED - 40n * 10n ** 6n);
      saleReverted();
      const launches = mocks.launched.length;
      confirm();
      await waitFor(() => expect(mocks.launched).toHaveLength(launches + 1));
      const config = mocks.launched.at(-1)!;
      expect(config.title).toBe('Review conversion');
      expect(config.transactionContent).toMatchObject({
        props: { amount: MINTED - 40n * 10n ** 6n, bridged: MINTED }
      });
      expect(mocks.onError).not.toHaveBeenCalled();
      expect(actionsOf('claim')).toHaveLength(1);
      expect(mocks.claim.execute).toHaveBeenCalledTimes(1);
    });

    it('never converts more than the claim minted', async () => {
      mocks.claim.client = usdcOf(MINTED * 3n);
      saleReverted();
      confirm();
      await waitFor(() => expect(mocks.launched.at(-1)!.title).toBe('Review conversion'));
      expect(mocks.launched.at(-1)!.transactionContent).toMatchObject({ props: { amount: MINTED } });
    });

    it('still refuses when there is nothing left to convert', async () => {
      mocks.claim.client = usdcOf(0n);
      saleReverted();
      const launches = mocks.launched.length;
      confirm();
      await waitFor(() =>
        expect(mocks.onError).toHaveBeenCalledWith(
          new TransactionRefusedError("There's no USDC from this bridge left in this wallet to convert.", {
            final: true
          })
        )
      );
      expect(mocks.launched).toHaveLength(launches);
    });

    it('converts nothing when a read fails, and lets Try again read again', async () => {
      mocks.claim.client = {
        getTransactionReceipt: vi.fn(async () => {
          throw new Error('rpc down');
        }) as never,
        readContract: vi.fn(async () => MINTED) as never
      };
      saleReverted();
      const launches = mocks.launched.length;
      confirm();
      await waitFor(() => expect(mocks.onError).toHaveBeenCalledWith(new Error('rpc down')));
      expect(mocks.launched).toHaveLength(launches);
    });

    it('sends a convert whose sale reverted again from its own Try again', () => {
      const card = seed({ claimed: true });
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card, 'convert', MINTED));
      confirm();
      const callbacks = mocks.convert.params!.getCallbacks();
      leg(callbacks, 'approve', '0xapprove');
      leg(callbacks, 'sellGem', '0xsell');
      callbacks.onError(new TransactionRevertedError(), '0xsell');
      expect(actionsOf('convert')).toEqual([]);
      confirm();
      expect(mocks.onError).not.toHaveBeenCalledWith(
        new TransactionRefusedError('This action was already sent.', { final: true })
      );
      expect(mocks.convert.execute).toHaveBeenCalledTimes(2);
    });
  });

  // The check before the wallet prompt reads the chain: a close meanwhile must not open the wallet.
  it.each(['claim', 'convert'] as const)(
    'drops a %s still checking the chain once the modal closes',
    kind => {
      const card = seed({ claimed: kind === 'convert' });
      const legs = mocks[kind];
      legs.dropCheck = vi.fn();
      const { result, rerender } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card, kind, kind === 'convert' ? MINTED : undefined));
      confirm();
      expect(legs.execute).toHaveBeenCalledTimes(1);
      vi.mocked(legs.dropCheck).mockClear();
      mocks.modalOpen = false;
      rerender();
      expect(legs.dropCheck).toHaveBeenCalled();
    }
  );

  // Figma 78 and 97: the card leaves once the USDS is in the wallet; Activity still lists the bridge.
  describe('the card once its USDS is delivered', () => {
    it('closes after a claim whose sale mined', () => {
      const card = seed({ claimed: false });
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card, 'claim'));
      confirm();
      const callbacks = mocks.claim.params!.getCallbacks();
      leg(callbacks, 'receiveMessage', '0xreceive');
      leg(callbacks, 'approve', '0xapprove');
      leg(callbacks, 'sellGem', '0xsell');
      callbacks.onSuccess('0xsell', 7n);
      expect(stored()).toMatchObject({ status: 'claimed', closedAt: expect.any(Number) });
    });

    it('closes after a claim bundle the wallet ran at once', () => {
      const card = seed({ claimed: false });
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card, 'claim'));
      confirm();
      const callbacks = mocks.claim.params!.getCallbacks();
      callbacks.onMutate(undefined);
      callbacks.onStart(undefined);
      callbacks.onSuccess('0xbundle', 7n);
      expect(stored()).toMatchObject({ status: 'claimed', closedAt: expect.any(Number) });
    });

    it('stays after a claim whose receive mined alone, to offer the convert', () => {
      const card = seed({ claimed: false });
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card, 'claim'));
      confirm();
      const callbacks = mocks.claim.params!.getCallbacks();
      leg(callbacks, 'receiveMessage', '0xreceive');
      callbacks.onSuccess('0xreceive', 7n);
      expect(stored().status).toBe('claimed');
      expect(stored().closedAt).toBeUndefined();
    });

    it('stays after a claim whose sale failed', () => {
      const card = seed({ claimed: false });
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(card, 'claim'));
      confirm();
      const callbacks = mocks.claim.params!.getCallbacks();
      leg(callbacks, 'receiveMessage', '0xreceive');
      leg(callbacks, 'sellGem', '0xsell');
      callbacks.onError(new TransactionRevertedError(), '0xsell');
      expect(stored().closedAt).toBeUndefined();
    });

    it('closes after a convert, also from a Safe once it executed', () => {
      for (const isSafe of [false, true]) {
        mocks.isSafe = isSafe;
        mocks.address = `0x${(6000 + ++accountSeq).toString(16).padStart(40, '0')}`;
        const card = seed({ claimed: true });
        const { result } = renderHook(() => useDestinationActionLaunch());
        act(() => result.current.launch(card, 'convert', MINTED));
        confirm();
        const callbacks = mocks.convert.params!.getCallbacks();
        leg(callbacks, 'approve', '0xapprove');
        leg(callbacks, 'sellGem', '0xsell');
        callbacks.onSuccess('0xsell-on-chain', 7n);
        expect(stored()).toMatchObject({ closedAt: expect.any(Number) });
      }
    });
  });
});
