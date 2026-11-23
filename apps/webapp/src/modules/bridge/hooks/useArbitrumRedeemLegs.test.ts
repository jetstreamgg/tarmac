/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { encodeFunctionData } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { ARB_RETRYABLE_TX } from '../adapters/nativeDeposit/contracts';
import { ARBITRUM_TICKET } from '../adapters/nativeDeposit/depositFixtures';
import { useArbitrumRedeemLegs } from './useArbitrumRedeemLegs';

const mocks = vi.hoisted(() => ({
  estimate: undefined as undefined | Record<string, unknown>,
  gas: undefined as bigint | undefined,
  estimateError: null as Error | null,
  flow: undefined as undefined | Record<string, unknown>,
  prepared: true,
  simulationError: null as Error | null
}));

vi.mock('wagmi', () => ({
  useEstimateGas: (params: Record<string, unknown>) => {
    mocks.estimate = params;
    return { data: mocks.gas, error: mocks.estimateError };
  }
}));
vi.mock('@/hooks/shared/useSequentialTransactionFlow', () => ({
  useSequentialTransactionFlow: (params: Record<string, unknown>) => {
    mocks.flow = params;
    return { prepared: mocks.prepared, error: mocks.simulationError, execute: vi.fn(), reset: vi.fn() };
  }
}));

const ACCOUNT = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
// redeem(bytes32) on ArbRetryableTx, as Arbitrum's retryables tool sends it for this ticket.
const REDEEM_CALLDATA = `0xeda1122c${ARBITRUM_TICKET.ticketId.slice(2)}`;
// keepalive(bytes32), the selector of the mainnet keepalive 0x4055f635…9834.
const KEEPALIVE_CALLDATA = `0xf0b21a41${ARBITRUM_TICKET.ticketId.slice(2)}`;
const getCallbacks = () => ({}) as TxCallbacks;

const render = (overrides: Partial<Parameters<typeof useArbitrumRedeemLegs>[0]> = {}) =>
  renderHook(() =>
    useArbitrumRedeemLegs({
      enabled: true,
      routeData: { ticketId: ARBITRUM_TICKET.ticketId, timeout: '1' },
      chainId: 42161,
      account: ACCOUNT,
      getCallbacks,
      ...overrides
    })
  ).result.current;

describe('useArbitrumRedeemLegs', () => {
  beforeEach(() => {
    mocks.estimate = undefined;
    mocks.gas = 159_976n;
    mocks.estimateError = null;
    mocks.flow = undefined;
    mocks.prepared = true;
    mocks.simulationError = null;
  });

  it('sends redeem(ticketId) on ArbRetryableTx with 1.2x the Arbitrum estimate', () => {
    expect(render().ready).toBe(true);
    expect(mocks.estimate).toMatchObject({
      to: ARB_RETRYABLE_TX,
      data: REDEEM_CALLDATA,
      account: ACCOUNT,
      chainId: 42161,
      query: { enabled: true }
    });
    const calls = mocks.flow!.calls as Parameters<typeof encodeFunctionData>[0][];
    expect(mocks.flow).toMatchObject({ enabled: true, chainId: 42161, failOnReplaced: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ to: ARB_RETRYABLE_TX, gas: 191_971n });
    expect(encodeFunctionData(calls[0])).toBe(REDEEM_CALLDATA);
  });

  it('sends keepalive(ticketId) on ArbRetryableTx with 1.2x the Arbitrum estimate', () => {
    mocks.gas = 152_254n;
    expect(render({ action: 'keepalive' }).ready).toBe(true);
    expect(mocks.estimate).toMatchObject({ to: ARB_RETRYABLE_TX, data: KEEPALIVE_CALLDATA });
    const calls = mocks.flow!.calls as Parameters<typeof encodeFunctionData>[0][];
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ to: ARB_RETRYABLE_TX, gas: 182_704n });
    expect(encodeFunctionData(calls[0])).toBe(KEEPALIVE_CALLDATA);
  });

  it('reports a keepalive whose ticket is gone (its estimate reverts)', () => {
    mocks.gas = undefined;
    mocks.estimateError = new Error('NoTicketWithID');
    const legs = render({ action: 'keepalive' });
    expect(legs).toMatchObject({ ready: false, error: mocks.estimateError });
    expect(mocks.flow).toMatchObject({ calls: [], enabled: false });
  });

  it('builds no call while the estimate is loading', () => {
    mocks.gas = undefined;
    expect(render().ready).toBe(false);
    expect(mocks.flow).toMatchObject({ calls: [], enabled: false });
  });

  it('reads nothing while disabled', () => {
    const legs = render({ enabled: false });
    expect(mocks.estimate).toMatchObject({ query: { enabled: false } });
    expect(mocks.flow).toMatchObject({ calls: [] });
    expect(legs).toMatchObject({ ready: false, error: null });
  });

  it.each([undefined, {}, { ticketId: '0x1234' }, { ticketId: `0x${'g'.repeat(64)}` }])(
    'reports a missing or malformed ticket id, and builds nothing (%o)',
    routeData => {
      const legs = render({ routeData: routeData as Record<string, string> | undefined });
      expect(legs.error).toBeInstanceOf(Error);
      expect(mocks.estimate).toMatchObject({ query: { enabled: false } });
      expect(mocks.flow).toMatchObject({ calls: [] });
    }
  );

  it('reports a failed estimate (a ticket already redeemed reverts it) or simulation', () => {
    mocks.gas = undefined;
    mocks.estimateError = new Error('NoTicketWithID');
    expect(render().error).toBe(mocks.estimateError);
    mocks.gas = 159_976n;
    mocks.estimateError = null;
    mocks.prepared = false;
    mocks.simulationError = new Error('reverted');
    expect(render()).toMatchObject({ ready: false, error: mocks.simulationError });
  });

  it('estimates nothing without an account', () => {
    render({ account: undefined });
    expect(mocks.estimate).toMatchObject({ query: { enabled: false } });
  });
});
