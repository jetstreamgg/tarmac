/**
 * @vitest-environment happy-dom
 */
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { encodeFunctionData } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { OP_STACK_DEPOSIT } from '../adapters/nativeDeposit/contracts';
import { ARBITRUM_WITHDRAWAL, OP_STACK_WITHDRAWAL } from '../adapters/nativeWithdrawal/contracts';
import { opStackWithdrawalMessage } from '../adapters/nativeWithdrawal/opStack';
import { BASE_WITHDRAWAL_LOGS, BASE_WITHDRAWAL_TX } from '../adapters/nativeWithdrawal/withdrawalFixtures';
import type { PendingBridge } from '../model/types';
import { useNativeWithdrawalActionLegs } from './useNativeWithdrawalActionLegs';

const mocks = vi.hoisted(() => ({
  read: undefined as undefined | Record<string, unknown>,
  baseGas: 600_000n as bigint | undefined,
  flow: undefined as undefined | Record<string, unknown>,
  built: [] as Record<string, unknown>[],
  buildError: null as Error | null
}));

vi.mock('wagmi', () => ({
  useConfig: () => ({}),
  useReadContract: (params: Record<string, unknown>) => {
    mocks.read = params;
    return { data: mocks.baseGas, error: null };
  }
}));
vi.mock('./usePendingScope', () => ({ usePendingScope: () => ({ familyChainId: 1 }) }));
vi.mock('./adapterContext', () => ({
  wagmiAdapterContext: () => ({ getClient: (network: string) => ({ network }) })
}));
vi.mock('../adapters/nativeWithdrawal/arbitrumProgress', () => ({
  arbitrumExecuteFromChain: async (args: Record<string, unknown>) => {
    mocks.built.push({ ...args, arbitrum: true });
    return { address: ARBITRUM_WITHDRAWAL.outbox, abi: [], functionName: 'executeTransaction', args: [] };
  }
}));
vi.mock('../adapters/nativeWithdrawal/opStackActions', () => ({
  opStackWithdrawalActionCall: async (args: Record<string, unknown>) => {
    mocks.built.push(args);
    if (mocks.buildError) throw mocks.buildError;
    return {
      address: OP_STACK_DEPOSIT.base.portal,
      abi: [],
      functionName:
        args.action === 'prove' ? 'proveWithdrawalTransaction' : 'finalizeWithdrawalTransactionExternalProof',
      args: []
    };
  }
}));
vi.mock('@/hooks/shared/useSequentialTransactionFlow', () => ({
  useSequentialTransactionFlow: (params: Record<string, unknown>) => {
    mocks.flow = params;
    return { prepared: true, error: null, execute: vi.fn(), reset: vi.fn() };
  }
}));

const MESSAGE = opStackWithdrawalMessage(BASE_WITHDRAWAL_LOGS, 'base')!;
const BRIDGE = {
  id: BASE_WITHDRAWAL_TX.hash,
  txHash: BASE_WITHDRAWAL_TX.hash,
  amount: MESSAGE.amount,
  recipient: MESSAGE.to,
  account: MESSAGE.from.toLowerCase(),
  routeData: { msgHash: MESSAGE.msgHash, relayCalldata: MESSAGE.withdrawal.data }
} as unknown as PendingBridge;
const getCallbacks = () => ({}) as TxCallbacks;

const render = (overrides: Partial<Parameters<typeof useNativeWithdrawalActionLegs>[0]> = {}) => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    () =>
      useNativeWithdrawalActionLegs({
        action: 'replay',
        enabled: true,
        network: 'base',
        bridge: BRIDGE,
        chainId: 1,
        getCallbacks,
        ...overrides
      }),
    { wrapper }
  );
};

describe('useNativeWithdrawalActionLegs', () => {
  beforeEach(() => {
    Object.assign(mocks, {
      read: undefined,
      baseGas: 600_000n,
      flow: undefined,
      built: [],
      buildError: null
    });
  });

  it('retries a failed relay on the L1 messenger with 1.2x its baseGas, building no portal call', () => {
    const { result } = render();
    expect(result.current.ready).toBe(true);
    expect(mocks.read).toMatchObject({
      address: OP_STACK_WITHDRAWAL.base.l1Messenger,
      functionName: 'baseGas',
      chainId: 1,
      query: { enabled: true }
    });
    const calls = mocks.flow!.calls as Parameters<typeof encodeFunctionData>[0][];
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ to: OP_STACK_WITHDRAWAL.base.l1Messenger, gas: 720_000n });
    expect(encodeFunctionData(calls[0])).toBe(MESSAGE.withdrawal.data);
    expect(mocks.built).toEqual([]);
  });

  it.each(['prove', 'finalize'] as const)(
    'sends the %s it built from the chain, on the portal',
    async action => {
      const { result } = render({ action });
      await waitFor(() => expect(result.current.ready).toBe(true));
      expect(mocks.built[0]).toMatchObject({ action, network: 'base', bridge: BRIDGE });
      expect(mocks.read).toMatchObject({ query: { enabled: false } });
      expect(mocks.flow).toMatchObject({ enabled: true, chainId: 1, failOnReplaced: true });
      expect((mocks.flow!.calls as { to: string }[])[0].to).toBe(OP_STACK_DEPOSIT.base.portal);
    }
  );

  it('executes an Arbitrum withdrawal on the outbox as its finalize, and never proves or replays it', async () => {
    const { result } = render({ action: 'finalize', network: 'arbitrum' });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(mocks.built[0]).toMatchObject({ arbitrum: true, bridge: BRIDGE });
    expect((mocks.flow!.calls as { to: string }[])[0].to).toBe(ARBITRUM_WITHDRAWAL.outbox);
    for (const action of ['prove', 'replay'] as const) {
      mocks.built = [];
      const other = render({ action, network: 'arbitrum' }).result;
      expect(other.current.ready).toBe(false);
      expect(mocks.built).toEqual([]);
    }
  });

  it("reports a prove that couldn't be built, and sends nothing", async () => {
    mocks.buildError = new Error("The L2 state doesn't match the dispute game's root.");
    const { result } = render({ action: 'prove' });
    await waitFor(() => expect(result.current.error).toBe(mocks.buildError));
    expect(result.current.ready).toBe(false);
    expect(mocks.flow).toMatchObject({ calls: [], enabled: false });
  });

  it('reports a stored retry that does not check out', () => {
    const { result } = render({ network: 'optimism' });
    expect(result.current.error).toBeInstanceOf(Error);
    expect(mocks.flow).toMatchObject({ calls: [] });
  });

  it('builds and reads nothing while disabled', () => {
    const { result } = render({ enabled: false, action: 'prove' });
    expect(mocks.built).toEqual([]);
    expect(mocks.read).toMatchObject({ query: { enabled: false } });
    expect(result.current).toMatchObject({ ready: false, error: null });
  });
});
