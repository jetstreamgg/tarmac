import { useQuery } from '@tanstack/react-query';
import type { Hex } from 'viem';
import { useConfig } from 'wagmi';
import type { CctpL2NetworkId } from '../adapters/cctp/contracts';
import { lookupCctpBurn, type CctpBurnLookup } from '../adapters/cctp/lookup';
import type { PendingBridge } from '../model/types';
import { pendingBridgeStore } from '../store/pendingStore';
import { wagmiAdapterContext } from './adapterContext';
import { useBridgeHistory } from './useBridgeHistory';
import { useIncomingCctpBridges } from './useIncomingCctpBridges';
import { usePendingScope } from './usePendingScope';

/** A CCTP burn to look up: its source network and hash. */
export type CctpClaimTarget = { from: CctpL2NetworkId; txHash: Hex };

export type CctpClaimLookupState =
  | { status: 'idle' }
  | { status: 'disconnected' }
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  /** Already in this wallet's list, or sent here from another account's list of this browser; `claimed` once it was. */
  | { status: 'known'; claimed?: true }
  | Extract<CctpBurnLookup, { status: 'refused' }>
  | { status: 'found'; bridge: PendingBridge; add: () => void };

const sameHash = (bridge: PendingBridge, txHash: Hex) => bridge.txHash?.toLowerCase() === txHash;

/**
 * Looks up a CCTP burn this browser has no record of, from a claim link or
 * the manual form, and adds it to the connected wallet's list for the tracker
 * to claim from. Each `attempt` reads the chain again.
 */
export function useCctpClaimLookup(target: CctpClaimTarget | undefined, attempt = 0): CctpClaimLookupState {
  const { account, familyChainId, scope } = usePendingScope();
  const config = useConfig();
  const history = useBridgeHistory();
  const incoming = useIncomingCctpBridges();
  const match = target
    ? (history.find(bridge => sameHash(bridge, target.txHash)) ??
      incoming.find(({ bridge }) => sameHash(bridge, target.txHash))?.bridge)
    : undefined;
  const known = match !== undefined;
  const query = useQuery({
    queryKey: [
      'cctp-claim-lookup',
      familyChainId,
      target?.from,
      target?.txHash,
      account?.toLowerCase(),
      attempt
    ],
    queryFn: () => {
      const client = wagmiAdapterContext(config, familyChainId).getClient(target!.from);
      if (!client) throw new Error(`No client for ${target!.from}`);
      return lookupCctpBurn({ from: target!.from, txHash: target!.txHash, account: account!, client });
    },
    enabled: !!target && !!account && !known,
    refetchOnWindowFocus: false,
    retry: false
  });
  if (!account || !scope) return { status: 'disconnected' };
  if (!target) return { status: 'idle' };
  if (match)
    return match.status === 'claimed' || match.status === 'arrived'
      ? { status: 'known', claimed: true }
      : { status: 'known' };
  if (query.isError) return { status: 'error', retry: () => void query.refetch() };
  if (!query.data) return { status: 'loading' };
  const result = query.data;
  if (result.status === 'refused') return result;
  return {
    status: 'found',
    bridge: result.bridge,
    add: () => pendingBridgeStore.upsert(scope, result.bridge)
  };
}
