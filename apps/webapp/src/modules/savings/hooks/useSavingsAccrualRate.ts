import { useChainId } from 'wagmi';
import { sUsdsAddress, useOverallSkyData, useReadSavingsUsds, useReadSsrAuthOracleGetSsr } from '@/hooks';
import { isL2ChainId } from '@/utils';

const RAY = 10n ** 27n;
const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

/**
 * The Sky Savings Rate as a plain per-second growth fraction, for projecting a
 * position forward between chain reads (`useAccruingValue`).
 *
 * SSR is stored as a per-second compounding ray — 1.0000000011… — so the
 * fraction is `(ssr - RAY) / RAY`. Subtracting in bigint first matters: the
 * difference is ~1e-9, and going through a float ray would spend most of its
 * significant digits on the leading 1.
 *
 * Mainnet reads it off sUSDS directly; the L2s read the value the SSR auth
 * oracle relays (`useSavingsSupplyMinAmountOut` uses the sibling reads for its
 * chi projection). Where neither is deployed — a fork chain the oracle doesn't
 * know about — it falls back to inverting the APY the page already displays, so
 * the counter still runs rather than freezing.
 */
export function useSavingsAccrualRate(): number | undefined {
  const chainId = useChainId();
  const isL2 = isL2ChainId(chainId);

  const { data: mainnetSsr } = useReadSavingsUsds({
    functionName: 'ssr',
    chainId: (isL2 ? 1 : chainId) as keyof typeof sUsdsAddress,
    query: { enabled: !isL2 }
  });
  const { data: l2Ssr } = useReadSsrAuthOracleGetSsr({ query: { enabled: isL2 } });
  const { data: overall } = useOverallSkyData();

  const ssr = isL2 ? l2Ssr : mainnetSsr;
  if (ssr !== undefined && ssr > RAY) {
    return Number(ssr - RAY) / 1e27;
  }

  const apy = overall?.skySavingsRatecRate ? parseFloat(overall.skySavingsRatecRate) : undefined;
  if (apy === undefined || !(apy > 0)) return undefined;
  // APY is the ray compounded over a year, so invert it the same way.
  return Math.expm1(Math.log1p(apy) / SECONDS_PER_YEAR);
}
