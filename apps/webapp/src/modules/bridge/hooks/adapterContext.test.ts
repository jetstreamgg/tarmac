import { describe, expect, it } from 'vitest';
import type { Config } from 'wagmi';
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
});
