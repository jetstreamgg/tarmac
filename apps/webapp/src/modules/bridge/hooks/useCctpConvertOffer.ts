import { useQuery } from '@tanstack/react-query';
import type { Hex } from 'viem';
import { useConfig } from 'wagmi';
import { getPublicClient } from '@wagmi/core';
import { useTokenBalance } from '@/hooks';
import { L1_USDC } from '../adapters/cctp/contracts';
import {
  cctpConvertOffer,
  claimNextLegTxHashes,
  confirmedClaimTxHashes,
  readClaimSold
} from '../adapters/cctp/convert';
import { bridgeChainId } from '../model/networks';
import { canLaunchConvert } from '../model/pendingTransitions';
import type { PendingBridge } from '../model/types';
import { usePendingScope } from './usePendingScope';

/**
 * The USDC (6 decimals) the connected account can convert to USDS on a
 * settled CCTP card (see `cctpConvertOffer`): reads whether this app's claim
 * sold it, from the receipts of every hash the claim confirmed with, and the account's USDC on Ethereum.
 * Undefined while either is unknown or failed to read.
 */
export function useCctpConvertOffer(bridge: PendingBridge): bigint | undefined {
  const { account, familyChainId } = usePendingScope();
  const config = useConfig();
  const chainId = bridgeChainId('ethereum', familyChainId);
  const recipient = bridge.recipient ?? bridge.account;
  const claimTxHashes = confirmedClaimTxHashes(bridge);
  const nextLegTxHashes = claimNextLegTxHashes(bridge);
  const eligible =
    canLaunchConvert(bridge) &&
    claimTxHashes.length > 0 &&
    chainId !== undefined &&
    !!account &&
    account.toLowerCase() === recipient.toLowerCase();

  // A mined receipt never changes; a leg not mined yet fails the read, which retries.
  const { data: claimSold } = useQuery({
    queryKey: ['cctp-claim-sold', chainId, claimTxHashes, nextLegTxHashes, recipient],
    queryFn: async () => {
      const client = chainId === undefined ? undefined : getPublicClient(config, { chainId });
      if (!client) throw new Error('No Ethereum client.');
      // A reverted claim can't tell what it left: offer nothing.
      return readClaimSold(client, bridge, recipient);
    },
    enabled: eligible,
    staleTime: Infinity,
    gcTime: Infinity
  });
  const { data: usdc } = useTokenBalance({
    address: account as Hex | undefined,
    token: L1_USDC,
    chainId: chainId ?? 0,
    enabled: eligible
  });

  return eligible ? cctpConvertOffer({ bridge, account, claimSold, usdcBalance: usdc?.value }) : undefined;
}
