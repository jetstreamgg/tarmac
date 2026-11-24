/// <reference types="vite/client" />

import { useState, type ReactNode } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseUnits } from 'viem';
import type { PendleConvertQuote, PendleMarketConfig } from '@/hooks';
import { chainId, forkChainId } from '@/utils/chainId';

i18n.load('en', {});
i18n.activate('en');

const MARKET: PendleMarketConfig = {
  name: 'PT-USDG',
  slug: 'pt-usdg',
  ptSymbol: 'PT-USDG-28MAY2026',
  marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33',
  ptToken: '0x9db38d74a0d29380899ad354121dfb521adb0548',
  ytToken: '0x4a1294749a70bc32a998b49dd11bf26e9379e3c1',
  syToken: '0xc1799cab1f201946f7cfafbaf1bcc089b2f08927',
  underlyingToken: '0xe343167631d89b6ffc58b88d6b7fb0228795491d',
  underlyingSymbol: 'USDG',
  underlyingDecimals: 6,
  expiry: 1795651200
};

const WALLET_BALANCE = parseUnits('1000', 6); // 1,000 USDG
const PT_BALANCE = parseUnits('500', 6); // 500 PT-USDG

const QUOTE: PendleConvertQuote = {
  method: 'swapExactTokenForPt',
  amountOut: parseUnits('102', 6),
  apiMinOut: parseUnits('101', 6),
  effectiveApy: 0.049,
  impliedApy: 0.0486,
  priceImpact: -0.0005,
  fetchedAt: Date.now(),
  apiContractParams: [],
  apiContractParamsName: []
};

type BatchCallbacks = {
  onMutate?: () => void;
  onStart?: (hash?: string) => void;
  onSuccess?: (hash?: string, blockNumber?: bigint) => void;
  onError?: (error: Error, hash?: string) => void;
};

const hoisted = vi.hoisted(() => ({
  chainId: 1,
  // What the market's SY lets through; {} = no rate limit and no supply cap.
  syLimits: {} as
    | {
        withdraw?: { maxPt: bigint; rateAssets: bigint; windowSeconds: number };
        maxSupply?: { shares: bigint; assets: bigint; capAssets: bigint };
      }
    | undefined,
  balanceChainIds: [] as (number | undefined)[],
  quoteArgs: undefined as Record<string, unknown> | undefined,
  batchArgs: undefined as (Record<string, unknown> & BatchCallbacks) | undefined,
  executeSpy: vi.fn(),
  analyticsSpy: vi.fn(),
  // Router allowance for the input token — 0n means every amount needs approval.
  allowance: 0n,
  // When set, useDebounce returns this instead of the live amount — simulates
  // the settle window after a keystroke. Unset = identity passthrough.
  debounceLagged: undefined as bigint | undefined,
  // Optional hook a test can set to mimic the real provider (every push
  // re-renders the tree) — the loop regression below relies on it.
  onPush: undefined as (() => void) | undefined,
  updateModalContent: vi.fn<
    (
      sessionId: string,
      partial: {
        entry?: { confirmDisabled?: boolean };
        errorMessage?: string;
        steps?: string[];
        rightHeaderComponent?: unknown;
        transactionContent?: ReactNode;
        toast?: { loading: string; success: string; error: string };
      }
    ) => void
  >(() => hoisted.onPush?.()),
  txCallbacks: {
    onMutate: vi.fn(),
    onStart: vi.fn(),
    onSuccess: vi.fn(),
    onError: vi.fn()
  }
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => hoisted.chainId,
    useChains: () => [{ id: 1, name: 'Ethereum' }],
    useConnection: () => ({
      address: '0x000000000000000000000000000000000000beef',
      isConnected: true
    })
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useDebounce: <T,>(value: T) => (hoisted.debounceLagged !== undefined ? hoisted.debounceLagged : value),
    useNetworkFee: () => ({
      data: undefined,
      isLoading: false,
      error: null,
      mutate: () => {},
      dataSources: []
    }),
    usePendleSyLimits: () => ({
      data: hoisted.syLimits,
      isLoading: false,
      error: null,
      mutate: () => undefined,
      dataSources: []
    }),
    usePendleUserPtBalances: () => ({
      data: { [MARKET.marketAddress]: PT_BALANCE },
      isLoading: false,
      error: undefined,
      mutate: () => undefined,
      dataSources: []
    }),
    usePendleMarketsApiData: () => ({
      data: { [MARKET.marketAddress]: { impliedApy: 0.042, expirySec: MARKET.expiry } },
      isLoading: false,
      error: undefined,
      mutate: () => undefined,
      dataSources: []
    }),
    useTokenBalance: ({ chainId }: { chainId?: number }) => {
      hoisted.balanceChainIds.push(chainId);
      return {
        data: { value: WALLET_BALANCE },
        isLoading: false,
        error: null,
        refetch: () => undefined
      };
    },
    useTokenAllowance: () => ({
      data: hoisted.allowance,
      isLoading: false,
      error: null,
      mutate: () => undefined
    }),
    useIsBatchSupported: () => ({ data: true }),
    useAllPendleMarketsHistory: () => ({
      data: undefined,
      isLoading: false,
      error: null,
      mutate: () => undefined,
      dataSources: []
    }),
    useQuotePendleConvert: (args: Record<string, unknown>) => {
      hoisted.quoteArgs = args;
      return {
        data: args.enabled ? QUOTE : undefined,
        isLoading: false,
        error: undefined,
        mutate: () => undefined,
        dataSources: []
      };
    },
    useBatchPendleConvert: (args: Record<string, unknown> & BatchCallbacks) => {
      hoisted.batchArgs = args;
      return {
        execute: hoisted.executeSpy,
        reset: () => undefined,
        prepared: !!args.enabled,
        isLoading: false,
        error: null,
        currentCallIndex: 0
      };
    }
  };
});

vi.mock('@/modules/pendle/hooks/usePendleUsdValue', () => ({
  usePendleUsdValue: () => (_symbol: string, amount: number) => amount
}));

vi.mock('@/modules/analytics/hooks/useWidgetAnalytics', () => ({
  useWidgetAnalytics: () => hoisted.analyticsSpy
}));

vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({
  useBatchToggle: () => [true, () => undefined]
}));

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: () => undefined,
    updateModalContent: hoisted.updateModalContent,
    isModalOpen: true,
    txCallbacks: hoisted.txCallbacks,
    txStatus: 'idle'
  }),
  useEntrySlot: () => null
}));

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { PendleModalForm } from '../PendleModalForm';
import { TooltipProvider } from '@/components/ui/tooltip';

const renderForm = (flow: 'supply' | 'withdraw') =>
  render(
    <I18nProvider i18n={i18n}>
      <TooltipProvider>
        <PendleModalForm sessionId="session-1" flow={flow} market={MARKET} />
      </TooltipProvider>
    </I18nProvider>
  );

const typeAmount = (value: string) =>
  fireEvent.change(screen.getByTestId('pendle-modal-amount-input'), { target: { value } });

const lastEntryUpdate = () => {
  const calls = hoisted.updateModalContent.mock.calls.filter(([, partial]) => partial.entry !== undefined);
  return calls.at(-1)?.[1];
};

/** The last toast titles the form pushed to the shared modal. */
const lastToastUpdate = () =>
  hoisted.updateModalContent.mock.calls.filter(([, partial]) => partial.toast !== undefined).at(-1)?.[1]
    .toast;

/** Renders the review-stage grid the form pushed to the shared modal. */
const renderLastReviewContent = () => {
  const calls = hoisted.updateModalContent.mock.calls.filter(
    ([, partial]) => partial.transactionContent !== undefined
  );
  return render(
    <I18nProvider i18n={i18n}>
      <TooltipProvider>{calls.at(-1)?.[1].transactionContent}</TooltipProvider>
    </I18nProvider>
  );
};

// Before MARKET's 26 Nov 2026 expiry, so the live-market specs keep passing after that date.
const BEFORE_EXPIRY_MS = Date.UTC(2026, 9, 1);

describe('PendleModalForm', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(BEFORE_EXPIRY_MS);
    hoisted.quoteArgs = undefined;
    hoisted.batchArgs = undefined;
    hoisted.onPush = undefined;
    hoisted.allowance = 0n;
    hoisted.debounceLagged = undefined;
    hoisted.chainId = 1;
    hoisted.balanceChainIds = [];
    hoisted.syLimits = {};
  });

  it('settles its content pushes when every push re-renders the host (regression: max update depth)', () => {
    // Mimic the real TransactionContext: updateModalContent always sets fresh
    // provider state, so every push re-renders the subscribed tree. Unstable
    // effect deps (e.g. an unmemoized transactionScreenContent) loop here.
    const Host = () => {
      const [, setTick] = useState(0);
      hoisted.onPush = () => setTick(tick => tick + 1);
      return <PendleModalForm sessionId="session-1" flow="supply" market={MARKET} />;
    };

    render(
      <I18nProvider i18n={i18n}>
        <TooltipProvider>
          <Host />
        </TooltipProvider>
      </I18nProvider>
    );

    // A settled form pushes a handful of times on mount — a loop hits React's
    // update-depth limit (~50) and throws before this assertion.
    expect(hoisted.updateModalContent.mock.calls.length).toBeLessThan(10);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  describe("under the SY's limits", () => {
    const amountInput = () => screen.getByTestId('pendle-modal-amount-input') as HTMLInputElement;
    // 50,000 USDG an hour; a 500,000 USDG supply cap.
    const withdrawLimit = (maxPt: bigint) => ({
      maxPt,
      rateAssets: parseUnits('50000', 6),
      windowSeconds: 3600
    });
    const SUPPLY_CAP = parseUnits('500000', 6);

    it('leaves the form alone while the limit sits above the position', () => {
      hoisted.syLimits = { withdraw: withdrawLimit(parseUnits('600', 6)) };
      const view = renderForm('withdraw');

      expect(view.container.textContent).toContain('Balance: 500');
      expect(screen.queryByTestId('pendle-modal-limit-notice')).toBeNull();
    });

    it('caps an early withdrawal at what the rate limit lets out', () => {
      hoisted.syLimits = { withdraw: withdrawLimit(parseUnits('200', 6)) };
      const view = renderForm('withdraw');

      expect(view.container.textContent).toContain('Available: 200');
      expect(screen.getByTestId('pendle-modal-limit-notice').textContent).toBe(
        'Pendle limits withdrawals from this market to 50,000.00 USDG per hour.'
      );

      fireEvent.click(screen.getByTestId('pendle-modal-max'));
      expect(amountInput().value).toBe('200');
      expect(screen.queryByTestId('pendle-modal-over-limit')).toBeNull();
      expect(lastEntryUpdate()?.entry?.confirmDisabled).toBe(false);
    });

    it('refuses an early withdrawal over the limit and names the maximum', () => {
      hoisted.syLimits = { withdraw: withdrawLimit(parseUnits('200', 6)) };
      renderForm('withdraw');
      typeAmount('300');

      expect(screen.getByTestId('pendle-modal-over-limit').textContent).toContain(
        'Maximum available now is 200'
      );
      expect(screen.queryByTestId('pendle-modal-insufficient')).toBeNull();
      expect(hoisted.batchArgs?.enabled).toBe(false);
      expect(lastEntryUpdate()?.entry?.confirmDisabled).toBe(true);
      expect(lastEntryUpdate()?.errorMessage).toBeUndefined();
    });

    it('still calls an amount over the position insufficient', () => {
      hoisted.syLimits = { withdraw: withdrawLimit(parseUnits('200', 6)) };
      renderForm('withdraw');
      typeAmount('600');

      expect(screen.getByTestId('pendle-modal-insufficient')).toBeTruthy();
      expect(screen.queryByTestId('pendle-modal-over-limit')).toBeNull();
    });

    it('says withdrawals are unavailable once the limit is used up', () => {
      hoisted.syLimits = { withdraw: withdrawLimit(0n) };
      renderForm('withdraw');
      typeAmount('100');

      expect(screen.getByTestId('pendle-modal-limit-notice').textContent).toBe(
        "Pendle's withdrawal limit of 50,000.00 USDG per hour is used up. Try again shortly."
      );
      // The notice carries it; the field doesn't repeat it.
      expect(screen.queryByTestId('pendle-modal-over-limit')).toBeNull();
      expect(lastEntryUpdate()?.entry?.confirmDisabled).toBe(true);
    });

    it('stops a supply at the room left under the supply cap', () => {
      hoisted.syLimits = {
        maxSupply: { shares: parseUnits('300', 6), assets: parseUnits('330', 6), capAssets: SUPPLY_CAP }
      };
      const view = renderForm('supply');

      // The wallet balance stays on show; Max stops at the cap (in shares: the
      // default input is the SY's own vault token).
      expect(view.container.textContent).toContain('Balance: 1,000');
      fireEvent.click(screen.getByTestId('pendle-modal-max'));
      expect(amountInput().value).toBe('300');
      expect(lastEntryUpdate()?.entry?.confirmDisabled).toBe(false);

      typeAmount('400');
      expect(screen.getByTestId('pendle-modal-over-limit').textContent).toContain('Maximum available is 300');
      expect(lastEntryUpdate()?.entry?.confirmDisabled).toBe(true);
    });

    it('says the market is full once the supply cap is reached', () => {
      hoisted.syLimits = { maxSupply: { shares: 0n, assets: 0n, capAssets: SUPPLY_CAP } };
      renderForm('supply');

      expect(screen.getByTestId('pendle-modal-limit-notice').textContent).toBe(
        "This market has reached Pendle's cap of 500,000.00 USDG."
      );
    });

    it('ignores the supply cap on a withdrawal and the rate limit on a supply', () => {
      hoisted.syLimits = {
        withdraw: withdrawLimit(0n),
        maxSupply: { shares: 0n, assets: 0n, capAssets: SUPPLY_CAP }
      };
      const supply = renderForm('supply');
      expect(supply.container.textContent).not.toContain('withdrawal limit');
      cleanup();

      renderForm('withdraw');
      expect(screen.getByTestId('pendle-modal-limit-notice').textContent).not.toContain('cap of');
    });
  });

  describe('matured market', () => {
    beforeEach(() => {
      vi.setSystemTime((MARKET.expiry + 60) * 1000);
    });

    it('blocks a supply left open past expiry and says why', () => {
      renderForm('supply');
      typeAmount('100');

      expect(hoisted.quoteArgs?.enabled).toBe(false);
      expect(lastEntryUpdate()?.entry?.confirmDisabled).toBe(true);
      expect(lastEntryUpdate()?.errorMessage).toContain('no longer accepts deposits');
    });

    it('blocks an early withdrawal past expiry and points to claiming', () => {
      renderForm('withdraw');
      typeAmount('200');

      expect(hoisted.quoteArgs?.enabled).toBe(false);
      expect(lastEntryUpdate()?.entry?.confirmDisabled).toBe(true);
      expect(lastEntryUpdate()?.errorMessage).toContain('early withdrawal is closed');
    });

    it('blocks a modal opened before expiry once the minute tick crosses it', () => {
      vi.useFakeTimers({
        toFake: ['Date', 'setInterval', 'clearInterval'],
        now: (MARKET.expiry - 30) * 1000
      });
      renderForm('supply');
      typeAmount('100');
      expect(lastEntryUpdate()?.entry?.confirmDisabled).toBe(false);

      act(() => vi.advanceTimersByTime(60_000));

      expect(lastEntryUpdate()?.entry?.confirmDisabled).toBe(true);
      expect(lastEntryUpdate()?.errorMessage).toContain('no longer accepts deposits');
    });
  });

  it.each(Object.entries(forkChainId))(
    'reads the wallet balance on the Ethereum fork from fork %s, never real mainnet',
    (_, id) => {
      vi.stubEnv('VITE_USE_MOCK_WALLET', 'false');
      hoisted.chainId = id;
      renderForm('supply');

      expect(hoisted.balanceChainIds.length).toBeGreaterThan(0);
      expect(hoisted.balanceChainIds.every(read => read === chainId.tenderly)).toBe(true);
    }
  );

  describe('supply flow', () => {
    it('quotes the selected input token against the market PT', () => {
      renderForm('supply');
      typeAmount('100');

      expect(hoisted.quoteArgs?.side).toBe('buy');
      expect(hoisted.quoteArgs?.inputToken).toBe(MARKET.underlyingToken);
      expect(hoisted.quoteArgs?.outputToken).toBe(MARKET.ptToken);
      expect(hoisted.quoteArgs?.amountIn).toBe(parseUnits('100', 6));
      expect(hoisted.quoteArgs?.enabled).toBe(true);
    });

    it('draws the per-order Claim at maturity and Est. yield from the quote', () => {
      renderForm('supply');
      typeAmount('100');

      // This order: 100 USDG in → 102 PT out at maturity, earning 2.
      expect(screen.getByTestId('pendle-modal-row-Claim at maturity').textContent).toContain('102');
      const days = Math.max(0, Math.floor((MARKET.expiry - Math.floor(Date.now() / 1000)) / 86_400));
      expect(screen.getByTestId(`pendle-modal-row-Est. ${days}D yield`).textContent).toContain('2');
    });

    it('shows the quoted effective rate as the Fixed rate once an amount is entered', () => {
      renderForm('supply');

      // Market implied rate before an amount, the quote's effective rate after.
      expect(screen.getByTestId('pendle-modal-row-Fixed rate').textContent).toContain('4.20%');
      typeAmount('100');
      // The old digits are still rolling out of the cell; read only what stays.
      const cell = screen.getByTestId('pendle-modal-row-Fixed rate').cloneNode(true) as HTMLElement;
      cell.querySelectorAll('[data-testid="rolling-digit-out"]').forEach(el => el.remove());
      expect(cell.textContent).toContain('4.90%');
      expect(screen.getByTestId('pendle-modal-row-Claim date').textContent).toBeTruthy();
      expect(screen.getByTestId('pendle-modal-row-Network fee')).toBeTruthy();
    });

    it('shows the review Min. received from the quote floor', () => {
      renderForm('supply');
      typeAmount('100');

      const review = renderLastReviewContent();
      expect(review.getByTestId('pendle-modal-row-Min. received').textContent).toContain('101');
    });

    it('shows the review price impact sign-flipped, not absolute', () => {
      renderForm('supply');
      typeAmount('100');

      // Quote raw -0.0005: Pendle's negative = unfavorable, displayed positive
      // under the app-wide convention. An |impact| would print the same string
      // for a favorable quote, inverting its meaning.
      const review = renderLastReviewContent();
      expect(review.getByTestId('pendle-modal-row-Price impact').textContent).toContain('0.050%');
    });

    it('keeps confirm disabled until an amount within balance is entered', () => {
      renderForm('supply');
      expect(lastEntryUpdate()?.entry?.confirmDisabled).toBe(true);

      typeAmount('100');
      expect(lastEntryUpdate()?.entry?.confirmDisabled).toBe(false);
    });

    it('holds the quote, the engine and confirm on the settled amount while the debounce lags', () => {
      // The typed 100 hasn't settled yet: the debounce still reports the prior 50.
      hoisted.debounceLagged = parseUnits('50', 6);
      renderForm('supply');
      typeAmount('100');

      expect(hoisted.quoteArgs?.amountIn).toBe(parseUnits('50', 6));
      expect(hoisted.batchArgs?.amountIn).toBe(parseUnits('50', 6));
      expect(lastEntryUpdate()?.entry?.confirmDisabled).toBe(true);

      // Settled: the live amount flows through and confirm re-arms.
      hoisted.debounceLagged = undefined;
      typeAmount('100.0');

      expect(hoisted.quoteArgs?.amountIn).toBe(parseUnits('100', 6));
      expect(hoisted.batchArgs?.amountIn).toBe(parseUnits('100', 6));
      expect(lastEntryUpdate()?.entry?.confirmDisabled).toBe(false);
    });

    it('disables confirm when the amount exceeds the wallet balance', () => {
      renderForm('supply');
      typeAmount('2000');

      expect(lastEntryUpdate()?.entry?.confirmDisabled).toBe(true);
    });

    it('fills the full wallet balance via Max', () => {
      renderForm('supply');
      fireEvent.click(screen.getByTestId('pendle-modal-max'));

      expect((screen.getByTestId('pendle-modal-amount-input') as HTMLInputElement).value).toBe('1,000');
      expect(lastEntryUpdate()?.entry?.confirmDisabled).toBe(false);
    });

    it('fires the legacy analytics event set with live data', () => {
      renderForm('supply');

      // Review-viewed parity: the editable entry is the review surface.
      expect(hoisted.analyticsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'review_viewed', flow: 'supply' })
      );

      typeAmount('100');

      act(() => {
        hoisted.batchArgs?.onMutate?.();
      });
      expect(hoisted.txCallbacks.onMutate).toHaveBeenCalledTimes(1);
      const started = hoisted.analyticsSpy.mock.calls.find(([e]) => e.event === 'transaction_started')?.[0];
      expect(started).toBeTruthy();
      expect(started.action).toBe('supply');
      expect(started.flow).toBe('supply');
      expect(started.amount).toBe(100);
      // Payload shape parity with the legacy pendleAnalyticsData blob.
      expect(started.data.module).toBe('pendle');
      expect(started.data.slippage).toBe(0.002);
      expect(started.data.amountFrom).toBe(100);
      expect(started.data.amountTo).toBe(102);
      expect(started.data.isBatchTx).toBe(true);

      act(() => {
        hoisted.batchArgs?.onSuccess?.('0xhash', 7n);
      });
      // The receipt block rides through to the history refresh.
      expect(hoisted.txCallbacks.onSuccess).toHaveBeenCalledWith('0xhash', 7n);
      expect(hoisted.analyticsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'transaction_completed', action: 'supply', txHash: '0xhash' })
      );

      act(() => {
        hoisted.batchArgs?.onError?.(new Error('boom'), '0xdead');
      });
      expect(hoisted.txCallbacks.onError).toHaveBeenCalled();
      expect(hoisted.analyticsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'transaction_error', action: 'supply' })
      );
    });

    it('pushes approve + supply step labels while the router allowance is insufficient', () => {
      renderForm('supply');
      typeAmount('100');

      expect(lastEntryUpdate()?.steps).toEqual([
        { label: 'Approve', tokenSymbol: 'USDG', failureDetail: "The USDG hasn't been approved." },
        { label: 'Supply', tokenSymbol: 'USDG', failureDetail: "The USDG hasn't been supplied." }
      ]);
    });

    it('collapses to a single supply step once the allowance covers the amount', () => {
      hoisted.allowance = parseUnits('1000', 6);
      renderForm('supply');
      typeAmount('100');

      expect(lastEntryUpdate()?.steps).toEqual([
        { label: 'Supply', tokenSymbol: 'USDG', failureDetail: "The USDG hasn't been supplied." }
      ]);
    });

    it('pushes an amount-aware success title for the toast — the input leg, not the quoted PT', () => {
      renderForm('supply');
      typeAmount('100');

      expect(lastToastUpdate()).toEqual({
        loading: 'Supplying 100.00 USDG',
        success: '100.00 USDG supplied!',
        error: 'Supply failed'
      });
    });

    it('keeps the slippage control out of the modal header — it lives in the review grid now', () => {
      renderForm('supply');

      const headerPush = hoisted.updateModalContent.mock.calls.find(
        ([, partial]) => partial.rightHeaderComponent !== undefined
      );
      expect(headerPush).toBeUndefined();
    });
  });

  describe('withdraw flow', () => {
    it('quotes PT against the selected output token from the PT balance', () => {
      renderForm('withdraw');
      typeAmount('200');

      expect(hoisted.quoteArgs?.side).toBe('withdraw');
      expect(hoisted.quoteArgs?.inputToken).toBe(MARKET.ptToken);
      expect(hoisted.quoteArgs?.outputToken).toBe(MARKET.underlyingToken);
      expect(hoisted.quoteArgs?.amountIn).toBe(parseUnits('200', 6));
    });

    it('caps Max at the PT balance and disables confirm beyond it', () => {
      renderForm('withdraw');
      fireEvent.click(screen.getByTestId('pendle-modal-max'));
      expect((screen.getByTestId('pendle-modal-amount-input') as HTMLInputElement).value).toBe('500');

      typeAmount('600');
      expect(lastEntryUpdate()?.entry?.confirmDisabled).toBe(true);
    });

    it('pushes approve + withdraw step labels for the PT input', () => {
      renderForm('withdraw');
      typeAmount('200');

      expect(lastEntryUpdate()?.steps).toEqual([
        { label: 'Approve', tokenSymbol: 'PT-USDG', failureDetail: "The PT-USDG hasn't been approved." },
        { label: 'Withdraw', tokenSymbol: 'PT-USDG', failureDetail: "The PT-USDG hasn't been withdrawn." }
      ]);
    });

    it('pushes an amount-aware success title for the toast — the PT sold, not the quoted receive', () => {
      renderForm('withdraw');
      typeAmount('200');

      expect(lastToastUpdate()).toEqual({
        loading: 'Withdrawing 200.00 PT-USDG',
        success: '200.00 PT-USDG withdrawn!',
        error: 'Withdrawal failed'
      });
    });

    it('shows what the early sell returns and forfeits in the entry grid', () => {
      renderForm('withdraw');
      typeAmount('200');

      // 200 PT sold → 102 USDG now; the 200 maturity claim forfeits 98.
      expect(screen.getByTestId("pendle-modal-row-You'll receive").textContent).toContain('102');
      expect(screen.getByTestId('pendle-modal-row-Lost on early withdrawal').textContent).toContain('98');
    });

    it('hosts the output-token selector in the Withdrawal token cell', () => {
      renderForm('withdraw');

      const cell = screen.getByTestId('pendle-modal-row-Withdrawal token');
      expect(cell.querySelector('[data-testid="pendle-modal-token-select"]')).toBeTruthy();
    });

    it('reviews with the receive-now hero and the PT amount in the grid', () => {
      renderForm('withdraw');
      typeAmount('200');

      const review = renderLastReviewContent();
      expect(review.getByTestId('pendle-receive-summary').textContent).toContain('102');
      expect(review.getByTestId('pendle-modal-row-Withdrawal amount').textContent).toContain('200');
      expect(review.getByTestId('pendle-modal-row-Min. received').textContent).toContain('101');
    });

    it('fires withdraw-flavored analytics', () => {
      renderForm('withdraw');
      typeAmount('200');

      act(() => {
        hoisted.batchArgs?.onMutate?.();
      });
      expect(hoisted.analyticsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'transaction_started', action: 'withdraw', flow: 'withdraw' })
      );
    });
  });
});
