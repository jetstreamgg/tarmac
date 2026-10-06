import type { BridgeNetworkId } from './networks';

export type BridgeRouteKind = 'native' | 'cctp' | 'layerzero';

export type BridgeStepAction = 'approve' | 'send' | 'claim' | 'prove' | 'finalize';

export type BridgeStep = { network: BridgeNetworkId; action: BridgeStepAction };

/** Why the resolver moved off the preferred route for a pair. */
export type BridgeFallbackReason = 'closed' | 'over-limit' | 'no-liquidity';

/** What the UI needs to show and launch a bridge; produced by the route resolver. */
export type BridgeRoute = {
  kind: BridgeRouteKind;
  /** Ordered steps, source-side first. */
  steps: BridgeStep[];
  etaMinutes: number;
  /** Display rate, e.g. "1:1". */
  rate: string;
  /** Bridge fee in USD; undefined until the route quotes it (LayerZero). */
  bridgeFeeUsd: number | undefined;
  /** Slippage as a fraction (0.001 = 0.1%). */
  slippage: number;
  /** A destination-side action (claim/prove/finalize) is needed before funds arrive. */
  requiresClaim: boolean;
  /** Set when this route replaces the preferred one (CCTP → native withdrawal). */
  fallbackReason?: BridgeFallbackReason;
};

export type PendingBridgeStatus = 'pending' | 'ready' | 'arrived' | 'claimed' | 'failed';

export type PendingBridgeNextAction = 'claim' | 'prove' | 'finalize';

/** A destination-side transaction the user sent for a bridge. */
export type PendingBridgeAction = { action: PendingBridgeNextAction; txHash: string; at: number };

export type PendingBridge = {
  /** The first source identifier known: the tx hash, or the Safe tx hash for a queued Safe transaction. */
  id: string;
  /** Sender, lowercase. */
  account: string;
  /** Amount at 18 decimals (USDS). */
  amount: bigint;
  token: 'USDS';
  from: BridgeNetworkId;
  to: BridgeNetworkId;
  recipient?: string;
  status: PendingBridgeStatus;
  routeKind: BridgeRouteKind;
  /** A destination-side action is needed; the card shows a Claim button. */
  requiresClaim: boolean;
  /** The destination action that is ready (status `ready`) or comes next (status `pending`). */
  nextAction?: PendingBridgeNextAction;
  startedAt: number;
  /** Expected arrival (or next action readiness), ms epoch. */
  etaAt: number;
  /** On-chain source tx; undefined while a Safe transaction waits for its signatures. */
  txHash?: string;
  safeTxHash?: string;
  actions: PendingBridgeAction[];
  /** Route-specific tracking ids (CCTP message hash, withdrawal hash, LayerZero guid). */
  routeData?: Record<string, string>;
  /** When the bridge reached arrived, claimed or failed. */
  settledAt?: number;
  failureReason?: string;
};
