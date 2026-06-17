import { useChainId, useConnection } from 'wagmi';
import { TOKENS, usePrices, useTokenBalances, type TokenItem } from '@/hooks';
import { getSupportedChainIds } from '@/data/wagmi/config/chainFamily';
import { IDLE_STABLECOINS, type StablecoinBalance } from '../helpers/idleView';

const STABLECOIN_SYMBOLS = IDLE_STABLECOINS.map(s => s.symbol) as readonly string[];
// Registry definitions (address-per-chain) for the idle stablecoins, resolved
// by symbol so we never couple to TOKENS' internal keys.
const STABLECOIN_TOKENS = Object.values(TOKENS).filter(token => STABLECOIN_SYMBOLS.includes(token.symbol));

export type UseStablecoinBalancesResult = {
  /** One row per stablecoin per chain it lives on, valued in USD. */
  balances: StablecoinBalance[];
  isLoading: boolean;
};

/**
 * Fetches the connected wallet's USDS/USDC/USDT/DAI balances across the whole
 * active chain family and values them in USD (BA Labs price per symbol, falling
 * back to the USDS price the same way the Earn marketplace does). Feeds
 * `buildIdleView` for the Portfolio "Idle" tab.
 */
export function useStablecoinBalances(): UseStablecoinBalancesResult {
  const connectedChainId = useChainId();
  const { address } = useConnection();
  const chainIds = getSupportedChainIds(connectedChainId);

  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  // Only request a token on chains where it has an address.
  const chainTokenMap: Record<number, TokenItem[]> = {};
  for (const id of chainIds) {
    const tokens: TokenItem[] = STABLECOIN_TOKENS.map(token => ({
      address: token.address[id],
      symbol: token.symbol
    })).filter(token => !!token.address);
    if (tokens.length > 0) chainTokenMap[id] = tokens;
  }

  const { data: rawBalances, isLoading: balancesLoading } = useTokenBalances({ address, chainTokenMap });

  const usdsPrice = pricesData?.USDS?.price;
  const priceFor = (symbol: string) => pricesData?.[symbol]?.price ?? usdsPrice;

  const balances: StablecoinBalance[] = (rawBalances ?? []).map(balance => ({
    symbol: balance.symbol,
    chainId: balance.chainId,
    amountUsd: parseFloat(balance.formatted) * parseFloat(priceFor(balance.symbol) || '0')
  }));

  return {
    balances,
    isLoading: balancesLoading || pricesLoading
  };
}
