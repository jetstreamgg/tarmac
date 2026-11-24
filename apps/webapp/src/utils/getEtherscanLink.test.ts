import { afterEach, describe, expect, it, vi } from 'vitest';
import { chainId, forkChainId } from './chainId';
import { getEtherscanLink, getExplorerLink } from './getEtherscanLink';
import { getTransactionLink } from './getTransactionLink';

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

describe('getExplorerLink', () => {
  afterEach(() => vi.stubEnv('VITE_TENDERLY_EXPLORER_BASE', ''));

  it('gives a fork L2 without its explorer no link, never Ethereum mainnet', () => {
    for (const id of Object.values(forkChainId)) {
      expect(getExplorerLink(id, TX, 'tx')).toBeUndefined();
      expect(getTransactionLink(id, undefined, TX, false)).toBeUndefined();
    }
  });

  it('links a fork L2 to its Tenderly explorer when set, and the other chains as before', () => {
    vi.stubEnv('VITE_TENDERLY_EXPLORER_BASE', explorer('BASE'));
    expect(getExplorerLink(forkChainId.base, TX, 'tx')).toBe(`https://${explorer('BASE')}/tx/${TX}`);
    for (const id of [chainId.mainnet, chainId.tenderly, chainId.base, chainId.optimism])
      expect(getExplorerLink(id, TX, 'tx')).toBe(getEtherscanLink(id, TX, 'tx'));
  });
});
