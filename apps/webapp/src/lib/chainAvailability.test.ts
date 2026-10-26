import { afterEach, describe, it, expect, vi } from 'vitest';
import { mainnet, base, arbitrum } from 'viem/chains';
import { chainId, forkChainId } from '@/utils/chainId';
import { Intent } from './enums';
import {
  CHAIN_WIDGET_MAP,
  MAINNET_FAMILY_CHAIN_IDS,
  chainSwitchTarget,
  chainIdsForIntent
} from './chainAvailability';

describe('MAINNET_FAMILY_CHAIN_IDS', () => {
  it('is exactly real mainnet plus the dev fork (the single-chain-product supported set)', () => {
    expect(MAINNET_FAMILY_CHAIN_IDS).toEqual([mainnet.id, chainId.tenderly]);
  });
});

describe('chainSwitchTarget (APP-528)', () => {
  const configured = [mainnet.id, base.id, arbitrum.id];

  it('offers real mainnet for a mainnet-only flow in production', () => {
    // No fork configured (prod) → the mainnet member of the supported set.
    expect(chainSwitchTarget(MAINNET_FAMILY_CHAIN_IDS, configured)).toBe(mainnet.id);
  });

  it('prefers the dev fork when it is both supported and configured', () => {
    // Dev: the wallet config includes the Tenderly fork; never switch a dev
    // wallet onto real Ethereum (real fees).
    const devConfigured = [chainId.tenderly, base.id];
    expect(chainSwitchTarget(MAINNET_FAMILY_CHAIN_IDS, devConfigured)).toBe(chainId.tenderly);
  });

  it('falls back to any supported chain the wallet config knows', () => {
    // A multi-chain flow supported on Base + Arbitrum, wallet config has Arbitrum.
    expect(chainSwitchTarget([base.id, arbitrum.id], [arbitrum.id])).toBe(arbitrum.id);
  });

  it('returns undefined when none of the supported chains are configured', () => {
    expect(chainSwitchTarget([base.id], [mainnet.id, arbitrum.id])).toBeUndefined();
  });

  it('returns undefined for an empty supported set', () => {
    expect(chainSwitchTarget([], configured)).toBeUndefined();
  });
});

describe('chainIdsForIntent (APP-528)', () => {
  it('returns the mainnet family plus every L2 for a multi-chain product (savings)', () => {
    const ids = chainIdsForIntent(Intent.SAVINGS_INTENT);
    expect(ids).toContain(mainnet.id);
    expect(ids).toContain(chainId.tenderly);
    expect(ids).toContain(base.id);
    expect(ids).toContain(arbitrum.id);
  });

  it('returns only the mainnet family for a mainnet-only product (vaults)', () => {
    const ids = chainIdsForIntent(Intent.VAULTS_INTENT);
    expect(ids.sort()).toEqual([mainnet.id, chainId.tenderly].sort());
    // An L2 the product does not run on is excluded — the guard fires there.
    expect(ids).not.toContain(base.id);
  });
});

describe('Tenderly fork L2s', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_TENDERLY_RPC_NAME', '');
  });

  it('are not listed without their RPCs, as in production', () => {
    for (const fork of Object.values(forkChainId)) expect(CHAIN_WIDGET_MAP[fork]).toBeUndefined();
    expect(chainIdsForIntent(Intent.SAVINGS_INTENT)).not.toEqual(
      expect.arrayContaining([expect.toBeOneOf(Object.values(forkChainId))])
    );
  });

  it('offer the same products as the L2 they stand in for in the dev build', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_USE_MOCK_WALLET', 'false');
    vi.stubEnv('VITE_TESTNET_CONFIG', 'true');
    vi.stubEnv('VITE_TENDERLY_RPC_NAME', 'team/project/dev-env');
    const dev = await import('./chainAvailability');
    expect(dev.CHAIN_WIDGET_MAP[forkChainId.base]).toEqual(CHAIN_WIDGET_MAP[base.id]);
    expect(dev.CHAIN_WIDGET_MAP[forkChainId.arbitrum]).toEqual(CHAIN_WIDGET_MAP[arbitrum.id]);
    expect(dev.chainIdsForIntent(Intent.SAVINGS_INTENT)).toEqual(
      expect.arrayContaining([forkChainId.base, forkChainId.arbitrum])
    );
  });
});
