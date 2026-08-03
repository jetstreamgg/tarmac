/// <reference types="vite/client" />

import { i18n } from '@lingui/core';
import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseUnits } from 'viem';

// The `t` macro resolves against the global i18n singleton (not React context).
i18n.load('en', {});
i18n.activate('en');

const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;

// Shared mutable state for the module mocks. `vi.hoisted` runs before the
// `vi.mock` factories so they can close over it.
const h = vi.hoisted(() => ({
  // Captured at the batch-decision seam: useTransactionFlow's shouldUseBatch is
  // the documented input that picks batch vs sequential. The orchestrator must
  // derive it from the toggle — this records what it actually routes there.
  capturedShouldUseBatch: undefined as boolean | undefined,
  allowance: 0n as bigint | undefined,
  batchEnabled: false,
  batchSupported: true as boolean | undefined
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useConnection: () => ({ address: TEST_ADDRESS, isConnected: true, isConnecting: false }),
    useAccount: () => ({ address: TEST_ADDRESS, isConnected: true, isConnecting: false }),
    useBlockNumber: () => ({ data: 0n })
  };
});

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: () => undefined })
  };
});

vi.mock('@/hooks/savings/useSavingsData', () => ({
  useSavingsData: () => ({
    data: { userSavingsBalance: 0n, userNstBalance: 0n, savingsRate: 0n, savingsTvl: 0n },
    error: null,
    isLoading: false,
    mutate: () => undefined,
    dataSources: []
  })
}));

vi.mock('@/hooks/savings/useReadSavingsUsds', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/savings/useReadSavingsUsds')>();
  return {
    ...actual,
    useReadSavingsUsdsMaxWithdraw: () => ({ data: undefined, queryKey: ['maxWithdraw'] })
  };
});

vi.mock('@/hooks/shared/useWriteContractFlow', () => ({
  useWriteContractFlow: () => ({
    error: null,
    prepareError: null,
    isLoading: false,
    prepared: false,
    execute: () => undefined,
    data: undefined,
    retryPrepare: () => undefined
  })
}));

// Capture the shouldUseBatch the routed engine hands to the transaction flow.
// Only the active (enabled) engine's value is the routed one.
vi.mock('@/hooks/shared/useTransactionFlow', () => ({
  useTransactionFlow: (params: { enabled?: boolean; shouldUseBatch?: boolean }) => {
    if (params.enabled) h.capturedShouldUseBatch = params.shouldUseBatch;
    return {
      error: null,
      isLoading: false,
      prepared: true,
      execute: () => undefined,
      currentCallIndex: 0,
      reset: () => undefined
    };
  }
}));

vi.mock('@/hooks/savings/useSavingsAllowance', () => ({
  useSavingsAllowance: () => ({
    data: h.allowance,
    error: null,
    isLoading: false,
    mutate: () => undefined,
    dataSources: []
  })
}));

vi.mock('@/hooks/tokens/useTokenAllowance', () => ({
  useTokenAllowance: () => ({
    data: parseUnits('1000000', 18),
    error: null,
    isLoading: false,
    mutate: () => undefined,
    dataSources: []
  })
}));

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: () => undefined,
    updateModalContent: () => undefined,
    isModalOpen: false,
    txCallbacks: {
      onMutate: () => undefined,
      onStart: () => undefined,
      onSuccess: () => undefined,
      onError: () => undefined
    },
    txStatus: 'idle'
  })
}));

// The two batch-decision inputs the orchestrator must consult.
vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({
  useBatchToggle: () => [h.batchEnabled, () => undefined] as const
}));
vi.mock('@/hooks/shared/useIsBatchSupported', () => ({
  useIsBatchSupported: () => ({
    data: h.batchSupported,
    isLoading: false,
    error: null,
    mutate: () => undefined
  })
}));

import { TOKENS } from '@/hooks';
import { useSavingsLaunch } from './useSavingsLaunch';

const AMOUNT = parseUnits('10', 18);

// allowance 0n → approve + deposit, so calls.length > 1 (batch is meaningful).
function routedShouldUseBatch(): boolean | undefined {
  h.capturedShouldUseBatch = undefined;
  const { unmount } = renderHook(() =>
    useSavingsLaunch({ flow: 'supply', originToken: TOKENS.usds, amount: AMOUNT })
  );
  const value = h.capturedShouldUseBatch;
  unmount();
  return value;
}

describe('useSavingsLaunch — batch toggle wiring', () => {
  beforeEach(() => {
    h.capturedShouldUseBatch = undefined;
    h.allowance = 0n;
    h.batchEnabled = false;
    h.batchSupported = true;
  });
  afterEach(() => cleanup());

  it('does NOT route a batch transaction when the toggle is off, even if the wallet supports it', () => {
    h.batchEnabled = false;
    h.batchSupported = true;
    expect(routedShouldUseBatch()).toBe(false);
  });

  it('routes a batch transaction when the toggle is on and the wallet supports it', () => {
    h.batchEnabled = true;
    h.batchSupported = true;
    expect(routedShouldUseBatch()).toBe(true);
  });

  it('does NOT route a batch transaction when the wallet cannot batch, even with the toggle on', () => {
    h.batchEnabled = true;
    h.batchSupported = false;
    expect(routedShouldUseBatch()).toBe(false);
  });
});
