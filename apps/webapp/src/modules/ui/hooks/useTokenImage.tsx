import { useMemo } from 'react';

/**
 * Pendle Principal Tokens carry their maturity in the symbol
 * (`PT-sUSDS-26NOV2026`), and third-party APIs — Morpho's market data, for one —
 * hand us that dated symbol verbatim. We only ship one icon per PT market, so
 * drop the `-DDMMMYYYY` suffix and resolve every maturity to the same asset.
 */
const PT_MATURITY_SUFFIX = /^(pt-.+)-\d{1,2}[a-z]{3}\d{4}$/;

export const useTokenImage = (symbol: string) => {
  return useMemo(() => {
    if (!symbol) return undefined;
    const symbolLower = symbol.toLowerCase();
    const assetName = symbolLower.match(PT_MATURITY_SUFFIX)?.[1] ?? symbolLower;

    // All tokens use .svg format
    return `/tokens/${assetName}.svg`;
  }, [symbol]);
};
