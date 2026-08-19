import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { WidgetAnalyticsEvent } from '@/widgets/shared/types/analyticsEvents';
import type { VaultProvider } from '@/hooks/vaults/types';

vi.mock('@/widgets/shared/hooks/useTransactionCallbacks', () => ({
  useTransactionCallbacks: () => ({
    handleOnMutate: vi.fn(),
    handleOnStart: vi.fn(),
    handleOnSuccess: vi.fn(),
    handleOnError: vi.fn()
  })
}));

import { useVaultTransactionCallbacks } from '../hooks/useVaultTransactionCallbacks';

const events: WidgetAnalyticsEvent[] = [];

const hookArgs = (provider: VaultProvider) => ({
  amount: 137n * 10n ** 6n,
  assetDecimals: 6,
  assetSymbol: 'USDT',
  vaultAddress: '0x74cb54e082411cfCAEADb00a0765625B10410DAa' as const,
  assetAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as const,
  vaultName: 'Tether Savings',
  provider,
  needsAllowance: false,
  shouldUseBatch: false,
  mutateAllowance: vi.fn(),
  mutateVaultData: vi.fn(),
  mutateAssetBalance: vi.fn(),
  onAnalyticsEvent: (event: WidgetAnalyticsEvent) => void events.push(event)
});

// VF-02 regression guard: the funnel events' `module` must follow the vault's
// provider instead of the pre-fix hardcoded 'morpho'.
describe('useVaultTransactionCallbacks module/provider parity', () => {
  beforeEach(() => {
    events.length = 0;
  });

  it("reports module 'sky' on supply and withdraw legs of a sky-provider vault", () => {
    const { result } = renderHook(() => useVaultTransactionCallbacks(hookArgs('sky')));

    result.current.supplyTransactionCallbacks.onMutate?.();
    result.current.withdrawTransactionCallbacks.onMutate?.();

    expect(events).toHaveLength(2);
    for (const event of events) {
      expect(event.data).toMatchObject({
        module: 'sky',
        product: 'Tether Savings',
        assetSymbol: 'USDT'
      });
    }
  });

  it("keeps module 'morpho' for morpho-provider vaults (legacy parity)", () => {
    const { result } = renderHook(() => useVaultTransactionCallbacks(hookArgs('morpho')));

    result.current.supplyTransactionCallbacks.onMutate?.();

    expect(events[0].data).toMatchObject({ module: 'morpho' });
  });
});
