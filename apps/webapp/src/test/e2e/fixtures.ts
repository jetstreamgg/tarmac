import { test as playwrightTest, expect } from '@playwright/test';
import { waitForVnetsReady } from './utils/waitForVnetsReady';
import { evmRevert, evmSnapshot } from './utils/snapshotTestnet';
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
} from '@jetstreamgg/hooks';
import {
  TENDERLY_ARBITRUM_CHAIN_ID,
  TENDERLY_BASE_CHAIN_ID,
  TENDERLY_CHAIN_ID
} from '@/data/wagmi/config/testTenderlyChain';
import { NetworkName } from './utils/constants';
import { getTestWalletAddress } from './utils/testWallets';
import { optimism, unichain } from 'viem/chains';

type WorkerFixture = {
  snapshotIds: string[];
};

type TestFixture = {
  autoTestFixture: void;
};

const test = playwrightTest.extend<TestFixture, WorkerFixture>({
  // One-time setup fixture. This will run once at the beginning of the worker and provide the EVM snapshotIds to the tests or to other fixtures
  snapshotIds: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, workerInfo) => {
      await waitForVnetsReady();

      // Get the wallet address for this worker
      const address = getTestWalletAddress(workerInfo.workerIndex);

      // Fund the worker's address before taking the snapshot
      // Mainnet funding
      await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '100', 18, NetworkName.mainnet, address);
      await setErc20Balance(mcdDaiAddress[TENDERLY_CHAIN_ID], '100', 18, NetworkName.mainnet, address);
      await setErc20Balance(mkrAddress[TENDERLY_CHAIN_ID], '10', 18, NetworkName.mainnet, address);
      await setErc20Balance(skyAddress[TENDERLY_CHAIN_ID], '100000000', 18, NetworkName.mainnet, address);
      await setErc20Balance(usdcAddress[TENDERLY_CHAIN_ID], '10', 6, NetworkName.mainnet, address);

      // Base funding
      await setEthBalance('100', NetworkName.base, address);
      await setErc20Balance(usdsL2Address[TENDERLY_BASE_CHAIN_ID], '100', 18, NetworkName.base, address);
      await setErc20Balance(usdcL2Address[TENDERLY_BASE_CHAIN_ID], '100', 6, NetworkName.base, address);

      // Arbitrum funding
      await setEthBalance('100', NetworkName.arbitrum, address);
      await setErc20Balance(
        usdsL2Address[TENDERLY_ARBITRUM_CHAIN_ID],
        '100',
        18,
        NetworkName.arbitrum,
        address
      );
      await setErc20Balance(
        usdcL2Address[TENDERLY_ARBITRUM_CHAIN_ID],
        '100',
        6,
        NetworkName.arbitrum,
        address
      );

      // Optimism funding
      await setEthBalance('100', NetworkName.optimism, address);
      await setErc20Balance(usdsL2Address[optimism.id], '100', 18, NetworkName.optimism, address);
      await setErc20Balance(usdcL2Address[optimism.id], '100', 6, NetworkName.optimism, address);

      // Unichain funding
      await setEthBalance('100', NetworkName.unichain, address);
      await setErc20Balance(usdsL2Address[unichain.id], '100', 18, NetworkName.unichain, address);
      await setErc20Balance(usdcL2Address[unichain.id], '100', 6, NetworkName.unichain, address);

      const snapshotIds = await evmSnapshot();

      await use(snapshotIds);
    },
    { scope: 'worker', auto: true }
  ],
  // Auto fixture that will run for each test. By adding its code after the `use` call, we ensure that the fixture runs after the test
  autoTestFixture: [
    async ({ snapshotIds }, use) => {
      await use();

      // Restore the EVM snapshot after each test
      const allRevertsSuccessful = await evmRevert(snapshotIds);
      expect(allRevertsSuccessful).toBe(true);
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
