import { useMemo } from 'react';

export const useTokenImage = (symbol: string) => {
  return useMemo(() => {
    if (!symbol) return undefined;
    const symbolLower = symbol.toLowerCase();

    // All tokens use .svg format
    return `/tokens/${symbolLower}.svg`;
  }, [symbol]);
};
