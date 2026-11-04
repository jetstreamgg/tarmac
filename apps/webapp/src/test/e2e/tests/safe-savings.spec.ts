import { isAddressEqual } from 'viem';
import { expect, test } from '../fixtures-parallel';
import { SavingsProductPage } from '../pages/SavingsProductPage';
import { setErc20Balance } from '../utils/setBalance';
import { usdsAddress } from '@/hooks';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import { NetworkName } from '../utils/constants';
import { deploySafe, enableSafeMode, SAFE_1_4_1 } from '../utils/mockSafe';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
import { expectAppChain, tenderlyChainLabel } from '../utils/switchWalletNetwork';

// APP-642: the app inside the Safe{Wallet} iframe, against a real 1-of-1 Safe on the forks.

test('Supply and withdraw from Savings as a Safe App', async ({ isolatedPage, testAccount }) => {
  const owners = [testAccount];
  const networks = [NetworkName.mainnet];
  // A fresh Safe per run: no allowance yet, so the supply is always an approve + supply batch.
  const safe = await deploySafe({ owners, saltNonce: BigInt(Date.now()), networks });
  await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '1', 18, NetworkName.mainnet, safe);
  const safeMode = await enableSafeMode(isolatedPage, { safe, owners, networks });

  const savings = new SavingsProductPage(isolatedPage);
  await savings.goto();
  // Connected on load, as inside the iframe: no connect button involved.
  await expect(isolatedPage.getByTestId('wallet-chip')).toContainText('safe:0x', { timeout: 15_000 });
  await savings.expectProductShell();
  // The dapp must not switch a Safe: the network control is a static pill, not a picker.
  await expect(isolatedPage.getByTestId('product-detail-network')).toHaveJSProperty('tagName', 'SPAN');

  await savings.openSupplyModal();
  await savings.fillAmount('.02');
  // No success toast until the queued Safe tx is executed below.
  await savings.reviewAndConfirm({ waitForSuccess: false });
  const supply = await safeMode.waitForQueued();
  expect(supply.operation).toBe(1);
  expect(isAddressEqual(supply.to, SAFE_1_4_1.multiSendCallOnly)).toBe(true);
  expect(supply.calls).toHaveLength(2);
  await safeMode.execute(supply.safeTxHash);
  await expectTransactionSuccess(isolatedPage);

  await savings.openWithdrawModal();
  await savings.fillAmount('.01');
  await savings.reviewAndConfirm({ waitForSuccess: false });
  const withdraw = await safeMode.waitForQueued();
  expect(withdraw.operation).toBe(0);
  expect(withdraw.calls).toHaveLength(1);
  expect(withdraw.nonce).toBe(supply.nonce + 1n);
  await safeMode.execute(withdraw.safeTxHash);
  await expectTransactionSuccess(isolatedPage);

  expect(safeMode.unmockedRequests).toEqual([]);
});

test('A Safe App follows the network Safe{Wallet} opens it on', async ({ isolatedPage, testAccount }) => {
  const owners = [testAccount];
  const networks = [NetworkName.mainnet, NetworkName.base];
  const safe = await deploySafe({ owners, saltNonce: BigInt(Date.now()), networks });
  const safeMode = await enableSafeMode(isolatedPage, { safe, owners, networks });

  const savings = new SavingsProductPage(isolatedPage);
  await savings.goto();
  await expect(isolatedPage.getByTestId('wallet-chip')).toContainText('safe:0x', { timeout: 15_000 });
  await expectAppChain(isolatedPage, tenderlyChainLabel(NetworkName.mainnet));

  await safeMode.switchNetwork(NetworkName.base);
  await expect(isolatedPage.getByTestId('wallet-chip')).toContainText('safe:0x', { timeout: 15_000 });
  await expectAppChain(isolatedPage, tenderlyChainLabel(NetworkName.base));

  expect(safeMode.unmockedRequests).toEqual([]);
});
