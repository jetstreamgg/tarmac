import { useMemo } from 'react';
import { useNow } from '../ui/useNow';
import { PENDLE_MARKETS } from './constants';
import { isMarketListed } from './helpers';
import type { PendleMarketConfig } from './pendle';

/**
 * The markets the app lists right now, re-evaluated as the clock ticks so a
 * successor appears at its `listFrom` without a reload. The array identity
 * only changes when the listed set does.
 */
export function useListedPendleMarkets(): PendleMarketConfig[] {
  const nowSec = Math.floor(useNow() / 1000);
  const listedKey = PENDLE_MARKETS.map(market => isMarketListed(market, nowSec)).join();
  return useMemo(() => {
    const listed = listedKey.split(',');
    return PENDLE_MARKETS.filter((_, index) => listed[index] === 'true');
  }, [listedKey]);
}
