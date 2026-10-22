import { isAddressEqual, parseEventLogs, erc20Abi, zeroAddress, type Log } from 'viem';
import { canLaunchConvert } from '../../model/pendingTransitions';
import type { PendingBridge } from '../../model/types';
import { cctpBurnAmount } from './calls';
import { L1_USDS } from './contracts';

/** The claim's transaction mints USDS to the recipient when it sold the received USDC (the wrapper mints it). */
export const claimSoldForUsds = (
  logs: readonly Pick<Log, 'address' | 'topics' | 'data'>[],
  recipient: string
) =>
  parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: logs as Log[], strict: true }).some(
    log =>
      isAddressEqual(log.address, L1_USDS) &&
      isAddressEqual(log.args.from, zeroAddress) &&
      isAddressEqual(log.args.to, recipient as `0x${string}`)
  );

/**
 * Every hash this app's claim confirmed with: a run signed step by step can
 * confirm its receive and its sale apart, and a bundle the wallet ran apart
 * keeps its other transactions on the claim.
 */
export const confirmedClaimTxHashes = (bridge: PendingBridge): string[] =>
  bridge.actions
    .filter(action => action.action === 'claim' && action.status === undefined)
    .flatMap(action => [action.txHash, ...(action.bundleTxHashes ?? [])]);

/** The first hash this app's claim confirmed with; see `confirmedClaimTxHashes` for all of them. */
export const confirmedClaimTxHash = (bridge: PendingBridge): string | undefined =>
  confirmedClaimTxHashes(bridge)[0];

/**
 * The USDC (6 decimals) a settled CCTP claim left unsold that `account` can
 * convert to USDS: what it minted, capped by what the account still holds.
 * Only to its recipient, for a claim this app recorded that sold nothing, and
 * once; undefined while anything it reads is unknown.
 */
export function cctpConvertOffer({
  bridge,
  account,
  claimSold,
  usdcBalance
}: {
  bridge: PendingBridge;
  account: string | undefined;
  claimSold: boolean | undefined;
  usdcBalance: bigint | undefined;
}): bigint | undefined {
  if (!canLaunchConvert(bridge) || !confirmedClaimTxHash(bridge)) return undefined;
  if (!account || account.toLowerCase() !== (bridge.recipient ?? bridge.account).toLowerCase())
    return undefined;
  if (claimSold !== false || usdcBalance === undefined) return undefined;
  const minted = cctpBurnAmount(bridge.amount);
  const amount = usdcBalance < minted ? usdcBalance : minted;
  return amount > 0n ? amount : undefined;
}
