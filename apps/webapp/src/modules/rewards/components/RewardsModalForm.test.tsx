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
    useIsBatchSupported: () => ({ data: false })
  };
});

// The shared form model, fully controlled — these tests only exercise the
// analytics blob the presentation layer derives from it.
vi.mock('../hooks/useRewardsTransactionForm', async importOriginal => {
  const actual = await importOriginal<typeof import('../hooks/useRewardsTransactionForm')>();
  return {
    ...actual,
    useRewardsTransactionForm: ({ flow }: { flow: string }) => ({
      isConnected: true,
      isSupply: flow === 'supply',
      decimals: 18,
      value: '25',
      amount: h.amount,
      available: parseUnits('100', 18),
      position: parseUnits('50', 18),
      isZero: h.amount === 0n,
      insufficient: false,
      amountReady: true,
      engineParams: { flow, amount: h.amount },
      toast: { loading: 'l', success: 's', error: 'e' },
      transactionScreenContent: null,
      onInput: () => {},
      setPercentAmount: () => {}
    })
  };
});

vi.mock('../hooks/useRewardsLaunch', async importOriginal => {
  const actual = await importOriginal<typeof import('../hooks/useRewardsLaunch')>();
  return {
    ...actual,
    useRewardsLaunch: () => ({
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

import { RewardsModalForm } from './RewardsModalForm';
import { TOKENS } from '@/hooks';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { RewardsLaunchFlow } from '../hooks/useRewardsLaunch';

const renderForm = (flow: RewardsLaunchFlow) =>
  render(
    <I18nProvider i18n={i18n}>
      <TooltipProvider>
        <RewardsModalForm
          sessionId="s1"
          flow={flow}
          contractAddress="0xfa99470f8b0afc45a68b9dc9f5b0b1c0c5f5e0aa"
          supplyToken={TOKENS.usds}
          displayName="SKY Rewards"
          productName="With: USDS Get: SKY"
          rewardTokenSymbol="SKY"
          rate={0.045}
        />
      </TooltipProvider>
    </I18nProvider>
  );

// The last analytics blob live-merged to the modal (what the provider will emit from).
const lastAnalytics = () => {
  const withAnalytics = h.update.mock.calls.filter(([, patch]) => patch?.analytics !== undefined);
  return withAnalytics.at(-1)?.[1].analytics;
};

describe('RewardsModalForm — analytics parity blob (APP-444 B3)', () => {
  beforeEach(() => {
    h.update.mockClear();
    h.isBatch = false;
    h.amount = parseUnits('25', 18);
  });
  afterEach(() => cleanup());

  it('pushes the legacy RewardsWidget supply blob with the registry product name', () => {
    renderForm('supply');
    expect(lastAnalytics()).toEqual({
      widgetName: 'rewards',
      flow: 'supply',
      action: 'supply',
      data: {
        module: 'rewards',
        product: 'With: USDS Get: SKY',
        productAddress: '0xfa99470f8b0afc45a68b9dc9f5b0b1c0c5f5e0aa',
        assetAddress: TOKENS.usds.address[1],
        assetSymbol: 'USDS',
        isBatchTx: false,
        amount: 25
      }
    });
  });

  it('signs the withdraw amount negative (pipeline sign rule)', () => {
    renderForm('withdraw');
    const analytics = lastAnalytics();
    expect(analytics.flow).toBe('withdraw');
    expect(analytics.data.amount).toBe(-25);
  });
});
