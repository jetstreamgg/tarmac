import {
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  isAddressEqual,
  parseUnits,
  type Address
} from 'viem';
import { base } from 'viem/chains';
import { expect, test } from '../fixtures-parallel';
import { BridgePage } from '../pages/BridgePage';
import {
  ARBITRUM_DEPOSIT,
  L1_USDS,
  l1DepositBridge
} from '@/modules/bridge/adapters/nativeDeposit/contracts';
import { skyL1TokenGatewayImplementationAbi } from '@/hooks/generated';
import { SAFE_TRANSACTION_SERVICE_URL } from '@/hooks/shared/constants';
import { usdsAddress } from '@/hooks';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import { NetworkName } from '../utils/constants';
import { addSafeOwner, deploySafe, enableSafeMode } from '../utils/mockSafe';
import { setErc20Balance, setEthBalance } from '../utils/setBalance';
import { installArbitrumShim } from '../utils/arbitrumShim';
import { watchDeposit } from '../utils/bridgeFunds';
import { relayOpStackDeposit } from '../utils/bridgeRelay';

// APP-643: Ethereum to L2 native deposits from a real Safe on the forks, as a Safe App.

const AMOUNT = parseUnits('1', 18);

/** A fresh 1-of-1 Safe owned by the test account, deployed on `networks` and funded with USDS on Ethereum. */
async function freshSafe(owner: Address, networks: NetworkName[]) {
  const owners = [owner];
  const safe = await deploySafe({ owners, saltNonce: BigInt(Date.now()), networks });
  await setErc20Balance(usdsAddress[TENDERLY_CHAIN_ID], '5', 18, NetworkName.mainnet, safe);
  return { safe, owners };
}

test.describe('Bridge: native deposits from a Safe', () => {
  test('A Safe on both networks queues the approve and the deposit, and the card follows them to Arrived', async ({
    isolatedPage,
    testAccount
  }) => {
    const { safe, owners } = await freshSafe(testAccount, [NetworkName.mainnet, NetworkName.base]);
    const safeMode = await enableSafeMode(isolatedPage, {
      safe,
      owners,
      networks: [NetworkName.mainnet, NetworkName.base]
    });
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoAsSafe();
    // The dapp must not switch a Safe: the source is a static badge.
    await expect(bridge.fromNetwork()).toHaveJSProperty('tagName', 'SPAN');
    await bridge.selectDestination('base');
    await expect(bridge.recipientHint()).toHaveCount(0);
    const funds = await watchDeposit({ to: 'base', sender: safe });

    await bridge.openReview('1');
    await bridge.confirmButton().click();

    // A Safe never bundles: the approve is its own Safe tx, of exactly the amount.
    const approve = await safeMode.waitForQueued();
    expect(approve.operation).toBe(0);
    expect(isAddressEqual(approve.to, L1_USDS)).toBe(true);
    expect(approve.data).toBe(
      encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [l1DepositBridge('base'), AMOUNT] })
    );
    await safeMode.execute(approve.safeTxHash);

    const deposit = await safeMode.waitForQueued({ timeout: 60_000 });
    expect(deposit.nonce).toBe(approve.nonce + 1n);
    expect(isAddressEqual(deposit.to, l1DepositBridge('base'))).toBe(true);
    const card = bridge.card('Base');
    await expect(card).toContainText('Awaiting signatures', { timeout: 30_000 });

    const executed = await safeMode.execute(deposit.safeTxHash);
    const txHash = executed.execution!.transactionHash;
    await expect(bridge.card('Base').getByTestId('pending-bridge-status')).toHaveText('Pending', {
      timeout: 60_000
    });
    await expect(bridge.card('Base')).not.toContainText('Awaiting signatures');
    await funds.expectEscrowed(txHash, AMOUNT);

    expect(await relayOpStackDeposit('base', txHash)).toContain('RelayedMessage');
    await expect(bridge.card('Base').getByTestId('pending-bridge-status')).toHaveText('Arrived', {
      timeout: 60_000
    });
    await funds.expectArrived(AMOUNT);
    expect(safeMode.unmockedRequests).toEqual([]);
  });

  test('A Safe missing on the destination needs a recipient, and the funds reach it', async ({
    isolatedPage,
    testAccount
  }) => {
    const { safe, owners } = await freshSafe(testAccount, [NetworkName.mainnet]);
    const safeMode = await enableSafeMode(isolatedPage, { safe, owners, networks: [NetworkName.mainnet] });
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoAsSafe();
    await bridge.selectDestination('optimism');

    await bridge.fromAmount().fill('1');
    await expect(bridge.recipientHint()).toHaveText(
      'Your Safe is not deployed on the destination network. Add a recipient address.',
      { timeout: 30_000 }
    );
    await expect(bridge.reviewCta()).toBeDisabled();

    const recipient = getAddress(testAccount);
    await bridge.setRecipient(recipient);
    await bridge.recipientSave().click();
    await expect(bridge.recipientHint()).toHaveCount(0);
    const funds = await watchDeposit({ to: 'optimism', sender: safe, recipient });
    await expect(bridge.reviewCta()).toBeEnabled({ timeout: 30_000 });
    await bridge.reviewCta().click();
    await expect(bridge.modalReview()).toBeVisible();
    await bridge.confirmButton().click();

    await safeMode.execute((await safeMode.waitForQueued()).safeTxHash);
    const deposit = await safeMode.waitForQueued({ timeout: 60_000 });
    const txHash = (await safeMode.execute(deposit.safeTxHash)).execution!.transactionHash;
    await funds.expectEscrowed(txHash, AMOUNT);
    expect(await relayOpStackDeposit('optimism', txHash)).toContain('RelayedMessage');
    await expect(bridge.card('OP Mainnet').getByTestId('pending-bridge-status')).toHaveText('Arrived', {
      timeout: 60_000
    });
    await funds.expectArrived(AMOUNT);
    expect(safeMode.unmockedRequests).toEqual([]);
  });
  test('A Safe with other owners on the destination needs a recipient', async ({
    isolatedPage,
    testAccount
  }) => {
    const networks = [NetworkName.mainnet, NetworkName.base];
    const { safe, owners } = await freshSafe(testAccount, networks);
    // Any address works as the extra owner: it only has to differ from Ethereum's set.
    await addSafeOwner({ safe, owner: testAccount, newOwner: L1_USDS, network: NetworkName.base });
    const safeMode = await enableSafeMode(isolatedPage, { safe, owners, networks });
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoAsSafe();
    await bridge.selectDestination('base');

    await bridge.fromAmount().fill('1');
    await expect(bridge.recipientHint()).toHaveText(
      'Your Safe has different owners on the destination network. Add a recipient address.',
      { timeout: 30_000 }
    );
    await expect(bridge.reviewCta()).toBeDisabled();
    expect(safeMode.queued()).toEqual([]);
    expect(safeMode.unmockedRequests).toEqual([]);
  });

  test('A destination Safe that cannot be checked blocks Review until a recipient is set', async ({
    isolatedPage,
    testAccount
  }) => {
    const networks = [NetworkName.mainnet, NetworkName.base];
    const { safe, owners } = await freshSafe(testAccount, networks);
    const safeMode = await enableSafeMode(isolatedPage, { safe, owners, networks });
    // Registered after the mock, so it wins: Base's tx service is down.
    await isolatedPage.route(
      url => url.origin === SAFE_TRANSACTION_SERVICE_URL[base.id],
      route => route.fulfill({ status: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' })
    );
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoAsSafe();
    await bridge.selectDestination('base');

    await bridge.fromAmount().fill('1');
    await expect(bridge.recipientHint()).toHaveText("We couldn't check your Safe. Add a recipient address.", {
      timeout: 30_000
    });
    await expect(bridge.reviewCta()).toBeDisabled();

    await bridge.setRecipient(getAddress(testAccount));
    await bridge.recipientSave().click();
    await expect(bridge.reviewCta()).toBeEnabled({ timeout: 30_000 });
    expect(safeMode.queued()).toEqual([]);
    expect(safeMode.unmockedRequests).toEqual([]);
  });

  test('An Arbitrum deposit from a Safe warns about the aliased refund and delivers to the Safe', async ({
    isolatedPage,
    testAccount
  }) => {
    const networks = [NetworkName.mainnet, NetworkName.arbitrum];
    const { safe, owners } = await freshSafe(testAccount, networks);
    // The Safe pays the retryable ticket's ETH itself.
    await setEthBalance('1', NetworkName.mainnet, safe);
    const shim = await installArbitrumShim(isolatedPage);
    const safeMode = await enableSafeMode(isolatedPage, { safe, owners, networks });
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoAsSafe();
    await bridge.selectDestination('arbitrum');
    const funds = await watchDeposit({ to: 'arbitrum', sender: safe });

    await bridge.openReview('1');
    await expect(isolatedPage.getByTestId('bridge-modal-aliased-refund')).toHaveText(
      "Unused ETH from the bridge fee is refunded to your Safe's aliased address on Arbitrum, not to your Safe."
    );
    await bridge.confirmButton().click();

    await safeMode.execute((await safeMode.waitForQueued()).safeTxHash);
    const deposit = await safeMode.waitForQueued({ timeout: 60_000 });
    expect(isAddressEqual(deposit.to, ARBITRUM_DEPOSIT.l1Gateway)).toBe(true);
    const { functionName, args } = decodeFunctionData({
      abi: skyL1TokenGatewayImplementationAbi,
      data: deposit.data
    });
    expect(functionName).toBe('outboundTransferCustomRefund');
    // The gateway aliases a contract's refund address on L2; the app must not alias it again.
    expect(args.slice(0, 4)).toEqual([L1_USDS, safe, safe, AMOUNT]);
    expect(deposit.value).toBeGreaterThan(0n);

    const txHash = (await safeMode.execute(deposit.safeTxHash)).execution!.transactionHash;
    await funds.expectEscrowed(txHash, AMOUNT);
    expect((await shim.relay(txHash)).minted).toBe(true);
    await expect(bridge.card('Arbitrum One').getByTestId('pending-bridge-status')).toHaveText('Arrived', {
      timeout: 60_000
    });
    await funds.expectArrived(AMOUNT);
    expect(safeMode.unmockedRequests).toEqual([]);
  });
});
