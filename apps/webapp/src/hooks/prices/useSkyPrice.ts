import { useMemo } from 'react';
import { parseUnits } from 'viem';

import { usePrices } from './usePrices';
import type { ReadHook } from '../hooks';

export type SkyPriceHook = ReadHook & {
  data?: bigint;
  priceString?: string;
};

export function useSkyPrice(): SkyPriceHook {
  const { data: prices, ...rest } = usePrices();

  const priceString = prices?.SKY?.price;

  const skyPrice = useMemo(() => {
    if (!priceString) {
      return undefined;
    }

    try {
      return parseUnits(priceString, 18);
    } catch {
      return undefined;
    }
  }, [priceString]);

  return {
    ...rest,
    data: skyPrice,
    priceString
  };
}
