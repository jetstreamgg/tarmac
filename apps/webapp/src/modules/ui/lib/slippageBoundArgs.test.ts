import { describe, expect, it } from 'vitest';
import { erc20Abi, type Abi } from 'viem';
import { curveStUsdsUsdsPoolAbi, psm3L2Abi } from '@/hooks/generated';
import { PSM_SWAP_BOUND_ARGS } from '@/modules/savings/components/SavingsModalForm';
import { CURVE_SWAP_BOUND_ARGS } from '@/modules/stusds/components/StUsdsModalForm';

// A `tightensOnly` index pointing at another uint (an amount) would let that
// argument move after the confirm, so each index is pinned to the bound by name,
// across every overload the matcher's by-name lookup covers.
describe('tightensOnly bound indexes', () => {
  it.each([
    {
      abi: psm3L2Abi as Abi,
      bounds: {
        swapExactIn: PSM_SWAP_BOUND_ARGS.swapExactIn,
        swapExactOut: PSM_SWAP_BOUND_ARGS.swapExactOut
      },
      names: { swapExactIn: 'minAmountOut', swapExactOut: 'maxAmountIn' }
    },
    { abi: erc20Abi as Abi, bounds: { approve: PSM_SWAP_BOUND_ARGS.approve }, names: { approve: 'amount' } },
    { abi: curveStUsdsUsdsPoolAbi as Abi, bounds: CURVE_SWAP_BOUND_ARGS, names: { exchange: '_min_dy' } }
  ])('$names', ({ abi, bounds, names }) => {
    for (const [functionName, { index }] of Object.entries(bounds)) {
      const overloads = abi.filter(item => item.type === 'function' && item.name === functionName);
      expect(overloads.length).toBeGreaterThan(0);
      for (const fn of overloads) {
        if (fn.type !== 'function') continue;
        expect(fn.inputs[index]?.name).toBe(names[functionName as keyof typeof names]);
        expect(fn.inputs[index]?.type).toBe('uint256');
      }
    }
  });
});
