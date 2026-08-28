import { describe, expect, it } from 'vitest';
import { arbitrum, base, mainnet, optimism, unichain } from 'viem/chains';
import { Intent } from './enums';
import { getRouteChainAction } from './widget-network-map';
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
          chainId: mainnet.id
        });
      }
    }
  });

  it('auto-switches to the config fork instead when one exists (dev/mock builds)', () => {
    expect(getRouteChainAction(Intent.STAKE_INTENT, base.id, { chains: DEV_CHAINS })).toEqual({
      kind: 'switch-network',
      chainId: chainId.tenderly
    });
    expect(getRouteChainAction(Intent.FIXED_INTENT, base.id, { chains: MOCK_CHAINS })).toEqual({
      kind: 'switch-network',
      chainId: chainId.tenderly
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
    expect(getRouteChainAction(Intent.STAKE_INTENT, 999999)).toEqual({
      kind: 'switch-network',
      chainId: mainnet.id
    });
  });

  it('redirects home from an unknown chain once the switch chance is spent', () => {
    expect(getRouteChainAction(Intent.STAKE_INTENT, 999999, { switchAttempted: true })).toEqual({
      kind: 'redirect-home'
    });
  });

  // Portfolio and the Earn marketplace run on every chain and need none in
  // particular, so they take no part in the rules at all — they neither move
  // the wallet nor get redirected, whatever the chain and whatever else is set.
  //
  // The two halves go together. They are the redirect's own DESTINATION, so
  // switching here would turn "this product isn't on your chain" into a prompt
  // to change chain anyway, one beat after landing on the surface that had no
  // complaint. Redirecting is meanwhile pointless from /portfolio and an
  // eviction from /earn.
  it('leaves the balances surfaces alone, whatever the chain', () => {
    const chains = [999999, base.id, mainnet.id, arbitrum.id];
    for (const current of chains) {
      for (const opts of [
        {},
        { switchAttempted: true },
        { chains: DEV_CHAINS },
        { filterChainId: base.id, chains: PROD_CHAINS },
        { filterChainId: mainnet.id, chains: PROD_CHAINS }
      ]) {
        expect(getRouteChainAction(Intent.BALANCES_INTENT, current, opts)).toEqual({
          kind: 'render'
        });
      }
    }
  });

  // A module route redirects home when the user's own chain change leaves it
  // stranded. The Portfolio it lands on must not then ask for the chain back —
  // that is the same prompt the redirect just decided not to make, arriving a
  // render later under a different intent (the visit's `switchAttempted` resets
  // with the intent, so nothing else would stop it).
  it('does not switch on arrival after a module redirected home', () => {
    // Stake on an unconfigured chain, switch chance already spent → home...
    expect(getRouteChainAction(Intent.STAKE_INTENT, 999999, { switchAttempted: true })).toEqual({
      kind: 'redirect-home'
    });
    // ...and the Portfolio that receives it asks for nothing, flag reset or not.
    expect(getRouteChainAction(Intent.BALANCES_INTENT, 999999)).toEqual({ kind: 'render' });
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
      chainId: base.id
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
      chainId: mainnet.id
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
