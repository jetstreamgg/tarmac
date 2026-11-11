import type { Address, Hex, PublicClient } from 'viem';
import { TransactionRefusedError } from '@/hooks/shared/useTransactionOutcome';
import { CCTP_SWAP_FAILED_MESSAGE, cctpResumeRefusal } from '../adapters/cctp/gate';
import { cctpSwapStore, type UnfinishedCctpSwap } from './cctpSwapStore';
import { isCctpSpendOpen } from './openCctpSpends';
import { PROMPT_OPEN_MESSAGE } from './promptRegistry';

/**
 * Why a stopped swap's USDC can't be spent now, by its burn or its convert: a
 * prompt spending it may still be signed in the wallet, or the chain shows the
 * swap or a spend of its USDC not as stored. A swap that failed leaves nothing
 * to spend, so its card goes.
 */
export async function unfinishedSwapRefusal({
  scope,
  swap,
  account,
  client
}: {
  scope: string | undefined;
  swap: UnfinishedCctpSwap;
  account: Address;
  client: PublicClient;
}) {
  if (scope && isCctpSpendOpen(scope, swap.swapTxHash))
    return new TransactionRefusedError(PROMPT_OPEN_MESSAGE);
  const refusal = await cctpResumeRefusal({
    network: swap.network,
    swapTxHash: swap.swapTxHash as Hex,
    account,
    usdcAmount: swap.usdcAmount,
    recipient: swap.recipient as Address,
    client
  });
  if (scope && refusal?.message === CCTP_SWAP_FAILED_MESSAGE) cctpSwapStore.clear(scope, swap.swapTxHash);
  return refusal;
}
