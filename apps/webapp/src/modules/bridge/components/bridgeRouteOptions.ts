/**
 * Pure builders for the "Select bridge type" cards (Figma 50 and 60): one card
 * per route the user can pick, greyed with its reason when it can't carry the
 * bridge now.
 */

import { t } from '@lingui/core/macro';
import { NO_VALUE } from '@/lib/constants';
import { formatUsd } from '@/utils';
import type { BridgeBlockReason, BridgeRouteOption } from '../model/resolveRoute';
import type { BridgeRoute, BridgeRouteKind } from '../model/types';
import {
  bridgeTypeLabel,
  bridgeTypeLogo,
  formatEta,
  formatEtaWords,
  type BridgeTypeLogo
} from './bridgeModalRows';

export type RouteOptionCard = {
  kind: BridgeRouteKind;
  name: string;
  logo?: BridgeTypeLogo;
  badge: { text: string; tone: 'accent' | 'muted' };
  description: string;
  rows: { label: string; value: string }[];
  unavailable: boolean;
};

const unavailableBadge = (reason: BridgeBlockReason): string => {
  if (reason === 'no-liquidity') return t`Insufficient liquidity`;
  if (reason === 'over-limit') return t`Above the limit`;
  if (reason === 'facts-loading') return t`Checking`;
  return t`Unavailable`;
};

const description = (route: BridgeRoute): string => {
  const eta = formatEtaWords(route.etaMinutes);
  if (route.kind === 'cctp')
    return t`Swapped 1:1 to USDC and sent to Ethereum with Circle CCTP. Claim it there in about ${eta}, then convert it back to USDS.`;
  const ethereumSteps = route.steps.filter(step => step.network !== route.steps[0].network).length;
  return ethereumSteps > 1
    ? t`Sky's native bridge, so your USDS stays USDS the whole way. Withdrawals to Ethereum take about ${eta} and need two more transactions on Ethereum.`
    : t`Sky's native bridge, so your USDS stays USDS the whole way. Withdrawals to Ethereum take about ${eta} and need one more transaction on Ethereum.`;
};

export function buildRouteOptionCard({
  option: { route, unavailable },
  networkFee,
  approvals
}: {
  option: BridgeRouteOption;
  networkFee: string;
  /** Transactions the user signs on both networks; undefined until read. */
  approvals: number | undefined;
}): RouteOptionCard {
  const logo = bridgeTypeLogo(route.kind);
  return {
    kind: route.kind,
    name: bridgeTypeLabel(route.kind),
    ...(logo && { logo }),
    badge: unavailable
      ? { text: unavailableBadge(unavailable), tone: 'muted' }
      : route.kind === 'cctp'
        ? { text: t`Fastest`, tone: 'accent' }
        : { text: t`Native`, tone: 'muted' },
    description: description(route),
    rows: [
      { label: t`Arrives in`, value: formatEta(route.etaMinutes) },
      { label: t`Claim`, value: t`Manual` },
      { label: t`Approvals`, value: approvals === undefined ? NO_VALUE : String(approvals) },
      {
        label: t`Bridge fee`,
        value: route.bridgeFeeUsd === undefined ? NO_VALUE : formatUsd(route.bridgeFeeUsd)
      },
      { label: t`Network fee`, value: networkFee }
    ],
    unavailable: unavailable !== undefined
  };
}
