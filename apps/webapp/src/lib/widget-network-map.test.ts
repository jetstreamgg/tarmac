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
          chainId: mainnet.id,
          network: 'ethereum'
        });
      }
    }
  });

  it('auto-switches to the config fork instead when one exists (dev/mock builds)', () => {
    expect(getRouteChainAction(Intent.STAKE_INTENT, base.id, { chains: DEV_CHAINS })).toEqual({
      kind: 'switch-network',
      chainId: chainId.tenderly,
      network: 'tenderly'
    });
    expect(getRouteChainAction(Intent.FIXED_INTENT, base.id, { chains: MOCK_CHAINS })).toEqual({
      kind: 'switch-network',
      chainId: chainId.tenderly,
      network: 'tenderlymainnet'
    });
  });

  it('redirects home once the visit already had its switch chance (declined prompt)', () => {
    expect(getRouteChainAction(Intent.STAKE_INTENT, base.id, { switchAttempted: true })).toEqual({
      kind: 'redirect-home'
    });
  });

  // A chain the app knows nothing about is what a wallet sitting on an
  // unconfigured network looks like once the blocking modal is gone: rule (c)
  // brings it back to a chain the module runs on rather than bouncing home.
  it('switches to the home chain on a chain that hosts no modules at all', () => {
    for (const intent of [Intent.STAKE_INTENT, Intent.BALANCES_INTENT]) {
      expect(getRouteChainAction(intent, 999999)).toEqual({
        kind: 'switch-network',
        chainId: mainnet.id,
        network: 'ethereum'
      });
    }
  });

  it('redirects home from an unknown chain once the switch chance is spent', () => {
    expect(getRouteChainAction(Intent.STAKE_INTENT, 999999, { switchAttempted: true })).toEqual({
      kind: 'redirect-home'
    });
  });

  // Portfolio and the Earn marketplace ARE the redirect's destination, and they
  // render on any chain. A wallet parked on an unconfigured network used to
  // throw the user off /earn on this path, which is a bug in both directions:
  // pointless on /portfolio, an eviction on /earn.
  it('never redirects the balances surfaces home, whatever the chain', () => {
    for (const current of [999999, base.id, mainnet.id]) {
      expect(getRouteChainAction(Intent.BALANCES_INTENT, current, { switchAttempted: true })).toEqual({
        kind: 'render'
      });
    }
  });
});

// Rule (a): the app-wide network filter decides which chain a module opens on,
// but only where a chain actually decides something.
describe('getRouteChainAction — the network filter', () => {
  const withFilter = (intent: Intent, current: number, filterChainId: number | null) =>
    getRouteChainAction(intent, current, { filterChainId, chains: PROD_CHAINS });

  it('opens a module on the filtered network when the module runs there', () => {
    expect(withFilter(Intent.SAVINGS_INTENT, mainnet.id, base.id)).toEqual({
      kind: 'switch-network',
      chainId: base.id,
      network: 'base'
    });
  });

  it('ignores a filter the module cannot honour, and stays put', () => {
    // Stake is mainnet-only; a Base filter can't move it there.
    expect(withFilter(Intent.STAKE_INTENT, mainnet.id, base.id)).toEqual({ kind: 'render' });
  });

  it('still lands a module whose filtered chain is unavailable on its own home chain', () => {
    // Filter says Base, Stake can't run there, and the wallet is on Arbitrum:
    // rule (a) declines, rule (b) fails, rule (c) brings it to mainnet.
    expect(withFilter(Intent.STAKE_INTENT, arbitrum.id, base.id)).toEqual({
      kind: 'switch-network',
      chainId: mainnet.id,
      network: 'ethereum'
    });
  });

  it('never fires on the Portfolio or the Earn marketplace', () => {
    // Both resolve to BALANCES_INTENT — the surfaces the filter is FOR. A
    // display filter must never prompt the wallet.
    expect(withFilter(Intent.BALANCES_INTENT, mainnet.id, base.id)).toEqual({ kind: 'render' });
  });

  it('does not fight a manual switch made on the page', () => {
    expect(
      getRouteChainAction(Intent.SAVINGS_INTENT, mainnet.id, {
        filterChainId: base.id,
        switchAttempted: true,
        chains: PROD_CHAINS
      })
    ).toEqual({ kind: 'render' });
  });

  it('is a no-op when the filter already names the current chain', () => {
    expect(withFilter(Intent.SAVINGS_INTENT, base.id, base.id)).toEqual({ kind: 'render' });
    expect(withFilter(Intent.SAVINGS_INTENT, base.id, null)).toEqual({ kind: 'render' });
  });

  it('ignores a filtered chain the wallet config does not carry', () => {
    // A production session holding a dev-fork filter: nothing to switch to.
    expect(
      getRouteChainAction(Intent.SAVINGS_INTENT, mainnet.id, {
        filterChainId: chainId.tenderly,
        chains: PROD_CHAINS
      })
    ).toEqual({ kind: 'render' });
  });
});
