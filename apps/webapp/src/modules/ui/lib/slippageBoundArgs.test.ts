import { describe, expect, it } from 'vitest';
import { erc20Abi, type Abi } from 'viem';
import { curveStUsdsUsdsPoolAbi, psm3L2Abi } from '@/hooks/generated';
import { PSM_SWAP_BOUND_ARGS } from '@/modules/savings/components/SavingsFlow';
import { CURVE_SWAP_BOUND_ARGS } from '@/modules/stusds/components/StUsdsFlow';

type Bounds = Record<string, { index: number } | readonly { index: number }[]>;
const indexesOf = (bounds: Bounds, fn: string) => {
  const listed = bounds[fn];
  return ('index' in listed ? [listed] : listed).map(b => b.index);
};

// A `tightensOnly` index pointing at another uint (an amount) would let that
// argument move after the confirm, so each index is pinned to the bound by name,
// across every overload the matcher's by-name lookup covers.
describe('tightensOnly bound indexes', () => {
  it.each([
    { abi: psm3L2Abi as Abi, bounds: PSM_SWAP_BOUND_ARGS, fn: 'swapExactIn', names: ['minAmountOut'] },
    { abi: psm3L2Abi as Abi, bounds: PSM_SWAP_BOUND_ARGS, fn: 'swapExactOut', names: ['maxAmountIn'] },
    { abi: erc20Abi as Abi, bounds: PSM_SWAP_BOUND_ARGS, fn: 'approve', names: ['amount'] },
    {
      abi: curveStUsdsUsdsPoolAbi as Abi,
      bounds: CURVE_SWAP_BOUND_ARGS,
      fn: 'exchange',
      names: ['_dx', '_min_dy']
    },
    { abi: erc20Abi as Abi, bounds: CURVE_SWAP_BOUND_ARGS, fn: 'approve', names: ['amount'] }
  ])('$fn → $names', ({ abi, bounds, fn, names }) => {
    const overloads = abi.filter(item => item.type === 'function' && item.name === fn);
    expect(overloads.length).toBeGreaterThan(0);
    for (const item of overloads) {
      if (item.type !== 'function') continue;
      const inputs = indexesOf(bounds, fn).map(i => item.inputs[i]);
      expect(inputs.map(input => input?.name)).toEqual(names);
      for (const input of inputs) expect(input?.type).toBe('uint256');
    }
  });
});
