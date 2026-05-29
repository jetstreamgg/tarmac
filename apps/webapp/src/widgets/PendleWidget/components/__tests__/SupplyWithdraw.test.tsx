/// <reference types="vite/client" />

import { act, type ReactNode } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mainnet } from 'viem/chains';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
i18n.load('en', {});
i18n.activate('en');

// Capture the latest TransactionOverview props so we can inspect the exact
// rows (label/value/className) that the component would render for each
// flow + selected-token combination.
type CapturedOverview = {
  title: string;
  detailsTitle?: string;
  pinnedData?: { label: string; value: unknown; className?: string }[];
  transactionData?: { label: string; value: unknown }[];
};
const captured: { latest?: CapturedOverview } = {};

vi.mock('@/widgets/shared/components/ui/transaction/TransactionOverview', () => ({
  TransactionOverview: (props: CapturedOverview) => {
    captured.latest = props;
    return <div data-testid="transaction-overview-stub" />;
  }
}));

// Light stubs for the surrounding chrome.
vi.mock('@/widgets/shared/components/ui/token/TokenInput', () => ({
  TokenInput: ({ token }: { token: { symbol: string } }) => (
    <div data-testid="token-input">{token.symbol}</div>
  )
}));

vi.mock('../PendleStatsCard', () => ({
  PendleStatsCard: () => <div data-testid="pendle-stats-card" />
}));

vi.mock('@/widgets/data/tooltips', () => ({
  getTooltipById: () => ({ title: '', tooltip: '' })
}));

import { SupplyWithdraw } from '../SupplyWithdraw';
import { PendleFlow } from '../../lib/constants';
import type { PendleConvertQuote, PendleMarketConfig, Token } from '@/hooks';

// PT-sUSDS-26NOV2026 fixture matching the shipped market.
const MARKET: PendleMarketConfig = {
  name: 'PT-sUSDS',
  marketAddress: '0x9c560ebaf78e596cbcc27411d633a74d628dd7dc',
  ptToken: '0xdc169abe56461a2e0c034da431ac2a3ebf596094',
  ytToken: '0xc7b8551c6b286ce0b44952320e940bd3dee58a09',
  syToken: '0xbe3d4ec488a0a042bb86f9176c24f8cd54018ba7',
  underlyingToken: '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD',
  underlyingSymbol: 'sUSDS',
  underlyingDecimals: 18,
  syAcceptedTokens: [
    '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    '0xdC035D45d973E3EC169d2276DDab16f1e407384F',
    '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD'
  ],
  expiry: 1795651200, // Nov 26 2026 00:00:00 UTC
  usdsEquivalence: 'pegged'
};

const PT_TOKEN: Token = {
  name: 'PT-sUSDS',
  symbol: 'PT-sUSDS',
  decimals: 18,
  color: '#1BE3C2',
  address: { [mainnet.id]: MARKET.ptToken }
};

const SUSDS_TOKEN: Token = {
  name: 'sUSDS',
  symbol: 'sUSDS',
  decimals: 18,
  color: '#00C2A1',
  address: { [mainnet.id]: MARKET.underlyingToken }
};

const USDS_TOKEN: Token = {
  name: 'USDS',
  symbol: 'USDS',
  decimals: 18,
  color: '#000000',
  address: { [mainnet.id]: '0xdC035D45d973E3EC169d2276DDab16f1e407384F' }
};

const USDC_TOKEN: Token = {
  name: 'USDC',
  symbol: 'USDC',
  decimals: 6,
  color: '#2775CA',
  address: { [mainnet.id]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }
};

const SUPPLY_LIST = [SUSDS_TOKEN, USDS_TOKEN, USDC_TOKEN];
const WITHDRAW_LIST = [USDS_TOKEN, USDC_TOKEN];

// Per Pendle convention amounts are in PT-side decimals on the receive side
// for BUY (PT has 18 decimals here) and in the chosen output's decimals on
// the receive side for SELL.
const PT_AMOUNT_18 = 101_744_300_000_000_000_000n; // 101.7443 PT-sUSDS / USDS
const PT_MIN_AMOUNT_18 = 101_235_600_000_000_000_000n; // 101.2356 PT-sUSDS

const USDC_RECEIVE_AMOUNT_6 = 101_744_300n; // 101.7443 USDC (6 decimals)
const USDC_MIN_AMOUNT_6 = 101_235_600n; // 101.2356 USDC

function makeBuyQuote(overrides: Partial<PendleConvertQuote> = {}): PendleConvertQuote {
  return {
    method: 'swapExactTokenForPt',
    amountOut: PT_AMOUNT_18,
    apiMinOut: PT_MIN_AMOUNT_18,
    effectiveApy: 0.0354,
    impliedApy: 0.0365,
    priceImpact: -0.00054,
    fetchedAt: Date.now(),
    apiContractParams: [],
    apiContractParamsName: [],
    ...overrides
  };
}

function makeSellQuote(
  amountOut: bigint,
  apiMinOut: bigint,
  overrides: Partial<PendleConvertQuote> = {}
): PendleConvertQuote {
  return {
    method: 'swapExactPtForToken',
    amountOut,
    apiMinOut,
    effectiveApy: 0.034,
    impliedApy: 0.0365,
    priceImpact: -0.00054,
    fetchedAt: Date.now(),
    apiContractParams: [],
    apiContractParamsName: [],
    ...overrides
  };
}

function renderComponent(ui: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  };
}

const baseProps = {
  market: MARKET,
  ptToken: PT_TOKEN,
  supplyTokenList: SUPPLY_LIST,
  withdrawTokenList: WITHDRAW_LIST,
  onSupplyTokenChange: () => undefined,
  onWithdrawOutTokenChange: () => undefined,
  onFlowChange: () => undefined,
  onAmountChange: () => undefined,
  inputBalance: 1_000_000_000_000_000_000_000n, // generous balance
  outputBalance: 0n,
  ptBalance: 0n,
  isFetchingQuote: false,
  slippage: 0.005,
  enabled: true,
  insufficientFunds: false
};

beforeEach(() => {
  captured.latest = undefined;
});

describe('SupplyWithdraw — BUY pinnedData (Transaction overview)', () => {
  it('renders 4 headline rows in order: You supply, Effective APY, Maturity date, Value at maturity', () => {
    const { unmount } = renderComponent(
      <SupplyWithdraw
        {...baseProps}
        selectedSupplyToken={USDS_TOKEN}
        selectedWithdrawOutToken={USDS_TOKEN}
        flow={PendleFlow.BUY}
        amount={100_000_000_000_000_000_000n} // 100 USDS
        quote={makeBuyQuote()}
      />
    );

    const pinned = captured.latest?.pinnedData ?? [];
    expect(pinned.map(r => r.label)).toEqual([
      'You supply',
      'Effective APY',
      'Maturity date',
      'Value at maturity'
    ]);
    unmount();
  });

  it('"You supply" uses input-token decimals (USDS=18) and the selected symbol', () => {
    const { unmount } = renderComponent(
      <SupplyWithdraw
        {...baseProps}
        selectedSupplyToken={USDS_TOKEN}
        selectedWithdrawOutToken={USDS_TOKEN}
        flow={PendleFlow.BUY}
        amount={100_000_000_000_000_000_000n}
        quote={makeBuyQuote()}
      />
    );
    const pinned = captured.latest!.pinnedData!;
    expect(pinned.find(r => r.label === 'You supply')!.value).toBe('100 USDS');
    unmount();
  });

  it('"You supply" with USDC (6 decimals) renders the right magnitude — cross-decimals guard', () => {
    const { unmount } = renderComponent(
      <SupplyWithdraw
        {...baseProps}
        selectedSupplyToken={USDC_TOKEN}
        selectedWithdrawOutToken={USDS_TOKEN}
        flow={PendleFlow.BUY}
        amount={100_000_000n} // 100 USDC (6 decimals)
        quote={makeBuyQuote()}
      />
    );
    const pinned = captured.latest!.pinnedData!;
    expect(pinned.find(r => r.label === 'You supply')!.value).toBe('100 USDC');
    unmount();
  });

  it('"Value at maturity" formats amountOut with PT decimals and labels it USDS (not PT-sUSDS)', () => {
    const { unmount } = renderComponent(
      <SupplyWithdraw
        {...baseProps}
        selectedSupplyToken={USDS_TOKEN}
        selectedWithdrawOutToken={USDS_TOKEN}
        flow={PendleFlow.BUY}
        amount={100_000_000_000_000_000_000n}
        quote={makeBuyQuote()}
      />
    );
    const pinned = captured.latest!.pinnedData!;
    // Critical: this row's unit MUST be USDS, not PT-sUSDS — the deal is
    // denominated in the SY's accounting asset, not the share token.
    expect(pinned.find(r => r.label === 'Value at maturity')!.value).toBe('101.7443 USDS');
    expect(pinned.find(r => r.label === 'Value at maturity')!.value).not.toMatch(/PT/);
    unmount();
  });

  it('"Effective APY" carries text-bullish on positive APY and text-error on negative', () => {
    const positiveCase = renderComponent(
      <SupplyWithdraw
        {...baseProps}
        selectedSupplyToken={USDS_TOKEN}
        selectedWithdrawOutToken={USDS_TOKEN}
        flow={PendleFlow.BUY}
        amount={100_000_000_000_000_000_000n}
        quote={makeBuyQuote({ effectiveApy: 0.0354 })}
      />
    );
    expect(captured.latest!.pinnedData!.find(r => r.label === 'Effective APY')!.className).toBe(
      'text-bullish'
    );
    positiveCase.unmount();

    const negativeCase = renderComponent(
      <SupplyWithdraw
        {...baseProps}
        selectedSupplyToken={USDS_TOKEN}
        selectedWithdrawOutToken={USDS_TOKEN}
        flow={PendleFlow.BUY}
        amount={100_000_000_000_000_000_000n}
        quote={makeBuyQuote({ effectiveApy: -0.01 })}
      />
    );
    expect(captured.latest!.pinnedData!.find(r => r.label === 'Effective APY')!.className).toBe(
      'text-error'
    );
    negativeCase.unmount();
  });
});

describe('SupplyWithdraw — BUY transactionData (Transaction Details)', () => {
  it('renders "You receive" in PT-sUSDS units and "Min. received" in PT-sUSDS units', () => {
    const { unmount } = renderComponent(
      <SupplyWithdraw
        {...baseProps}
        selectedSupplyToken={USDS_TOKEN}
        selectedWithdrawOutToken={USDS_TOKEN}
        flow={PendleFlow.BUY}
        amount={100_000_000_000_000_000_000n}
        quote={makeBuyQuote()}
      />
    );
    const details = captured.latest!.transactionData!;
    expect(details.find(r => r.label === 'You receive')!.value).toBe('101.7443 PT-sUSDS');
    expect(details.find(r => r.label === 'Min. received')!.value).toBe('101.2356 PT-sUSDS');
    unmount();
  });

  it('does NOT duplicate "You supply" in the details (it lives in pinnedData)', () => {
    const { unmount } = renderComponent(
      <SupplyWithdraw
        {...baseProps}
        selectedSupplyToken={USDS_TOKEN}
        selectedWithdrawOutToken={USDS_TOKEN}
        flow={PendleFlow.BUY}
        amount={100_000_000_000_000_000_000n}
        quote={makeBuyQuote()}
      />
    );
    const details = captured.latest!.transactionData!;
    expect(details.find(r => r.label === 'You supply')).toBeUndefined();
    unmount();
  });
});

describe('SupplyWithdraw — SELL pinnedData (Transaction overview)', () => {
  it('renders 4 headline rows in order: You withdraw, Effective APY, Maturity date, You receive', () => {
    const { unmount } = renderComponent(
      <SupplyWithdraw
        {...baseProps}
        selectedSupplyToken={USDS_TOKEN}
        selectedWithdrawOutToken={USDS_TOKEN}
        flow={PendleFlow.WITHDRAW}
        amount={100_000_000_000_000_000_000n} // 100 PT-sUSDS
        ptBalance={1_000_000_000_000_000_000_000n}
        inputBalance={1_000_000_000_000_000_000_000n}
        quote={makeSellQuote(PT_AMOUNT_18, PT_MIN_AMOUNT_18)}
      />
    );
    const pinned = captured.latest?.pinnedData ?? [];
    expect(pinned.map(r => r.label)).toEqual([
      'You withdraw',
      'Effective APY',
      'Maturity date',
      'You receive'
    ]);
    unmount();
  });

  it('"You withdraw" uses the PT token symbol and PT decimals (18)', () => {
    const { unmount } = renderComponent(
      <SupplyWithdraw
        {...baseProps}
        selectedSupplyToken={USDS_TOKEN}
        selectedWithdrawOutToken={USDS_TOKEN}
        flow={PendleFlow.WITHDRAW}
        amount={100_000_000_000_000_000_000n}
        ptBalance={1_000_000_000_000_000_000_000n}
        inputBalance={1_000_000_000_000_000_000_000n}
        quote={makeSellQuote(PT_AMOUNT_18, PT_MIN_AMOUNT_18)}
      />
    );
    const pinned = captured.latest!.pinnedData!;
    expect(pinned.find(r => r.label === 'You withdraw')!.value).toBe('100 PT-sUSDS');
    unmount();
  });

  it('"You receive" with USDS output labels USDS (not PT-sUSDS)', () => {
    const { unmount } = renderComponent(
      <SupplyWithdraw
        {...baseProps}
        selectedSupplyToken={USDS_TOKEN}
        selectedWithdrawOutToken={USDS_TOKEN}
        flow={PendleFlow.WITHDRAW}
        amount={100_000_000_000_000_000_000n}
        ptBalance={1_000_000_000_000_000_000_000n}
        inputBalance={1_000_000_000_000_000_000_000n}
        quote={makeSellQuote(PT_AMOUNT_18, PT_MIN_AMOUNT_18)}
      />
    );
    const pinned = captured.latest!.pinnedData!;
    expect(pinned.find(r => r.label === 'You receive')!.value).toBe('101.7443 USDS');
    unmount();
  });

  it('"You receive" with USDC output labels USDC and uses 6-decimal formatting — cross-decimals guard', () => {
    const { unmount } = renderComponent(
      <SupplyWithdraw
        {...baseProps}
        selectedSupplyToken={USDS_TOKEN}
        selectedWithdrawOutToken={USDC_TOKEN}
        flow={PendleFlow.WITHDRAW}
        amount={100_000_000_000_000_000_000n}
        ptBalance={1_000_000_000_000_000_000_000n}
        inputBalance={1_000_000_000_000_000_000_000n}
        quote={makeSellQuote(USDC_RECEIVE_AMOUNT_6, USDC_MIN_AMOUNT_6)}
      />
    );
    const pinned = captured.latest!.pinnedData!;
    expect(pinned.find(r => r.label === 'You receive')!.value).toBe('101.7443 USDC');
    unmount();
  });
});

describe('SupplyWithdraw — BUY pinnedData / details: remaining row values', () => {
  function buyRender(quoteOverrides: Partial<PendleConvertQuote> = {}) {
    return renderComponent(
      <SupplyWithdraw
        {...baseProps}
        selectedSupplyToken={USDS_TOKEN}
        selectedWithdrawOutToken={USDS_TOKEN}
        flow={PendleFlow.BUY}
        amount={100_000_000_000_000_000_000n}
        quote={makeBuyQuote(quoteOverrides)}
      />
    );
  }

  it('"Effective APY" renders as a percentage with 2 decimal places', () => {
    const { unmount } = buyRender({ effectiveApy: 0.0354 });
    expect(captured.latest!.pinnedData!.find(r => r.label === 'Effective APY')!.value).toBe('3.54%');
    unmount();
  });

  it('"Maturity date" renders as a locale-formatted month-day-year string', () => {
    const { unmount } = buyRender();
    const value = captured.latest!.pinnedData!.find(r => r.label === 'Maturity date')!.value as string;
    // Expiry is Nov 26 2026 00:00:00 UTC. Locale formatting varies, but it
    // must contain the year and a recognizable month token.
    expect(value).toMatch(/2026/);
    expect(value).toMatch(/Nov/);
    unmount();
  });

  it('"Slippage tolerance" renders the configured decimal as XX.YY% with 2 fixed decimals', () => {
    const { unmount } = renderComponent(
      <SupplyWithdraw
        {...baseProps}
        selectedSupplyToken={USDS_TOKEN}
        selectedWithdrawOutToken={USDS_TOKEN}
        flow={PendleFlow.BUY}
        amount={100_000_000_000_000_000_000n}
        quote={makeBuyQuote()}
        slippage={0.0025} // 0.25%
      />
    );
    expect(
      captured.latest!.transactionData!.find(r => r.label === 'Slippage tolerance')!.value
    ).toBe('0.25%');
    unmount();
  });

  it('"Price impact" flips the API sign: API positive (favorable) → displayed negative', () => {
    const { unmount } = buyRender({ priceImpact: -0.00054 });
    // -0.054% (API negative = unfavorable in our display convention)
    expect(captured.latest!.transactionData!.find(r => r.label === 'Price impact')!.value).toBe(
      '0.054%'
    );
    unmount();
  });

  it('"Routed via" without aggregator says just "Pendle pool"', () => {
    const { unmount } = buyRender(); // no aggregatorType
    expect(captured.latest!.transactionData!.find(r => r.label === 'Routed via')!.value).toBe(
      'Pendle pool'
    );
    unmount();
  });

  it('"Routed via" on BUY with aggregator shows "<agg> → Pendle pool" (mint follows swap)', () => {
    const { unmount } = buyRender({
      aggregatorType: 'OKX',
      priceImpactBreakdown: { internalPriceImpact: -0.0003, externalPriceImpact: -0.0002 }
    });
    expect(captured.latest!.transactionData!.find(r => r.label === 'Routed via')!.value).toBe(
      'OKX → Pendle pool'
    );
    unmount();
  });

  it('aggregator route surfaces breakdown sub-rows (Pendle pool + aggregator name)', () => {
    const { unmount } = buyRender({
      aggregatorType: 'KYBERSWAP',
      priceImpactBreakdown: { internalPriceImpact: -0.0003, externalPriceImpact: -0.0002 }
    });
    const labels = captured.latest!.transactionData!.map(r => r.label);
    // Pendle pool + KyberSwap (mapped) sub-rows render below "Price impact"
    expect(labels).toContain('Pendle pool');
    expect(labels).toContain('KyberSwap');
    unmount();
  });

  it('"Pendle fee" with undefined feeUsd renders a React node containing "Included in quote"', () => {
    const { unmount } = buyRender({ feeUsd: undefined });
    const value = captured.latest!.transactionData!.find(r => r.label === 'Pendle fee')!.value;
    // value is a <Trans>Included in quote</Trans> React node — render and read textContent.
    const probe = document.createElement('div');
    document.body.appendChild(probe);
    const probeRoot = createRoot(probe);
    act(() => {
      probeRoot.render(<I18nProvider i18n={i18n}>{value as ReactNode}</I18nProvider>);
    });
    expect(probe.textContent).toContain('Included in quote');
    act(() => {
      probeRoot.unmount();
    });
    probe.remove();
    unmount();
  });

  it('"Pendle fee" with small USD value renders with 4 decimal places', () => {
    const { unmount } = buyRender({ feeUsd: 0.0363 });
    expect(captured.latest!.transactionData!.find(r => r.label === 'Pendle fee')!.value).toBe(
      '$0.0363'
    );
    unmount();
  });

  it('"Pendle fee" with USD value >= 1 renders with 2 decimal places', () => {
    const { unmount } = buyRender({ feeUsd: 12.345 });
    expect(captured.latest!.transactionData!.find(r => r.label === 'Pendle fee')!.value).toBe(
      '$12.35'
    );
    unmount();
  });
});

describe('SupplyWithdraw — SELL: remaining row values', () => {
  function sellRender(
    outputToken: Token,
    amountOut: bigint,
    apiMinOut: bigint,
    quoteOverrides: Partial<PendleConvertQuote> = {}
  ) {
    return renderComponent(
      <SupplyWithdraw
        {...baseProps}
        selectedSupplyToken={USDS_TOKEN}
        selectedWithdrawOutToken={outputToken}
        flow={PendleFlow.WITHDRAW}
        amount={100_000_000_000_000_000_000n}
        ptBalance={1_000_000_000_000_000_000_000n}
        inputBalance={1_000_000_000_000_000_000_000n}
        quote={makeSellQuote(amountOut, apiMinOut, quoteOverrides)}
      />
    );
  }

  it('SELL Maturity date pinned: month/year present', () => {
    const { unmount } = sellRender(USDS_TOKEN, PT_AMOUNT_18, PT_MIN_AMOUNT_18);
    const value = captured.latest!.pinnedData!.find(r => r.label === 'Maturity date')!.value as string;
    expect(value).toMatch(/2026/);
    expect(value).toMatch(/Nov/);
    unmount();
  });

  it('SELL "Routed via" with aggregator shows "Pendle pool → <agg>" (swap follows burn)', () => {
    const { unmount } = sellRender(USDC_TOKEN, USDC_RECEIVE_AMOUNT_6, USDC_MIN_AMOUNT_6, {
      aggregatorType: 'OKX',
      priceImpactBreakdown: { internalPriceImpact: -0.0003, externalPriceImpact: -0.0002 }
    });
    expect(captured.latest!.transactionData!.find(r => r.label === 'Routed via')!.value).toBe(
      'Pendle pool → OKX'
    );
    unmount();
  });

  it('SELL aggregator surfaces "Pendle pool" + aggregator sub-rows for price-impact breakdown', () => {
    const { unmount } = sellRender(USDC_TOKEN, USDC_RECEIVE_AMOUNT_6, USDC_MIN_AMOUNT_6, {
      aggregatorType: 'PARASWAP',
      priceImpactBreakdown: { internalPriceImpact: -0.0004, externalPriceImpact: -0.0001 }
    });
    const labels = captured.latest!.transactionData!.map(r => r.label);
    expect(labels).toContain('Pendle pool');
    expect(labels).toContain('Paraswap');
    unmount();
  });
});

describe('SupplyWithdraw — SELL transactionData (Transaction Details)', () => {
  it('"Min. received" uses output-token decimals + symbol (not PT)', () => {
    const { unmount } = renderComponent(
      <SupplyWithdraw
        {...baseProps}
        selectedSupplyToken={USDS_TOKEN}
        selectedWithdrawOutToken={USDC_TOKEN}
        flow={PendleFlow.WITHDRAW}
        amount={100_000_000_000_000_000_000n}
        ptBalance={1_000_000_000_000_000_000_000n}
        inputBalance={1_000_000_000_000_000_000_000n}
        quote={makeSellQuote(USDC_RECEIVE_AMOUNT_6, USDC_MIN_AMOUNT_6)}
      />
    );
    const details = captured.latest!.transactionData!;
    expect(details.find(r => r.label === 'Min. received')!.value).toBe('101.2356 USDC');
    unmount();
  });

  it('does NOT duplicate "You receive" or "Maturity date" in the details (both pinned)', () => {
    const { unmount } = renderComponent(
      <SupplyWithdraw
        {...baseProps}
        selectedSupplyToken={USDS_TOKEN}
        selectedWithdrawOutToken={USDS_TOKEN}
        flow={PendleFlow.WITHDRAW}
        amount={100_000_000_000_000_000_000n}
        ptBalance={1_000_000_000_000_000_000_000n}
        inputBalance={1_000_000_000_000_000_000_000n}
        quote={makeSellQuote(PT_AMOUNT_18, PT_MIN_AMOUNT_18)}
      />
    );
    const details = captured.latest!.transactionData!;
    expect(details.find(r => r.label === 'You receive')).toBeUndefined();
    expect(details.find(r => r.label === 'Maturity date')).toBeUndefined();
    unmount();
  });
});
