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

/** On-chain state each route ticket reads; anything left undefined does not block. */
export type BridgeRouteFacts = {
  native?: RouteGate;
  /** `liquidity`: USDC the L2 PSM3 can pay out, in USDS wei. */
  cctp?: RouteGate & { liquidity?: bigint };
  layerzero?: RouteGate & { bridgeFeeUsd?: number };
};

export type BridgeBlockReason = 'pair-not-allowed' | BridgeFallbackReason;

export type ResolvedBridgeRoute =
  { status: 'ok'; route: BridgeRoute } | { status: 'blocked'; reason: BridgeBlockReason };

const DAY_MINUTES = 24 * 60;
const CCTP_ETA_MINUTES = 20;
const LAYERZERO_ETA_MINUTES = 3;

// Measured from past deposits and withdrawals (APP-613, APP-617).
const DEPOSIT_ETA_MINUTES: Partial<Record<BridgeNetworkId, number>> = {
  optimism: 1,
  unichain: 1,
  base: 3,
  arbitrum: 7
};
const WITHDRAWAL_ETA_MINUTES: Partial<Record<BridgeNetworkId, number>> = {
  base: 5 * DAY_MINUTES,
  arbitrum: Math.round(6.4 * DAY_MINUTES),
  optimism: 7 * DAY_MINUTES,
  unichain: 7 * DAY_MINUTES
};

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
    const failure = gateFailure(amount, facts.layerzero);
    if (failure) return blocked(failure);
    return ok(
      route(
        'layerzero',
        routeSteps('layerzero', from, to),
        LAYERZERO_ETA_MINUTES,
        facts.layerzero?.bridgeFeeUsd
      )
    );
  }

  if (from === 'ethereum') {
    const failure = gateFailure(amount, facts.native);
    if (failure) return blocked(failure);
    return ok(route('native', routeSteps('native', from, to), DEPOSIT_ETA_MINUTES[to] ?? 0, 0));
  }

  const cctpFailure = gateFailure(amount, facts.cctp);
  if (!cctpFailure) {
    return ok(route('cctp', routeSteps('cctp', from, to), CCTP_ETA_MINUTES, 0));
  }
  const nativeFailure = gateFailure(amount, facts.native);
  if (nativeFailure) return blocked(nativeFailure);
  return ok(
    route('native', routeSteps('native', from, to), WITHDRAWAL_ETA_MINUTES[from] ?? 0, 0, cctpFailure)
  );
}
