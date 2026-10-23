import { describe, expect, it } from 'vitest';
import { arbitrum, base } from 'wagmi/chains';
import { forkChainId } from '@/utils/chainId';
import { defaultConfig } from './widgets-default-config';

describe('defaultConfig on the Tenderly fork L2s', () => {
  it('lists the real L2 tokens for each fork L2', () => {
    expect(defaultConfig.balancesTokenList[forkChainId.base]).toEqual(
      defaultConfig.balancesTokenList[base.id]
    );
    expect(defaultConfig.tradeTokenList[forkChainId.arbitrum]).toEqual(
      defaultConfig.tradeTokenList[arbitrum.id]
    );
  });
});
