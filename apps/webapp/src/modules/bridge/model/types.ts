import type { BridgeNetworkId } from './networks';

export type BridgeRouteKind = 'native' | 'cctp' | 'layerzero';

export type BridgeStepAction = 'approve' | 'send' | 'claim' | 'prove' | 'finalize';

export type BridgeStep = { network: BridgeNetworkId; action: BridgeStepAction };

/** What the UI needs to show and launch a bridge; produced by the route resolver. */
export type BridgeRoute = {
  kind: BridgeRouteKind;
  /** Ordered steps, source-side first. */
  steps: BridgeStep[];
  etaMinutes: number;
  /** Display rate, e.g. "1:1". */
  rate: string;
  /** Bridge fee in USD. */
  bridgeFeeUsd: number;
  /** Slippage as a fraction (0.001 = 0.1%). */
  slippage: number;
  /** A destination-side action (claim/prove/finalize) is needed before funds arrive. */
  requiresClaim: boolean;
};

export type PendingBridgeStatus = 'pending' | 'ready' | 'arrived' | 'claimed' | 'failed';

export type PendingBridgeNextAction = 'claim' | 'prove' | 'finalize';

export type PendingBridge = {
  id: string;
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
  nextAction?: PendingBridgeNextAction;
  startedAt: number;
  /** Expected arrival (or claim readiness), ms epoch. */
  etaAt: number;
  txHash: string;
  claimTxHash?: string;
  claimedAt?: number;
};
