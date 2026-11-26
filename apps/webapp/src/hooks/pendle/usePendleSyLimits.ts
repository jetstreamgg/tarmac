import { useMemo } from 'react';
import { maxUint256 } from 'viem';
import { useChainId, useConnection, useReadContract, useReadContracts } from 'wagmi';
import { familyMainnetId } from '@/utils';
import { ZERO_ADDRESS } from '../constants';
import type { ReadHook } from '../hooks';
import { PENDLE_PRICE_REGISTRY_ABI, PENDLE_RATE_LIMITER_ABI, PENDLE_SY_ABI } from './constants';
import { computePendleSyLimits, type PendleSyLimits } from './computePendleSyLimits';
import type { PendleMarketConfig } from './pendle';

/** The limits move with every other user's trade and refill by the second. */
const POLL_MS = 30_000;
/** While Pendle has both limits off, the poll only has to notice them coming on. */
const POLL_OFF_MS = 5 * 60_000;

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

  const limiterContract = {
    address: limiter ?? ZERO_ADDRESS,
    abi: PENDLE_RATE_LIMITER_ABI,
    chainId
  } as const;
  const syContract = { address: market.syToken, abi: PENDLE_SY_ABI, chainId } as const;

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
      { ...syContract, functionName: 'exchangeRate' },
      { ...limiterContract, functionName: 'getRateLimitData', args: [market.syToken] }
    ],
    query: {
      enabled: active,
      refetchInterval: query => {
        if (!poll) return false;
        const read = query.state.data;
        const limitsOff = !!read && !read[0] && read[5] === maxUint256;
        return limitsOff ? POLL_OFF_MS : POLL_MS;
      }
    }
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
    abi: PENDLE_PRICE_REGISTRY_ABI,
    chainId,
    functionName: 'tokenPrice',
    args: [market.syToken],
    query: { enabled: needsPrice, refetchInterval: poll ? POLL_MS : false }
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
      exchangeRate,
      meter
    ] = reads;
    return computePendleSyLimits({
      isRateLimited: limited,
      availableBurn,
      aggregateAvailableBurn,
      syPrice: syPrice ?? 0n,
      burnQuota,
      burnCapacity: meter.capacity,
      burnWindowSeconds: meter.burnDecayWindow,
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
