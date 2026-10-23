import { afterEach, describe, expect, it, vi } from 'vitest';
import { chainId, forkChainId } from './chainId';
import { getEtherscanLink } from './getEtherscanLink';

const TX = `0x${'ab'.repeat(32)}`;
const explorer = (chain: string) => `dashboard.tenderly.co/team/project/testnets/env/container/${chain}`;

describe('getEtherscanLink on the Tenderly multichain fork', () => {
  afterEach(() => {
    for (const chain of ['ETHEREUM', 'BASE', 'ARBITRUM', 'OPTIMISM', 'UNICHAIN'])
      vi.stubEnv(`VITE_TENDERLY_EXPLORER_${chain}`, '');
  });

  it('links each fork transaction to its own Tenderly explorer', () => {
    const forks = {
      ETHEREUM: chainId.tenderly,
      BASE: forkChainId.base,
      ARBITRUM: forkChainId.arbitrum,
      OPTIMISM: forkChainId.optimism,
      UNICHAIN: forkChainId.unichain
    };
    for (const [chain, id] of Object.entries(forks)) {
      vi.stubEnv(`VITE_TENDERLY_EXPLORER_${chain}`, explorer(chain));
      expect(getEtherscanLink(id, TX, 'tx')).toBe(`https://${explorer(chain)}/tx/${TX}`);
    }
  });

  it('keeps the production explorers for the real chains', () => {
    vi.stubEnv('VITE_TENDERLY_EXPLORER_BASE', explorer('BASE'));
    expect(getEtherscanLink(chainId.mainnet, TX, 'tx')).toBe(`https://etherscan.io/tx/${TX}`);
    expect(getEtherscanLink(chainId.base, TX, 'tx')).toBe(`https://basescan.org/tx/${TX}`);
  });

  it('keeps the Ethereum fork explorer it had without the env var', () => {
    expect(getEtherscanLink(chainId.tenderly, TX, 'tx')).toMatch(
      /^https:\/\/dashboard\.tenderly\.co\/jetstreamgg\/jetstream\/testnet\/[0-9a-f-]+\/tx\//
    );
  });
});
