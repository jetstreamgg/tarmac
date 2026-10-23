import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseUnits } from 'viem';
import type { TransactionFlowProps } from '@/modules/ui/context/transactionContract';

i18n.load('en', {});
i18n.activate('en');

const h = vi.hoisted(() => ({
  modalProps: vi.fn<(props: TransactionFlowProps) => void>(),
  status: 'idle',
  txCallbacks: {
    onMutate: vi.fn(),
    onStart: vi.fn(),
    onSuccess: vi.fn(),
    onError: vi.fn()
  },
  balance: undefined as bigint | undefined,
  engineParams: undefined as Record<string, unknown> | undefined,
  execute: vi.fn(),
  mutatePocketBalance: vi.fn(),
  mutateAllowance: vi.fn(),
  reset: vi.fn(),
  settle: null as { reset: unknown; onCleared: unknown } | null,
  needsAllowance: false,
  prepared: true,
  isLoading: false,
  disabledReason: undefined as string | undefined,
  nextCalls: [] as unknown[],
  targetAmount: 0n as bigint
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useChains: () => [{ id: 1, name: 'Ethereum' }],
    useConnection: () => ({ address: '0x0000000000000000000000000000000000000001', isConnected: true })
  };
});

vi.mock('@/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@/hooks')>()),
  useTokenBalance: () => ({ data: h.balance === undefined ? undefined : { value: h.balance } })
}));

vi.mock('@/hooks/shared/useIsBatchSupported', () => ({
  useIsBatchSupported: () => ({
    data: false,
    isLoading: false,
    error: null,
    mutate: () => {},
    dataSources: []
  })
}));

vi.mock('@/hooks/shared/useNetworkFee', () => ({
  useNetworkFee: () => ({ data: undefined, isLoading: false, error: null, mutate: () => {}, dataSources: [] })
}));

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useSession: () => ({ txCallbacks: h.txCallbacks, status: h.status }),
  useSettleOnEnd: (reset: unknown, onCleared: unknown) => {
    h.settle = { reset, onCleared };
  }
}));

vi.mock('@/modules/ui/components/TransactionModal', async () =>
  (await import('@/modules/ui/components/transactionModalSpy.testing')).transactionModalSpy(h.modalProps)
);

vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({
  useBatchToggle: () => [true, vi.fn()]
}));

vi.mock('../hooks/usePsmConversion', () => ({
  usePsmConversion: (params: Record<string, unknown>) => {
    h.engineParams = params;
    const direction = params.direction as string;
    const [originSymbol, targetSymbol] = direction === 'USDC_TO_USDS' ? ['USDC', 'USDS'] : ['USDS', 'USDC'];
    return {
      direction,
      originToken: { symbol: originSymbol },
      targetToken: { symbol: targetSymbol },
      targetAmount: h.targetAmount,
      needsAllowance: h.needsAllowance,
      prepared: h.prepared,
      isLoading: h.isLoading,
      disabledReason: h.disabledReason,
      execute: h.execute,
      mutatePocketBalance: h.mutatePocketBalance,
      mutateAllowance: h.mutateAllowance,
      reset: h.reset,
      calls: [],
      nextCalls: h.nextCalls,
      isBatch: false
    };
  }
}));

import { ConvertFlow } from './ConvertFlow';
import type { PsmConversionDirection } from '../hooks/usePsmConversion.helpers';

const AMOUNT_USDS = parseUnits('100', 18);

const renderFlow = (direction: PsmConversionDirection, amount: bigint, onSuccess?: () => void) =>
  render(
    <I18nProvider i18n={i18n}>
      <ConvertFlow direction={direction} amount={amount} onSuccess={onSuccess} />
    </I18nProvider>
  );
const lastProps = () => h.modalProps.mock.calls.at(-1)![0];

beforeEach(() => {
  vi.clearAllMocks();
  h.status = 'idle';
  h.balance = undefined;
  h.engineParams = undefined;
  h.needsAllowance = false;
  h.prepared = true;
  h.isLoading = false;
  h.disabledReason = undefined;
  h.nextCalls = [];
  h.targetAmount = parseUnits('100', 6);
});

afterEach(cleanup);

describe('ConvertFlow', () => {
  it('wires the engine with the session callbacks, referral code and direction/amount', () => {
    renderFlow('USDS_TO_USDC', AMOUNT_USDS);

    expect(h.engineParams).toMatchObject({
      direction: 'USDS_TO_USDC',
      amount: AMOUNT_USDS,
      shouldUseBatch: true,
      enabled: true,
      onMutate: h.txCallbacks.onMutate,
      onStart: h.txCallbacks.onStart,
      onSuccess: h.txCallbacks.onSuccess,
      onError: h.txCallbacks.onError
    });
    expect(h.engineParams).toHaveProperty('referralCode');
  });

  it('labels a two-step approve → convert flow when allowance is needed', () => {
    h.needsAllowance = true;
    renderFlow('USDS_TO_USDC', AMOUNT_USDS);
    // "Approve ◉ USDS", then "Convert ◉ USDS to ◉ USDC" (Figma 1036:205564).
    expect(lastProps().steps).toEqual([
      { label: 'Approve', tokenSymbol: 'USDS', failureDetail: "The USDS hasn't been approved." },
      {
        label: 'Convert',
        tokenSymbol: 'USDS',
        targetTokenSymbol: 'USDC',
        failureDetail: "The USDS hasn't been converted."
      }
    ]);
  });

  it('collapses to a single convert step when allowance covers the amount', () => {
    renderFlow('USDC_TO_USDS', parseUnits('100', 6));
    expect(lastProps().steps).toEqual([
      {
        label: 'Convert',
        tokenSymbol: 'USDC',
        targetTokenSymbol: 'USDS',
        failureDetail: "The USDC hasn't been converted."
      }
    ]);
  });

  it('renders the review modal with its copy, toasts and convert analytics', () => {
    renderFlow('USDS_TO_USDC', AMOUNT_USDS);

    expect(lastProps()).toMatchObject({
      title: 'Review conversion',
      // The wallet screen keeps the review title (Figma 1036:205564).
      transactionTitle: 'Review conversion',
      confirmLabel: 'Confirm',
      confirmDisabled: false,
      usdValue: 100,
      toast: {
        loading: 'Converting 100.00 USDS',
        success: '100.00 USDS converted to USDC!',
        error: 'Conversion failed'
      },
      analytics: {
        widgetName: 'convert',
        flow: 'usds-to-usdc',
        action: 'convert',
        data: { module: 'convert', originToken: 'USDS', targetToken: 'USDC', amount: 100 }
      }
    });
    expect(lastProps().entry).toBeUndefined();
    expect(lastProps().transactionContent).toBeTruthy();
  });

  it('confirms with the engine execute; success refetches engine reads, then the page', () => {
    const pageSuccess = vi.fn();
    renderFlow('USDS_TO_USDC', AMOUNT_USDS, pageSuccess);

    expect(lastProps().onConfirm).toBe(h.execute);
    lastProps().onSuccess?.();
    expect(h.mutatePocketBalance).toHaveBeenCalledTimes(1);
    expect(pageSuccess).toHaveBeenCalledTimes(1);
  });

  it('hands the session the live calls and the engine guard for deferred dispatches', () => {
    h.nextCalls = [{ to: '0x1' }];
    const view = renderFlow('USDC_TO_USDS', AMOUNT_USDS);
    expect(lastProps().dispatch).toMatchObject({ nextCalls: h.nextCalls, blocked: false, disabled: false });

    h.disabledReason = 'non_zero_fee';
    view.rerender(
      <I18nProvider i18n={i18n}>
        <ConvertFlow direction="USDC_TO_USDS" amount={AMOUNT_USDS} />
      </I18nProvider>
    );
    expect(lastProps().dispatch).toMatchObject({ blocked: true, disabled: true });
  });

  it.each([
    ['zero amount', 0n, {}],
    ['engine guard', AMOUNT_USDS, { disabledReason: 'insufficient_liquidity' }],
    ['not prepared', AMOUNT_USDS, { prepared: false }]
  ] as const)('disables confirm on %s', (_label, amount, engineOverride) => {
    Object.assign(h, engineOverride);
    renderFlow('USDS_TO_USDC', amount);
    expect(lastProps().confirmDisabled).toBe(true);
  });

  it('turns the engine off once the balance no longer covers the amount, but not mid-run', () => {
    h.balance = parseUnits('50', 18);
    renderFlow('USDS_TO_USDC', AMOUNT_USDS);
    expect(h.engineParams?.enabled).toBe(false);
    cleanup();

    // A run the balance check no longer passes keeps the engine on (useTransactionRunActive).
    h.status = 'loading';
    renderFlow('USDS_TO_USDC', AMOUNT_USDS);
    expect(h.engineParams?.enabled).toBe(true);
  });

  it('resets the engine as the session ends, then refreshes the allowance, so a mined approve is not asked for again', () => {
    renderFlow('USDS_TO_USDC', AMOUNT_USDS);
    expect(h.settle).toEqual({ reset: h.reset, onCleared: h.mutateAllowance });
  });
});
