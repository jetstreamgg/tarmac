import { useMemo } from 'react';
import type { Call } from 'viem';
import { NO_VALUE } from '@/lib/constants';
import { useFeePerGas, useNetworkFee, usePrices } from '@/hooks';
import { computeFeeWei, feeWeiToUsd } from '@/hooks/shared/networkFee';
import { formatUsd } from '@/utils';
import { buildRouteOptionCard, type RouteOptionCard } from '../components/bridgeRouteOptions';
import type { BridgeRouteOption } from '../model/resolveRoute';
import { destinationGas, routeApprovals } from '../model/routeCosts';

type RouteSource = { calls: Call[]; isBatch: boolean };

/**
 * The "Select bridge type" cards of a pair with a route choice: each route's
 * signatures, and its fee as its source calls plus an estimate of its steps on
 * Ethereum. Undefined when the pair has a single route.
 */
export function useBridgeRouteCards({
  options,
  chainId,
  ethereumChainId,
  sources
}: {
  options: BridgeRouteOption[] | undefined;
  chainId: number | undefined;
  ethereumChainId: number | undefined;
  sources: { cctp: RouteSource; native: RouteSource };
}): RouteOptionCard[] | undefined {
  const available = (kind: 'cctp' | 'native') =>
    !!options?.some(option => option.route.kind === kind && !option.unavailable);
  const cctpFee = useNetworkFee({
    calls: sources.cctp.calls,
    chainId,
    shouldUseBatch: sources.cctp.isBatch,
    enabled: available('cctp') && sources.cctp.calls.length > 0
  });
  const nativeFee = useNetworkFee({
    calls: sources.native.calls,
    chainId,
    shouldUseBatch: sources.native.isBatch,
    enabled: available('native') && sources.native.calls.length > 0
  });
  // Ethereum's id is always known when its steps are; mainnet only stands in while disabled.
  const { data: ethFeePerGas } = useFeePerGas(
    ethereumChainId ?? 1,
    !!options && ethereumChainId !== undefined
  );
  const { data: prices } = usePrices();
  const ethPrice = prices?.ETH?.price === undefined ? undefined : Number(prices.ETH.price);
  const cctpFeeWei = cctpFee.data?.feeWei;
  const nativeFeeWei = nativeFee.data?.feeWei;

  return useMemo(() => {
    if (!options) return undefined;
    // An unavailable route goes last, below the one the user can take.
    const ordered = [...options].sort((a, b) => Number(!!a.unavailable) - Number(!!b.unavailable));
    return ordered.map(option => {
      const kind = option.route.kind === 'cctp' ? 'cctp' : 'native';
      const sourceFeeWei = kind === 'cctp' ? cctpFeeWei : nativeFeeWei;
      const usd =
        option.unavailable || sourceFeeWei === undefined || ethFeePerGas === undefined
          ? undefined
          : feeWeiToUsd(
              sourceFeeWei + computeFeeWei({ gas: destinationGas(option.route), feePerGas: ethFeePerGas }),
              ethPrice
            );
      const source = sources[kind];
      return buildRouteOptionCard({
        option,
        networkFee: usd === undefined ? NO_VALUE : `~${formatUsd(usd)}`,
        approvals: routeApprovals(option.route, { calls: source.calls.length, isBatch: source.isBatch })
      });
    });
  }, [options, cctpFeeWei, nativeFeeWei, ethFeePerGas, ethPrice, sources]);
}
