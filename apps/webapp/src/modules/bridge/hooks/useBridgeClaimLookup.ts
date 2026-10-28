import { useQuery } from '@tanstack/react-query';
import type { Hex } from 'viem';
import { useConfig } from 'wagmi';
import type { CctpL2NetworkId } from '../adapters/cctp/contracts';
import { lookupCctpBurn, type CctpBurnLookup } from '../adapters/cctp/lookup';
import { isNativeDepositNetwork } from '../adapters/nativeDeposit/contracts';
import { lookupNativeWithdrawal, type NativeWithdrawalLookup } from '../adapters/nativeWithdrawal/lookup';
import type { PendingBridge } from '../model/types';
import { pendingBridgeStore } from '../store/pendingStore';
import { wagmiAdapterContext } from './adapterContext';
import { useBridgeHistory } from './useBridgeHistory';
import { useIncomingCctpBridges } from './useIncomingCctpBridges';
import { usePendingScope } from './usePendingScope';

type BridgeLookup = CctpBurnLookup | NativeWithdrawalLookup;

/** A bridge to Ethereum to look up, a CCTP burn or a native withdrawal: its source network and hash. */
export type BridgeClaimTarget = { from: CctpL2NetworkId; txHash: Hex };

export type BridgeClaimLookupState =
  | { status: 'idle' }
  | { status: 'disconnected' }
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  /** Already in this wallet's list, or sent here from another account's list of this browser; `claimed` once it was. */
  | { status: 'known'; claimed?: true }
  | Extract<BridgeLookup, { status: 'refused' }>
  | { status: 'found'; bridge: PendingBridge; add: () => void };

const sameHash = (bridge: PendingBridge, txHash: Hex) => bridge.txHash?.toLowerCase() === txHash;

/**
 * Looks up a bridge to Ethereum this browser has no record of, a CCTP burn or
 * else a native withdrawal, from a claim link or the manual form, and adds it
 * to the connected wallet's list for the tracker to claim, or prove and
 * finalize. Each `attempt` reads the chain again.
 */
export function useBridgeClaimLookup(
  target: BridgeClaimTarget | undefined,
  attempt = 0
): BridgeClaimLookupState {
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
      'bridge-claim-lookup',
      familyChainId,
      target?.from,
      target?.txHash,
      account?.toLowerCase(),
      attempt
    ],
    queryFn: async (): Promise<BridgeLookup> => {
      const { from, txHash } = target!;
      const client = wagmiAdapterContext(config, familyChainId).getClient(from);
      if (!client) throw new Error(`No client for ${from}`);
      const burn = await lookupCctpBurn({ from, txHash, account: account!, client });
      // The same receipt read as a native withdrawal: only one of them can be in it.
      if (burn.status !== 'refused' || burn.reason !== 'not-a-bridge' || !isNativeDepositNetwork(from))
        return burn;
      return lookupNativeWithdrawal({ from, txHash, account: account!, client });
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
