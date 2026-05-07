import { useMemo } from 'react';
import { TOKENS, type PendleMarketConfig, type Token } from '@jetstreamgg/sky-hooks';
import { mainnet } from 'viem/chains';

export type PendleTokens = {
  underlyingToken: Token;
  ptToken: Token;
  /**
   * The selectable token list for the user-picked side of the convert flow:
   * BUY input or SELL output. Always begins with the market's underlying
   * (default selection) and appends USDS / USDC if they aren't already the
   * underlying. Reuses the global TOKENS registry — no inline definitions.
   */
  inputTokenList: Token[];
};

// Pendle markets are dynamic (per-market PT address + arbitrary underlying),
// so they don't fit the static TOKENS map. PendleMarketConfig is the registry.
export const usePendleTokens = (market: PendleMarketConfig): PendleTokens => {
  const underlyingToken = useMemo<Token>(
    () => ({
      name: market.underlyingSymbol,
      symbol: market.underlyingSymbol,
      decimals: market.underlyingDecimals,
      color: '#00C2A1',
      address: { [mainnet.id]: market.underlyingToken }
    }),
    [market.underlyingSymbol, market.underlyingDecimals, market.underlyingToken]
  );

  const ptToken = useMemo<Token>(
    () => ({
      name: `PT-${market.underlyingSymbol}`,
      symbol: `PT-${market.underlyingSymbol}`,
      decimals: market.underlyingDecimals,
      color: '#1BE3C2',
      address: { [mainnet.id]: market.ptToken }
    }),
    [market.underlyingSymbol, market.underlyingDecimals, market.ptToken]
  );

  const inputTokenList = useMemo<Token[]>(() => {
    const seen = new Set<string>([market.underlyingToken.toLowerCase()]);
    const list: Token[] = [underlyingToken];
    for (const candidate of [TOKENS.usds, TOKENS.usdc]) {
      const addr = candidate.address[mainnet.id];
      if (!addr) continue;
      const key = addr.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(candidate);
    }
    return list;
  }, [market.underlyingToken, underlyingToken]);

  return { underlyingToken, ptToken, inputTokenList };
};
