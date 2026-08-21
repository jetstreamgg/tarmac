import { useChains } from 'wagmi';

/**
 * Display name of a chain per the wagmi config, for the modal Network cells.
 * The fallback covers ids the config doesn't know: mainnet-anchored flows
 * assume 'Ethereum' (the default); surfaces that would rather not guess pass
 * NO_VALUE.
 */
export function useNetworkName(chainId: number, fallback: string = 'Ethereum'): string {
  const chains = useChains();
  return chains.find(chain => chain.id === chainId)?.name ?? fallback;
}
