import { useMemo } from 'react';
import { type Token, TOKENS, useReadSsrAuthOracleGetChi } from '@/hooks';
import { math } from '@/utils';

const RAY = 10n ** 27n;

/**
 * The L2 PSM withdraw bounds, priced at the SSR oracle's stored `chi`:
 *  - `minAmountOutForWithdrawAll`: the origin-token floor for swapping the whole
 *    sUSDS balance out (`swapExactIn`).
 *  - `maxAmountInForWithdraw`: the sUSDS ceiling for taking exactly `amount` out
 *    (`swapExactOut`), also the approval it needs.
 *
 * PSM3 prices sUSDS at the oracle's conversion rate, which is the stored `chi`
 * accrued forward from `rho`, so it never falls below `chi`. Pricing at `chi`
 * therefore keeps the floor at or under the real output and the ceiling at or
 * over the real input, and both only move when the oracle updates, not every
 * block the way a live PSM preview does. The cost is the accrual since the last
 * oracle update, a few thousandths of a percent in practice.
 */
export function useSavingsWithdrawBounds({
  amount,
  sUsdsBalance,
  originToken
}: {
  amount: bigint;
  sUsdsBalance: bigint | undefined;
  originToken: Token;
}): { minAmountOutForWithdrawAll: bigint; maxAmountInForWithdraw: bigint } {
  const { data: chi } = useReadSsrAuthOracleGetChi();
  const isUsdc = originToken.symbol === TOKENS.usdc.symbol;

  return useMemo(() => {
    if (!chi) return { minAmountOutForWithdrawAll: 0n, maxAmountInForWithdraw: 0n };
    const assetsOut = ((sUsdsBalance ?? 0n) * chi) / RAY;
    const wadIn = isUsdc ? math.convertUSDCtoWad(amount) : amount;
    return {
      minAmountOutForWithdrawAll: isUsdc ? math.convertWadtoUSDC(assetsOut) : assetsOut,
      maxAmountInForWithdraw: wadIn === 0n ? 0n : (wadIn * RAY + chi - 1n) / chi
    };
  }, [chi, sUsdsBalance, amount, isUsdc]);
}
