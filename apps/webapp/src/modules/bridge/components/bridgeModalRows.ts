/**
 * Pure cell builders for the "Review USDS bridge" modal grid (Figma 3574:64110):
 * [Bridge type | Bridge rate], [Estimated arrival | Slippage], [Bridge fee | Network fee].
 * Labels and pairing are the Figma contract, asserted in `bridgeModalRows.test.ts`.
 */

import { formatEther } from 'viem';
import { plural, t } from '@lingui/core/macro';
import type { ModalGridCell } from '@/components/product/ModalGridCells';
import { networkFeeCell } from '@/components/product/ModalGridCells';
import type { BridgeTypeLogoKind } from '@/components/product/BridgeTypeLogo';
import { NO_VALUE } from '@/lib/constants';
import { formatUsd } from '@/utils';
import { DAY_MINUTES } from '../model/resolveRoute';
import type { BridgeRoute, BridgeRouteKind } from '../model/types';

// SkyLink (Sky's native bridges), CCTP and LayerZero are names, never translated.
export const bridgeTypeLabel = (kind: BridgeRouteKind): string =>
  kind === 'native' ? 'SkyLink' : kind === 'cctp' ? 'CCTP' : 'LayerZero';

/** The logo drawn before a route's name; LayerZero has none. */
export const bridgeTypeLogo = (kind: BridgeRouteKind): BridgeTypeLogoKind | undefined =>
  kind === 'cctp' ? 'cctp' : kind === 'native' ? 'skylink' : undefined;

/** Whole or one-decimal days, for multi-day withdrawals: 7, 6.4. */
export const toDays = (minutes: number): number => Math.round((minutes / DAY_MINUTES) * 10) / 10;

/** "~3 min", "~1 hr 30 min", "~1 day", "~7 days". */
export const formatEta = (minutes: number): string => {
  if (minutes >= DAY_MINUTES) return plural(toDays(minutes), { one: '~# day', other: '~# days' });
  if (minutes < 60) return t`~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? t`~${hours} hr` : t`~${hours} hr ${rest} min`;
};

/** The same units in words, for prose: "20 minutes", "1 hour 30 minutes", "7 days". */
export const formatEtaWords = (minutes: number): string => {
  if (minutes >= DAY_MINUTES) return plural(toDays(minutes), { one: '# day', other: '# days' });
  if (minutes < 60) return plural(minutes, { one: '# minute', other: '# minutes' });
  const hours = plural(Math.floor(minutes / 60), { one: '# hour', other: '# hours' });
  const rest = minutes % 60;
  if (rest === 0) return hours;
  const restMinutes = plural(rest, { one: '# minute', other: '# minutes' });
  return t`${hours} ${restMinutes}`;
};

export const formatSlippage = (slippage: number): string => `${(slippage * 100).toFixed(2)}%`;

/** Rounds up to `digits` significant digits, so a shown maximum is never below the real one. */
const ceilSignificant = (wei: bigint, digits: number): bigint => {
  const dropped = wei.toString().length - digits;
  if (dropped <= 0) return wei;
  const unit = 10n ** BigInt(dropped);
  return ((wei + unit - 1n) / unit) * unit;
};

/** The most ETH a deposit pays for its L2 delivery, rounded up to two significant digits: "Up to 0.0000048 ETH". */
/** ETH rounded up to two significant digits, so it never reads less than `wei`. */
export const formatEthCeil = (wei: bigint): string =>
  Number(formatEther(ceilSignificant(wei, 2))).toLocaleString('en-US', { maximumSignificantDigits: 2 });

export const formatMaxEthFee = (wei: bigint): string => {
  const eth = formatEthCeil(wei);
  return t`Up to ${eth} ETH`;
};

export function buildBridgeModalRows({
  route,
  networkFee,
  bridgeFee,
  fromToken = 'USDS'
}: {
  route: BridgeRoute;
  networkFee: string;
  /** Overrides the route's USD fee, for a route that charges it in ETH. */
  bridgeFee?: string;
  /** The token sent, rated against the USDS delivered. */
  fromToken?: 'USDS' | 'USDC';
}): ModalGridCell[][] {
  const logo = bridgeTypeLogo(route.kind);
  return [
    [
      {
        kind: 'single',
        label: t`Bridge type`,
        value: bridgeTypeLabel(route.kind),
        ...(logo && { logo })
      },
      {
        kind: 'pair',
        label: t`Bridge rate`,
        token: fromToken,
        left: '1.00',
        right: '1.00',
        rightToken: 'USDS'
      }
    ],
    [
      { kind: 'single', label: t`Estimated arrival`, value: formatEta(route.etaMinutes) },
      { kind: 'single', label: t`Slippage`, value: formatSlippage(route.slippage) }
    ],
    [
      {
        kind: 'single',
        label: t`Bridge fee`,
        value: bridgeFee ?? (route.bridgeFeeUsd === undefined ? NO_VALUE : formatUsd(route.bridgeFeeUsd))
      },
      networkFeeCell(networkFee)
    ]
  ];
}

export const bridgeFootnote = (route: BridgeRoute): string => {
  const eta = formatEtaWords(route.etaMinutes);
  const actions = route.kind === 'native' ? route.steps.map(step => step.action) : [];
  if (actions.includes('prove'))
    return t`The withdrawal takes about ${eta}. You will need to come back to Ethereum twice: to prove it, usually within an hour or two, and to finalize it once the waiting period ends. Both steps need ETH on Ethereum for gas.`;
  if (actions.includes('finalize'))
    return t`The withdrawal takes about ${eta}. Once it's ready, finalize it on Ethereum to receive your USDS. This step needs ETH on Ethereum for gas.`;
  return route.requiresClaim
    ? t`The transaction will be processed on the blockchain and is expected to complete within approximately ${eta}. You will need to claim your asset manually afterward.`
    : t`The transaction will be processed on the blockchain and is expected to complete within approximately ${eta}. Your funds will arrive automatically.`;
};
