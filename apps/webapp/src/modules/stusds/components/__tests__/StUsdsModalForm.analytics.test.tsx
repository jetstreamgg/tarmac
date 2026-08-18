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
  amount: 0n as bigint,
  provider: 'native' as string
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
    useIsBatchSupported: () => ({ data: false })
  };
});

// The shared form model, fully controlled — these tests only exercise the
// analytics blob the presentation layer derives from it.
vi.mock('../../hooks/useStUsdsTransactionForm', async importOriginal => {
  const actual = await importOriginal<typeof import('../../hooks/useStUsdsTransactionForm')>();
  const { StUsdsProviderType } = await import('@/hooks');
  return {
    ...actual,
    useStUsdsTransactionForm: ({ flow }: { flow: string }) => ({
      isConnected: true,
      isSupply: flow === 'supply',
      value: '40',
      amount: h.amount,
      available: parseUnits('100', 18),
      isZero: h.amount === 0n,
      insufficient: false,
      blocked: false,
      amountReady: true,
      rate: 0.05,
      position: parseUnits('10', 18),
      engineParams: { flow, amount: h.amount },
      providerSelection: {
        selectedProvider: h.provider === 'curve' ? StUsdsProviderType.CURVE : StUsdsProviderType.NATIVE,
        selectedQuote: undefined,
        isLoading: false,
        allProvidersBlocked: false
      },
      priceImpactBps: undefined,
      needsImpactAcknowledgement: false,
      impactAccepted: false,
      setImpactAccepted: () => {},
      needsRiskAcknowledgement: false,
      riskAccepted: false,
      acceptRisk: () => {},
      toast: { loading: 'l', success: 's', error: 'e' },
      transactionScreenContent: null,
      onInput: () => {},
      setPercentAmount: () => {}
    })
  };
});

vi.mock('../../hooks/useStUsdsLaunch', async importOriginal => {
  const actual = await importOriginal<typeof import('../../hooks/useStUsdsLaunch')>();
  return {
    ...actual,
    useStUsdsLaunch: () => ({
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

// Presentation-only; needs quote/premium fields these analytics tests don't model.
vi.mock('../StUsdsProviderNotice', () => ({ StUsdsProviderNotice: () => null }));

import { StUsdsModalForm } from '../StUsdsModalForm';
import { stUsdsAddress } from '@/hooks';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { StUsdsLaunchFlow } from '../../hooks/useStUsdsLaunch';

const renderForm = (flow: StUsdsLaunchFlow) =>
  render(
    <I18nProvider i18n={i18n}>
      <TooltipProvider>
        <StUsdsModalForm sessionId="s1" flow={flow} />
      </TooltipProvider>
    </I18nProvider>
  );

// The last analytics blob live-merged to the modal (what the provider will emit from).
const lastAnalytics = () => {
  const withAnalytics = h.update.mock.calls.filter(([, patch]) => patch?.analytics !== undefined);
  return withAnalytics.at(-1)?.[1].analytics;
};

describe('StUsdsModalForm — analytics parity blob (APP-444 B5)', () => {
  beforeEach(() => {
    h.update.mockClear();
    h.isBatch = false;
    h.amount = parseUnits('40', 18);
    h.provider = 'native';
  });
  afterEach(() => cleanup());

  it('pushes the legacy StUSDSWidget blob: widget expert, hardcoded USDS, no assetAddress', () => {
    renderForm('supply');
    expect(lastAnalytics()).toEqual({
      widgetName: 'expert',
      flow: 'supply',
      action: 'supply',
      data: {
        module: 'expert',
        product: 'stUSDS',
        productAddress: stUsdsAddress[1],
        assetSymbol: 'USDS',
        isBatchTx: false,
        provider: 'native',
        amount: 40
      }
    });
    expect(lastAnalytics().data).not.toHaveProperty('assetAddress');
  });

  it('reports the curve route and signs the withdraw negative', () => {
    h.provider = 'curve';
    renderForm('withdraw');
    const analytics = lastAnalytics();
    expect(analytics.data.provider).toBe('curve');
    expect(analytics.data.amount).toBe(-40);
  });
});
