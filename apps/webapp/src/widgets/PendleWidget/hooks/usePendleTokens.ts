import { useMemo } from 'react';
import { TENDERLY_CHAIN_ID, TOKENS, type PendleMarketConfig, type Token } from '@/hooks';
import { mainnet } from 'viem/chains';

export type PendleTokens = {
  underlyingToken: Token;
  ptToken: Token;
  /** Supply (BUY) tokens: market underlying + USDS + USDC (de-duped). */
  supplyTokenList: Token[];
  /** Withdraw (SELL) tokens: supply list with sUSDS excluded — sUSDS is not a withdrawal option even when it is the SY underlying. */
  withdrawTokenList: Token[];
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
      address: {
        [mainnet.id]: market.underlyingToken,
        [TENDERLY_CHAIN_ID]: market.underlyingToken
      }
    }),
    [market.underlyingSymbol, market.underlyingDecimals, market.underlyingToken]
  );

  const ptToken = useMemo<Token>(
    () => ({
      name: `PT-${market.underlyingSymbol}`,
      symbol: `PT-${market.underlyingSymbol}`,
      decimals: market.underlyingDecimals,
      color: '#1BE3C2',
      address: {
        [mainnet.id]: market.ptToken,
        [TENDERLY_CHAIN_ID]: market.ptToken
      }
    }),
    [market.underlyingSymbol, market.underlyingDecimals, market.ptToken]
  );

  const supplyTokenList = useMemo<Token[]>(() => {
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

  const withdrawTokenList = useMemo<Token[]>(() => {
    const sUsdsAddr = TOKENS.susds.address[mainnet.id]?.toLowerCase();
    if (!sUsdsAddr) return supplyTokenList;
    return supplyTokenList.filter(t => t.address[mainnet.id]?.toLowerCase() !== sUsdsAddr);
  }, [supplyTokenList]);

  return { underlyingToken, ptToken, supplyTokenList, withdrawTokenList };
};
