/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cctpL2Contracts } from '../adapters/cctp/contracts';
import { useCctpGate } from './useCctpGate';

const UNIT = 10n ** 12n;
const HALTED = 2n ** 256n - 1n;
const PSM3_USDC = 1_000n * 10n ** 6n;
const LITE_PSM_DAI = 5_000n * 10n ** 18n;

const mocks = vi.hoisted(() => ({
  live: true,
  pocket: undefined as string | undefined,
  usdcOf: {} as Record<string, bigint>,
  pocketRead: 'success' as 'success' | 'pending' | 'error',
  // A refetch failed after a good read: TanStack keeps the data and reports an error.
  refetchFailed: false
}));

vi.mock('../model/pairs', async importOriginal => ({
  ...(await importOriginal<typeof import('../model/pairs')>()),
  isLivePair: () => mocks.live
}));
type Read = { address: string; functionName: string; args?: readonly unknown[] };
const { psm3, usdc } = cctpL2Contracts('base');
// Answers each read by contract and function; the L2 USDC by holder.
const answer = ({ address, functionName, args }: Read): unknown => {
  if (address === usdc && functionName === 'balanceOf') return mocks.usdcOf[args?.[0] as string] ?? 0n;
  if (functionName === 'balanceOf') return LITE_PSM_DAI;
  return {
    paused: false,
    burnLimitsPerMessage: 10n ** 13n,
    pocket: mocks.pocket ?? psm3,
    live: 1n,
    tin: 0n,
    HALTED: HALTED
  }[functionName];
};
vi.mock('wagmi', () => ({
  useReadContracts: ({ contracts, query }: { contracts: Read[]; query?: { enabled?: boolean } }) => {
    if (query?.enabled === false) return { status: 'pending', data: undefined };
    const pocketRead = contracts.some(read => read.address === usdc && read.functionName === 'balanceOf');
    if (pocketRead && mocks.pocketRead !== 'success') return { status: mocks.pocketRead, data: undefined };
    return { status: mocks.refetchFailed ? 'error' : 'success', data: contracts.map(answer) };
  }
}));

const render = (swap?: boolean) =>
  renderHook(() =>
    useCctpGate({ from: 'base', to: 'ethereum', sourceChainId: 8453, ethereumChainId: 1, swap })
  ).result.current;

describe('useCctpGate', () => {
  beforeEach(() => {
    mocks.live = true;
    mocks.pocket = undefined;
    mocks.usdcOf = { [psm3]: PSM3_USDC };
    mocks.pocketRead = 'success';
    mocks.refetchFailed = false;
  });

  it('limits a burn that swaps by the USDC PSM3 can pay out', () => {
    expect(render()).toEqual({ isOpen: true, maxAmount: 10n ** 13n * UNIT, liquidity: PSM3_USDC * UNIT });
  });

  it('limits a burn of USDC already swapped by the LitePSM alone', () => {
    expect(render(false)).toEqual({ isOpen: true, maxAmount: 10n ** 13n * UNIT, liquidity: LITE_PSM_DAI });
  });

  it('limits a burn that swaps by the USDC of the pocket PSM3 swaps from', () => {
    const pocket = '0x000000000000000000000000000000000000beef';
    mocks.pocket = pocket;
    mocks.usdcOf = { [psm3]: 0n, [pocket]: PSM3_USDC };
    expect(render()).toMatchObject({ isOpen: true, liquidity: PSM3_USDC * UNIT });
    mocks.usdcOf = { [psm3]: PSM3_USDC, [pocket]: 0n };
    expect(render()).toMatchObject({ isOpen: true, liquidity: 0n });
  });

  it("loads until the pocket's USDC is read, and fails closed when it can't be", () => {
    mocks.pocketRead = 'pending';
    expect(render()).toBe('loading');
    mocks.pocketRead = 'error';
    expect(render()).toBe('error');
  });

  it('keeps the last good read when a refetch fails, so an open CCTP route stays put', () => {
    mocks.refetchFailed = true;
    expect(render()).toEqual({ isOpen: true, maxAmount: 10n ** 13n * UNIT, liquidity: PSM3_USDC * UNIT });
  });

  it('reads nothing for a pair that is not live', () => {
    mocks.live = false;
    expect(render()).toBeUndefined();
  });
});
