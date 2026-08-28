import { describe, it, expect } from 'vitest';
import { mainnet, base, arbitrum } from 'viem/chains';
import { chainId } from '@/utils/chainId';
import { Intent } from './enums';
import { MAINNET_FAMILY_CHAIN_IDS, chainSwitchTarget, chainIdsForIntent } from './chainAvailability';

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
