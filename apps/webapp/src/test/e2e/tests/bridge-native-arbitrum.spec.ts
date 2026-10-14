import { type Page } from '@playwright/test';
import {
  decodeAbiParameters,
  encodeFunctionData,
  getAddress,
  parseEther,
  parseUnits,
  type Address
} from 'viem';
import { expect, test } from '../fixtures-parallel';
import { BridgePage } from '../pages/BridgePage';
import {
  arbitrumOutboundCalldata,
  arbitrumRedeemGas
} from '@/modules/bridge/adapters/nativeDeposit/arbitrum';
import {
  ARBITRUM_DEPOSIT,
  L1_USDS,
  arbRetryableTxAbi
} from '@/modules/bridge/adapters/nativeDeposit/contracts';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
import { arbitrumSubmissionFee, l2UsdsBalance, pendingDepositTxHash } from '../utils/bridgeRelay';
import { installArbitrumShim } from '../utils/arbitrumShim';
import { switchWalletNetwork, tenderlyChainLabel } from '../utils/switchWalletNetwork';
import { NetworkName } from '../utils/constants';

// Ethereum → Arbitrum native deposits (APP-613). The L1 deposit and every L2 mint are real; the
// Arbitrum fork can't create retryable tickets, so `installArbitrumShim` plays ArbOS's ticket part.
const ceil = (value: bigint, numerator: bigint, denominator: bigint) =>
  (value * numerator + denominator - 1n) / denominator;

async function deposit(page: Page, amount: string) {
  const shim = await installArbitrumShim(page);
  const bridge = new BridgePage(page);
  await bridge.gotoConnected();
  await bridge.selectDestination('arbitrum');
  await bridge.openReview(amount);
  await bridge.confirmButton().click();
  await expectTransactionSuccess(page, { title: 'Bridge initiated!', timeout: 90_000 });
  const card = bridge.card('Arbitrum One');
  await expect(card.getByTestId('pending-bridge-status')).toHaveText('Pending', { timeout: 30_000 });
  const txHash = await pendingDepositTxHash(page, 'arbitrum');
  expect(txHash).toBeTruthy();
  return { shim, bridge, card, txHash: txHash! };
}

// A recovery leaves the wallet on Arbitrum, outside the Ethereum fork's pending scope.
const backToEthereum = (page: Page) => switchWalletNetwork(page, tenderlyChainLabel(NetworkName.mainnet));

test.describe('Bridge: Ethereum to Arbitrum native deposits', () => {
  test('The ticket is priced with Sky margins over the Arbitrum estimates, and the card follows its auto-redeem to Arrived', async ({
    isolatedPage,
    testAccount
  }) => {
    const account = getAddress(testAccount);
    const amount = parseUnits('2', 18);
    const before = await l2UsdsBalance('arbitrum', account);
    const { shim, card, txHash } = await deposit(isolatedPage, '2');
    const outbound = arbitrumOutboundCalldata({ from: account, to: account, amount });

    const estimate = shim.seen.estimates.at(-1)!;
    expect(estimate.args).toEqual([
      ARBITRUM_DEPOSIT.l1Gateway,
      parseEther('1'),
      ARBITRUM_DEPOSIT.l2Gateway,
      0n,
      account,
      account,
      outbound
    ]);

    // Pending until ArbOS reads the deposit.
    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Pending');
    const relay = await shim.relay(txHash);
    expect(relay.minted).toBe(true);
    expect(relay.ticket.data).toBe(outbound);

    const [l1Token, refundTo, to, sent, maxGas, gasPriceBid, extra] = relay.deposit.args as readonly [
      Address,
      Address,
      Address,
      bigint,
      bigint,
      bigint,
      `0x${string}`
    ];
    const [maxSubmissionCost, extraData] = decodeAbiParameters(
      [{ type: 'uint256' }, { type: 'bytes' }],
      extra
    );
    const submissionFee = await arbitrumSubmissionFee(outbound, relay.blockNumber);
    expect(getAddress(relay.deposit.to)).toBe(getAddress(ARBITRUM_DEPOSIT.l1Gateway));
    expect([l1Token, refundTo, to, sent]).toEqual([L1_USDS, account, account, amount]);
    expect(maxGas).toBe(ceil(estimate.gas, 3n, 2n));
    expect(gasPriceBid).toBe(shim.seen.gasPrices.at(-1)! * 2n);
    expect(maxSubmissionCost).toBe(ceil(submissionFee, 5n, 2n));
    expect(extraData).toBe('0x');
    expect(relay.deposit.value).toBe(maxSubmissionCost + maxGas * gasPriceBid);

    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Arrived', { timeout: 60_000 });
    expect((await l2UsdsBalance('arbitrum', account)) - before).toBe(amount);
  });

  test('A failed auto-redeem asks for a Redeem that delivers the funds', async ({
    isolatedPage,
    testAccount
  }) => {
    const account = getAddress(testAccount);
    const before = await l2UsdsBalance('arbitrum', account);
    const { shim, card, txHash } = await deposit(isolatedPage, '2');
    const relay = await shim.relay(txHash, { failAutoRedeem: true });
    expect(relay.minted).toBe(false);

    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Action needed', { timeout: 60_000 });
    await expect(card.getByTestId('pending-bridge-note')).toContainText('Redeem on Arbitrum within 6 days');
    await expect(card.getByTestId('pending-bridge-keepalive')).toHaveCount(0);
    const redeem = card.getByTestId('pending-bridge-action');
    await expect(redeem).toHaveText('Redeem');

    await redeem.click();
    await expectTransactionSuccess(isolatedPage, { title: 'Redeem sent!', timeout: 90_000 });
    expect(shim.seen.sent).toHaveLength(1);
    const [sent] = shim.seen.sent;
    expect(sent.action).toBe('redeem');
    expect(getAddress(sent.from)).toBe(account);
    expect(sent.data).toBe(
      encodeFunctionData({ abi: arbRetryableTxAbi, functionName: 'redeem', args: [relay.ticket.ticketId] })
    );
    expect(sent.gas).toBe(arbitrumRedeemGas(await shim.mintEstimate(relay.ticket.data)));

    await backToEthereum(isolatedPage);
    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Arrived', { timeout: 60_000 });
    expect((await l2UsdsBalance('arbitrum', account)) - before).toBe(parseUnits('2', 18));
  });

  test('Near its deadline the ticket offers Extend, and the keepalive moves the deadline', async ({
    isolatedPage,
    testAccount
  }) => {
    const { shim, card, txHash } = await deposit(isolatedPage, '1');
    const relay = await shim.relay(txHash, { failAutoRedeem: true });
    shim.setTicketTimeout(relay.ticket.ticketId, 86_400n);

    const note = card.getByTestId('pending-bridge-note');
    await expect(note).toContainText('left to redeem', { timeout: 60_000 });
    await card.getByTestId('pending-bridge-keepalive').click();
    await expectTransactionSuccess(isolatedPage, { title: 'Deadline extended!', timeout: 90_000 });
    expect(
      shim.seen.sent.map(({ action, from, data }) => ({ action, from: getAddress(from), data }))
    ).toEqual([
      {
        action: 'keepalive',
        from: getAddress(testAccount),
        data: encodeFunctionData({
          abi: arbRetryableTxAbi,
          functionName: 'keepalive',
          args: [relay.ticket.ticketId]
        })
      }
    ]);

    await backToEthereum(isolatedPage);
    await expect(note).toContainText('Redeem on Arbitrum within 7 days', { timeout: 60_000 });
    await expect(card.getByTestId('pending-bridge-keepalive')).toHaveCount(0);
    await expect(card.getByTestId('pending-bridge-action')).toHaveText('Redeem');
  });

  test('An expired ticket says the funds were not delivered, links where to check, and offers no action', async ({
    isolatedPage
  }) => {
    const { shim, card, txHash } = await deposit(isolatedPage, '1');
    const relay = await shim.relay(txHash, { failAutoRedeem: true });
    shim.setTicketTimeout(relay.ticket.ticketId, undefined);

    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Expired', { timeout: 60_000 });
    await expect(card.getByTestId('pending-bridge-note')).toContainText('the funds were not delivered');
    const retryables = new URL(
      (await card.getByTestId('pending-bridge-retryables-link').getAttribute('href'))!
    );
    expect(retryables.searchParams.get('chainId')).toBe('42161');
    expect(retryables.searchParams.get('tx')).toBe(txHash);
    await expect(card.getByTestId('pending-bridge-support-link')).toBeVisible();
    await expect(card.getByTestId('pending-bridge-action')).toHaveCount(0);
    await expect(card.getByTestId('pending-bridge-keepalive')).toHaveCount(0);
    await expect(card.getByRole('button', { name: /cancel/i })).toHaveCount(0);
  });
});
