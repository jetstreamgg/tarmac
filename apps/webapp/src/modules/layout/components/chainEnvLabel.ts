import { isForkChainId } from '@/utils/chainId';
import { getChainName } from '@/utils/getChainName';

export type ChainEnvTone = 'fork' | 'production' | 'unconfigured';

/**
 * What the dev-build chain pill says about the wallet's chain: a Tenderly fork, a production chain
 * (real funds), or one the config doesn't know. Developer tooling, never shipped to production, so
 * not Lingui-wrapped.
 */
export const chainEnvLabel = (
  walletChainId: number | undefined,
  isConfigured: boolean
): { tone: ChainEnvTone; label: string } | undefined => {
  if (walletChainId === undefined) return undefined;
  if (!isConfigured) return { tone: 'unconfigured', label: `Chain ${walletChainId} · not configured` };
  if (isForkChainId(walletChainId))
    return { tone: 'fork', label: `Tenderly ${getChainName(walletChainId)} · ${walletChainId}` };
  return { tone: 'production', label: `${getChainName(walletChainId)} · Production` };
};
