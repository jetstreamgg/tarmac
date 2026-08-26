import { useCallback, useMemo, useState } from 'react';
import { formatUnits, parseUnits } from 'viem';
import { useChainId, useConnection } from 'wagmi';
import { useTokenBalance } from '@/hooks';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { normalizeDecimalSeparator } from '@/lib/amountInput';
import {
  getPsmConversionTokens,
  getPsmDecimalsForDirection,
  getPsmTargetAmount,
  getValidatedPsmExternalAmount,
  type PsmConversionDirection
} from './usePsmConversion.helpers';
import type { ConvertTokenSymbol } from '../components/ConvertTokenSelect';

const OPPOSITE: Record<PsmConversionDirection, PsmConversionDirection> = {
  USDC_TO_USDS: 'USDS_TO_USDC',
  USDS_TO_USDC: 'USDC_TO_USDS'
};

const directionForSourceSymbol = (symbol: string | null): PsmConversionDirection | undefined =>
  symbol?.toUpperCase() === 'USDC'
    ? 'USDC_TO_USDS'
    : symbol?.toUpperCase() === 'USDS'
      ? 'USDS_TO_USDC'
      : undefined;

const originSymbolFor = (direction: PsmConversionDirection): ConvertTokenSymbol =>
  direction === 'USDC_TO_USDS' ? 'USDC' : 'USDS';

/** Trims a decimal string's fraction so it parses at the given token decimals. */
const clampFraction = (value: string, decimals: number) => {
  const [whole, fraction] = value.split('.');
  if (fraction === undefined || fraction.length <= decimals) return value;
  return decimals === 0 ? whole : `${whole}.${fraction.slice(0, decimals)}`;
};

/**
 * Form model for the Convert page (Figma 486:31193): direction + typed amount +
 * balances + validation. Presentation-free — `ConvertCard` renders it and
 * `useConvertLaunch` executes it.
 *
 * The URL is the source of truth for the direction: it is *derived* from the
 * legacy `?source_token=` param every render (default USDS → USDC per the Figma
 * default frame), and flips only write the param. Deep links, back/forward and
 * in-page flips therefore can never disagree with the form. The typed amount is
 * kept raw and clamped to the active origin's decimals at read time, so a
 * direction change (whichever way it arrives) needs no state surgery.
 *
 * All decimal handling defers to the PSM helpers (6↔18 scaling parity with the
 * engine): input strings are validated by `getValidatedPsmExternalAmount` and the
 * derived target amount comes from `getPsmTargetAmount` — the same function the
 * engine uses for calldata, so the "To" figure can never drift from execution.
 */
export function useConvertForm() {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();
  const [searchParams, setSearchParams] = useAppSearchParams();

  const direction = directionForSourceSymbol(searchParams.get(QueryParams.SourceToken)) ?? 'USDS_TO_USDC';
  const [rawValue, setRawValue] = useState('');

  const originDecimals = getPsmDecimalsForDirection(direction);
  const targetDecimals = getPsmDecimalsForDirection(OPPOSITE[direction]);
  // The typed string re-clamped to the active origin's decimals (USDS 18 → USDC 6);
  // everything below (display, parsing, validation) reads this, never rawValue.
  const value = rawValue === '' ? rawValue : clampFraction(rawValue, originDecimals);
  const { originToken, targetToken } = useMemo(
    () => getPsmConversionTokens(chainId, direction),
    [chainId, direction]
  );

  const { data: originBalance, refetch: mutateOriginBalance } = useTokenBalance({
    chainId,
    address,
    token: originToken?.address
  });
  const { data: targetBalance, refetch: mutateTargetBalance } = useTokenBalance({
    chainId,
    address,
    token: targetToken?.address
  });

  const amount = useMemo(() => {
    if (value === '') return 0n;
    try {
      return parseUnits(value, originDecimals);
    } catch {
      return 0n;
    }
  }, [value, originDecimals]);

  const targetAmount = useMemo(() => getPsmTargetAmount(direction, amount), [direction, amount]);

  const onInput = useCallback(
    (raw: string) => {
      // iOS's numeric keypad offers a single decimal key labelled from the
      // system locale, so under most European locales a comma is the only
      // separator typeable — read it as the decimal point the validator (and
      // every `?amount=` deep link) works in (APP-518).
      const typed = normalizeDecimalSeparator(raw);
      // A bare '.' is that key's first tap: the validator rejects it (it is not
      // an amount yet) but the field has to show it, or the next digit lands as
      // a whole unit — ',5' typed as 0.5 arriving as 5. It parses to 0n below.
      if (typed === '' || typed === '.' || getValidatedPsmExternalAmount(typed, direction) !== undefined) {
        setRawValue(typed);
      }
    },
    [direction]
  );

  // Flips only write the URL; the derived `direction` follows on the next render.
  const applyDirection = useCallback(
    (next: PsmConversionDirection) => {
      if (next === direction) return;
      setSearchParams(
        params => {
          params.set(QueryParams.SourceToken, originSymbolFor(next));
          return params;
        },
        { replace: true }
      );
    },
    [direction, setSearchParams]
  );

  const flip = useCallback(() => applyDirection(OPPOSITE[direction]), [applyDirection, direction]);

  /** Token chip selection: picking the opposite side's token flips the direction. */
  const selectToken = useCallback(
    (side: 'from' | 'to', symbol: ConvertTokenSymbol) => {
      const nextDirection =
        side === 'from'
          ? symbol === 'USDC'
            ? 'USDC_TO_USDS'
            : 'USDS_TO_USDC'
          : symbol === 'USDC'
            ? 'USDS_TO_USDC'
            : 'USDC_TO_USDS';
      applyDirection(nextDirection);
    },
    [applyDirection]
  );

  const setPercent = useCallback(
    (percent: number) => {
      const balance = originBalance?.value;
      if (balance === undefined) return;
      setRawValue(formatUnits((balance * BigInt(percent)) / 100n, originDecimals));
    },
    [originBalance?.value, originDecimals]
  );

  const mutateBalances = useCallback(() => {
    mutateOriginBalance();
    mutateTargetBalance();
  }, [mutateOriginBalance, mutateTargetBalance]);

  const reset = useCallback(() => setRawValue(''), []);

  const isZero = amount === 0n;
  const insufficient = isConnected && !isZero && originBalance !== undefined && amount > originBalance.value;

  return {
    direction,
    originSymbol: originSymbolFor(direction),
    targetSymbol: originSymbolFor(OPPOSITE[direction]),
    value,
    targetValue: value === '' ? '' : formatUnits(targetAmount, targetDecimals),
    amount,
    targetAmount,
    originDecimals,
    targetDecimals,
    originBalance: originBalance?.value,
    targetBalance: targetBalance?.value,
    isConnected,
    isZero,
    insufficient,
    onInput,
    flip,
    selectToken,
    setPercent,
    mutateBalances,
    reset
  };
}
