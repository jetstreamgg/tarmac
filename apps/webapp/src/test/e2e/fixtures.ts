import { test as playwrightTest, expect } from '@playwright/test';
import { waitForVnetReady } from './utils/waitForVnetsReady';
import { evmRevert, evmSnapshot, SnapshotInfo } from './utils/snapshotTestnet';
import { mockRpcCalls } from './mock-rpc-call';
import { mockVpnCheck } from './mock-vpn-check';
import { setErc20Balance, setEthBalance } from './utils/setBalance';
import {
  mcdDaiAddress,
  mkrAddress,
  skyAddress,
  usdcAddress,
  usdcL2Address,
  usdsAddress,
  usdsL2Address
} from '@jetstreamgg/sky-hooks';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import { NetworkName } from './utils/constants';
import { getTestWalletAddress } from './utils/testWallets';
import { optimism, unichain, arbitrum, base } from 'viem/chains';

type WorkerFixture = {
  snapshotId: string | SnapshotInfo[];
};

type TestFixture = {
  autoTestFixture: void;
};

const setupMainnetBalances = async (address: string) => {
  await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '100', 18, NetworkName.mainnet, address);
  await setErc20Balance(mcdDaiAddress[TENDERLY_CHAIN_ID], '100', 18, NetworkName.mainnet, address);
  await setErc20Balance(mkrAddress[TENDERLY_CHAIN_ID], '10', 18, NetworkName.mainnet, address);
  await setErc20Balance(skyAddress[TENDERLY_CHAIN_ID], '100000000', 18, NetworkName.mainnet, address);
  await setErc20Balance(usdcAddress[TENDERLY_CHAIN_ID], '10', 6, NetworkName.mainnet, address);
};

const setupBaseBalances = async (address: string) => {
  await setEthBalance('100', NetworkName.base, address);
  await setErc20Balance(usdsL2Address[base.id], '100', 18, NetworkName.base, address);
  await setErc20Balance(usdcL2Address[base.id], '100', 6, NetworkName.base, address);
};

const setupArbitrumBalances = async (address: string) => {
  await setEthBalance('100', NetworkName.arbitrum, address);
  await setErc20Balance(usdsL2Address[arbitrum.id], '100', 18, NetworkName.arbitrum, address);
  await setErc20Balance(usdcL2Address[arbitrum.id], '100', 6, NetworkName.arbitrum, address);
};

const setupOptimismBalances = async (address: string) => {
  await setEthBalance('100', NetworkName.optimism, address);
  await setErc20Balance(usdsL2Address[optimism.id], '100', 18, NetworkName.optimism, address);
  await setErc20Balance(usdcL2Address[optimism.id], '100', 6, NetworkName.optimism, address);
};

const setupUnichainBalances = async (address: string) => {
  await setEthBalance('100', NetworkName.unichain, address);
  await setErc20Balance(usdsL2Address[unichain.id], '100', 18, NetworkName.unichain, address);
  await setErc20Balance(usdcL2Address[unichain.id], '100', 6, NetworkName.unichain, address);
};

const chainSetupFunctions: Record<string, (address: string) => Promise<void>> = {
  [NetworkName.mainnet]: setupMainnetBalances,
  [NetworkName.base]: setupBaseBalances,
  [NetworkName.arbitrum]: setupArbitrumBalances,
  [NetworkName.optimism]: setupOptimismBalances,
  [NetworkName.unichain]: setupUnichainBalances
};

const ALL_CHAINS = Object.values(NetworkName);

const test = playwrightTest.extend<TestFixture, WorkerFixture>({
  // One-time setup fixture. This will run once at the beginning of the worker and provide the EVM snapshotIds to the tests or to other fixtures
  snapshotId: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, workerInfo) => {
      const isCI = !!process.env.CI;
      const requiredChain = process.env.TEST_CHAIN;
      const [primaryChain] = requiredChain?.split(',').map(chain => chain.trim()) || [];

      if (isCI && !primaryChain) {
        throw new Error('TEST_CHAIN environment variable must be set in CI');
      }

      const address = getTestWalletAddress(workerInfo.workerIndex);

      if (primaryChain) {
        // CI environment: setup only the primary chain
        if (!chainSetupFunctions[primaryChain]) {
          throw new Error(`Unsupported chain for CI: ${primaryChain}`);
        }
        await waitForVnetReady(primaryChain as NetworkName);
        await chainSetupFunctions[primaryChain](address);
      } else {
        // Local environment: setup all chains
        await Promise.all(ALL_CHAINS.map(chain => waitForVnetReady(chain)));
        await Promise.all(ALL_CHAINS.map(chain => chainSetupFunctions[chain](address)));
      }

      const snapshotId = await evmSnapshot(primaryChain);
      await use(snapshotId);
    },
    { scope: 'worker', auto: true }
  ],
  // Auto fixture that will run for each test. By adding its code after the `use` call, we ensure that the fixture runs after the test
  autoTestFixture: [
    async ({ snapshotId }, use) => {
      await use();

      // Restore the EVM snapshot for the current test's chain
      if (typeof snapshotId === 'string') {
        const requiredChain = process.env.TEST_CHAIN;
        if (!requiredChain) {
          throw new Error('TEST_CHAIN environment variable not set');
        }

        // Split the chain string and use the first chain as primary
        const [primaryChain] = requiredChain.split(',').map(chain => chain.trim());
        if (!primaryChain) {
          throw new Error('No valid chain specified in TEST_CHAIN');
        }
        const revertSuccessful = await evmRevert(primaryChain, snapshotId);
        expect(revertSuccessful).toBe(true);
      } else {
        const results = await Promise.all(snapshotId.map(info => evmRevert(info.chain, info.snapshotId)));
        results.forEach(revertSuccessful => {
          expect(revertSuccessful).toBe(true);
        });
      }
    },
    { scope: 'test', auto: true }
  ],
  // Mock routes before starting the test, and before the `beforeAll` calls
  page: async ({ page }, use, workerInfo) => {
    // Set worker index in the environment with VITE_ prefix
    process.env.VITE_TEST_WORKER_INDEX = String(workerInfo.workerIndex);

    await page.route('https://virtual.**.rpc.tenderly.co/**', mockRpcCalls);
    await page.route('**/ip/status?ip=*', mockVpnCheck);

    await use(page);
  }
});

export { test, expect };
