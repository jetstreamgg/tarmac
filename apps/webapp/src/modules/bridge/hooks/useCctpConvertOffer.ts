import { useQuery } from '@tanstack/react-query';
import { TransactionReceiptNotFoundError, type Hex } from 'viem';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { useTokenBalance } from '@/hooks';
import { L1_USDC } from '../adapters/cctp/contracts';
import {
  cctpConvertOffer,
  cctpNothingToConvert,
  claimLegOpenUntil,
  claimNextLegTxHashes,
  confirmedClaimTxHashes,
  findLostSale,
  findOthersClaimReceipt,
  OTHERS_CLAIM_RESCAN_MS,
  othersClaimSold,
  readClaimSold
} from '../adapters/cctp/convert';
import { bridgeChainId } from '../model/networks';
import { canConvert, recordActionSent } from '../model/pendingTransitions';
import { pendingBridgeStore } from '../store/pendingStore';
import { isCctpSpendOpen } from '../store/openCctpSpends';
import { lostSaleIntent, lostSaleRead } from '../store/saleIntentStore';
import { SEND_INTENT_MS } from '../store/sendIntentStore';
import type { PendingBridge } from '../model/types';
import { usePendingScope } from './usePendingScope';

const OTHERS_CLAIM_POLL_MS = 60_000;
// One Ethereum block.
const LEG_READ_MAX_DELAY_MS = 12_000;

/**
 * The USDC (6 decimals) the connected account can convert to USDS on a
 * settled CCTP card (see `cctpConvertOffer`): reads whether this app's claim
 * sold it, from the receipts of every hash the claim confirmed with, and the account's USDC on Ethereum.
 * With no claim this app confirmed, someone else's receive is looked for once the account holds USDC,
 * and whether the recipient sold it then or later (`othersClaimSold`).
 * `offer` is undefined while either is unknown or failed to read; `nothingLeft` says so only once it is sure.
 * `saleOpenUntil` is when a sale prompt a reload lost expires, while it holds the offer back.
 * `saleSentUntil` is when a leg the claim run sent and the chain hasn't mined counts as dropped.
 */
export function useCctpConvertOffer(
  bridge: PendingBridge,
  now: number
): { offer: bigint | undefined; nothingLeft: boolean; saleOpenUntil?: number; saleSentUntil?: number } {
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
    gcTime: Infinity,
    // A run's approve or sale takes a block or more to mine: keep reading until it does, not just three tries.
    retry: (failures, error) => error instanceof TransactionReceiptNotFoundError || failures < 3,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, LEG_READ_MAX_DELAY_MS)
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

  // A sale prompt of this card no page answered (a reload mid-signature) may still be signed, or be pending: nothing
  // is offered while it lasts. A sale of it found in Ethereum's last hour is the card's convert, which its tracker settles.
  const intent = convertible ? lostSaleIntent(bridge.id, now) : undefined;
  // This page's own prompt still open isn't lost.
  const lost = intent && !isCctpSpendOpen(intent.scope, bridge.id) ? intent : undefined;
  useQuery({
    queryKey: ['cctp-lost-sale', chainId, bridge.id, lost?.at],
    queryFn: async () => {
      const l1 = chainId === undefined ? undefined : getPublicClient(config, { chainId });
      if (!l1 || !lost) throw new Error('No Ethereum client.');
      const cards = pendingBridgeStore.getSnapshot(lost.scope);
      const hash = await findLostSale({
        l1,
        recipient: recipient as Hex,
        ...lostSaleRead(lost, bridge, cards)
      });
      if (hash)
        pendingBridgeStore.update(lost.scope, bridge.id, current =>
          recordActionSent(current, { action: 'convert', txHash: hash, at: Date.now() })
        );
      return hash;
    },
    enabled: !!lost,
    staleTime: Infinity,
    // Read again each minute while its intent lasts: the sale may mine later.
    refetchInterval: query => (query.state.data ? false : OTHERS_CLAIM_POLL_MS)
  });
  const saleOpen = !!lost;

  const othersSoldRead = othersSoldFailed ? undefined : othersSold;
  const offer =
    !eligible || saleOpen
      ? undefined
      : othersClaimed
        ? cctpConvertOffer({
            bridge,
            account,
            claimSold: othersSoldRead,
            usdcBalance: usdc?.value,
            othersClaimTxHash: othersClaim?.transactionHash
          })
        : cctpConvertOffer({ bridge, account, claimSold, usdcBalance: usdc?.value });
  const nothingLeft =
    !saleOpen &&
    cctpNothingToConvert({
      bridge,
      account,
      offer,
      claimSold,
      usdcBalance: usdc?.value,
      othersClaim,
      othersSold: othersSoldRead,
      now
    });
  // Until the run's last leg mines or counts as dropped, the card waits on it.
  const legOpenUntil =
    eligible && !othersClaimed && claimSold === undefined ? claimLegOpenUntil(bridge) : undefined;
  return {
    offer,
    nothingLeft,
    saleOpenUntil: lost ? lost.at + SEND_INTENT_MS : undefined,
    saleSentUntil: legOpenUntil !== undefined && now < legOpenUntil ? legOpenUntil : undefined
  };
}
