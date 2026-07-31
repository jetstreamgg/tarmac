/**
 * Full display names for reward tokens, shown as the subtitle of the Portfolio
 * reward tables' Token cell (Figma 1036:190238 — "SPK / Spark token").
 *
 * The names can't come from the reward reads: the Merkl API returns a symbol
 * only, and the `TOKENS` registry's `name` field mostly repeats the symbol. So —
 * like `idleView`'s IDLE_STABLECOINS map — the display names live here. Unknown
 * symbols fall back to the symbol itself.
 */
const NAME_BY_SYMBOL: Record<string, string> = {
  MORPHO: 'Morpho token',
  SPK: 'Spark token',
  GROVE: 'Grove token',
  CLE: 'Chronicle Points',
  SKY: 'Sky token',
  USDS: 'Sky USD',
  USDC: 'USD Coin',
  USDT: 'Tether',
  DAI: 'Dai Stablecoin'
};

export function rewardTokenName(symbol: string): string {
  return NAME_BY_SYMBOL[symbol.toUpperCase()] ?? symbol;
}
