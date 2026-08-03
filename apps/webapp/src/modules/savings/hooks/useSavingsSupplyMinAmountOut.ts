import { useMemo } from 'react';
import {
  type Token,
  TOKENS,
  useReadSsrAuthOracleGetChi,
  useReadSsrAuthOracleGetRho,
  useReadSsrAuthOracleGetSsr
} from '@/hooks';
import { math } from '@/utils';
import { EPOCH_LENGTH } from '@/widgets/shared/constants';

/**
 * The minimum sUSDS out (slippage floor) for an L2 PSM supply (`swapExactIn`).
 *
 * Mirrors the legacy `L2SavingsWidget` derivation exactly: project chi forward by
 * one epoch from the SSR auth oracle (chi / rho / ssr) and convert the supplied
 * assets to shares. USDC (6-decimal) input is widened to wad first and the result
 * rounded down to keep the min-out from over-shooting. Computing the projected chi
 * in a `useMemo` keyed on the oracle reads captures the timestamp once per oracle
 * change (rather than per render), matching the legacy effect without mirroring
 * derived state into React state.
 *
 * The panel passes the result straight into `useSavingsLaunch({ minAmountOut })`,
 * which hands it to the unmodified `useBatchPsmSwapExactIn` engine — keeping the
 * calldata-building (and the assetIn allowance, landmine #1) entirely engine-owned.
 */
export function useSavingsSupplyMinAmountOut({
  amount,
  originToken
}: {
  amount: bigint;
  originToken: Token;
}): bigint {
  const { data: chi } = useReadSsrAuthOracleGetChi();
  const { data: rho } = useReadSsrAuthOracleGetRho();
  const { data: dsr } = useReadSsrAuthOracleGetSsr();

  const isUsdc = originToken.symbol === TOKENS.usdc.symbol;

  return useMemo(() => {
    if (!rho || !dsr || !chi) return 0n;
    // Project chi forward from the oracle's last update (rho) by the elapsed
    // wall-clock time plus one epoch — matches the legacy L2 widget. `Date.now`
    // is intentionally impure here; the memo deps keep the result stable between
    // oracle updates so the engine isn't re-prepared on every render.
    // eslint-disable-next-line react-hooks/purity
    const timestamp = Math.floor(Date.now() / 1000);
    const elapsedTimeWithEpoch = BigInt(timestamp) + BigInt(EPOCH_LENGTH) - rho;
    const updatedChi = math.updatedChi(dsr, Number(elapsedTimeWithEpoch), chi);
    const wadAmount = isUsdc ? math.convertUSDCtoWad(amount) : amount;
    const shares = math.calculateSharesFromAssets(wadAmount, updatedChi);
    return isUsdc ? math.roundDownLastTwelveDigits(shares) : shares;
  }, [rho, dsr, chi, amount, isUsdc]);
}
