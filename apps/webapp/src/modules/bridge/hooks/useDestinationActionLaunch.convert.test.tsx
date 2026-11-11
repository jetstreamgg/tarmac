/**
 * @vitest-environment happy-dom
 */
import { TransactionRevertedError } from '@/hooks/shared/useTransactionOutcome';
import { act, renderHook as renderHookIn } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { createElement, isValidElement, type ReactNode } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig, TxCallbacks } from '@/modules/ui/context/transactionContract';
import { applyProgress, createPendingBridge, recordAction } from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import type { PendingBridge } from '../model/types';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { useDestinationActionLaunch } from './useDestinationActionLaunch';

// The hook invalidates balance reads once an action confirms.
const queryClient = new QueryClient();
const renderHook = <Result,>(hook: () => Result) =>
  renderHookIn(hook, {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
  });

type ConvertParams = {
  enabled: boolean;
  amount?: bigint;
  chainId?: number;
  account?: string;
  batch?: boolean;
  getCallbacks: () => TxCallbacks;
};

const mocks = vi.hoisted(() => ({
  address: '',
  walletChainId: 1,
  isSafe: false,
  canSwitchChain: true,
  switches: [] as { chainId: number; onSuccess?: () => void }[],
  launched: [] as TransactionConfig[],
  updates: [] as { sessionId: string; partial: Record<string, unknown> }[],
  mockLegs: [] as string[][],
  claimEnabled: false,
  convert: {
    params: undefined as undefined | ConvertParams,
    calls: [] as { functionName: string }[],
    isBatch: false,
    ready: false,
    error: null as Error | null,
    execute: (() => undefined) as () => void,
    reset: (() => undefined) as () => void
  }
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: mocks.address, chainId: mocks.walletChainId }),
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
    updateModalContent: (sessionId: string, partial: Record<string, unknown>) =>
      mocks.updates.push({ sessionId, partial }),
    txCallbacks: { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() },
    txStatus: 'idle',
    isModalOpen: true,
    isMinimized: false,
    activeSessionId: undefined,
    restore: vi.fn()
  })
}));
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({
    canSwitchChain: mocks.canSwitchChain,
    handleSwitchChain: (request: { chainId: number; onSuccess?: () => void }) => mocks.switches.push(request)
  })
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
  useCctpClaimLegs: (params: { enabled: boolean }) => {
    mocks.claimEnabled = params.enabled;
    return {
      calls: [],
      isBatch: false,
      ready: false,
      error: null,
      execute: () => undefined,
      reset: () => undefined
    };
  }
}));
vi.mock('./useCctpConvertLegs', () => ({
  useCctpConvertLegs: (params: ConvertParams) => {
    mocks.convert.params = params;
    const { calls, isBatch, ready, error, execute, reset } = mocks.convert;
    return { calls, isBatch, ready, error, execute, reset };
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
vi.mock('../adapters/mockAdapter', () => ({
  runMockLegs: (names: string[]) => {
    mocks.mockLegs.push(names);
    return new Promise<string>(() => undefined);
  }
}));

const NOW = 1_800_000_000_000;
// 100 USDS bridged mints 100 USDC.
const MINTED = 100n * 10n ** 6n;
let accountSeq = 0;
const scope = () => pendingScopeKey({ account: mocks.address, familyChainId: 1 });
const stored = () => pendingBridgeStore.getSnapshot(scope()).find(entry => entry.id === '0xburn')!;

const seed = ({ recipient, claimed = true }: { recipient?: string; claimed?: boolean } = {}) => {
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
      recipient,
      route: resolved.route,
      txHash: '0xburn',
      now: NOW
    }),
    { kind: 'ready', nextAction: 'claim' },
    NOW
  );
  pendingBridgeStore.upsert(
    scope(),
    claimed ? recordAction(ready, { action: 'claim', txHash: '0xclaim', at: NOW }) : ready
  );
  return stored();
};

const confirm = () => act(() => mocks.launched.at(-1)!.onConfirm!());
const convertActions = (bridge: PendingBridge = stored()) =>
  bridge.actions.filter(a => a.action === 'convert');

describe('useDestinationActionLaunch: converting a CCTP claim to USDS', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  beforeEach(() => {
    mocks.address = `0x${(4000 + ++accountSeq).toString(16).padStart(40, '0')}`;
    mocks.walletChainId = 1;
    mocks.isSafe = false;
    mocks.canSwitchChain = true;
    mocks.switches = [];
    mocks.launched = [];
    mocks.updates = [];
    mocks.mockLegs = [];
    mocks.claimEnabled = false;
    mocks.convert = {
      params: undefined,
      calls: [],
      isBatch: false,
      ready: false,
      error: null,
      execute: vi.fn(),
      reset: vi.fn()
    };
  });

  it('builds the convert legs on Ethereum for the offered amount and the connected account', () => {
    const card = seed();
    const { result } = renderHook(() => useDestinationActionLaunch());
    expect(mocks.convert.params?.enabled).toBe(false);
    act(() => result.current.launch(card, 'convert', MINTED));
    expect(mocks.convert.params).toMatchObject({
      enabled: true,
      amount: MINTED,
      chainId: 1,
      account: mocks.address
    });
    expect(mocks.claimEnabled).toBe(false);
  });

  it('opens the conversion of the USDC amount, with the conversion step', () => {
    const card = seed();
    const { result } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card, 'convert', 40n * 10n ** 6n));
    const config = mocks.launched.at(-1)!;
    const hero = config.transactionScreenContent;
    expect(isValidElement(hero) && hero.props).toMatchObject({
      from: { amount: '40.00', symbol: 'USDC' },
      to: { amount: '40.00', symbol: 'USDS' }
    });
    expect(config.toast?.loading).toBe('Converting 40.00 USDC to USDS');
    expect(
      (config.steps as { label: string; tokenSymbol: string; targetTokenSymbol?: string }[] | undefined)?.map(
        step => `${step.label} ${step.tokenSymbol} to ${step.targetTokenSymbol}`
      )
    ).toEqual(['Convert USDC to USDS']);
    expect(config.usdValue).toBe(40);
  });

  it('shows one step per call once built: the approve when short and the sale', () => {
    const card = seed();
    const { result, rerender } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card, 'convert', MINTED));
    mocks.convert.calls = [{ functionName: 'approve' }, { functionName: 'sellGem' }];
    rerender();
    const steps = mocks.updates.at(-1)?.partial.steps as {
      label: string;
      tokenSymbol: string;
      targetTokenSymbol?: string;
    }[];
    expect(
      steps.map(step => [step.label, step.tokenSymbol, step.targetTokenSymbol].filter(Boolean).join(' '))
    ).toEqual(['Approve USDC', 'Convert USDC USDS']);
  });

  it('sends the convert legs on Confirm, never the mock executor', () => {
    mocks.convert.ready = true;
    const card = seed();
    const { result } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card, 'convert', MINTED));
    confirm();
    expect(mocks.convert.execute).toHaveBeenCalledTimes(1);
    expect(mocks.mockLegs).toEqual([]);
  });

  it('records the convert at broadcast and once confirmed, leaving the bridge claimed', () => {
    mocks.convert.ready = true;
    const card = seed();
    const { result } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card, 'convert', MINTED));
    confirm();
    const callbacks = mocks.convert.params!.getCallbacks();
    callbacks.onStart('0xsell');
    expect(convertActions()).toEqual([
      { action: 'convert', txHash: '0xsell', at: expect.any(Number), status: 'sent' }
    ]);
    callbacks.onSuccess('0xsell');
    expect(convertActions()).toEqual([{ action: 'convert', txHash: '0xsell', at: expect.any(Number) }]);
    expect(stored()).toMatchObject({ status: 'claimed', settledAt: card.settledAt });
  });

  it('is never launched twice: not while sent, not once confirmed, and Retry sends nothing more', () => {
    mocks.convert.ready = true;
    const card = seed();
    const { result } = renderHook(() => useDestinationActionLaunch());
    expect(result.current.canLaunch(card, 'convert')).toBe(true);
    act(() => result.current.launch(card, 'convert', MINTED));
    confirm();
    const callbacks = mocks.convert.params!.getCallbacks();
    callbacks.onStart('0xsell');
    callbacks.onError(new Error('rpc timeout'), '0xsell');
    confirm();
    expect(mocks.convert.execute).toHaveBeenCalledTimes(1);
    expect(result.current.canLaunch(stored(), 'convert')).toBe(false);
    act(() => result.current.launch(card, 'convert', MINTED));
    expect(mocks.launched).toHaveLength(1);

    callbacks.onSuccess('0xsell');
    act(() => result.current.launch(stored(), 'convert', MINTED));
    expect(mocks.launched).toHaveLength(1);
  });

  it('can be launched again once the sent one reverted', () => {
    mocks.convert.ready = true;
    const card = seed();
    const { result } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card, 'convert', MINTED));
    confirm();
    const callbacks = mocks.convert.params!.getCallbacks();
    callbacks.onStart('0xsell');
    callbacks.onError(new TransactionRevertedError(), '0xsell');
    expect(convertActions()).toEqual([]);
    act(() => result.current.launch(stored(), 'convert', MINTED));
    expect(mocks.launched).toHaveLength(2);
  });

  it("converts a claim sent to this wallet from another account's list, recorded in the sender's entry", () => {
    mocks.convert.ready = true;
    const recipient = mocks.address;
    mocks.address = `0x${(4500 + accountSeq).toString(16).padStart(40, '0')}`;
    const senderScope = scope();
    const card = seed({ recipient });
    mocks.address = recipient;
    const { result } = renderHook(() => useDestinationActionLaunch());
    expect(result.current.canLaunch(card, 'convert')).toBe(true);

    act(() => result.current.launchIn(senderScope, card, 'convert', MINTED));
    confirm();
    expect(mocks.convert.execute).toHaveBeenCalledTimes(1);
    mocks.convert.params!.getCallbacks().onStart('0xsell');
    const entry = pendingBridgeStore.getSnapshot(senderScope).find(bridge => bridge.id === card.id)!;
    expect(convertActions(entry)).toEqual([
      { action: 'convert', txHash: '0xsell', at: expect.any(Number), status: 'sent' }
    ]);
    expect(pendingBridgeStore.getSnapshot(scope())).toEqual([]);
  });

  it('opens nothing before the claim', () => {
    const unclaimed = seed({ claimed: false });
    const { result } = renderHook(() => useDestinationActionLaunch());
    expect(result.current.canLaunch(unclaimed, 'convert')).toBe(false);
    act(() => result.current.launch(unclaimed, 'convert', MINTED));
    expect(mocks.launched).toEqual([]);
  });

  it.each([undefined, 0n, MINTED + 1n])('opens nothing for an amount the claim did not mint: %s', amount => {
    const card = seed();
    const { result } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card, 'convert', amount));
    expect(mocks.launched).toEqual([]);
    expect(mocks.switches).toEqual([]);
    act(() => result.current.launch(card, 'convert', MINTED));
    expect(mocks.launched).toHaveLength(1);
  });

  it("opens nothing for an account that isn't the recipient", () => {
    const card = seed({ recipient: `0x${'1'.repeat(40)}` });
    const { result } = renderHook(() => useDestinationActionLaunch());
    expect(result.current.canLaunch(card, 'convert')).toBe(false);
    act(() => result.current.launch(card, 'convert', MINTED));
    expect(mocks.launched).toEqual([]);
  });

  it('sends nothing when the wallet moved to another account before Confirm', () => {
    mocks.convert.ready = true;
    const card = seed();
    const { result, rerender } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card, 'convert', MINTED));
    mocks.address = `0x${'2'.repeat(40)}`;
    rerender();
    confirm();
    expect(mocks.convert.execute).not.toHaveBeenCalled();
  });

  it('switches a wallet on another network first, then opens on the same amount', () => {
    mocks.walletChainId = 8453;
    const card = seed();
    const { result, rerender } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card, 'convert', 40n * 10n ** 6n));
    expect(mocks.switches.map(({ chainId }) => chainId)).toEqual([1]);
    act(() => mocks.switches[0].onSuccess!());
    mocks.walletChainId = 1;
    rerender();
    expect(mocks.launched).toHaveLength(1);
    expect(mocks.convert.params).toMatchObject({ enabled: true, amount: 40n * 10n ** 6n });
  });

  it('marks a convert a Safe sent, for the tracker to read from the Safe service', () => {
    mocks.isSafe = true;
    mocks.convert.ready = true;
    const card = seed();
    const { result } = renderHook(() => useDestinationActionLaunch());
    act(() => result.current.launch(card, 'convert', MINTED));
    confirm();
    mocks.convert.params!.getCallbacks().onStart('0xsafesell');
    expect(convertActions()).toEqual([
      expect.objectContaining({ txHash: '0xsafesell', status: 'sent', safe: true })
    ]);
  });

  describe('the hint on a card that offers it', () => {
    it('says the convert waits to confirm, or for the Safe to execute it', () => {
      mocks.convert.ready = true;
      seed();
      const { result } = renderHook(() => useDestinationActionLaunch());
      expect(result.current.actionHint(stored(), 'convert')).toBeUndefined();
      act(() => result.current.launch(stored(), 'convert', MINTED));
      confirm();
      mocks.convert.params!.getCallbacks().onStart('0xsell');
      expect(result.current.actionHint(stored(), 'convert')).toEqual({
        kind: 'action-sent',
        network: 'ethereum'
      });
    });

    it('tells a wallet that cannot be switched to switch to Ethereum', () => {
      mocks.walletChainId = 8453;
      mocks.canSwitchChain = false;
      mocks.isSafe = true;
      seed();
      const { result } = renderHook(() => useDestinationActionLaunch());
      expect(result.current.canLaunch(stored(), 'convert')).toBe(false);
      expect(result.current.actionHint(stored(), 'convert')).toEqual({
        kind: 'switch-network',
        network: 'ethereum',
        safe: true
      });
    });

    it('the claim hint ignores a convert: a settled card shows no action button', () => {
      mocks.convert.ready = true;
      seed();
      const { result } = renderHook(() => useDestinationActionLaunch());
      act(() => result.current.launch(stored(), 'convert', MINTED));
      confirm();
      mocks.convert.params!.getCallbacks().onStart('0xsell');
      expect(result.current.actionHint(stored())).toBeUndefined();
    });
  });
});
