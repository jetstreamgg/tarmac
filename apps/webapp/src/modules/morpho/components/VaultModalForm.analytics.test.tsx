import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseUnits } from 'viem';

i18n.load('en', {});
i18n.activate('en');

const h = vi.hoisted(() => ({
  update: vi.fn(),
  isBatch: false,
  amount: 0n as bigint
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useChains: () => [{ id: 1, name: 'Ethereum' }]
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useIsTouchDevice: () => false,
    useNetworkFee: () => ({ data: undefined, isLoading: false, error: null }),
    useIsBatchSupported: () => ({ data: false }),
    useVaultMarketData: () => ({ data: undefined })
  };
});

// The shared form model, fully controlled — these tests only exercise the
// analytics blob the presentation layer derives from it.
vi.mock('../hooks/useVaultTransactionForm', async importOriginal => {
  const actual = await importOriginal<typeof import('../hooks/useVaultTransactionForm')>();
  return {
    ...actual,
    useVaultTransactionForm: ({ flow }: { flow: string }) => ({
      isConnected: true,
      isSupply: flow === 'supply',
      decimals: 18,
      value: '15',
      amount: h.amount,
      available: parseUnits('100', 18),
      isZero: h.amount === 0n,
      insufficient: false,
      amountReady: true,
      position: parseUnits('20', 18),
      isLiquidityConstrained: false,
      isLiquidityDataUnavailable: false,
      engineParams: { flow, amount: h.amount },
      toast: { loading: 'l', success: 's', error: 'e' },
      transactionScreenContent: null,
      onInput: () => {},
      setPercentAmount: () => {}
    })
  };
});

vi.mock('../hooks/useVaultLaunch', async importOriginal => {
  const actual = await importOriginal<typeof import('../hooks/useVaultLaunch')>();
  return {
    ...actual,
    useVaultLaunch: () => ({
      execute: vi.fn(),
      steps: ['Supply'],
      prepared: true,
      isLoading: false,
      error: null,
      calls: [],
      isBatch: h.isBatch
    })
  };
});

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ updateModalContent: h.update, txStatus: 'idle' }),
  useEntrySlot: () => null
}));

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { VaultModalForm } from './VaultModalForm';
import { TOKENS } from '@/hooks';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { VaultLaunchFlow } from '../hooks/useVaultLaunch';

const VAULT = '0xd63070114470f685b75b74d60eec7c1113d33a3d' as const;

const renderForm = (flow: VaultLaunchFlow, provider?: 'morpho' | 'sky') =>
  render(
    <I18nProvider i18n={i18n}>
      <TooltipProvider>
        <VaultModalForm
          sessionId="s1"
          flow={flow}
          vaultAddress={VAULT}
          assetToken={TOKENS.usds}
          vaultName="Sky USDS Vault"
          provider={provider}
          netRate={0.045}
        />
      </TooltipProvider>
    </I18nProvider>
  );

// The last analytics blob live-merged to the modal (what the provider will emit from).
const lastAnalytics = () => {
  const withAnalytics = h.update.mock.calls.filter(([, patch]) => patch?.analytics !== undefined);
  return withAnalytics.at(-1)?.[1].analytics;
};

describe('VaultModalForm — analytics parity blob (APP-444 B7)', () => {
  beforeEach(() => {
    h.update.mockClear();
    h.isBatch = false;
    h.amount = parseUnits('15', 18);
  });
  afterEach(() => cleanup());

  it('pushes the legacy VaultWidget blob: module morpho, vault as product', () => {
    renderForm('supply');
    expect(lastAnalytics()).toEqual({
      widgetName: 'vaults',
      flow: 'supply',
      action: 'supply',
      data: {
        module: 'morpho',
        product: 'Sky USDS Vault',
        productAddress: VAULT,
        assetAddress: TOKENS.usds.address[1],
        assetSymbol: 'USDS',
        isBatchTx: false,
        amount: 15
      }
    });
  });

  it('reports the sky provider as its own module and signs the withdraw negative', () => {
    renderForm('withdraw', 'sky');
    const analytics = lastAnalytics();
    expect(analytics.data.module).toBe('sky');
    expect(analytics.data.amount).toBe(-15);
  });
});
