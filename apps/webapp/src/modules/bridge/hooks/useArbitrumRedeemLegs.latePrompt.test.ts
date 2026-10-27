/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { TxMutateVariables, UseSequentialTransactionFlowParameters } from '@/hooks/hooks';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { ARBITRUM_TICKET } from '../adapters/nativeDeposit/depositFixtures';
import { useArbitrumRedeemLegs } from './useArbitrumRedeemLegs';

// A prompt opened by an earlier card's Confirm is never reported to the card whose Confirm is current.

const mocks = vi.hoisted(() => ({
  flow: undefined as undefined | Record<string, unknown>
}));

vi.mock('wagmi', () => ({
  useEstimateGas: () => ({ data: 159_976n, error: null })
}));
vi.mock('@/hooks/shared/useSequentialTransactionFlow', () => ({
  useSequentialTransactionFlow: (params: Record<string, unknown>) => {
    mocks.flow = params;
    return { prepared: true, error: null, execute: vi.fn(), reset: vi.fn() };
  }
}));

type MockCallbacks = { [K in keyof TxCallbacks]: Mock };
const makeCallbacks = (): MockCallbacks => ({
  onMutate: vi.fn(),
  onStart: vi.fn(),
  onSuccess: vi.fn(),
  onError: vi.fn()
});

const ACCOUNT = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
const HASH_A = `0x${'a'.repeat(64)}`;
const HASH_B = `0x${'b'.repeat(64)}`;

describe('useArbitrumRedeemLegs: a prompt signed or rejected late', () => {
  let current: { value: MockCallbacks };
  let A: MockCallbacks;
  let B: MockCallbacks;
  let variablesA: TxMutateVariables;
  let variablesB: TxMutateVariables;
  let engine: Required<
    Pick<UseSequentialTransactionFlowParameters, 'onMutate' | 'onStart' | 'onSuccess' | 'onError'>
  >;

  beforeEach(() => {
    mocks.flow = undefined;
    A = makeCallbacks();
    B = makeCallbacks();
    current = { value: A };
    // Distinct request objects, as the engine dispatches one per wallet prompt.
    variablesA = { functionName: 'redeem', args: [ARBITRUM_TICKET.ticketId] } as TxMutateVariables;
    variablesB = { functionName: 'redeem', args: [ARBITRUM_TICKET.ticketId] } as TxMutateVariables;

    renderHook(() =>
      useArbitrumRedeemLegs({
        enabled: true,
        routeData: { ticketId: ARBITRUM_TICKET.ticketId, timeout: '1' },
        chainId: 42161,
        account: ACCOUNT,
        getCallbacks: () => current.value as unknown as TxCallbacks
      })
    );
    engine = mocks.flow as unknown as typeof engine;

    // Card A's Confirm opens prompt A; the user leaves it open and closes A's modal.
    engine.onMutate(variablesA);
    // Card B's Confirm re-points the callbacks and opens prompt B.
    current.value = B;
    engine.onMutate(variablesB);
    expect(B.onMutate).toHaveBeenCalledWith(variablesB);
  });

  it("never reports prompt A's hash, signed late, to card B", () => {
    engine.onStart(HASH_A, variablesA);
    expect(B.onStart).not.toHaveBeenCalledWith(HASH_A);
    // Card A still records its own action.
    expect(A.onStart).toHaveBeenCalledWith(HASH_A);
  });

  it("never forwards prompt A's late rejection to card B while B's prompt is pending", () => {
    engine.onError(new Error('User rejected'), '', variablesA);
    expect(B.onError).not.toHaveBeenCalled();
  });

  it("control: prompt B's hash reaches card B", () => {
    engine.onStart(HASH_B, variablesB);
    expect(B.onStart).toHaveBeenCalledWith(HASH_B);
  });
});
