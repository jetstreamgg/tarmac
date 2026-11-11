import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Call } from 'viem';

// A run's later steps belong to the chain its first step was sent on. The wallet
// moving to another chain between steps must never get the next step there: the
// same address on another chain is a different contract, or none.

const wagmi = vi.hoisted(() => ({
  onWriteSuccess: undefined as undefined | ((hash: `0x${string}`) => void),
  writeContract: vi.fn(),
  resetWrite: vi.fn(),
  address: undefined as string | undefined,
  // The wallet's chain: what wagmi simulates on when no chainId is passed.
  walletChainId: 1,
  simulateArgs: [] as Record<string, unknown>[],
  // When set, a refetch resolves only after this promise does (a slow RPC).
  refetchGate: undefined as Promise<void> | undefined,
  mutationHash: undefined as `0x${string}` | undefined,
  receipt: { isLoading: false, isSuccess: false, failure: null as Error | null }
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ connector: undefined, address: wagmi.address, chainId: wagmi.walletChainId }),
  useSimulateContract: (params: Record<string, unknown>) => {
    wagmi.simulateArgs.push(params);
    // Like wagmi: the request carries the pinned chain, or the wallet's.
    const simulate = () => ({
      data: {
        request: {
          address: params.address,
          functionName: params.functionName,
          chainId: (params.chainId as number | undefined) ?? wagmi.walletChainId
        }
      },
      isLoading: false,
      error: null
    });
    return {
      ...simulate(),
      refetch: async () => {
        if (wagmi.refetchGate) await wagmi.refetchGate;
        return simulate();
      }
    };
  },
  useWriteContract: (opts: { mutation: { onSuccess?: (hash: `0x${string}`) => void } }) => {
    wagmi.onWriteSuccess = opts.mutation.onSuccess;
    return {
      writeContract: wagmi.writeContract,
      error: null,
      data: wagmi.mutationHash,
      isPending: false,
      reset: wagmi.resetWrite
    };
  }
}));

vi.mock('@/hooks/shared/useTransactionOutcome', () => ({
  useTransactionOutcome: () => ({
    isPending: wagmi.receipt.isLoading,
    isSuccess: wagmi.receipt.isSuccess,
    failure: wagmi.receipt.failure,
    receipt: undefined
  })
}));

vi.mock('@/hooks/shared/useWaitForSafeTxHash', () => ({
  useWaitForSafeTxHash: () => ({ transactionHash: undefined, isSafeApp: false })
}));

import { useSequentialTransactionFlow } from '@/hooks/shared/useSequentialTransactionFlow';
import { isStalledStep } from '@/hooks/helpers';

const ETHEREUM = 1;
const BASE = 8453;
const ACCOUNT = '0x00000000000000000000000000000000000000aA';
const TOKEN = '0x0000000000000000000000000000000000000010' as `0x${string}`;
const BRIDGE = '0x0000000000000000000000000000000000000220' as `0x${string}`;

const APPROVE = { to: TOKEN, abi: [], functionName: 'approve', args: [BRIDGE, 100n] } as unknown as Call;
const BRIDGE_CALL = {
  to: BRIDGE,
  abi: [],
  functionName: 'bridgeERC20To',
  args: [TOKEN, TOKEN, ACCOUNT, 100n, 200000, '0x']
} as unknown as Call;

function resetWagmi() {
  wagmi.onWriteSuccess = undefined;
  wagmi.writeContract = vi.fn();
  wagmi.resetWrite = vi.fn();
  wagmi.address = ACCOUNT;
  wagmi.walletChainId = ETHEREUM;
  wagmi.simulateArgs = [];
  wagmi.refetchGate = undefined;
  wagmi.mutationHash = undefined;
  wagmi.receipt = { isLoading: false, isSuccess: false, failure: null };
}

type Hook = ReturnType<typeof start>['hook'];

// Confirm on Ethereum: the approve is in the wallet, then mining.
function start(chainIdProp: () => number = () => ETHEREUM) {
  const onError = vi.fn();
  const hook = renderHook(() =>
    useSequentialTransactionFlow({ calls: [APPROVE, BRIDGE_CALL], chainId: chainIdProp(), onError })
  );
  act(() => hook.result.current.execute());
  act(() => {
    wagmi.mutationHash = '0xapprove';
    wagmi.receipt = { isLoading: true, isSuccess: false, failure: null };
    wagmi.onWriteSuccess?.('0xapprove');
  });
  hook.rerender();
  return { hook, onError };
}

function switchWallet(hook: Hook, chainId: number) {
  wagmi.walletChainId = chainId;
  hook.rerender();
}

function mineApprove(hook: Hook) {
  act(() => {
    wagmi.receipt = { isLoading: false, isSuccess: true, failure: null };
  });
  hook.rerender();
}

const sentOn = () =>
  wagmi.writeContract.mock.calls.map(([request]) => (request as { chainId: number }).chainId);
const sentBridges = () =>
  wagmi.writeContract.mock.calls.filter(
    ([request]) => (request as { functionName: string }).functionName === 'bridgeERC20To'
  );

describe('useSequentialTransactionFlow — the wallet switches chains mid-run', () => {
  beforeEach(resetWagmi);
  afterEach(() => vi.clearAllMocks());

  it('sends every step on the starting chain when the wallet stays on it', () => {
    const { hook, onError } = start();
    mineApprove(hook);

    expect(sentOn()).toEqual([ETHEREUM, ETHEREUM]);
    expect(sentBridges()).toHaveLength(1);
    expect(onError).not.toHaveBeenCalled();
  });

  for (const [label, chainIdProp] of [
    ['the caller keeps naming the starting chain', () => ETHEREUM],
    ['the caller follows the wallet', () => wagmi.walletChainId]
  ] as const) {
    describe(label, () => {
      it('pauses instead of sending the next step on the new chain', () => {
        const { hook, onError } = start(chainIdProp);
        switchWallet(hook, BASE);
        mineApprove(hook);

        expect(hook.result.current.currentCallIndex).toBe(1);
        expect(sentBridges()).toHaveLength(0);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(isStalledStep(onError.mock.calls[0][0])).toBe(true);
        expect(hook.result.current.isLoading).toBe(false);
      });

      it('never simulates a later step on the new chain', () => {
        const { hook } = start(chainIdProp);
        switchWallet(hook, BASE);
        mineApprove(hook);

        const laterSteps = wagmi.simulateArgs.filter(args => args.functionName === 'bridgeERC20To');
        const enabled = laterSteps.filter(args => (args.query as { enabled: boolean }).enabled);
        expect(enabled.length).toBeGreaterThan(0);
        expect(enabled.map(args => args.chainId)).toEqual(enabled.map(() => ETHEREUM));
      });

      it('a Retry on the new chain sends nothing and reports again', async () => {
        const { hook, onError } = start(chainIdProp);
        switchWallet(hook, BASE);
        mineApprove(hook);

        await act(async () => hook.result.current.execute());

        expect(sentBridges()).toHaveLength(0);
        expect(onError).toHaveBeenCalledTimes(2);
      });

      it('back on the starting chain, only a Retry sends the step, on that chain', async () => {
        const { hook, onError } = start(chainIdProp);
        switchWallet(hook, BASE);
        mineApprove(hook);

        switchWallet(hook, ETHEREUM);
        expect(sentBridges()).toHaveLength(0);

        await act(async () => hook.result.current.execute());
        expect(sentOn()).toEqual([ETHEREUM, ETHEREUM]);
        expect(sentBridges()).toHaveLength(1);
        expect(onError).toHaveBeenCalledTimes(1);
      });
    });
  }

  it('a wallet that left and came back before the step mined sends the next step', () => {
    const { hook, onError } = start();
    switchWallet(hook, BASE);
    switchWallet(hook, ETHEREUM);
    mineApprove(hook);

    expect(sentOn()).toEqual([ETHEREUM, ETHEREUM]);
    expect(onError).not.toHaveBeenCalled();
  });

  it('a Retry re-simulating a reverted step sends nothing when the chain switches before it lands', async () => {
    const { hook, onError } = start();
    mineApprove(hook);
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: false, failure: null };
      wagmi.mutationHash = '0xbridge';
      wagmi.onWriteSuccess?.('0xbridge');
    });
    hook.rerender();
    act(() => {
      wagmi.receipt = { isLoading: false, isSuccess: false, failure: new Error('execution reverted') };
    });
    hook.rerender();
    expect(onError).toHaveBeenCalledTimes(1);

    let release = () => {};
    wagmi.refetchGate = new Promise<void>(resolve => (release = resolve));
    act(() => hook.result.current.execute());
    switchWallet(hook, BASE);
    await act(async () => release());

    expect(sentBridges()).toHaveLength(1); // the reverted one
    expect(onError).toHaveBeenCalledTimes(2);
  });
});
