import { describe, expect, it } from 'vitest';
import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  getAddress,
  type Address,
  type Hex,
  type Log
} from 'viem';
import {
  ARBITRUM_DEPOSIT_LOGS,
  ARBITRUM_DEPOSIT_TX,
  BASE_DEPOSIT_LOGS,
  BASE_DEPOSIT_TX,
  OPTIMISM_DEPOSIT_LOGS,
  OPTIMISM_DEPOSIT_TX,
  UNICHAIN_DEPOSIT_LOGS,
  UNICHAIN_DEPOSIT_TX
} from '../adapters/nativeDeposit/depositFixtures';
import { L1_USDS, l1DepositBridge, type NativeDepositNetwork } from '../adapters/nativeDeposit/contracts';
import { depositsInLogs } from '../adapters/nativeDeposit/discovery';
import { createPendingBridge } from '../model/pendingTransitions';
import { nativeDepositRoute } from '../model/resolveRoute';
import { bundleDepositIn, type BundleReceipt } from './bundleDeposit';

const NOW = 1_800_000_000_000;
const APPROVE_HASH = '0x00000000000000000000000000000000000000000000000000000000000000a1' as Hex;
const DEPOSIT_HASH = '0x00000000000000000000000000000000000000000000000000000000000000d1' as Hex;
const OTHER = '0x2546BcD3c84621e976D8185a91A922aE77ECEc30' as Address;

const SUSDS = 'a3931d71877c0e7a3148cb7eb4463524fec27fbd';
// The fixture's gateway deposit moved sUSDS; the same log with USDS as its token.
const ARBITRUM_USDS_LOGS = ARBITRUM_DEPOSIT_LOGS.map(log => ({
  ...log,
  data: log.data.replace(SUSDS, L1_USDS.slice(2).toLowerCase()) as Hex
}));

const NETWORKS = [
  ['base', BASE_DEPOSIT_LOGS, BASE_DEPOSIT_TX.from],
  ['optimism', OPTIMISM_DEPOSIT_LOGS, OPTIMISM_DEPOSIT_TX.from],
  ['unichain', UNICHAIN_DEPOSIT_LOGS, UNICHAIN_DEPOSIT_TX.from],
  ['arbitrum', ARBITRUM_USDS_LOGS, ARBITRUM_DEPOSIT_TX.from]
] as const satisfies readonly (readonly [NativeDepositNetwork, readonly Log[], Address])[];

const receipt = (
  logs: readonly Log[],
  overrides: Partial<Pick<BundleReceipt, 'status' | 'transactionHash' | 'blockNumber'>> = {}
): BundleReceipt =>
  ({
    status: 'success',
    transactionHash: DEPOSIT_HASH,
    blockNumber: 100n,
    logs,
    ...overrides
  }) as unknown as BundleReceipt;

// The USDS approval a bundle sends before its deposit.
const approvalLog = (owner: Address, network: NativeDepositNetwork, amount: bigint) =>
  ({
    address: L1_USDS,
    topics: encodeEventTopics({
      abi: erc20Abi,
      eventName: 'Approval',
      args: { owner, spender: l1DepositBridge(network) }
    }),
    data: encodeAbiParameters([{ type: 'uint256' }], [amount])
  }) as unknown as Log;

describe.each(NETWORKS)('bundleDepositIn, a bundle to %s', (network, logs, sender) => {
  // What the chain shows for the fixture's deposit: its amount and recipient.
  const [onChain] = depositsInLogs(
    logs.map(log => ({ ...log, transactionHash: DEPOSIT_HASH, blockNumber: 100n, removed: false }) as Log),
    sender
  );
  const paysSender = onChain.recipient.toLowerCase() === sender.toLowerCase();
  const card = (overrides: { amount?: bigint; recipient?: string; account?: string } = {}) =>
    createPendingBridge({
      account: overrides.account ?? sender,
      amount: overrides.amount ?? onChain.amount,
      from: 'ethereum',
      to: network,
      recipient: 'recipient' in overrides ? overrides.recipient : paysSender ? undefined : onChain.recipient,
      route: nativeDepositRoute(network),
      bundleId: 'bundle-1',
      now: NOW
    });

  it('finds the deposit under the hash and block of the receipt it mined in', () => {
    expect(bundleDepositIn(card(), [receipt(logs)])).toEqual({
      txHash: DEPOSIT_HASH,
      blockNumber: 100n,
      to: network,
      amount: onChain.amount,
      recipient: onChain.recipient
    });
  });

  it('finds the deposit in the second receipt of a bundle that approved first', () => {
    const approve = receipt([approvalLog(sender, network, onChain.amount)], {
      transactionHash: APPROVE_HASH,
      blockNumber: 99n
    });
    expect(bundleDepositIn(card(), [approve, receipt(logs)])).toMatchObject({
      txHash: DEPOSIT_HASH,
      blockNumber: 100n
    });
  });

  it('finds the deposit in one receipt that carries both the approval and the deposit', () => {
    const atomic = receipt([approvalLog(sender, network, onChain.amount), ...logs]);
    expect(bundleDepositIn(card(), [atomic])).toMatchObject({ txHash: DEPOSIT_HASH, to: network });
  });

  it('never takes a deposit of another amount', () => {
    expect(bundleDepositIn(card({ amount: onChain.amount + 1n }), [receipt(logs)])).toBeUndefined();
    expect(bundleDepositIn(card({ amount: onChain.amount - 1n }), [receipt(logs)])).toBeUndefined();
  });

  it('never takes a deposit that pays someone other than the card names', () => {
    expect(bundleDepositIn(card({ recipient: OTHER }), [receipt(logs)])).toBeUndefined();
  });

  it('never takes a deposit another account sent', () => {
    expect(bundleDepositIn(card({ account: OTHER }), [receipt(logs)])).toBeUndefined();
  });

  it('matches the recipient the card names whatever its letter case', () => {
    const named = getAddress(onChain.recipient);
    expect(bundleDepositIn(card({ recipient: named }), [receipt(logs)])?.txHash).toBe(DEPOSIT_HASH);
    expect(bundleDepositIn(card({ recipient: named.toLowerCase() }), [receipt(logs)])?.txHash).toBe(
      DEPOSIT_HASH
    );
  });

  it('ignores a reverted receipt even when its logs match', () => {
    expect(bundleDepositIn(card(), [receipt(logs, { status: 'reverted' })])).toBeUndefined();
  });

  it('ignores a bundle that only approved', () => {
    expect(
      bundleDepositIn(card(), [receipt([approvalLog(sender, network, onChain.amount)])])
    ).toBeUndefined();
  });

  it('gives nothing for a card that did not start on Ethereum', () => {
    expect(bundleDepositIn({ ...card(), from: 'base' }, [receipt(logs)])).toBeUndefined();
  });

  it('never takes the same deposit for a card to another network', () => {
    const elsewhere = NETWORKS.find(([other]) => other !== network)![0];
    expect(bundleDepositIn({ ...card(), to: elsewhere }, [receipt(logs)])).toBeUndefined();
  });
});

describe('bundleDepositIn, a deposit that pays another address', () => {
  // The OP and Unichain fixtures pay a recipient other than their sender.
  it.each([
    ['optimism', OPTIMISM_DEPOSIT_LOGS, OPTIMISM_DEPOSIT_TX.from],
    ['unichain', UNICHAIN_DEPOSIT_LOGS, UNICHAIN_DEPOSIT_TX.from]
  ] as const)('on %s is never taken by a card that names no recipient', (network, logs, sender) => {
    const [onChain] = depositsInLogs(
      logs.map(log => ({ ...log, transactionHash: DEPOSIT_HASH, blockNumber: 100n, removed: false }) as Log),
      sender
    );
    expect(onChain.recipient.toLowerCase()).not.toBe(sender.toLowerCase());
    const card = createPendingBridge({
      account: sender,
      amount: onChain.amount,
      from: 'ethereum',
      to: network,
      route: nativeDepositRoute(network),
      bundleId: 'bundle-1',
      now: NOW
    });
    expect(bundleDepositIn(card, [receipt(logs)])).toBeUndefined();
  });
});
