/**
 * @vitest-environment happy-dom
 */
import { i18n } from '@lingui/core';
import { renderHook } from '@testing-library/react';
import { parseGwei, type Call } from 'viem';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NO_VALUE } from '@/lib/constants';
import { cctpWithdrawalRoute, nativeWithdrawalRoute, type BridgeRouteOption } from '../model/resolveRoute';
import { useBridgeRouteCards } from './useBridgeRouteCards';

const mocks = vi.hoisted(() => ({
  feeWei: new Map<number, bigint>(),
  feeArgs: [] as { calls: unknown[]; chainId?: number; shouldUseBatch?: boolean; enabled?: boolean }[],
  ethFeePerGas: undefined as bigint | undefined,
  ethPrice: undefined as string | undefined
}));

vi.mock('@/hooks', async importOriginal => ({
  ...(await importOriginal<object>()),
  // Each source's L2 fee, keyed by its call count.
  useNetworkFee: (args: { calls: unknown[]; enabled?: boolean }) => {
    mocks.feeArgs.push(args);
    const feeWei = mocks.feeWei.get(args.calls.length);
    return { data: args.enabled && feeWei !== undefined ? { feeWei } : undefined };
  },
  useFeePerGas: () => ({ data: mocks.ethFeePerGas }),
  usePrices: () => ({ data: mocks.ethPrice ? { ETH: { price: mocks.ethPrice } } : undefined })
}));

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

const call = {} as Call;
const OPTIONS = [{ route: cctpWithdrawalRoute('base') }, { route: nativeWithdrawalRoute('base') }];
const SOURCES = {
  cctp: { calls: [call, call, call, call], isBatch: false },
  native: { calls: [call, call], isBatch: false }
};

const cards = (options: BridgeRouteOption[] | undefined = OPTIONS) =>
  renderHook(() => useBridgeRouteCards({ options, chainId: 8453, ethereumChainId: 1, sources: SOURCES }))
    .result.current;
const cell = (card: { rows: { label: string; value: string }[] } | undefined, label: string) =>
  card?.rows.find(row => row.label === label)?.value;

describe('useBridgeRouteCards', () => {
  beforeEach(() => {
    mocks.feeWei.clear();
    mocks.feeArgs.length = 0;
    mocks.ethFeePerGas = undefined;
    mocks.ethPrice = undefined;
  });

  it('builds no cards on a pair with a single route, and estimates nothing', () => {
    expect(
      renderHook(() =>
        useBridgeRouteCards({ options: undefined, chainId: 8453, ethereumChainId: 1, sources: SOURCES })
      ).result.current
    ).toBeUndefined();
    expect(mocks.feeArgs.every(args => !args.enabled)).toBe(true);
  });

  it("prices each route's L2 calls on the source chain plus its Ethereum steps", () => {
    mocks.feeWei.set(4, 10n ** 13n); // 0.00001 ETH
    mocks.feeWei.set(2, 2n * 10n ** 13n);
    mocks.ethFeePerGas = parseGwei('1');
    mocks.ethPrice = '2000';
    const [cctp, native] = cards()!;
    // CCTP: 0.00001 + 210k gas at 1 gwei = 0.00022 ETH = $0.44.
    expect(cell(cctp, 'Network fee')).toBe('~$0.44');
    // OP Stack: 0.00002 + 850k gas at 1 gwei = 0.00087 ETH = $1.74.
    expect(cell(native, 'Network fee')).toBe('~$1.74');
    expect(mocks.feeArgs.filter(args => args.enabled).every(args => args.chainId === 8453)).toBe(true);
  });

  it('counts the signatures of each route', () => {
    const [cctp, native] = cards()!;
    expect(cell(cctp, 'Approvals')).toBe('5');
    expect(cell(native, 'Approvals')).toBe('4');
  });

  it('shows a dash for a fee it cannot price yet', () => {
    mocks.feeWei.set(4, 10n ** 13n);
    mocks.ethPrice = '2000';
    const [cctp] = cards()!;
    expect(cell(cctp, 'Network fee')).toBe(NO_VALUE);
  });

  it("doesn't estimate an unavailable route", () => {
    cards([{ route: cctpWithdrawalRoute('base'), unavailable: 'no-liquidity' }, OPTIONS[1]]);
    const cctpArgs = mocks.feeArgs.find(args => args.calls.length === 4);
    expect(cctpArgs?.enabled).toBe(false);
  });
});
