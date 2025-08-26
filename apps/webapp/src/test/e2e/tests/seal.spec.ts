import { expect, test } from '../fixtures.ts';
import { setErc20Balance } from '../utils/setBalance.ts';
import { mkrAddress, usdsAddress } from '@jetstreamgg/sky-hooks';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain.ts';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { newSealPosition } from '../utils/newSealPosition.ts';
import { lsMkrUsdsRewardAddress, sealModuleAddress } from '@jetstreamgg/sky-hooks';
import { approveToken } from '../utils/approveToken.ts';
import { NetworkName } from '../utils/constants.ts';
import { getTestWalletAddress } from '../utils/testWallets.ts';

test.beforeAll(async () => {
  await Promise.all([
    setErc20Balance(mkrAddress[TENDERLY_CHAIN_ID], '1000'),
    setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '38100'),
    approveToken(mkrAddress[TENDERLY_CHAIN_ID], sealModuleAddress[TENDERLY_CHAIN_ID], '100')
  ]);
  // Create a new Seal position in the forked testnet before running the tests. Seal widget has the "Open new position" button disabled for the migration.
  await newSealPosition(
    '100',
    // Manually created delegate in the parent forked vnet
    '0x4e4393f93ac7ba34648a82ea2248d9bdbb1ff7e5',
    lsMkrUsdsRewardAddress[TENDERLY_CHAIN_ID]
    // '38000',
  );
});

test.beforeEach(async ({ page }) => {
  const workerIndex = Number(process.env.VITE_TEST_WORKER_INDEX ?? 1);
  const address = getTestWalletAddress(workerIndex);
  await Promise.all([
    setErc20Balance(mkrAddress[TENDERLY_CHAIN_ID], '100', 18, NetworkName.mainnet, address),
    setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '1', 18, NetworkName.mainnet, address)
  ]);
  await page.goto('/seal-engine');
  await connectMockWalletAndAcceptTerms(page);
});

test('Free all MKR', async ({ page }) => {
  // positions overview
  await expect(page.getByText('Position 1')).toBeVisible();
  // unseal all
  await page.getByRole('button', { name: 'Manage Seal Position' }).last().click();

  await expect(page.getByTestId('supply-first-input-lse-balance')).toHaveText('100 MKR');

  // fill with all MKR and proceed to skip the rewards and delegates and confirm position
  await page.getByTestId('supply-first-input-lse').fill('100');
  await page.getByTestId('widget-button').click();

  await expect(page.getByText('Choose your reward token')).toBeVisible();
  await page.getByRole('button', { name: 'skip' }).click();
  await expect(page.getByText('Choose your delegate')).toBeVisible();
  await page.getByRole('button', { name: 'skip' }).click();

  await expect(page.getByText('Confirm your position').nth(0)).toBeVisible();

  await page.getByRole('button', { name: 'Confirm' }).click();
  expect(page.getByRole('heading', { name: 'Success!' })).toBeVisible();
  await expect(page.getByText("You've unsealed 100 MKR to exit your position.")).toBeVisible();
});
