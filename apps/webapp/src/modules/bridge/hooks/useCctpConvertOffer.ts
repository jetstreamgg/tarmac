import { useQuery } from '@tanstack/react-query';
import type { Hex } from 'viem';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { useTokenBalance } from '@/hooks';
import { L1_USDC } from '../adapters/cctp/contracts';
import {
  cctpConvertOffer,
  claimNextLegTxHashes,
  confirmedClaimTxHashes,
  findOthersClaimReceipt,
  othersClaimSold,
  readClaimSold
} from '../adapters/cctp/convert';
import { bridgeChainId } from '../model/networks';
import { canConvert } from '../model/pendingTransitions';
import type { PendingBridge } from '../model/types';
import { usePendingScope } from './usePendingScope';

const OTHERS_CLAIM_POLL_MS = 60_000;
// A node's logs can lag the nonce the tracker saw used: a scan that found nothing runs again for this long.
const OTHERS_CLAIM_RESCAN_MS = 10 * 60_000;

/**
 * The USDC (6 decimals) the connected account can convert to USDS on a
 * settled CCTP card (see `cctpConvertOffer`): reads whether this app's claim
 * sold it, from the receipts of every hash the claim confirmed with, and the account's USDC on Ethereum.
 * With no claim this app confirmed, someone else's receive is looked for once the account holds USDC,
 * and whether the recipient sold it then or later (`othersClaimSold`).
 * Undefined while either is unknown or failed to read.
 */
export function useCctpConvertOffer(bridge: PendingBridge): bigint | undefined {
  const { account, familyChainId } = usePendingScope();
  const config = useConfig();
  const chainId = bridgeChainId('ethereum', familyChainId);
  const recipient = bridge.recipient ?? bridge.account;
  const claimTxHashes = confirmedClaimTxHashes(bridge);
  const nextLegTxHashes = claimNextLegTxHashes(bridge);
  const sourceChainId = bridgeChainId(bridge.from, familyChainId);
  const convertible = canConvert(bridge, account) && chainId !== undefined;
  // A claim still sent is this app's own, as a Safe's is until its last leg: its receive isn't someone else's.
  const claimSent = bridge.actions.some(action => action.action === 'claim' && action.status === 'sent');
  const othersClaimed =
    convertible && claimTxHashes.length === 0 && !claimSent && !!bridge.txHash && sourceChainId !== undefined;
  const eligible = convertible && (claimTxHashes.length > 0 || othersClaimed);

  // A mined receipt never changes; a leg not mined yet fails the read, which retries.
  const { data: claimSold } = useQuery({
    queryKey: ['cctp-claim-sold', chainId, claimTxHashes, nextLegTxHashes, recipient],
    queryFn: async () => {
      const client = chainId === undefined ? undefined : getPublicClient(config, { chainId });
      if (!client) throw new Error('No Ethereum client.');
      // A reverted claim can't tell what it left: offer nothing.
      return readClaimSold(client, bridge, recipient);
    },
    enabled: eligible && !othersClaimed,
    staleTime: Infinity,
    gcTime: Infinity
  });
  const { data: usdc } = useTokenBalance({
    address: account as Hex | undefined,
    token: L1_USDC,
    chainId: chainId ?? 0,
    enabled: eligible
  });
  // Scanned only while there is USDC to offer; a mined receive never changes. A failed scan runs again each
  // minute, and one that found nothing too, until `OTHERS_CLAIM_RESCAN_MS` after the card settled.
  const { data: othersClaim } = useQuery({
    queryKey: ['cctp-others-claim', chainId, sourceChainId, bridge.txHash, recipient],
    queryFn: async () => {
      const l1 = chainId === undefined ? undefined : getPublicClient(config, { chainId });
      const l2 =
        sourceChainId === undefined ? undefined : getPublicClient(config, { chainId: sourceChainId });
      if (!l1 || !l2) throw new Error('No CCTP clients.');
      return findOthersClaimReceipt({ l1, l2, bridge });
    },
    enabled: othersClaimed && (usdc?.value ?? 0n) > 0n,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchInterval: query =>
      query.state.status === 'error' ||
      (query.state.data === null && Date.now() - (bridge.settledAt ?? 0) < OTHERS_CLAIM_RESCAN_MS)
        ? OTHERS_CLAIM_POLL_MS
        : false
  });
  // A sale signed apart can mine after the receive was found: read again each minute while unsold or unread.
  // A failed re-read keeps the last answer, so it offers nothing until a read succeeds.
  const { data: othersSold, isError: othersSoldFailed } = useQuery({
    queryKey: ['cctp-others-claim-sold', chainId, othersClaim?.transactionHash, recipient],
    queryFn: async () => {
      const l1 = chainId === undefined ? undefined : getPublicClient(config, { chainId });
      if (!l1 || !othersClaim) throw new Error('No Ethereum client.');
      return othersClaimSold({ l1, receive: othersClaim, recipient: recipient as Hex });
    },
    enabled: !!othersClaim,
    staleTime: Infinity,
    refetchInterval: query => (query.state.data === true ? false : OTHERS_CLAIM_POLL_MS)
  });

  if (!eligible) return undefined;
  return othersClaimed
    ? cctpConvertOffer({
        bridge,
        account,
        claimSold: othersSoldFailed ? undefined : othersSold,
        usdcBalance: usdc?.value,
        othersClaimTxHash: othersClaim?.transactionHash
      })
    : cctpConvertOffer({ bridge, account, claimSold, usdcBalance: usdc?.value });
}
