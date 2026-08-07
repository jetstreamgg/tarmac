import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  live: 1n as bigint | undefined,
  tin: 0n as bigint | undefined,
  halted: 0n as bigint | undefined
}));

// The three PSM-wrapper reads the gate is made of. Stubbed so the branches can be
// driven directly — every one of them was previously reachable only by rendering
// the whole supply modal, which is why several never got asserted at all.
vi.mock('@/hooks', () => ({
  useUsdsPsmWrapperLive: () => ({ data: h.live }),
  useUsdsPsmWrapperTin: () => ({ data: h.tin }),
  useUsdsPsmWrapperHalted: () => ({ data: h.halted })
}));

import { useUsdcSupplyGate } from './useUsdcSupplyGate';

/** What mainnet's `HALTED()` actually returns — a max-uint256 sentinel, not a flag. */
const MAINNET_HALTED_SENTINEL = 2n ** 256n - 1n;
const BUY_GEM_HALTED = 1n;
const SELL_GEM_HALTED = 2n;

const gate = () => renderHook(() => useUsdcSupplyGate()).result.current;

describe('useUsdcSupplyGate', () => {
  beforeEach(() => {
    h.live = 1n;
    h.tin = 0n;
    h.halted = 0n;
  });
  afterEach(() => cleanup());

  it('opens the path when the module is live, unhalted and free', () => {
    expect(gate()).toEqual({ ready: true });
  });

  describe('holds until every read has answered', () => {
    // A fee that hasn't loaded yet must not read as "no fee" — that would let a
    // swap go out that leaves the deposit short.
    it.each([
      ['live', () => (h.live = undefined)],
      ['tin', () => (h.tin = undefined)],
      ['HALTED', () => (h.halted = undefined)]
    ])('is not ready while %s is in flight', (_label, unset) => {
      unset();
      const result = gate();
      expect(result.ready).toBe(false);
      // No verdict either way — the caller blocks on `ready`, not on a reason.
      expect(result.blockedReason).toBeUndefined();
    });
  });

  it('blocks when the wrapper is cased off (live !== 1)', () => {
    h.live = 0n;
    expect(gate()).toEqual({ ready: true, blockedReason: 'psm_unavailable' });
  });

  it('blocks when the sell direction is halted by flag', () => {
    h.halted = SELL_GEM_HALTED;
    expect(gate()).toEqual({ ready: true, blockedReason: 'direction_halted' });
  });

  it('ignores a halt that only covers the buy direction', () => {
    // buyGem is the withdraw-side leg; it has no bearing on a USDC supply.
    h.halted = BUY_GEM_HALTED;
    expect(gate()).toEqual({ ready: true });
  });

  it('blocks on a nonzero fee, which would leave the deposit short', () => {
    h.tin = 1n;
    expect(gate()).toEqual({ ready: true, blockedReason: 'non_zero_fee' });
  });

  // The branch that actually runs in production: mainnet's HALTED is a max-uint256
  // sentinel, far outside the 0..3 flag range, so it falls through to the
  // "halted === tin" comparison instead of being read as a bitmask.
  describe("mainnet's max-uint256 HALTED sentinel", () => {
    it('is not treated as a halt while the fee is zero', () => {
      h.halted = MAINNET_HALTED_SENTINEL;
      h.tin = 0n;
      expect(gate()).toEqual({ ready: true });
    });

    it('halts the direction when the fee is raised to the sentinel', () => {
      h.halted = MAINNET_HALTED_SENTINEL;
      h.tin = MAINNET_HALTED_SENTINEL;
      // Reported as a halt, not as a fee: the halt check runs first, and calling
      // this "charges a fee" would misdescribe a frozen module.
      expect(gate()).toEqual({ ready: true, blockedReason: 'direction_halted' });
    });
  });

  it('reports the module being off ahead of any fee it also has', () => {
    h.live = 0n;
    h.tin = 1n;
    expect(gate()).toEqual({ ready: true, blockedReason: 'psm_unavailable' });
  });
});
