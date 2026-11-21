import { formatUnits } from 'viem';
import { getSupportedNumberLocale } from '@/utils/localization';
import { math } from '@/utils';
import { cctpBurnAmount } from '../adapters/cctp/calls';
import type { BridgeRouteKind } from './types';
import { USDS_DECIMALS } from './usds';

/** What a route moves of `amount`: CCTP burns whole USDC units, and the USDS below one stays in the wallet. */
export const bridgedAmount = (amount: bigint, routeKind: BridgeRouteKind | undefined): bigint =>
  routeKind === 'cctp' ? math.convertUSDCtoWad(cctpBurnAmount(amount)) : amount;

/** A USDS amount with every decimal it has and at least two, never rounded. */
export const formatExactUsds = (amount: bigint): string =>
  new Intl.NumberFormat(getSupportedNumberLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: USDS_DECIMALS
  }).format(formatUnits(amount, USDS_DECIMALS) as `${number}`);
