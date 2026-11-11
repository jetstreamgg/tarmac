/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { encodeFunctionData } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { L2_CROSS_DOMAIN_MESSENGER } from '../adapters/nativeDeposit/contracts';
import { BASE_DEPOSIT_LOGS } from '../adapters/nativeDeposit/depositFixtures';
import { opStackDepositMessage } from '../adapters/nativeDeposit/opStack';
import { useOpStackReplayLegs } from './useOpStackReplayLegs';

const mocks = vi.hoisted(() => ({
  read: undefined as undefined | Record<string, unknown>,
  baseGas: undefined as bigint | undefined,
  readError: null as Error | null,
  flow: undefined as undefined | Record<string, unknown>,
  prepared: true,
  simulationError: null as Error | null
}));

vi.mock('wagmi', () => ({
  useReadContract: (params: Record<string, unknown>) => {
    mocks.read = params;
    return { data: mocks.baseGas, error: mocks.readError };
  }
}));
vi.mock('@/hooks/shared/useSequentialTransactionFlow', () => ({
  useSequentialTransactionFlow: (params: Record<string, unknown>) => {
    mocks.flow = params;
    return { prepared: mocks.prepared, error: mocks.simulationError, execute: vi.fn(), reset: vi.fn() };
  }
}));

const MESSAGE = opStackDepositMessage(BASE_DEPOSIT_LOGS, 'base')!;
const ROUTE_DATA = {
  msgHash: MESSAGE.msgHash,
  l2TxHash: MESSAGE.l2TxHash,
  relayCalldata: MESSAGE.relayCalldata
};
const getCallbacks = () => ({}) as TxCallbacks;

const render = (overrides: Partial<Parameters<typeof useOpStackReplayLegs>[0]> = {}) =>
  renderHook(() =>
    useOpStackReplayLegs({
      enabled: true,
      network: 'base',
      routeData: ROUTE_DATA,
      chainId: 8453,
      getCallbacks,
      ...overrides
    })
  ).result.current;

describe('useOpStackReplayLegs', () => {
  beforeEach(() => {
    mocks.read = undefined;
    mocks.baseGas = 593_409n;
    mocks.readError = null;
    mocks.flow = undefined;
    mocks.prepared = true;
    mocks.simulationError = null;
  });

  it("sends the stored relayMessage on the L2 with 1.2x the messenger's baseGas", () => {
    expect(render().ready).toBe(true);
    expect(mocks.read).toMatchObject({ functionName: 'baseGas', chainId: 8453, query: { enabled: true } });
    const calls = mocks.flow!.calls as Parameters<typeof encodeFunctionData>[0][];
    expect(mocks.flow).toMatchObject({ enabled: true, chainId: 8453, failOnReplaced: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ to: L2_CROSS_DOMAIN_MESSENGER, gas: 712_090n });
    expect(encodeFunctionData(calls[0])).toBe(MESSAGE.relayCalldata);
  });

  it('builds no call while baseGas is loading', () => {
    mocks.baseGas = undefined;
    const legs = render();
    expect(legs.ready).toBe(false);
    expect(mocks.flow).toMatchObject({ calls: [], enabled: false });
  });

  it('reads nothing while disabled', () => {
    const legs = render({ enabled: false });
    expect(mocks.read).toMatchObject({ query: { enabled: false } });
    expect(mocks.flow).toMatchObject({ calls: [] });
    expect(legs).toMatchObject({ ready: false, error: null });
  });

  it('reports a message that does not check out, and builds nothing from it', () => {
    const legs = render({ network: 'optimism' });
    expect(legs.error).toBeInstanceOf(Error);
    expect(mocks.read).toMatchObject({ query: { enabled: false } });
    expect(mocks.flow).toMatchObject({ calls: [] });
  });

  it('reports a failed baseGas read or simulation', () => {
    mocks.baseGas = undefined;
    mocks.readError = new Error('rpc down');
    expect(render().error).toBe(mocks.readError);
    mocks.baseGas = 593_409n;
    mocks.readError = null;
    mocks.prepared = false;
    mocks.simulationError = new Error('reverted');
    expect(render()).toMatchObject({ ready: false, error: mocks.simulationError });
  });
});
