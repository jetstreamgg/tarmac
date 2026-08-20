import { render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nWidgetProvider } from '@/widgets/context/I18nWidgetProvider';
import type { NetworkFeeData } from '@/hooks';
import { NetworkFeeValue, useBundleFeeState } from './NetworkFeeValue';

const mocks = vi.hoisted(() => ({
  batchEnabled: false,
  setBatchEnabled: vi.fn(),
  batchSupported: true as boolean | undefined,
  isSupportLoading: false
}));

vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({
  useBatchToggle: () => [mocks.batchEnabled, mocks.setBatchEnabled] as const
}));

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useIsBatchSupported: () => ({ data: mocks.batchSupported, isLoading: mocks.isSupportLoading })
  };
});

/** A resolved estimate: bundling applies and saves 18.4%. */
const fee = (overrides: Partial<NetworkFeeData> = {}): NetworkFeeData => ({
  gas: 162_592n,
  sequentialGas: 199_222n,
  batchGas: 162_592n,
  isBatch: true,
  feePerGas: 201_000_000n,
  feeWei: 32_681_000_000_000n,
  feeUsd: 0.11,
  formatted: '$0.11',
  sequentialFormatted: '$0.13',
  batchSaving: 0.184,
  ...overrides
});

const stateOf = (callCount: number, data?: NetworkFeeData, failed = false) =>
  renderHook(() => useBundleFeeState(callCount, data, failed)).result.current;

beforeEach(() => {
  mocks.batchEnabled = false;
  mocks.batchSupported = true;
  mocks.isSupportLoading = false;
  mocks.setBatchEnabled.mockClear();
});

describe('useBundleFeeState', () => {
  it('holds everything back until the fee has landed', () => {
    expect(stateOf(2, undefined)).toMatchObject({ ready: false, settled: false, promoVisible: false });
  });

  it('holds everything back while wallet capabilities are still loading', () => {
    mocks.isSupportLoading = true;
    expect(stateOf(2, fee())).toMatchObject({ ready: false, settled: false, promoVisible: false });
  });

  it('is ready and settled once the fee is formatted', () => {
    expect(stateOf(2, fee())).toMatchObject({ ready: true, settled: true, canBundle: true });
  });

  it('settles — but is never ready — when the estimate fails', () => {
    // The badge is the modal's only bundling switch, so a reverting simulation must not
    // take it away with the figure.
    expect(stateOf(2, undefined, true)).toMatchObject({
      ready: false,
      settled: true,
      canBundle: true,
      promoVisible: false
    });
  });

  it('cannot bundle a single call, or a wallet that does not support it', () => {
    expect(stateOf(1, fee()).canBundle).toBe(false);
    mocks.batchSupported = false;
    expect(stateOf(2, fee()).canBundle).toBe(false);
  });

  it('pitches the saving only to someone who had bundling off', () => {
    expect(stateOf(2, fee()).promoVisible).toBe(true);
    mocks.batchEnabled = true;
    expect(stateOf(2, fee()).promoVisible).toBe(false);
  });

  it('does not pitch a saving it cannot quote', () => {
    expect(stateOf(2, fee({ batchSaving: 0 })).promoVisible).toBe(false);
    expect(stateOf(2, fee({ batchSaving: undefined })).promoVisible).toBe(false);
  });

  it('keeps the card up after the switch is flipped mid-modal', () => {
    const { result, rerender } = renderHook(() => useBundleFeeState(2, fee()));
    expect(result.current.promoVisible).toBe(true);
    mocks.batchEnabled = true;
    rerender();
    // `enabledOnOpen` is a snapshot: flipping the switch must not yank the card out from
    // under the click that just landed on it.
    expect(result.current.promoVisible).toBe(true);
  });
});

const renderValue = (data: NetworkFeeData | undefined, state: ReturnType<typeof stateOf>, loading = false) =>
  render(
    <I18nWidgetProvider locale="en">
      <NetworkFeeValue fee={data} state={state} loading={loading} />
    </I18nWidgetProvider>
  );

describe('NetworkFeeValue', () => {
  it('is a plain dash before anything has resolved', async () => {
    renderValue(undefined, stateOf(2, undefined));
    expect(await screen.findByText('–')).toBeTruthy();
    expect(screen.queryByTestId('bundle-toggle-badge')).toBeNull();
  });

  it('stays plain for a wallet that cannot bundle', async () => {
    mocks.batchSupported = false;
    const data = fee({ isBatch: false });
    renderValue(data, stateOf(2, data));
    expect(await screen.findByText('$0.11')).toBeTruthy();
    expect(screen.queryByTestId('bundle-toggle-badge')).toBeNull();
  });

  it('keeps the row plain while the promo card is making the same case', async () => {
    // Bundling off + a saving to pitch → the card is up, so no `Not bundled` badge.
    const data = fee({ isBatch: false });
    const state = stateOf(2, data);
    expect(state.promoVisible).toBe(true);
    renderValue(data, state);
    expect(await screen.findByText('$0.11')).toBeTruthy();
    expect(screen.queryByTestId('bundle-toggle-badge')).toBeNull();
  });

  it('shows the badge and the bundled fee when bundling is on', async () => {
    mocks.batchEnabled = true;
    const data = fee();
    renderValue(data, stateOf(2, data));
    expect(await screen.findByTestId('bundle-toggle-badge')).toBeTruthy();
    expect(screen.getByText('Bundled')).toBeTruthy();
    expect(screen.getByText('$0.11')).toBeTruthy();
    // The sequential cost is not drawn beside it — struck through or otherwise: the
    // saving has already been made by the time this state is reachable (team call,
    // 2026-07-28).
    expect(screen.queryByText('$0.13')).toBeNull();
  });

  it('shows a `Not bundled` badge once the pitch is gone', async () => {
    // Bundling off and nothing to pitch (no saving) → the badge explains the higher fee.
    const data = fee({ isBatch: false, batchSaving: 0 });
    renderValue(data, stateOf(2, data));
    expect(await screen.findByText('Not bundled')).toBeTruthy();
  });

  it('still offers the toggle when the estimate failed', async () => {
    mocks.batchEnabled = true;
    renderValue(undefined, stateOf(2, undefined, true));
    expect(await screen.findByTestId('bundle-toggle-badge')).toBeTruthy();
    // Failed reads as failed, not as the not-applicable dash (APP-491).
    expect(screen.getByTestId('network-fee-failed')).toBeTruthy();
  });

  it('draws the skeleton while the estimate is in flight (APP-491)', async () => {
    renderValue(undefined, stateOf(1, undefined), true);
    expect(await screen.findByTestId('network-fee-loading')).toBeTruthy();
    expect(screen.queryByText('–')).toBeNull();
  });

  it('says the estimate failed instead of a dash (APP-491)', async () => {
    // One call → no bundling badge; the failed marker stands alone.
    renderValue(undefined, stateOf(1, undefined, true));
    expect(await screen.findByTestId('network-fee-failed')).toBeTruthy();
    expect(screen.getByText('Unavailable')).toBeTruthy();
    expect(screen.queryByText('–')).toBeNull();
  });

  it('keeps a held figure through a failed refetch', async () => {
    // `keepPreviousData` can hand back the last estimate alongside a new error —
    // the figure wins over the failed marker.
    const data = fee({ isBatch: false });
    mocks.batchSupported = false;
    renderValue(data, stateOf(1, data, true), false);
    expect(await screen.findByText('$0.11')).toBeTruthy();
    expect(screen.queryByTestId('network-fee-failed')).toBeNull();
  });
});
