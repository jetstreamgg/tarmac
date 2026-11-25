import { expect } from '@playwright/test';
import {
  createPublicClient,
  getAddress,
  http,
  isAddressEqual,
  parseAbi,
  parseEventLogs,
  type Address,
  type Hash
} from 'viem';
import {
  ARBITRUM_DEPOSIT,
  L1_USDS,
  OP_STACK_DEPOSIT,
  l1DepositBridge,
  type NativeDepositNetwork
} from '@/modules/bridge/adapters/nativeDeposit/contracts';
import { getRpcUrlFromFile } from './getRpcUrlFromFile';
import { NetworkName } from './constants';

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
]);
const escrowAbi = parseAbi(['function escrow() view returns (address)']);

const client = async (network: NetworkName) =>
  createPublicClient({ transport: http(await getRpcUrlFromFile(network)) });

const l2Usds = (network: NativeDepositNetwork) =>
  network === 'arbitrum' ? ARBITRUM_DEPOSIT.l2Usds : OP_STACK_DEPOSIT[network].l2Usds;
const l2Bridge = (network: NativeDepositNetwork) =>
  network === 'arbitrum' ? ARBITRUM_DEPOSIT.l2Gateway : OP_STACK_DEPOSIT[network].l2TokenBridge;

/**
 * Fund invariants of one native deposit, safe under parallel tests: the escrow
 * is shared, so its side is read from the deposit's own Transfer logs, and every
 * balance checked belongs to this test's accounts or must not move at all.
 * Snapshot with this before the deposit is sent.
 */
export async function watchDeposit({
  to,
  sender,
  recipient = sender
}: {
  to: NativeDepositNetwork;
  sender: Address;
  recipient?: Address;
}) {
  const l1 = await client(NetworkName.mainnet);
  const l2 = await client(NetworkName[to]);
  const bridge = l1DepositBridge(to);
  const l1Balance = (account: Address) =>
    l1.readContract({ address: L1_USDS, abi: erc20Abi, functionName: 'balanceOf', args: [account] });
  const l2Balance = (account: Address) =>
    l2.readContract({ address: l2Usds(to), abi: erc20Abi, functionName: 'balanceOf', args: [account] });

  const [senderBefore, bridgeBefore, recipientBefore, l2BridgeBefore] = await Promise.all([
    l1Balance(sender),
    l1Balance(bridge),
    l2Balance(recipient),
    l2Balance(l2Bridge(to))
  ]);

  return {
    /** The deposit moved exactly `amount` from the sender to the escrow and left no allowance behind. */
    async expectEscrowed(l1TxHash: Hash, amount: bigint) {
      const [escrow, receipt] = await Promise.all([
        l1.readContract({ address: bridge, abi: escrowAbi, functionName: 'escrow' }),
        l1.getTransactionReceipt({ hash: l1TxHash })
      ]);
      const transfers = parseEventLogs({
        abi: erc20Abi,
        eventName: 'Transfer',
        logs: receipt.logs.filter(log => isAddressEqual(log.address, L1_USDS))
      }).map(({ args }) => args);
      expect(transfers).toEqual([{ from: getAddress(sender), to: getAddress(escrow), value: amount }]);
      expect(await l1Balance(sender)).toBe(senderBefore - amount);
      expect(await l1Balance(bridge)).toBe(bridgeBefore);
      expect(
        await l1.readContract({
          address: L1_USDS,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [sender, bridge]
        })
      ).toBe(0n);
    },
    /** Exactly `amount` reached the recipient on the L2, and the L2 bridge kept none. */
    async expectArrived(amount: bigint) {
      expect(await l2Balance(recipient)).toBe(recipientBefore + amount);
      expect(await l2Balance(l2Bridge(to))).toBe(l2BridgeBefore);
    }
  };
}
