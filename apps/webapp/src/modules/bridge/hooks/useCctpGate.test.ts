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

const mocks = vi.hoisted(() => ({ live: true }));

vi.mock('../model/pairs', async importOriginal => ({
  ...(await importOriginal<typeof import('../model/pairs')>()),
  isLivePair: () => mocks.live
}));
vi.mock('wagmi', () => ({
  useReadContracts: () => ({
    status: 'success',
    data: [
      false,
      false,
      10n ** 13n,
      PSM3_USDC,
      cctpL2Contracts('base').psm3,
      false,
      false,
      LITE_PSM_DAI,
      1n,
      0n,
      HALTED
    ]
  })
}));

const render = (swap?: boolean) =>
  renderHook(() =>
    useCctpGate({ from: 'base', to: 'ethereum', sourceChainId: 8453, ethereumChainId: 1, swap })
  ).result.current;

describe('useCctpGate', () => {
  beforeEach(() => {
    mocks.live = true;
  });

  it('limits a burn that swaps by the USDC PSM3 can pay out', () => {
    expect(render()).toEqual({ isOpen: true, maxAmount: 10n ** 13n * UNIT, liquidity: PSM3_USDC * UNIT });
  });

  it('limits a burn of USDC already swapped by the LitePSM alone', () => {
    expect(render(false)).toEqual({ isOpen: true, maxAmount: 10n ** 13n * UNIT, liquidity: LITE_PSM_DAI });
  });

  it('reads nothing for a pair that is not live', () => {
    mocks.live = false;
    expect(render()).toBeUndefined();
  });
});
