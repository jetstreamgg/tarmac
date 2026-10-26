import { describe, expect, it } from 'vitest';
import { chainId, forkChainId } from '@/utils/chainId';
import { chainEnvLabel } from './chainEnvLabel';

describe('chainEnvLabel', () => {
  it('names the Tenderly forks with their chain id', () => {
    expect(chainEnvLabel(chainId.tenderly, true)).toEqual({
      tone: 'fork',
      label: 'Tenderly Ethereum · 314310'
    });
    expect(chainEnvLabel(forkChainId.base, true)).toEqual({ tone: 'fork', label: 'Tenderly Base · 9998453' });
    expect(chainEnvLabel(forkChainId.arbitrum, true)?.label).toBe('Tenderly Arbitrum · 99942161');
  });

  it('flags the production chains', () => {
    expect(chainEnvLabel(chainId.mainnet, true)).toEqual({
      tone: 'production',
      label: 'Ethereum · Production'
    });
    expect(chainEnvLabel(chainId.arbitrum, true)).toEqual({
      tone: 'production',
      label: 'Arbitrum · Production'
    });
  });

  it('says when the wallet is on a chain the config lacks', () => {
    expect(chainEnvLabel(43114, false)).toEqual({
      tone: 'unconfigured',
      label: 'Chain 43114 · not configured'
    });
    expect(chainEnvLabel(forkChainId.base, false)?.tone).toBe('unconfigured');
  });

  it('shows nothing without a wallet chain', () => {
    expect(chainEnvLabel(undefined, false)).toBeUndefined();
  });
});
