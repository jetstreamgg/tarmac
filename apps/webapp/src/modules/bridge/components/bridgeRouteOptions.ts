/**
 * Pure builders for the "Select bridge type" cards (Figma 50 and 60): one card
 * per route the user can pick, greyed with its reason when it can't carry the
 * bridge now.
 */

import { t } from '@lingui/core/macro';
import { NO_VALUE } from '@/lib/constants';
import { formatUsd } from '@/utils';
import { getBridgeNetwork } from '../model/networks';
import type { BridgeBlockReason, BridgeRouteOption } from '../model/resolveRoute';
import type { BridgeRoute, BridgeRouteKind } from '../model/types';
import { bridgeTypeLabel, bridgeTypeLogo, formatEta, formatEtaWords } from './bridgeModalRows';
import type { BridgeTypeLogoKind } from '@/components/product/BridgeTypeLogo';

export type RouteOptionCard = {
  kind: BridgeRouteKind;
  name: string;
  logo?: BridgeTypeLogoKind;
  badge: { text: string; tone: 'accent' | 'muted' };
  description: string;
  rows: { label: string; value: string }[];
  etaMinutes: number;
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
    etaMinutes: route.etaMinutes,
    unavailable: unavailable !== undefined
  };
}

/** The toast of a Review that opens on SkyLink because CCTP can't carry the bridge (Figma 61). */
export function routeFallbackNotice(route: BridgeRoute): { title: string; description: string } | undefined {
  const reason = route.fallbackReason;
  if (!reason) return undefined;
  const network = getBridgeNetwork(route.steps[0].network).name;
  const eta = formatEtaWords(route.etaMinutes);
  if (reason === 'facts-error')
    return {
      title: t`CCTP route unavailable`,
      description: t`We couldn't check CCTP right now. We switched you to SkyLink, which takes about ${eta}.`
    };
  const why =
    reason === 'no-liquidity'
      ? t`Not enough USDC liquidity on ${network} for CCTP.`
      : reason === 'closed'
        ? t`CCTP is closed on ${network} right now.`
        : t`This amount is above CCTP's limit on ${network}.`;
  const switched = t`We switched you to SkyLink, which takes about ${eta}. Confirm to continue or try again later.`;
  return { title: t`CCTP route unavailable`, description: `${why} ${switched}` };
}
