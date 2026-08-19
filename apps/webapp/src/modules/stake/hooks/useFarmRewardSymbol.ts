import { useChainId } from 'wagmi';
import { useRewardContractTokens } from '@/hooks';
import { farmRewardSymbol } from '../lib/farmRewardSymbol';

/**
 * Display symbol for a stake farm's reward token: the generated address books
 * when they know the farm, else the farm's on-chain `rewardsToken` symbol.
 * The picker offers every farm the indexer lists, which can include farms the
 * shipped address books don't know yet — those surfaces must show the real
 * token, never a hardcoded fallback. `undefined` while unresolved; callers
 * that must always render something fall back to the shortened farm address.
 */
export function useFarmRewardSymbol(contractAddress: `0x${string}` | undefined): string | undefined {
  const chainId = useChainId();
  const bookSymbol = farmRewardSymbol(contractAddress, chainId);
  // The on-chain read only runs for farms the books miss.
  const { data: farmTokens } = useRewardContractTokens(bookSymbol ? undefined : contractAddress);
  return bookSymbol ?? farmTokens?.rewardsToken?.symbol;
}
