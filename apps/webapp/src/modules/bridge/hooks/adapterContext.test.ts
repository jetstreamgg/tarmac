import { describe, expect, it } from 'vitest';
import { createConfig, http, type Config } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { chainId, forkChainId } from '@/utils/chainId';
import { wagmiAdapterContext } from './adapterContext';

const config = {} as Config;
const forkL2Ids = Object.values(forkChainId);

describe('wagmiAdapterContext', () => {
  it('marks the Tenderly family with fork L2s configured as the multichain fork', () => {
    expect(wagmiAdapterContext(config, chainId.tenderly, forkL2Ids).onTenderlyFork).toBe(true);
  });

  it.each([
    ['mainnet with fork L2s configured', chainId.mainnet, forkL2Ids],
    ['the Tenderly mainnet fork without fork L2s', chainId.tenderly, []]
  ])('does not mark %s', (_, familyChainId, ids) => {
    expect(wagmiAdapterContext(config, familyChainId, ids).onTenderlyFork).toBe(false);
  });

  // The fork attestation reader keeps its scans per client, so a new client on each poll would rescan.
  it('hands out the same client for a network on every call', () => {
    const wagmiConfig = createConfig({ chains: [mainnet], transports: { [mainnet.id]: http() } });
    const context = wagmiAdapterContext(wagmiConfig, chainId.mainnet, []);
    expect(context.getClient('ethereum')).toBeDefined();
    expect(context.getClient('ethereum')).toBe(context.getClient('ethereum'));
  });
});
