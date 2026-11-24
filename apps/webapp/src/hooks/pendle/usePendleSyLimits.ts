import { useMemo } from 'react';
import { parseAbi } from 'viem';
import { useChainId, useConnection, useReadContract, useReadContracts } from 'wagmi';
import { familyMainnetId } from '@/utils';
import { ZERO_ADDRESS } from '../constants';
import type { ReadHook } from '../hooks';
import { computePendleSyLimits, type PendleSyLimits } from './computePendleSyLimits';
import type { PendleMarketConfig } from './pendle';

const rateLimiterAbi = parseAbi([
  'function isRateLimited(address token) view returns (bool)',
  'function availableBurn(address token) view returns (uint256)',
  'function burnQuota(address token, address account) view returns (uint256)',
  'function PRICE_REGISTRY() view returns (address)'
]);

const priceRegistryAbi = parseAbi(['function tokenPrice(address token) view returns (uint256)']);

const syAbi = parseAbi([
  'function supplyCap() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function exchangeRate() view returns (uint256)'
]);

/** The limits move with every other user's trade and refill by the second. */
const POLL_MS = 30_000;

/**
 * What the market's SY currently lets through: its burn rate limit, which
 * bounds early withdrawals and matured claims, and its supply cap, which
 * bounds deposits. Read live, so the forms follow whatever Pendle configures.
 *
 * `data` is `{}` for a market whose SY has no limiter (`syRateLimiter` unset)
 * and `undefined` while the reads are loading or after they fail. A failure
 * leaves the forms unbounded, with the contract's own revert as the backstop.
 */
export function usePendleSyLimits(
  market: PendleMarketConfig,
  { enabled = true, poll = true }: { enabled?: boolean; poll?: boolean } = {}
): ReadHook & { data?: PendleSyLimits } {
  const { address } = useConnection();
  const chainId = familyMainnetId(useChainId());
  const limiter = market.syRateLimiter;
  const active = enabled && !!limiter;
  const refetchInterval = poll ? POLL_MS : (false as const);

  const limiterContract = { address: limiter ?? ZERO_ADDRESS, abi: rateLimiterAbi, chainId } as const;
  const syContract = { address: market.syToken, abi: syAbi, chainId } as const;

  const {
    data: reads,
    isLoading: readsLoading,
    error: readsError,
    refetch: refetchReads
  } = useReadContracts({
    allowFailure: false,
    contracts: [
      { ...limiterContract, functionName: 'isRateLimited', args: [market.syToken] },
      { ...limiterContract, functionName: 'availableBurn', args: [market.syToken] },
      // The meter every limited SY shares is kept under the zero address.
      { ...limiterContract, functionName: 'availableBurn', args: [ZERO_ADDRESS] },
      { ...limiterContract, functionName: 'burnQuota', args: [market.syToken, address ?? ZERO_ADDRESS] },
      { ...limiterContract, functionName: 'PRICE_REGISTRY' },
      { ...syContract, functionName: 'supplyCap' },
      { ...syContract, functionName: 'totalSupply' },
      { ...syContract, functionName: 'exchangeRate' }
    ],
    query: { enabled: active, refetchInterval }
  });

  const isRateLimited = reads?.[0];
  const priceRegistry = reads?.[4];
  // The SY's price only matters to the shared meter, which a burn reaches only while limited.
  const needsPrice = active && isRateLimited === true;
  const {
    data: syPrice,
    isLoading: priceLoading,
    error: priceError,
    refetch: refetchPrice
  } = useReadContract({
    address: priceRegistry,
    abi: priceRegistryAbi,
    chainId,
    functionName: 'tokenPrice',
    args: [market.syToken],
    query: { enabled: needsPrice, refetchInterval }
  });

  const data = useMemo<PendleSyLimits | undefined>(() => {
    if (!limiter) return {};
    if (!reads || (reads[0] && syPrice === undefined)) return undefined;
    const [
      limited,
      availableBurn,
      aggregateAvailableBurn,
      burnQuota,
      ,
      supplyCap,
      totalSupply,
      exchangeRate
    ] = reads;
    return computePendleSyLimits({
      isRateLimited: limited,
      availableBurn,
      aggregateAvailableBurn,
      syPrice: syPrice ?? 0n,
      burnQuota,
      supplyCap,
      totalSupply,
      exchangeRate
    });
  }, [limiter, reads, syPrice]);

  return {
    data,
    isLoading: active && (readsLoading || (needsPrice && priceLoading)),
    error: readsError ?? priceError ?? null,
    mutate: () => {
      refetchReads();
      refetchPrice();
    },
    dataSources: []
  };
}
