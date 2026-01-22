import { TestProject } from 'vitest/node';
import { mcdDaiAddress, mkrAddress, skyAddress, TOKENS, usdsAddress } from '../src';
import { BASE_CHAIN_ID, TENDERLY_CHAIN_ID } from '../src/constants';
import {
  setErc20Balance,
  setEthBalance,
  setStakeModuleDebtCeiling,
  setStUsdsCap,
  reduceStakeModuleDebt,
  waitForVnetsReady
} from './utils';
import { testClientMainnet, testClientBase, testClientArbitrum } from './WagmiWrapper';
import { NetworkName } from './constants';

// This function will be called once before running the tests
export async function setup({ provide }: TestProject) {
  await waitForVnetsReady();

  // Set high debt ceiling for the Stake module's SKY ilk
  // This is needed because the fork may have a low or zero debt ceiling
  await setStakeModuleDebtCeiling();

  // Set high supply cap for stUSDS
  // This is needed because the fork may have reached or be near the supply cap
  await setStUsdsCap();

  // Reduce staking engine debt to ensure stUSDS has available liquidity
  // The new fork may have high debt that blocks withdrawals
  await reduceStakeModuleDebt();

  await Promise.all([
    // Tenderly Mainnet
    setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '100'),
    setErc20Balance(mkrAddress[TENDERLY_CHAIN_ID], '100'),
    setErc20Balance(mcdDaiAddress[TENDERLY_CHAIN_ID], '10000'),
    setErc20Balance(skyAddress[TENDERLY_CHAIN_ID], '0'),
    // Tenderly Base
    setEthBalance('10', NetworkName.base),
    setErc20Balance(TOKENS.usds.address[BASE_CHAIN_ID], '200', 18, NetworkName.base),
    setErc20Balance(TOKENS.susds.address[BASE_CHAIN_ID], '100', 18, NetworkName.base)
  ]);

  const [snapshotIdMainnet, snapshotIdBase, snapshotIdArbitrum] = await Promise.all([
    testClientMainnet.snapshot(),
    testClientBase.snapshot(),
    testClientArbitrum.snapshot()
  ]);
  provide('snapshotIdMainnet', snapshotIdMainnet);
  provide('snapshotIdBase', snapshotIdBase);
  provide('snapshotIdArbitrum', snapshotIdArbitrum);
}

// Extend `ProvidedContext` type to have
// type safe access to `provide/inject` methods:
declare module 'vitest' {
  export interface ProvidedContext {
    snapshotIdMainnet: `0x${string}`;
    snapshotIdBase: `0x${string}`;
    snapshotIdArbitrum: `0x${string}`;
  }
}
