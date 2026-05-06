import { useChainId, useReadContract } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import type { PendleMarketConfig } from './pendle';

const SY_PREVIEW_REDEEM_ABI = [
  {
    type: 'function',
    name: 'previewRedeem',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenOut', type: 'address' },
      { name: 'amountSharesToRedeem', type: 'uint256' }
    ],
    outputs: [{ name: 'amountTokenOut', type: 'uint256' }]
  }
] as const;

const YT_PYINDEX_ABI = [
  {
    type: 'function',
    name: 'pyIndexStored',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const;

const ONE = 1_000_000_000_000_000_000n;

/**
 * Computes the actual amount of underlying the user will receive when
 * redeeming `ptBalance` PT post-maturity.
 *
 * Two on-chain reads:
 *   1. YT.pyIndexStored() — the post-maturity (frozen) index used to
 *      convert PT shares to SY shares. PT → SY is NOT 1:1: a higher
 *      pyIndex means each PT redeems for proportionally fewer SY.
 *   2. SY.previewRedeem(tokenOut, syAmount) — the SY's exchange rate to
 *      its underlying. For pure 1:1 wrappers (USDG, USDe) this is identity;
 *      for vault-share PTs it can differ.
 *
 * Final formula: `receive = SY.previewRedeem(underlying, ptBalance × 1e18 / pyIndex)`.
 *
 * Pendle's convert API is unreliable post-maturity (most market info is
 * dropped) so we read on-chain instead. This is the same path
 * Router.exitPostExpToToken takes when redeeming.
 */
export function usePendleRedeemPreview(market: PendleMarketConfig, ptBalance: bigint | undefined) {
  const chainId = useChainId();
  const balanceChainId = isTestnetId(chainId) ? chainId : mainnet.id;
  const enabled = ptBalance !== undefined && ptBalance > 0n;

  const { data: pyIndex, isLoading: pyIndexLoading } = useReadContract({
    abi: YT_PYINDEX_ABI,
    address: market.ytToken,
    functionName: 'pyIndexStored',
    chainId: balanceChainId,
    query: { enabled }
  });

  const syAmount =
    enabled && pyIndex !== undefined && (pyIndex as bigint) > 0n
      ? (ptBalance! * ONE) / (pyIndex as bigint)
      : undefined;

  const { data: previewAmount, isLoading: previewLoading } = useReadContract({
    abi: SY_PREVIEW_REDEEM_ABI,
    address: market.syToken,
    functionName: 'previewRedeem',
    args: syAmount !== undefined ? [market.underlyingToken, syAmount] : undefined,
    chainId: balanceChainId,
    query: { enabled: syAmount !== undefined }
  });

  return {
    data: previewAmount,
    isLoading: pyIndexLoading || previewLoading,
    error: undefined
  };
}
