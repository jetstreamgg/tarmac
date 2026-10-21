import { type Page, type Route } from '@playwright/test';
import {
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  parseEther,
  getAddress,
  parseUnits,
  toFunctionSelector,
  type Address
} from 'viem';
import { expect, test } from '../fixtures-parallel';
import { BridgePage } from '../pages/BridgePage';
import { L1_USDS, l1DepositBridge } from '@/modules/bridge/adapters/nativeDeposit/contracts';
import { connectAndVerify } from '../utils/connectAndVerify';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
import { watchDeposit } from '../utils/bridgeFunds';
import { awaitDepositTxHash, relayOpStackDeposit } from '../utils/bridgeRelay';
import { installArbitrumShim } from '../utils/arbitrumShim';
import { getRpcUrlFromFile } from '../utils/getRpcUrlFromFile';
import { setErc20Balance } from '../utils/setBalance';
import { switchWalletNetwork, tenderlyChainLabel } from '../utils/switchWalletNetwork';
import { NetworkName } from '../utils/constants';

// APP-643 form and route resolution, on the native deposit route. Writes go to OP Mainnet:
// no other spec closes that bridge.

const TENDERLY_RPC = 'https://virtual.**.rpc.tenderly.co/**';
const IS_OPEN = toFunctionSelector('isOpen()').slice(2);
const BALANCE_OF = toFunctionSelector('balanceOf(address)').slice(2);

type Sent = { to: Address; data: string; value: bigint };

/** Every transaction the wallet sends from this page, in order, and the removal of the recorder. */
async function recordSends(page: Page) {
  const sent: Sent[] = [];
  const handler = (route: Route) => {
    const body = route.request().postData();
    if (body?.includes('"eth_sendTransaction"')) {
      const tx = JSON.parse(body).params[0];
      sent.push({ to: getAddress(tx.to), data: tx.data ?? tx.input, value: BigInt(tx.value ?? 0) });
    }
    return route.fallback();
  };
  await page.route(TENDERLY_RPC, handler);
  return { sent, stop: () => page.unroute(TENDERLY_RPC, handler) };
}

/** Answers the page's `eth_call`s whose calldata matches with an RPC error while `failing()` holds. */
async function failCalls(page: Page, matches: (data: string) => boolean, failing = () => true) {
  await page.route(TENDERLY_RPC, route => {
    const body = route.request().postData();
    if (!body?.includes('"eth_call"') || !failing()) return route.fallback();
    const request = JSON.parse(body);
    if (Array.isArray(request) || !matches(String(request.params?.[0]?.data ?? '').toLowerCase()))
      return route.fallback();
    return route.fulfill({
      json: { jsonrpc: '2.0', id: request.id, error: { code: -32000, message: 'e2e: read failed' } }
    });
  });
}

const usdsBalanceRead = (account: Address) => (data: string) =>
  data.includes(BALANCE_OF) && data.includes(account.slice(2).toLowerCase());

/** Approves `amount` of USDS to `spender` from `owner` on the Ethereum fork, outside the app. */
async function approveOnFork(owner: Address, spender: Address, amount: bigint) {
  const response = await fetch(await getRpcUrlFromFile(NetworkName.mainnet), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_sendTransaction',
      params: [
        {
          from: owner,
          to: L1_USDS,
          data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, amount] })
        }
      ]
    })
  });
  const { error } = await response.json();
  if (error) throw new Error(`approve on fork failed: ${error.message}`);
}

const approveData = (spender: Address, amount: bigint) =>
  encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, amount] });

const ceilSignificant = (wei: bigint, digits: number) => {
  const dropped = wei.toString().length - digits;
  if (dropped <= 0) return wei;
  const unit = 10n ** BigInt(dropped);
  return ((wei + unit - 1n) / unit) * unit;
};

test.describe('Bridge: form and route resolution', () => {
  test('Ethereum offers every live destination, an L2 source offers only Ethereum, and picking the destination as source swaps the pair', async ({
    isolatedPage
  }) => {
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.toNetwork().click();
    for (const network of ['base', 'optimism', 'unichain', 'arbitrum'])
      await expect(isolatedPage.getByTestId(`bridge-to-network-${network}`)).toBeVisible();
    await isolatedPage.keyboard.press('Escape');

    await switchWalletNetwork(isolatedPage, tenderlyChainLabel(NetworkName.base));
    await expect(bridge.fromNetwork()).toContainText('Base');
    await expect(bridge.toNetwork()).toContainText('Ethereum');
    await bridge.toNetwork().click();
    await expect(isolatedPage.getByRole('option')).toHaveText(['Ethereum']);
    await isolatedPage.keyboard.press('Escape');
    await bridge.fromAmount().fill('1');

    await bridge.fromNetwork().click();
    await isolatedPage.getByTestId('bridge-from-network-ethereum').click();
    await expect(bridge.fromNetwork()).toContainText('Ethereum');
    await expect(bridge.toNetwork()).toContainText('Base');
    // Picking a source doesn't move the wallet: Review waits until the wallet is on it.
    await expect(isolatedPage.getByTestId('bridge-source-unavailable')).toBeVisible();
    await expect(bridge.reviewCta()).toBeDisabled();
    await switchWalletNetwork(isolatedPage, tenderlyChainLabel(NetworkName.mainnet));
    await expect(isolatedPage.getByTestId('bridge-source-unavailable')).toHaveCount(0);
    await expect(bridge.reviewCta()).toBeEnabled({ timeout: 30_000 });
  });

  test('A zero amount and an amount above the balance block Review', async ({ isolatedPage }) => {
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.selectDestination('optimism');

    await bridge.fromAmount().fill('0');
    await expect(bridge.reviewCta()).toBeDisabled();
    await bridge.fromAmount().fill('1000000000');
    await expect(isolatedPage.getByTestId('bridge-error')).toHaveText('Insufficient funds');
    await expect(bridge.reviewCta()).toBeDisabled();
  });

  test('A loading balance blocks Review, and an unreadable one says so', async ({
    isolatedPage,
    testAccount
  }) => {
    let failing = true;
    await failCalls(isolatedPage, usdsBalanceRead(getAddress(testAccount)), () => failing);
    const bridge = new BridgePage(isolatedPage);
    await isolatedPage.goto('/convert?tab=bridge');
    await connectAndVerify(isolatedPage, { batch: true });
    await bridge.selectDestination('optimism');
    await bridge.fromAmount().fill('1');

    await expect(isolatedPage.getByTestId('bridge-balance-unknown')).toHaveText(
      "We couldn't load your USDS balance. Try again in a moment.",
      { timeout: 60_000 }
    );
    await expect(bridge.reviewCta()).toBeDisabled();
    await expect(bridge.fromBalance()).toHaveText('Balance: –');

    failing = false;
    await isolatedPage.reload();
    await connectAndVerify(isolatedPage, { batch: true });
    await bridge.expectBalanceLoaded();
  });

  test('The percent buttons fill exact amounts and never round above the balance', async ({
    isolatedPage,
    testAccount
  }) => {
    const balance = '3.333333333333333333';
    await setErc20Balance(L1_USDS, balance, 18, NetworkName.mainnet, testAccount);
    const wei = parseUnits(balance, 18);
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.selectDestination('optimism');

    for (const percent of [25n, 50n, 100n]) {
      await isolatedPage.getByTestId(`bridge-from-percent-${percent}`).click();
      await expect(bridge.fromAmount()).toHaveValue(formatUnits((wei * percent) / 100n, 18));
    }
    await expect(isolatedPage.getByTestId('bridge-error')).toHaveCount(0);
    await expect(bridge.reviewCta()).toBeEnabled({ timeout: 30_000 });
  });

  test('Disconnected, balances show a placeholder and Review opens the connect flow', async ({
    isolatedPage
  }) => {
    const bridge = new BridgePage(isolatedPage);
    await isolatedPage.goto('/convert?tab=bridge');
    await expect(bridge.panel()).toBeVisible();
    await expect(bridge.fromBalance()).toHaveText('Balance: –');
    await expect(isolatedPage.getByTestId('bridge-from-percent-100')).toHaveCount(0);

    await bridge.fromAmount().fill('1');
    await expect(bridge.reviewCta()).toBeEnabled();
    await bridge.reviewCta().click();
    await expect(isolatedPage.getByRole('dialog', { name: 'Connect a wallet' })).toBeVisible();
  });

  test('A wallet that moves to an L2 after Review sends nothing on the wrong chain', async ({
    isolatedPage
  }) => {
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.selectDestination('optimism');
    await bridge.openReview('1');
    const { sent } = await recordSends(isolatedPage);

    await switchWalletNetwork(isolatedPage, tenderlyChainLabel(NetworkName.base));
    const mainnet = tenderlyChainLabel(NetworkName.mainnet);
    const dialog = isolatedPage.getByRole('dialog');
    await expect(dialog).toContainText(`This transaction was prepared on ${mainnet}.`);
    await expect(dialog.getByRole('button', { name: `Switch to ${mainnet}` })).toBeVisible();
    await expect(bridge.confirmButton()).toHaveCount(0);
    expect(sent).toEqual([]);
  });

  test('A route gate that fails to read blocks Review with its message, and recovers once it reads', async ({
    isolatedPage
  }) => {
    let failing = true;
    await failCalls(
      isolatedPage,
      data => data.includes(IS_OPEN),
      () => failing
    );
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.selectDestination('optimism');
    await bridge.fromAmount().fill('1');

    await expect(bridge.blocked()).toHaveText("We couldn't check this route. Try again in a moment.", {
      timeout: 60_000
    });
    await expect(bridge.reviewCta()).toBeDisabled();

    // The gate polls every minute.
    failing = false;
    await expect(bridge.blocked()).toHaveCount(0, { timeout: 90_000 });
    await expect(bridge.reviewCta()).toBeEnabled({ timeout: 30_000 });
  });

  test('A short allowance approves exactly the amount, then the bridge; a sufficient one skips the approve', async ({
    isolatedPage,
    testAccount
  }) => {
    const account = getAddress(testAccount);
    const amount = parseUnits('1', 18);
    const spender = l1DepositBridge('optimism');
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected({ batch: false });
    await bridge.selectDestination('optimism');
    const { sent } = await recordSends(isolatedPage);

    const short = await watchDeposit({ to: 'optimism', sender: account });
    await bridge.openReview('1');
    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });
    const first = await awaitDepositTxHash(isolatedPage, 'optimism');
    expect(sent.map(tx => tx.to)).toEqual([L1_USDS, spender]);
    expect(sent[0].data).toBe(approveData(spender, amount));
    await short.expectEscrowed(first, amount);
    expect(await relayOpStackDeposit('optimism', first)).toContain('RelayedMessage');
    await short.expectArrived(amount);

    await approveOnFork(account, spender, amount);
    sent.length = 0;
    await bridge.gotoConnected({ batch: false });
    await bridge.selectDestination('optimism');
    const enough = await watchDeposit({ to: 'optimism', sender: account });
    await bridge.openReview('1');
    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0].to).toBe(spender);
    const second = sent.length === 1 ? await awaitDepositTxHash(isolatedPage, 'optimism') : first;
    await enough.expectEscrowed(second, amount);
    expect(await relayOpStackDeposit('optimism', second)).toContain('RelayedMessage');
    await enough.expectArrived(amount);
  });

  test('A batching wallet and a sequential wallet send the same calls', async ({
    isolatedPage,
    testAccount
  }) => {
    const account = getAddress(testAccount);
    const amount = parseUnits('1', 18);
    const bridge = new BridgePage(isolatedPage);
    const runs: Sent[][] = [];

    for (const batch of [true, false]) {
      await bridge.gotoConnected({ batch });
      await bridge.selectDestination('optimism');
      const { sent, stop } = await recordSends(isolatedPage);
      const funds = await watchDeposit({ to: 'optimism', sender: account });
      await bridge.openReview('1');
      await bridge.confirmButton().click();
      await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });
      await expect.poll(() => sent.length).toBe(2);
      const txHash = await awaitDepositTxHash(isolatedPage, 'optimism');
      await funds.expectEscrowed(txHash, amount);
      expect(await relayOpStackDeposit('optimism', txHash)).toContain('RelayedMessage');
      await funds.expectArrived(amount);
      runs.push([...sent]);
      await stop();
    }
    expect(runs[0]).toEqual(runs[1]);
  });

  test('The Arbitrum ticket ETH shown at Review is what the deposit sends', async ({
    isolatedPage,
    testAccount
  }) => {
    const account = getAddress(testAccount);
    const amount = parseUnits('1', 18);
    const shim = await installArbitrumShim(isolatedPage);
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.selectDestination('arbitrum');
    const funds = await watchDeposit({ to: 'arbitrum', sender: account });
    await bridge.openReview('1');
    await expect(bridge.modalRow('Bridge fee')).toContainText(/Up to [\d.]+ ETH/, { timeout: 30_000 });
    const shown = await bridge.modalRow('Bridge fee').innerText();

    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });
    const txHash = await awaitDepositTxHash(isolatedPage, 'arbitrum');
    await funds.expectEscrowed(txHash, amount);
    const relay = await shim.relay(txHash);
    // Review rounds the most ETH up to two significant digits (bridgeModalRows' formatMaxEthFee).
    const shownWei = parseEther(shown.match(/Up to ([\d.]+) ETH/)![1]);
    expect(shownWei).toBe(ceilSignificant(relay.deposit.value, 2));
    expect(relay.minted).toBe(true);
    await funds.expectArrived(amount);
  });

  test('Without ETH for gas, Review stays open and the send fails in the wallet', async ({
    isolatedPage
  }) => {
    // The fork takes unsigned sends without charging gas, so the node's refusal is played here.
    await isolatedPage.route(TENDERLY_RPC, route => {
      const body = route.request().postData();
      if (!body?.includes('"eth_sendTransaction"')) return route.fallback();
      const { id } = JSON.parse(body);
      return route.fulfill({
        json: {
          jsonrpc: '2.0',
          id,
          error: { code: -32000, message: 'insufficient funds for gas * price + value' }
        }
      });
    });
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.selectDestination('optimism');
    await bridge.openReview('1');
    await bridge.confirmButton().click();
    await expect(isolatedPage.getByRole('dialog')).toContainText('Transaction failed', { timeout: 60_000 });
    await expect(bridge.cards()).toHaveCount(0);
  });
});
