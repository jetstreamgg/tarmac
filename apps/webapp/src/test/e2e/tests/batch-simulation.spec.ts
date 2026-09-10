/*
 * Batch pre-send simulation (APP-537). The mock wallet advertises EIP-5792 atomic
 * batching, so every multi-call flow in this suite already exercises the happy path:
 * the bundle is simulated with `eth_call` + a code state override before
 * `wallet_sendCalls`. These specs cover what the happy path can't — the two failure
 * classes — by intercepting exactly that request. It is the only `eth_call` the app
 * issues with a third (state override) parameter; the per-call sequential simulations
 * and the fee estimate (`eth_simulateV1`) are untouched.
 *
 * Wallet traffic is observed through the mock connector's request log
 * (`extendedMock request: <method>` on the page console), which is the only place a
 * bundled send (`wallet_sendCalls`) and a sequential one (`eth_sendTransaction`) differ
 * — the mock connector turns both into `eth_sendTransaction` on the wire.
 */

import { type Page } from '@playwright/test';
import { expect, test } from '../fixtures-parallel';
import { SavingsProductPage } from '../pages/SavingsProductPage';

const RPC_URL = 'https://virtual.**.rpc.tenderly.co/**';

const isBatchSimulation = (postData: string | null) => {
  if (!postData) return false;
  try {
    const body = JSON.parse(postData);
    return body.method === 'eth_call' && Array.isArray(body.params) && typeof body.params[2] === 'object';
  } catch {
    return false;
  }
};

/** Fails the batch simulation with the given JSON-RPC error; everything else passes through. */
const failBatchSimulation = async (page: Page, error: { code: number; message: string }) => {
  await page.route(RPC_URL, async (route, request) => {
    if (!isBatchSimulation(request.postData())) return route.fallback();
    const body = JSON.parse(request.postData()!);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ jsonrpc: '2.0', id: body.id, error })
    });
  });
};

/** Wallet methods the mock connector was asked for, in order. */
const recordWalletRequests = (page: Page) => {
  const methods: string[] = [];
  page.on('console', message => {
    const match = message.text().match(/^extendedMock request: (\S+)/);
    if (match) methods.push(match[1]);
  });
  return methods;
};

test.describe('Batch simulation before send', () => {
  test('a bundle that reverts in simulation blocks the flow and never reaches the wallet', async ({
    isolatedPage
  }) => {
    const wallet = recordWalletRequests(isolatedPage);
    // JSON-RPC code 3 is `execution reverted` — what a bundle-level revert looks like.
    await failBatchSimulation(isolatedPage, { code: 3, message: 'execution reverted' });

    const savings = new SavingsProductPage(isolatedPage);
    await savings.gotoConnected();
    await savings.openSupplyModal();
    await savings.fillAmount('2');

    const review = isolatedPage.getByRole('dialog').getByRole('button', { name: 'Review', exact: true });
    await expect(isolatedPage.getByText('Something went wrong preparing the transaction')).toBeVisible({
      timeout: 60_000
    });
    await expect(review).toBeDisabled();

    expect(wallet).not.toContain('wallet_sendCalls');
    expect(wallet).not.toContain('eth_sendTransaction');
  });

  test('an RPC that cannot simulate a bundle falls back to the sequential flow', async ({ isolatedPage }) => {
    const wallet = recordWalletRequests(isolatedPage);
    // `-32602 invalid params` is the shape of a backend that rejects the state override.
    await failBatchSimulation(isolatedPage, { code: -32602, message: 'invalid params' });

    const savings = new SavingsProductPage(isolatedPage);
    await savings.gotoConnected();
    await savings.openSupplyModal();
    await savings.fillAmount('2');
    await savings.reviewAndConfirm();

    // The calls went out one at a time, each still validated by its own eth_call —
    // never as an unsimulated bundle.
    expect(wallet).not.toContain('wallet_sendCalls');
    expect(wallet).toContain('eth_sendTransaction');
  });
});
