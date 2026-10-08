import type { BridgeNetworkId } from './networks';
import { isAllowedPair } from './pairs';
import type {
  BridgeFallbackReason,
  BridgeRoute,
  BridgeRouteKind,
  BridgeStep,
  PendingBridgeNextAction
} from './types';

type RouteGate = {
  /** Governance can close the native bridges and pause CCTP or the OFTs. */
  isOpen?: boolean;
  /** Per-message or rate limit, in USDS wei. */
  maxAmount?: bigint;
};

/** A fact being read, or one that couldn't be read, blocks its route. */
export type RouteFact<T> = T | 'loading' | 'error';

/**
 * On-chain state each route ticket reads. A route ticket passes `toRouteFact`
 * of its query; undefined means no ticket reads that route yet.
 */
export type BridgeRouteFacts = {
  native?: RouteFact<RouteGate>;
  /** `liquidity`: USDC the L2 PSM3 can pay out, in USDS wei. */
  cctp?: RouteFact<RouteGate & { liquidity?: bigint }>;
  /** `bridgeFeeUsd`: the quoted fee, paid on top in the native token; a read with no quote blocks. */
  layerzero?: RouteFact<RouteGate & { bridgeFeeUsd: number }>;
};

/** A query's result as a route fact; a success with no data is an error. */
export const toRouteFact = <T>({
  status,
  data
}: {
  status: 'pending' | 'error' | 'success';
  data: T | undefined;
}): RouteFact<T> => {
  if (status === 'pending') return 'loading';
  if (status === 'error' || data === undefined) return 'error';
  return data;
};

export type BridgeBlockReason = 'pair-not-allowed' | 'facts-loading' | 'facts-error' | BridgeFallbackReason;

export type ResolvedBridgeRoute =
  { status: 'ok'; route: BridgeRoute } | { status: 'blocked'; reason: BridgeBlockReason };

export const DAY_MINUTES = 24 * 60;
const CCTP_ETA_MINUTES = 20;
const LAYERZERO_ETA_MINUTES = 3;

/** Networks the native bridges reach; one added without its ETAs fails to compile. */
type NativeNetworkId = Exclude<BridgeNetworkId, 'ethereum' | 'avalanche' | 'solana'>;

// Measured from past deposits and withdrawals (APP-613, APP-617).
const DEPOSIT_ETA_MINUTES: Record<NativeNetworkId, number> = {
  optimism: 1,
  unichain: 1,
  base: 3,
  arbitrum: 7
};
const WITHDRAWAL_ETA_MINUTES: Record<NativeNetworkId, number> = {
  base: 5 * DAY_MINUTES,
  arbitrum: Math.round(6.4 * DAY_MINUTES),
  optimism: 7 * DAY_MINUTES,
  unichain: 7 * DAY_MINUTES
};

const nativeEtaMinutes = (etas: Record<NativeNetworkId, number>, network: BridgeNetworkId) =>
  (etas as Partial<Record<BridgeNetworkId, number>>)[network];

const isUnread = (fact: RouteFact<unknown> | undefined): fact is 'loading' | 'error' =>
  fact === 'loading' || fact === 'error';
const unreadReason = (fact: 'loading' | 'error'): BridgeBlockReason =>
  fact === 'loading' ? 'facts-loading' : 'facts-error';

const gateFailure = (
  amount: bigint,
  gate: (RouteGate & { liquidity?: bigint }) | undefined
): BridgeFallbackReason | undefined => {
  if (gate?.isOpen === false) return 'closed';
  if (amount === 0n) return undefined;
  if (gate?.maxAmount !== undefined && amount > gate.maxAmount) return 'over-limit';
  if (gate?.liquidity !== undefined && amount > gate.liquidity) return 'no-liquidity';
  return undefined;
};

const sourceSteps = (from: BridgeNetworkId): BridgeStep[] => [
  ...(from === 'solana' ? [] : [{ network: from, action: 'approve' as const }]),
  { network: from, action: 'send' }
];

/** Actions on the destination after the source send, in order. */
export const destinationActions = (
  kind: BridgeRouteKind,
  from: BridgeNetworkId
): PendingBridgeNextAction[] => {
  if (kind === 'cctp') return ['claim'];
  if (kind === 'layerzero' || from === 'ethereum') return [];
  // OP Stack withdrawals prove then finalize; Arbitrum executes once on the outbox.
  return from === 'arbitrum' ? ['finalize'] : ['prove', 'finalize'];
};

const routeSteps = (kind: BridgeRouteKind, from: BridgeNetworkId, to: BridgeNetworkId): BridgeStep[] => [
  ...sourceSteps(from),
  ...destinationActions(kind, from).map(action => ({ network: to, action }))
];

const route = (
  kind: BridgeRouteKind,
  steps: BridgeStep[],
  etaMinutes: number,
  bridgeFeeUsd: number | undefined,
  fallbackReason?: BridgeFallbackReason
): BridgeRoute => ({
  kind,
  steps,
  etaMinutes,
  rate: '1:1',
  bridgeFeeUsd,
  slippage: 0,
  requiresClaim: steps.some(step => step.network !== steps[0].network),
  ...(fallbackReason && { fallbackReason })
});

const ok = (resolved: BridgeRoute): ResolvedBridgeRoute => ({ status: 'ok', route: resolved });
const blocked = (reason: BridgeBlockReason): ResolvedBridgeRoute => ({ status: 'blocked', reason });

/**
 * The route for a pair (APP-610 scope): Ethereum to an L2 by native deposit,
 * an L2 to Ethereum by CCTP falling back to the native withdrawal, and
 * Avalanche or Solana by LayerZero.
 */
export function resolveBridgeRoute({
  from,
  to,
  amount,
  facts
}: {
  from: BridgeNetworkId;
  to: BridgeNetworkId;
  amount: bigint;
  facts: BridgeRouteFacts;
}): ResolvedBridgeRoute {
  if (!isAllowedPair({ from, to })) return blocked('pair-not-allowed');

  const isLayerZero = [from, to].some(network => network === 'avalanche' || network === 'solana');
  if (isLayerZero) {
    const { layerzero } = facts;
    if (isUnread(layerzero)) return blocked(unreadReason(layerzero));
    if (layerzero && !Number.isFinite(layerzero.bridgeFeeUsd)) return blocked('facts-error');
    const failure = gateFailure(amount, layerzero);
    if (failure) return blocked(failure);
    return ok(
      route('layerzero', routeSteps('layerzero', from, to), LAYERZERO_ETA_MINUTES, layerzero?.bridgeFeeUsd)
    );
  }

  const { native, cctp } = facts;
  if (from === 'ethereum') {
    // No known ETA means no native route to that network.
    const etaMinutes = nativeEtaMinutes(DEPOSIT_ETA_MINUTES, to);
    if (etaMinutes === undefined) return blocked('pair-not-allowed');
    if (isUnread(native)) return blocked(unreadReason(native));
    const failure = gateFailure(amount, native);
    if (failure) return blocked(failure);
    return ok(route('native', routeSteps('native', from, to), etaMinutes, 0));
  }

  // No fallback before CCTP is known: the native withdrawal takes days.
  if (isUnread(cctp)) return blocked(unreadReason(cctp));
  const cctpFailure = gateFailure(amount, cctp);
  if (!cctpFailure) {
    return ok(route('cctp', routeSteps('cctp', from, to), CCTP_ETA_MINUTES, 0));
  }
  const withdrawalMinutes = nativeEtaMinutes(WITHDRAWAL_ETA_MINUTES, from);
  if (withdrawalMinutes === undefined) return blocked(cctpFailure);
  if (isUnread(native)) return blocked(unreadReason(native));
  const nativeFailure = gateFailure(amount, native);
  if (nativeFailure) return blocked(nativeFailure);
  return ok(route('native', routeSteps('native', from, to), withdrawalMinutes, 0, cctpFailure));
}
