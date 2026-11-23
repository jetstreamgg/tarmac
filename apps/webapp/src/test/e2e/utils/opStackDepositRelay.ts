// viem imports only: scripts/relayForkDeposit.ts runs this file with plain node.
import {
  isAddressEqual,
  toHex,
  type Address,
  type Hash,
  type PublicClient,
  type TransactionReceipt
} from 'viem';
import { extractTransactionDepositedLogs, opaqueDataToDepositData } from 'viem/op-stack';

type Reader = Pick<PublicClient, 'getTransactionReceipt' | 'waitForTransactionReceipt'>;

/** A JSON-RPC call to a Tenderly fork, which also takes its admin methods. */
export const forkRpc = async <T>(url: string, method: string, params: unknown[]): Promise<T> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const body = await response.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result as T;
};

/** The L2 deposit transaction of an L1 OP Stack deposit, from the TransactionDeposited log of the L2's portal. */
export async function readOpStackDeposit(
  l1: Pick<Reader, 'getTransactionReceipt'>,
  l1TxHash: Hash,
  portal: Address
) {
  const receipt = await l1.getTransactionReceipt({ hash: l1TxHash });
  const log = extractTransactionDepositedLogs({ logs: receipt.logs }).find(({ address }) =>
    isAddressEqual(address, portal)
  );
  if (!log) throw new Error(`No TransactionDeposited log from ${portal} in ${l1TxHash}`);
  return { from: log.args.from, to: log.args.to, ...opaqueDataToDepositData(log.args.opaqueData) };
}

/**
 * Plays the sequencer's part on the L2 fork, which never derives deposits from
 * the L1 fork: sends the exact deposit tx of `deposit`. A `gas` below the
 * message's needs makes the messenger record a FailedRelayedMessage, the state
 * a user replays from.
 */
export async function sendOpStackDeposit(
  l2: Pick<Reader, 'waitForTransactionReceipt'>,
  l2Rpc: string,
  deposit: Awaited<ReturnType<typeof readOpStackDeposit>>,
  { gas }: { gas?: bigint } = {}
): Promise<TransactionReceipt> {
  await forkRpc(l2Rpc, 'tenderly_setBalance', [[deposit.from], toHex(10n ** 18n)]);
  const hash = await forkRpc<Hash>(l2Rpc, 'eth_sendTransaction', [
    {
      from: deposit.from,
      to: deposit.to,
      gas: toHex(gas ?? deposit.gas),
      value: toHex(deposit.value),
      data: deposit.data
    }
  ]);
  const receipt = await l2.waitForTransactionReceipt({ hash });
  if (receipt.status === 'reverted') throw new Error(`The L2 deposit tx ${hash} reverted`);
  return receipt;
}
