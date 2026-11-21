import { type Page, type Route } from '@playwright/test';
import { getAddress, numberToHex, parseUnits, toFunctionSelector, type Address } from 'viem';
import { expect, expectNoFixtureLeaks, installFixtureRoutes, test } from '../fixtures-parallel';
import { BridgePage } from '../pages/BridgePage';
import {
  L1_USDC,
  MESSAGE_TRANSMITTER_V2,
  TOKEN_MESSENGER_V2,
  USDS_PSM_WRAPPER,
  cctpL2Contracts
} from '@/modules/bridge/adapters/cctp/contracts';
import { IRIS_API_URL } from '@/modules/bridge/adapters/cctp/iris';
import { NetworkName } from '../utils/constants';
import { getRpcUrlFromFile } from '../utils/getRpcUrlFromFile';
import { accountPool } from '../utils/accountPoolManager';
import { connectAndVerify } from '../utils/connectAndVerify';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
import { awaitDepositTxHash, l1AccountState } from '../utils/bridgeRelay';
import { receiveCctpMessage, stubIris } from '../utils/cctpAttester';
import { setErc20Balance } from '../utils/setBalance';
import { switchWalletNetwork, tenderlyChainLabel } from '../utils/switchWalletNetwork';

// APP-614 recovery: every way a CCTP bridge to Ethereum can stall still ends with the
// funds claimable, or delivered, from this app.

const TENDERLY_RPC = 'https://virtual.**.rpc.tenderly.co/**';
const AMOUNT = '2';
const DELIVERED = parseUnits(AMOUNT, 18);
const REJECTED = { jsonrpc: '2.0', id: 1, error: { code: 4001, message: 'User rejected the request.' } };
const PSM3 = getAddress(cctpL2Contracts('base').psm3);
const DEPOSIT_FOR_BURN = toFunctionSelector(
  'depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)'
);

type Send = { to: Address; data: string };

const sendOf = (body: string | null): Send | undefined => {
  if (!body?.includes('"eth_sendTransaction"')) return undefined;
  const [tx] = JSON.parse(body).params;
  return { to: getAddress(tx.to), data: tx.data ?? '' };
};

/** Routes each wallet send through `handle`; anything else goes to the fork. Returns the removal. */
async function onSends(page: Page, handle: (send: Send, route: Route) => unknown) {
  const handler = (route: Route) => {
    const send = sendOf(route.request().postData());
    return send ? handle(send, route) : route.fallback();
  };
  await page.route(TENDERLY_RPC, handler);
  return () => page.unroute(TENDERLY_RPC, handler);
}

/** The wallet on Base with the form on Base to Ethereum, ready to review. */
async function openOnBase(page: Page, { batch = true }: { batch?: boolean } = {}) {
  const bridge = new BridgePage(page);
  await bridge.gotoConnected({ batch });
  await switchWalletNetwork(page, tenderlyChainLabel(NetworkName.base));
  await bridge.expectBalanceLoaded();
  await expect(bridge.toNetwork()).toContainText('Ethereum');
  return bridge;
}

async function confirmBurn(bridge: BridgePage, page: Page) {
  await bridge.openReview(AMOUNT);
  await expect(bridge.modalRow('Bridge type')).toContainText('CCTP');
  await bridge.confirmButton().click();
  await expectTransactionSuccess(page, { title: 'Bridge initiated!', timeout: 90_000 });
  return awaitDepositTxHash(page, 'ethereum');
}

const status = (bridge: BridgePage) => bridge.card('Ethereum').getByTestId('pending-bridge-status');

async function claim(bridge: BridgePage, page: Page) {
  await expect(status(bridge)).toHaveText('Ready to claim', { timeout: 90_000 });
  await bridge.card('Ethereum').getByTestId('pending-bridge-action').click();
  await expectTransactionSuccess(page, { title: 'Funds claimed successfully!', timeout: 90_000 });
}

/**
 * Shows the page Ethereum's blocks `seconds` later than they are, as a shard
 * that warps the shared mainnet fork leaves it, without moving the fork itself.
 * Returns the removal.
 */
async function runEthereumAhead(page: Page, seconds: number) {
  const l1 = await getRpcUrlFromFile(NetworkName.mainnet);
  type RpcReply = { result?: { timestamp?: string } | null };
  const shift = (reply: RpcReply) => {
    if (reply.result?.timestamp)
      reply.result.timestamp = numberToHex(BigInt(reply.result.timestamp) + BigInt(seconds));
  };
  const matches = (target: URL) => target.href === l1;
  const handler = async (route: Route) => {
    if (!route.request().postData()?.includes('eth_getBlockBy')) return route.fallback();
    const response = await route.fetch();
    const body: RpcReply | RpcReply[] = await response.json();
    (Array.isArray(body) ? body : [body]).forEach(shift);
    return route.fulfill({ response, json: body });
  };
  await page.route(matches, handler);
  return () => page.unroute(matches, handler);
}

const expectUsdsDelivered = (account: Address, before: bigint, amount = DELIVERED) =>
  expect.poll(async () => (await l1AccountState(account)).usds - before, { timeout: 30_000 }).toBe(amount);

test.describe('Bridge: CCTP recovery', () => {
  test('A burn declined after the swap leaves a Continue card that burns only the swapped USDC', async ({
    isolatedPage,
    testAccount
  }) => {
    const iris = await stubIris(isolatedPage);
    const bridge = await openOnBase(isolatedPage, { batch: false });
    const { usds: before } = await l1AccountState(testAccount);

    const stopRejecting = await onSends(isolatedPage, (send, route) =>
      send.data.startsWith(DEPOSIT_FOR_BURN) ? route.fulfill({ json: REJECTED }) : route.fallback()
    );
    await bridge.openReview(AMOUNT);
    await bridge.confirmButton().click();
    await expect(isolatedPage.getByRole('dialog')).toContainText('declined', { timeout: 90_000 });
    await stopRejecting();
    await isolatedPage.getByTestId('transaction-modal-close').click();
    await expect(isolatedPage.getByRole('dialog')).toHaveCount(0);

    const resume = isolatedPage.getByTestId('continue-bridge-card');
    await expect(resume).toBeVisible({ timeout: 30_000 });
    await expect(bridge.cards()).toHaveCount(0);

    const sent: Send[] = [];
    await onSends(isolatedPage, (send, route) => {
      sent.push(send);
      return route.fallback();
    });
    await resume.getByTestId('continue-bridge-action').click();
    await expect(bridge.modalReview()).toBeVisible();
    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });
    expect(sent.map(send => send.to)).not.toContain(PSM3);
    expect(sent.filter(send => send.to === getAddress(TOKEN_MESSENGER_V2))).toHaveLength(1);
    await expect(resume).toHaveCount(0);

    await iris.attest(NetworkName.base, await awaitDepositTxHash(isolatedPage, 'ethereum'));
    await claim(bridge, isolatedPage);
    await expectUsdsDelivered(testAccount, before);
  });

  test('With the pending list gone, the lookup finds the burn by its hash and the claim delivers', async ({
    isolatedPage,
    testAccount
  }) => {
    const iris = await stubIris(isolatedPage);
    let bridge = await openOnBase(isolatedPage);
    const { usds: before } = await l1AccountState(testAccount);
    const txHash = await confirmBurn(bridge, isolatedPage);

    // A mock build clears localStorage on load, as a new device or cleared site data would.
    bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await expect(bridge.cards()).toHaveCount(0);

    await isolatedPage.getByTestId('bridge-claim-lookup-open').click();
    await isolatedPage.getByTestId('bridge-claim-lookup-network-base').click();
    await isolatedPage.getByTestId('bridge-claim-lookup-hash').fill(txHash);
    await isolatedPage.getByTestId('bridge-claim-lookup-find').click();
    // A found burn goes straight to the list and the modal closes.
    await expect(bridge.cards()).toHaveCount(1, { timeout: 60_000 });
    await expect(bridge.card('Ethereum')).toContainText(`${AMOUNT}.00`);
    await expect(isolatedPage.getByTestId('bridge-claim-lookup-form')).toHaveCount(0);

    await iris.attest(NetworkName.base, txHash);
    await claim(bridge, isolatedPage);
    await expectUsdsDelivered(testAccount, before);
  });

  test('A conversion declined after the claim leaves a Convert action that delivers the USDS', async ({
    isolatedPage,
    testAccount
  }) => {
    const iris = await stubIris(isolatedPage);
    const bridge = await openOnBase(isolatedPage, { batch: false });
    const { usds: before } = await l1AccountState(testAccount);
    await iris.attest(NetworkName.base, await confirmBurn(bridge, isolatedPage));
    await expect(status(bridge)).toHaveText('Ready to claim', { timeout: 90_000 });

    const sent: Address[] = [];
    const stopRejecting = await onSends(isolatedPage, (send, route) => {
      sent.push(send.to);
      return send.to === getAddress(USDS_PSM_WRAPPER) ? route.fulfill({ json: REJECTED }) : route.fallback();
    });
    await bridge.card('Ethereum').getByTestId('pending-bridge-action').click();
    await expect(isolatedPage.getByRole('dialog')).toContainText('declined', { timeout: 90_000 });
    await stopRejecting();
    expect(sent[0]).toBe(getAddress(MESSAGE_TRANSMITTER_V2));
    await isolatedPage.getByTestId('transaction-modal-close').click();

    const card = bridge.card('Ethereum');
    await expect(card.getByTestId('pending-bridge-convert-note')).toHaveText(
      "Your bridge arrived as USDC because the conversion to USDS didn't complete. Convert it now at a 1:1 rate.",
      { timeout: 60_000 }
    );
    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Arrived as USDC');
    expect((await l1AccountState(testAccount)).usds).toBe(before);

    await card.getByTestId('pending-bridge-convert').click();
    await expect(isolatedPage.getByRole('dialog')).toContainText('Review conversion');
    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Funds converted successfully!', timeout: 90_000 });
    await expectUsdsDelivered(testAccount, before);
    await expect(card.getByTestId('pending-bridge-convert')).toHaveCount(0, { timeout: 60_000 });
  });

  test('A burn someone else delivers on Ethereum arrives as USDC, and the card converts it once', async ({
    isolatedPage,
    testAccount
  }) => {
    const iris = await stubIris(isolatedPage);
    const bridge = await openOnBase(isolatedPage);
    const { usds: before } = await l1AccountState(testAccount);
    const attested = await iris.attest(NetworkName.base, await confirmBurn(bridge, isolatedPage));
    await expect(status(bridge)).toHaveText('Ready to claim', { timeout: 90_000 });

    const { nonce: nonceBefore } = await l1AccountState(testAccount);
    await receiveCctpMessage(attested);
    // APP-653: a receive anyone else sent sells nothing, so the card finds it and offers the convert.
    const card = bridge.card('Ethereum');
    await expect(card.getByTestId('pending-bridge-convert-note')).toBeVisible({ timeout: 90_000 });
    await expect(status(bridge)).toHaveText('Arrived as USDC');
    await expect(card.getByTestId('pending-bridge-action')).toHaveCount(0);
    expect(await l1AccountState(testAccount)).toEqual({ nonce: nonceBefore, usds: before });

    await card.getByTestId('pending-bridge-convert').click();
    await expect(isolatedPage.getByRole('dialog')).toContainText('Review conversion');
    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Funds converted successfully!', timeout: 90_000 });
    await expectUsdsDelivered(testAccount, before);
    await expect(card.getByTestId('pending-bridge-convert')).toHaveCount(0, { timeout: 60_000 });
  });

  test('A claim sent from another device that sold for USDS reads Claimed and offers no convert', async ({
    isolatedPage,
    testAccount,
    browser
  }) => {
    const iris = await stubIris(isolatedPage);
    const bridge = await openOnBase(isolatedPage);
    const { usds: before } = await l1AccountState(testAccount);
    const txHash = await confirmBurn(bridge, isolatedPage);
    await iris.attest(NetworkName.base, txHash);
    await expect(status(bridge)).toHaveText('Ready to claim', { timeout: 90_000 });
    // USDC the wallet holds anyway, so the card looks for the receive and must tell it sold.
    await setErc20Balance(L1_USDC, '7', 6, NetworkName.mainnet, testAccount);
    const scans: string[] = [];
    await isolatedPage.route(TENDERLY_RPC, route => {
      const body = route.request().postData() ?? '';
      if (body.includes('"eth_getLogs"') && body.toLowerCase().includes(TOKEN_MESSENGER_V2.toLowerCase()))
        scans.push(body);
      return route.fallback();
    });

    // The same wallet claims on another device, found through the lookup.
    const context = await browser.newContext();
    await context.addInitScript(account => {
      (window as unknown as { __TEST_ACCOUNT__: string }).__TEST_ACCOUNT__ = account;
    }, testAccount);
    const page = await context.newPage();
    const leaks = await installFixtureRoutes(page);
    await iris.serve(page);
    try {
      const other = new BridgePage(page);
      await other.gotoConnected();
      await page.getByTestId('bridge-claim-lookup-open').click();
      await page.getByTestId('bridge-claim-lookup-network-base').click();
      await page.getByTestId('bridge-claim-lookup-hash').fill(txHash);
      await page.getByTestId('bridge-claim-lookup-find').click();
      await expect(other.cards()).toHaveCount(1, { timeout: 60_000 });
      await claim(other, page);
      await expectUsdsDelivered(testAccount, before);
    } finally {
      await context.close();
    }
    expectNoFixtureLeaks(leaks);

    await expect(status(bridge)).toHaveText('Claimed', { timeout: 90_000 });
    await expect.poll(() => scans.length, { timeout: 60_000 }).toBeGreaterThan(0);
    // The scan's receipt and sale reads take a few seconds; an offer would show by then.
    await isolatedPage.waitForTimeout(10_000);
    const card = bridge.card('Ethereum');
    await expect(card.getByTestId('pending-bridge-convert-note')).toHaveCount(0);
    await expect(card.getByTestId('pending-bridge-convert')).toHaveCount(0);
    await expect(card.getByTestId('pending-bridge-action')).toHaveCount(0);
  });

  test('An Iris outage keeps the card Pending, and it becomes claimable once Iris answers', async ({
    isolatedPage,
    testAccount
  }) => {
    const iris = await stubIris(isolatedPage);
    let outageRequests = 0;
    const outage = (route: Route) => {
      outageRequests++;
      return route.fulfill({ status: 500, body: '' });
    };
    // Added last, so it answers before the stub.
    await isolatedPage.route(`${IRIS_API_URL}/v2/messages/**`, outage);
    const bridge = await openOnBase(isolatedPage);
    const { usds: before } = await l1AccountState(testAccount);
    const txHash = await confirmBurn(bridge, isolatedPage);
    await iris.attest(NetworkName.base, txHash);

    await expect.poll(() => outageRequests, { timeout: 90_000 }).toBeGreaterThanOrEqual(2);
    await expect(status(bridge)).toHaveText('Pending');

    await isolatedPage.unroute(`${IRIS_API_URL}/v2/messages/**`, outage);
    await claim(bridge, isolatedPage);
    await expectUsdsDelivered(testAccount, before);
  });

  // Recovery dates a bundle's L2 burn by that L2's clock, not Ethereum's: dated by Ethereum's, the card
  // would start a month back, past its ETA, and wait on the slow poll.
  test('A bundled burn sent while Ethereum runs a month ahead of Base still becomes claimable', async ({
    isolatedPage,
    testAccount
  }) => {
    const iris = await stubIris(isolatedPage);
    const stopAhead = await runEthereumAhead(isolatedPage, 31 * 86_400);
    const bridge = await openOnBase(isolatedPage);
    const { usds: before } = await l1AccountState(testAccount);
    await iris.attest(NetworkName.base, await confirmBurn(bridge, isolatedPage));
    await expect(status(bridge)).toHaveText('Ready to claim', { timeout: 90_000 });

    await stopAhead();
    await claim(bridge, isolatedPage);
    await expectUsdsDelivered(testAccount, before);
  });

  test('To another wallet: the sender sees the status and the claim link, and only the recipient claims', async ({
    isolatedPage,
    testAccount,
    browser
  }, testInfo) => {
    const recipient = getAddress(
      accountPool.getAccountAddress(await accountPool.claimAccount(`${testInfo.workerIndex}-recipient`))
    );
    const iris = await stubIris(isolatedPage);
    const bridge = await openOnBase(isolatedPage);
    await bridge.setRecipient(recipient);
    await bridge.recipientSave().click();
    await bridge.openReview(AMOUNT);
    await expect(isolatedPage.getByTestId('bridge-modal-recipient-warning')).toBeVisible();
    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });
    const txHash = await awaitDepositTxHash(isolatedPage, 'ethereum');

    const card = bridge.card('Ethereum');
    await expect(card.getByTestId('pending-bridge-recipient-note')).toBeVisible();
    await iris.attest(NetworkName.base, txHash);
    await expect(status(bridge)).toHaveText('Ready to claim', { timeout: 90_000 });
    await expect(card.getByTestId('pending-bridge-action')).toHaveCount(0);
    await expect(card.getByTestId('pending-bridge-recipient-note')).toContainText(
      'needs to claim it from that wallet to receive USDS'
    );
    const { nonce: senderNonce } = await l1AccountState(testAccount);

    // The recipient opens the claim link in their own browser.
    const context = await browser.newContext();
    await context.addInitScript(account => {
      (window as unknown as { __TEST_ACCOUNT__: string }).__TEST_ACCOUNT__ = account;
    }, recipient);
    const page = await context.newPage();
    const leaks = await installFixtureRoutes(page);
    await iris.serve(page);
    try {
      const { usds: before } = await l1AccountState(recipient);
      // The claim link as the sender's card builds it (claimLink.ts imports app constants the runner can't load).
      await page.goto(`/convert?tab=bridge&claim_network=base&claim_tx=${txHash}`);
      // The link opens the lookup on its burn; disconnected, it asks to connect first.
      await expect(page.getByTestId('bridge-claim-lookup-hash')).toHaveValue(txHash.toLowerCase());
      await expect(page.getByTestId('bridge-claim-lookup-message')).toHaveText(
        'Connect your wallet to look it up.'
      );
      // The mock wallet connects from the header, under the modal: close it, connect, look it up again.
      await page.getByTestId('bridge-claim-lookup-close').click();
      await connectAndVerify(page);
      await page.getByTestId('bridge-claim-lookup-open').click();
      await page.getByTestId('bridge-claim-lookup-network-base').click();
      await page.getByTestId('bridge-claim-lookup-hash').fill(txHash);
      await page.getByTestId('bridge-claim-lookup-find').click();
      // Added from the lookup, it's the recipient's own bridge, with its Claim.
      const recipientBridge = new BridgePage(page);
      await expect(recipientBridge.cards()).toHaveCount(1, { timeout: 60_000 });
      await claim(recipientBridge, page);
      await expectUsdsDelivered(recipient, before);
    } finally {
      await context.close();
    }
    expectNoFixtureLeaks(leaks);

    await expect(status(bridge)).toHaveText('Claimed', { timeout: 90_000 });
    expect((await l1AccountState(testAccount)).nonce).toBe(senderNonce);
  });
});
