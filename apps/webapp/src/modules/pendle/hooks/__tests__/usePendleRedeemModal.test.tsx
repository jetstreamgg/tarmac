/// <reference types="vite/client" />

import { act, useEffect, type ReactNode } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mainnet } from 'viem/chains';
import { pendleAnalyticsData } from '@/modules/pendle/lib/pendleAnalyticsData';
import type { PendleConvertQuote, PendleMarketConfig } from '@/hooks';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
i18n.load('en', {});
i18n.activate('en');

const MATURED_MARKET: PendleMarketConfig = {
  name: 'PT-USDG',
  slug: 'pt-usdg',
  marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33',
  ptToken: '0x9db38d74a0d29380899ad354121dfb521adb0548',
  ytToken: '0x4a1294749a70bc32a998b49dd11bf26e9379e3c1',
  syToken: '0xc1799cab1f201946f7cfafbaf1bcc089b2f08927',
  underlyingToken: '0xe343167631d89b6ffc58b88d6b7fb0228795491d',
  underlyingSymbol: 'USDG',
  underlyingDecimals: 6,
  expiry: 1_700_000_000 // matured (2023)
};

const PT_BALANCE = 1_500_000n; // 1.5 PT-USDG (6dp)

const QUOTE: PendleConvertQuote = {
  method: 'exitPostExpToToken',
  amountOut: 1_499_500n,
  apiMinOut: 1_484_505n,
  effectiveApy: 0.054,
  impliedApy: 0.06,
  priceImpact: -0.0012,
  aggregatorType: 'KYBERSWAP',
  feeUsd: 1.23,
  fetchedAt: Date.now(),
  apiContractParams: [],
  apiContractParamsName: []
};

const hoisted = vi.hoisted(() => ({
  launchMock: vi.fn(),
  updateMock: vi.fn(),
  isModalOpen: false,
  txStatus: 'idle',
  matured: true,
  // Swappable execute fn so tests can prove the latest one fires through onConfirm.
  currentExecute: (() => undefined) as () => void,
  // Swappable USD value fn (default ≈$1/token) so a test can force "no value".
  valueUsd: ((_symbol: string, amount: number) => amount) as (
    symbol: string,
    amount: number
  ) => number | undefined,
  // Click-time network switch collaborators.
  chainId: 1,
  canSwitchChain: true,
  switchChainAsyncMock: vi.fn(async () => undefined as unknown),
  setIsAutoSwitchingMock: vi.fn(),
  setAutoSwitchIntentMock: vi.fn(),
  trackSwitchRequestedMock: vi.fn(),
  trackSwitchCompletedMock: vi.fn(),
  // The provider's live session, and the args the quote hook last saw.
  activeSessionId: null as string | null,
  quoteEnabled: undefined as boolean | undefined,
  // Swappable write-hook simulation state; defaults to prepared.
  writeError: undefined as Error | undefined,
  // Swappable quote state; undefined keeps the healthy QUOTE.
  quoteState: undefined as { data: unknown; isLoading: boolean; error: Error | undefined } | undefined
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => hoisted.chainId,
    useChains: () => [{ id: 1, name: 'Ethereum' }],
    useSwitchChain: () => ({ switchChainAsync: hoisted.switchChainAsyncMock }),
    useConnection: () => ({ address: '0x1111111111111111111111111111111111111111' })
  };
});

vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({
    isSwitchingNetwork: false,
    setIsSwitchingNetwork: () => undefined,
    isAutoSwitching: false,
    setIsAutoSwitching: hoisted.setIsAutoSwitchingMock,
    autoSwitchIntent: null,
    setAutoSwitchIntent: hoisted.setAutoSwitchIntentMock,
    canSwitchChain: hoisted.canSwitchChain
  })
}));

vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({
  useAppAnalytics: () => ({
    trackNetworkSwitchRequested: hoisted.trackSwitchRequestedMock,
    trackNetworkSwitchCompleted: hoisted.trackSwitchCompletedMock
  })
}));

vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({
  useBatchToggle: () => [true, () => undefined]
}));

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    isMarketMatured: () => hoisted.matured,
    useTokenAllowance: () => ({ data: 0n, isLoading: false, error: null, mutate: () => {} }),
    useNetworkFee: () => ({
      data: undefined,
      isLoading: false,
      error: null,
      mutate: () => {},
      dataSources: []
    }),
    useIsBatchSupported: () => ({ data: true, isLoading: false }),
    usePendleUserPtBalances: () => ({
      data: { [MATURED_MARKET.marketAddress]: PT_BALANCE },
      isLoading: false,
      error: undefined,
      mutate: () => undefined,
      dataSources: []
    }),
    useQuotePendleConvert: (args: { enabled?: boolean }) => {
      hoisted.quoteEnabled = args.enabled;
      return {
        ...(hoisted.quoteState ?? { data: QUOTE, isLoading: false, error: undefined }),
        mutate: () => undefined,
        dataSources: []
      };
    },
    useBatchPendleConvert: () => {
      // Snapshot the current execute at render time so each render's writeHook
      // closes over the args from that render — matches the real hook's
      // semantics (a fresh execute closure per render).
      const captured = hoisted.currentExecute;
      return {
        execute: () => captured(),
        reset: () => undefined,
        prepared: !hoisted.writeError,
        isLoading: false,
        error: hoisted.writeError,
        currentCallIndex: 0
      };
    }
  };
});

vi.mock('@/modules/pendle/hooks/usePendleSlippage', () => ({
  usePendleSlippage: () => ({
    slippage: 0.01,
    setSlippage: () => undefined,
    defaultSlippage: 0.01
  })
}));

// Stub the USD value fn so the test doesn't pull in usePrices()/wagmi reads.
// Reads the swappable hoisted fn (default ≈$1/token).
vi.mock('@/modules/pendle/hooks/usePendleUsdValue', () => ({
  usePendleUsdValue: () => hoisted.valueUsd
}));

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: hoisted.launchMock,
    updateModalContent: hoisted.updateMock,
    isModalOpen: hoisted.isModalOpen,
    activeSessionId: hoisted.activeSessionId,
    txCallbacks: {
      onMutate: () => undefined,
      onStart: () => undefined,
      onSuccess: () => undefined,
      onError: () => undefined
    },
    txStatus: hoisted.txStatus
  })
}));

vi.mock('../../components/PendleRedeem', () => ({
  PendleRedeem: () => null
}));

import { usePendleRedeemModal } from '../usePendleRedeemModal';

function renderComponent(ui: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
  });
  return {
    container,
    rerender: (next: ReactNode) => {
      act(() => {
        root.render(<I18nProvider i18n={i18n}>{next}</I18nProvider>);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  };
}

const TestConsumer = ({ openOnMount = true }: { openOnMount?: boolean }) => {
  const { openRedeemModal } = usePendleRedeemModal(MATURED_MARKET);
  useEffect(() => {
    if (openOnMount) openRedeemModal();
  }, [openRedeemModal, openOnMount]);
  return null;
};

describe('usePendleRedeemModal analytics', () => {
  beforeEach(() => {
    hoisted.launchMock.mockClear();
    hoisted.updateMock.mockClear();
    hoisted.isModalOpen = false;
    hoisted.txStatus = 'idle';
    hoisted.matured = true;
    hoisted.valueUsd = (_symbol: string, amount: number) => amount;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('freezes the live analytics push once the flow leaves IDLE', () => {
    hoisted.isModalOpen = true;
    const view = renderComponent(<TestConsumer openOnMount={false} />);
    const idlePushes = hoisted.updateMock.mock.calls.length;
    expect(idlePushes).toBeGreaterThan(0);

    // Quote repolls mid-flight (valueUsd recompute) while the tx is loading:
    // the blob the signed tx started with must not be rewritten.
    hoisted.txStatus = 'loading';
    hoisted.valueUsd = (_symbol: string, amount: number) => amount * 2;
    view.rerender(<TestConsumer openOnMount={false} />);
    expect(hoisted.updateMock.mock.calls.length).toBe(idlePushes);

    // Back to IDLE (reset/retry): pushes resume.
    hoisted.txStatus = 'idle';
    view.rerender(<TestConsumer openOnMount={false} />);
    expect(hoisted.updateMock.mock.calls.length).toBeGreaterThan(idlePushes);
    view.unmount();
  });

  it('names the quoted receive amount in the success toast, on launch and in the live push', () => {
    hoisted.isModalOpen = true;
    const { unmount } = renderComponent(<TestConsumer />);
    // QUOTE.amountOut = 1_499_500n at 6dp → 1.5 of the default output (the underlying).
    const expected = {
      loading: 'Claiming your matured position',
      success: 'Claimed 1.50 USDG',
      error: 'Claim failed'
    };
    expect(hoisted.launchMock.mock.calls[0][0].toast).toEqual(expected);
    const lastPush = hoisted.updateMock.mock.calls.at(-1)?.[1];
    expect(lastPush.toast).toEqual(expected);
    unmount();
  });

  it('preserves widgetName=fixed, flow=redeem, action=redeem on launch()', () => {
    const { unmount } = renderComponent(<TestConsumer />);
    expect(hoisted.launchMock).toHaveBeenCalledTimes(1);
    const config = hoisted.launchMock.mock.calls[0][0];
    expect(config.analytics.widgetName).toBe('fixed');
    expect(config.analytics.flow).toBe('redeem');
    expect(config.analytics.action).toBe('redeem');
    unmount();
  });

  it('emits analytics.data shaped identically to pendleAnalyticsData(redeem)', () => {
    const { unmount } = renderComponent(<TestConsumer />);
    const config = hoisted.launchMock.mock.calls[0][0];

    // Reconstruct the expected blob from the same inputs the hook used.
    const ptToken = {
      name: 'PT-USDG',
      symbol: 'PT-USDG',
      decimals: 6,
      color: '#1BE3C2',
      address: { [mainnet.id]: MATURED_MARKET.ptToken }
    };
    const underlyingToken = {
      name: 'USDG',
      symbol: 'USDG',
      decimals: 6,
      color: '#00C2A1',
      address: { [mainnet.id]: MATURED_MARKET.underlyingToken }
    };
    const expected = pendleAnalyticsData({
      market: MATURED_MARKET,
      side: 'redeem',
      originToken: ptToken,
      targetToken: underlyingToken,
      amountFromBigint: PT_BALANCE,
      amountToBigint: QUOTE.amountOut,
      fromDecimals: MATURED_MARKET.underlyingDecimals,
      toDecimals: MATURED_MARKET.underlyingDecimals,
      slippage: 0.01,
      quote: QUOTE,
      isBatchTx: true
    });

    // Each key in `expected` must be present on the launched blob with the
    // same value. `amount` is added on top of that — assert separately below.
    for (const [key, value] of Object.entries(expected)) {
      expect(config.analytics.data[key]).toEqual(value);
    }
    unmount();
  });

  it('emits a strictly negative amount = USD value of the redeemed output leg', () => {
    // `amount` now values the non-PT output leg (USDS/USDC/underlying the user
    // receives), not the PT count. Output = QUOTE.amountOut (1_499_500n at 6dp)
    // = 1.4995; valued ~$1/token by the stubbed value fn; emitted negative as a
    // withdrawal. (Previously this asserted the PT-balance magnitude of 1.5.)
    const { unmount } = renderComponent(<TestConsumer />);
    const config = hoisted.launchMock.mock.calls[0][0];
    expect(config.analytics.data.amount).toBeLessThan(0);
    expect(Math.abs(config.analytics.data.amount)).toBeCloseTo(1.4995, 6);
    unmount();
  });

  it('omits amount when the output leg cannot be valued (valueUsd → undefined)', () => {
    hoisted.valueUsd = () => undefined;
    const { unmount } = renderComponent(<TestConsumer />);
    const config = hoisted.launchMock.mock.calls[0][0];
    expect(config.analytics.widgetName).toBe('fixed');
    expect('amount' in config.analytics.data).toBe(false);
    unmount();
  });

  it('includes module=pendle and the consolidated Pendle fields', () => {
    const { unmount } = renderComponent(<TestConsumer />);
    const config = hoisted.launchMock.mock.calls[0][0];
    const data = config.analytics.data;
    expect(data.module).toBe('pendle');
    expect(data.productAddress).toBe(MATURED_MARKET.marketAddress);
    expect(data.ptAddress).toBe(MATURED_MARKET.ptToken);
    expect(data.expiry).toBe(MATURED_MARKET.expiry);
    expect(data.aggregatorType).toBe('KYBERSWAP');
    expect(data.feeUsd).toBe(1.23);
    unmount();
  });
});

describe('usePendleRedeemModal onConfirm freshness', () => {
  beforeEach(() => {
    hoisted.launchMock.mockClear();
    // currentExecute is reassigned per test below, so no clear needed here.
    hoisted.matured = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('onConfirm invokes the latest writeHook.execute, not the one captured at launch', () => {
    // Modal opens with the user's initial selection (e.g. underlying as output).
    // writeHook.execute closes over that render's args.
    const executeAtLaunch = vi.fn();
    hoisted.currentExecute = executeAtLaunch;

    const { rerender, unmount } = renderComponent(<TestConsumer />);

    expect(hoisted.launchMock).toHaveBeenCalledTimes(1);
    const storedOnConfirm = hoisted.launchMock.mock.calls[0][0].onConfirm;

    // User changes something after launch (output token, slippage, or a
    // background quote refetch lands). The next render of useBatchPendleConvert
    // produces a new execute closure referencing the new args. Force the
    // re-render and swap the hoisted execute to model it.
    const executeAfterChange = vi.fn();
    hoisted.currentExecute = executeAfterChange;
    rerender(<TestConsumer openOnMount={false} />);

    // User clicks Confirm. The stored onConfirm — captured at launch — must
    // route through the ref and call the latest execute, not the stale one.
    act(() => {
      storedOnConfirm();
    });

    expect(executeAtLaunch).not.toHaveBeenCalled();
    expect(executeAfterChange).toHaveBeenCalledTimes(1);
    unmount();
  });
});

describe('usePendleRedeemModal network switch', () => {
  beforeEach(() => {
    hoisted.launchMock.mockClear();
    hoisted.isModalOpen = false;
    hoisted.txStatus = 'idle';
    hoisted.matured = true;
    hoisted.chainId = 1;
    hoisted.canSwitchChain = true;
    hoisted.switchChainAsyncMock.mockReset();
    hoisted.switchChainAsyncMock.mockResolvedValue(undefined);
    hoisted.setIsAutoSwitchingMock.mockClear();
    hoisted.setAutoSwitchIntentMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // A real click, not a render-time capture — reassigning an outer variable
  // during render trips react-hooks/globals, and the click path is what ships.
  const Capture = () => {
    const { openRedeemModal } = usePendleRedeemModal(MATURED_MARKET);
    return <button data-testid="open-redeem" onClick={() => void openRedeemModal()} />;
  };
  const clickOpen = (container: HTMLElement) =>
    act(async () => {
      container
        .querySelector('[data-testid="open-redeem"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

  it('opens directly on the pendle chain without touching the wallet', async () => {
    const view = renderComponent(<Capture />);
    await clickOpen(view.container);
    expect(hoisted.switchChainAsyncMock).not.toHaveBeenCalled();
    expect(hoisted.launchMock).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('switches the wallet to mainnet first when clicked off-chain, flagged automatic', async () => {
    hoisted.chainId = 8453; // Base
    const view = renderComponent(<Capture />);
    await clickOpen(view.container);
    expect(hoisted.setIsAutoSwitchingMock).toHaveBeenCalledWith(true);
    expect(hoisted.switchChainAsyncMock).toHaveBeenCalledWith({ chainId: 1 });
    expect(hoisted.launchMock).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('a rejected switch opens nothing and resets the auto flags — the click stays retryable', async () => {
    hoisted.chainId = 8453;
    hoisted.switchChainAsyncMock.mockRejectedValueOnce(new Error('User rejected the request'));
    const view = renderComponent(<Capture />);
    await clickOpen(view.container);
    expect(hoisted.launchMock).not.toHaveBeenCalled();
    expect(hoisted.setIsAutoSwitchingMock).toHaveBeenLastCalledWith(false);
    expect(hoisted.setAutoSwitchIntentMock).toHaveBeenLastCalledWith(null);
    view.unmount();
  });

  it('does nothing off-chain in a Safe — it cannot switch from the dapp (APP-486)', async () => {
    hoisted.chainId = 8453;
    hoisted.canSwitchChain = false;
    const view = renderComponent(<Capture />);
    await clickOpen(view.container);
    expect(hoisted.switchChainAsyncMock).not.toHaveBeenCalled();
    expect(hoisted.launchMock).not.toHaveBeenCalled();
    view.unmount();
  });
});

describe('usePendleRedeemModal claim quote failure', () => {
  beforeEach(() => {
    hoisted.launchMock.mockClear();
    hoisted.isModalOpen = false;
    hoisted.txStatus = 'idle';
    hoisted.matured = true;
    hoisted.chainId = 1;
  });

  afterEach(() => {
    hoisted.quoteState = undefined;
    hoisted.writeError = undefined;
    vi.clearAllMocks();
  });

  const Capture = () => {
    const { openRedeemModal } = usePendleRedeemModal(MATURED_MARKET);
    return <button data-testid="open-redeem" onClick={() => void openRedeemModal()} />;
  };
  const clickOpen = (container: HTMLElement) =>
    act(async () => {
      container
        .querySelector('[data-testid="open-redeem"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  // The card no longer gates Claim on a quote: the modal opens and says why.
  const openWith = async (quoteState: typeof hoisted.quoteState) => {
    hoisted.quoteState = quoteState;
    const view = renderComponent(<Capture />);
    await clickOpen(view.container);
    view.unmount();
    return hoisted.launchMock.mock.calls[0][0] as { errorMessage?: string };
  };

  it('says nothing while the quote is healthy or still loading', async () => {
    expect((await openWith(undefined)).errorMessage).toBeUndefined();
    hoisted.launchMock.mockClear();
    expect(
      (await openWith({ data: undefined, isLoading: true, error: undefined })).errorMessage
    ).toBeUndefined();
  });

  it.each([
    'Pendle /convert 400: {"message":"Market not found","statusCode":400}',
    'Pendle /convert 503: {}'
  ])('says Pendle cannot prepare the claim when its API refuses: %s', async raw => {
    const config = await openWith({ data: undefined, isLoading: false, error: new Error(raw) });
    expect(config.errorMessage).toBe("Pendle can't prepare this claim right now. Please try again later.");
  });

  it('does not tell a dust position to check back later', async () => {
    const config = await openWith({
      data: undefined,
      isLoading: false,
      error: new Error('Pendle /convert 400: {"message":"Input valuation is too low"}')
    });
    expect(config.errorMessage).toBe('This position is too small to claim.');
  });

  it('points at the other payout token when Pendle has no route', async () => {
    const config = await openWith({
      data: undefined,
      isLoading: false,
      error: new Error('Pendle /convert returned no routes')
    });
    expect(config.errorMessage).toBe(
      "Pendle can't route this claim to the selected token. Try a different token."
    );
  });

  it('says the quote was invalid, as the buy/sell modal does', async () => {
    const config = await openWith({
      data: undefined,
      isLoading: false,
      error: new Error('Pendle: malformed quote — missing input/output struct for "exitPostExpToToken"')
    });
    expect(config.errorMessage).toBe('Received an invalid quote from Pendle. Please try again.');
  });

  it('points at the connection when Pendle could not be reached', async () => {
    const config = await openWith({ data: undefined, isLoading: false, error: new Error('Failed to fetch') });
    expect(config.errorMessage).toBe(
      "Couldn't reach Pendle to prepare your claim. Check your connection and try again."
    );
  });

  it.each([
    new SyntaxError('Unexpected token < in JSON at position 0'),
    new Error('Pendle: refusing to sign — selector "redeemPyToToken" not allowed for redeem')
  ])('falls back to the shared prepare copy, not the connection: %s', async error => {
    const config = await openWith({ data: undefined, isLoading: false, error });
    expect(config.errorMessage).toBe('Something went wrong preparing the transaction. Please try again.');
  });

  it('gives a failed simulation the shared fallback, not advice to adjust inputs', async () => {
    hoisted.writeError = new Error('HTTP request failed');
    const config = await openWith(undefined);
    expect(config.errorMessage).toBe('Something went wrong preparing the transaction. Please try again.');
  });

  it('reads a contract revert through the shared revert registry', async () => {
    hoisted.writeError = new Error('execution reverted: custom error 0x1234');
    const config = await openWith(undefined);
    expect(config.errorMessage).toBe('The transaction would fail with "custom error 0x1234".');
  });

  it('keeps the slippage guidance when the simulation fails on slippage', async () => {
    hoisted.writeError = new Error('execution reverted: Slippage: INSUFFICIENT_TOKEN_OUT');
    const config = await openWith(undefined);
    expect(config.errorMessage).toMatch(/slippage tolerance/);
  });

  it("fetches the quote only while this card's modal session is live, like the buy/sell modal", async () => {
    hoisted.activeSessionId = null;
    const view = renderComponent(<Capture />);
    expect(hoisted.quoteEnabled).toBe(false);

    await clickOpen(view.container);
    const { sessionId } = hoisted.launchMock.mock.calls[0][0] as { sessionId: string };
    hoisted.activeSessionId = sessionId;
    view.rerender(<Capture />);
    expect(hoisted.quoteEnabled).toBe(true);

    // Another card's session doesn't wake this card's quote.
    hoisted.activeSessionId = 'another-card';
    view.rerender(<Capture />);
    expect(hoisted.quoteEnabled).toBe(false);
    view.unmount();
    hoisted.activeSessionId = null;
  });

  it('shows a prepare failure when no quote has arrived and none failed', async () => {
    hoisted.writeError = new Error('HTTP request failed');
    const config = await openWith({ data: undefined, isLoading: false, error: undefined });
    expect(config.errorMessage).toBe('Something went wrong preparing the transaction. Please try again.');
  });
});
