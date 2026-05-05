import { useMemo } from 'react';
import { type PendleMarketConfig, type Token } from '@jetstreamgg/sky-hooks';
import { mainnet } from 'viem/chains';

export type PendleTokens = {
  underlyingToken: Token;
  ptToken: Token;
};

// Pendle markets are dynamic (per-market PT address + arbitrary underlying),
// so they don't fit the static TOKENS map. PendleMarketConfig is the registry.
export const usePendleTokens = (market: PendleMarketConfig): PendleTokens => {
  const underlyingToken = useMemo<Token>(
    () => ({
      name: market.underlyingSymbol,
      symbol: market.underlyingSymbol,
      decimals: market.underlyingDecimals,
      color: '#6d7ce3',
      address: { [mainnet.id]: market.underlyingToken }
    }),
    [market.underlyingSymbol, market.underlyingDecimals, market.underlyingToken]
  );

  const ptToken = useMemo<Token>(
    () => ({
      name: `PT-${market.underlyingSymbol}`,
      symbol: `PT-${market.underlyingSymbol}`,
      decimals: market.underlyingDecimals,
      color: '#f97316',
      address: { [mainnet.id]: market.ptToken }
    }),
    [market.underlyingSymbol, market.underlyingDecimals, market.ptToken]
  );

  return { underlyingToken, ptToken };
};
