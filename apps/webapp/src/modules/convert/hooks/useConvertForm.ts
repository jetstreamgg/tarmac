import { useCallback, useMemo, useState } from 'react';
import { formatUnits, parseUnits } from 'viem';
import { useChainId, useConnection } from 'wagmi';
import { useTokenBalance } from '@/hooks';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
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
 * `useConvertLaunch` executes it. The initial direction honours the legacy
 * `?source_token=` deep-link param (kept in sync on flip); the default is
 * USDS → USDC per the Figma default frame.
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

  const [direction, setDirection] = useState<PsmConversionDirection>(
    () => directionForSourceSymbol(searchParams.get(QueryParams.SourceToken)) ?? 'USDS_TO_USDC'
  );
  const [value, setValue] = useState('');

  const originDecimals = getPsmDecimalsForDirection(direction);
  const targetDecimals = getPsmDecimalsForDirection(OPPOSITE[direction]);
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
      if (raw === '' || getValidatedPsmExternalAmount(raw, direction) !== undefined) {
        setValue(raw);
      }
    },
    [direction]
  );

  const applyDirection = useCallback(
    (next: PsmConversionDirection) => {
      if (next === direction) return;
      setDirection(next);
      // Re-clamp the typed amount to the new origin's decimals (USDS 18 → USDC 6).
      setValue(v => (v === '' ? v : clampFraction(v, getPsmDecimalsForDirection(next))));
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
      setValue(formatUnits((balance * BigInt(percent)) / 100n, originDecimals));
    },
    [originBalance?.value, originDecimals]
  );

  const mutateBalances = useCallback(() => {
    mutateOriginBalance();
    mutateTargetBalance();
  }, [mutateOriginBalance, mutateTargetBalance]);

  const reset = useCallback(() => setValue(''), []);

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
