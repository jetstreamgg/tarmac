import { describe, expect, it } from 'vitest';
import { arbitrum, base, mainnet, optimism, unichain } from 'viem/chains';
import { Intent } from './enums';
import { getMainnetTargetName, getNetworkOverrideForIntent, getRouteChainAction } from './widget-network-map';
import { chainId } from '@/utils/chainId';

// Chain lists mirroring the app's wagmi configs: production carries no
// testnet chain; dev adds the Tenderly fork; mock/e2e names every chain
// after its fork.
const PROD_CHAINS = [
  { id: mainnet.id, name: 'Ethereum' },
  { id: base.id, name: 'Base' },
  { id: arbitrum.id, name: 'Arbitrum One' }
];
const DEV_CHAINS = [{ id: chainId.tenderly, name: 'Tenderly' }, ...PROD_CHAINS];
const MOCK_CHAINS = [
  { id: chainId.tenderly, name: 'Tenderly Mainnet' },
  { id: base.id, name: 'Tenderly Base' }
];

const MAINNET_ONLY_INTENTS = [
  Intent.REWARDS_INTENT,
  Intent.UPGRADE_INTENT,
  Intent.STAKE_INTENT,
  Intent.EXPERT_INTENT,
  Intent.VAULTS_INTENT,
  Intent.FIXED_INTENT
];

const MULTICHAIN_INTENTS = [
  Intent.BALANCES_INTENT,
  Intent.SAVINGS_INTENT,
  Intent.TRADE_INTENT,
  Intent.CONVERT_INTENT
];

const L2_CHAIN_IDS = [base.id, arbitrum.id, optimism.id, unichain.id];

describe('getNetworkOverrideForIntent', () => {
  it('forces ethereum for mainnet-only intents on an L2', () => {
    for (const intent of MAINNET_ONLY_INTENTS) {
      expect(getNetworkOverrideForIntent(intent, base.id)).toBe('ethereum');
    }
  });

  it('never overrides on mainnet, testnets, or for multichain intents', () => {
    expect(getNetworkOverrideForIntent(Intent.STAKE_INTENT, mainnet.id)).toBeUndefined();
    expect(getNetworkOverrideForIntent(Intent.STAKE_INTENT, chainId.tenderly)).toBeUndefined();
    for (const intent of MULTICHAIN_INTENTS) {
      expect(getNetworkOverrideForIntent(intent, base.id)).toBeUndefined();
    }
  });

  it('targets the config-derived mainnet-family chain: ethereum in prod, the fork elsewhere', () => {
    expect(getNetworkOverrideForIntent(Intent.STAKE_INTENT, base.id, PROD_CHAINS)).toBe('ethereum');
    expect(getNetworkOverrideForIntent(Intent.STAKE_INTENT, base.id, DEV_CHAINS)).toBe('tenderly');
    expect(getNetworkOverrideForIntent(Intent.STAKE_INTENT, base.id, MOCK_CHAINS)).toBe('tenderlymainnet');
  });
});

describe('getMainnetTargetName', () => {
  it('keeps a mainnet-family current chain as its own target', () => {
    expect(getMainnetTargetName(mainnet.id, DEV_CHAINS)).toBe('Ethereum');
    expect(getMainnetTargetName(chainId.tenderly, DEV_CHAINS)).toBe('Tenderly');
    expect(getMainnetTargetName(chainId.tenderly, MOCK_CHAINS)).toBe('Tenderly Mainnet');
  });

  it('prefers the config fork from an L2, ethereum when the config has none', () => {
    expect(getMainnetTargetName(base.id, DEV_CHAINS)).toBe('Tenderly');
    expect(getMainnetTargetName(base.id, PROD_CHAINS)).toBe('Ethereum');
    expect(getMainnetTargetName(base.id)).toBe('Ethereum');
  });
});

describe('getRouteChainAction', () => {
  it('renders every module on mainnet and tenderly', () => {
    for (const targetChainId of [mainnet.id, chainId.tenderly]) {
      for (const intent of [...MAINNET_ONLY_INTENTS, ...MULTICHAIN_INTENTS]) {
        expect(getRouteChainAction(intent, targetChainId)).toEqual({ kind: 'render' });
      }
    }
  });

  it('renders multichain modules on every L2', () => {
    for (const targetChainId of L2_CHAIN_IDS) {
      for (const intent of MULTICHAIN_INTENTS) {
        expect(getRouteChainAction(intent, targetChainId)).toEqual({ kind: 'render' });
      }
    }
  });

  it('auto-switches to ethereum for mainnet-only modules reached on an L2', () => {
    for (const targetChainId of L2_CHAIN_IDS) {
      for (const intent of MAINNET_ONLY_INTENTS) {
        expect(getRouteChainAction(intent, targetChainId)).toEqual({
          kind: 'switch-network',
          network: 'ethereum'
        });
      }
    }
  });

  it('auto-switches to the config fork instead when one exists (dev/mock builds)', () => {
    expect(getRouteChainAction(Intent.STAKE_INTENT, base.id, { chains: DEV_CHAINS })).toEqual({
      kind: 'switch-network',
      network: 'tenderly'
    });
    expect(getRouteChainAction(Intent.FIXED_INTENT, base.id, { chains: MOCK_CHAINS })).toEqual({
      kind: 'switch-network',
      network: 'tenderlymainnet'
    });
  });

  it('redirects home once the visit already had its switch chance (declined prompt)', () => {
    expect(getRouteChainAction(Intent.STAKE_INTENT, base.id, { switchAttempted: true })).toEqual({
      kind: 'redirect-home'
    });
  });

  it('redirects home on a chain that hosts no modules at all', () => {
    expect(getRouteChainAction(Intent.STAKE_INTENT, 999999)).toEqual({ kind: 'redirect-home' });
    expect(getRouteChainAction(Intent.BALANCES_INTENT, 999999)).toEqual({ kind: 'redirect-home' });
  });
});
