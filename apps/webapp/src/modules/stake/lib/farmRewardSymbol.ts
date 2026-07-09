import { lsSkySkyRewardAddress, lsSkySpkRewardAddress, lsSkyUsdsRewardAddress } from '@/hooks';

const FARM_SYMBOLS: [Record<number, string>, string][] = [
  [lsSkySkyRewardAddress, 'SKY'],
  [lsSkyUsdsRewardAddress, 'USDS'],
  [lsSkySpkRewardAddress, 'SPK']
];

/**
 * Reward token paid by a stake farm, resolved from the generated address
 * books — a pure lookup for display surfaces (confirm summary, stake card)
 * that must not pay an on-chain read. Unknown farms resolve to `undefined`;
 * callers decide their own fallback.
 */
export function farmRewardSymbol(contractAddress: string | undefined, chainId: number): string | undefined {
  if (!contractAddress) return undefined;
  const needle = contractAddress.toLowerCase();
  for (const [book, symbol] of FARM_SYMBOLS) {
    if (book[chainId]?.toLowerCase() === needle) return symbol;
  }
  return undefined;
}
