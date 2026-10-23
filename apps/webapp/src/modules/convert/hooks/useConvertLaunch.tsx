import { useCallback, useId } from 'react';
import { useChainId } from 'wagmi';
import { REFERRAL_CODE } from '@/lib/constants';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useMinimizedSessionLock } from '@/modules/ui/hooks/useMinimizedSessionLock';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { usePsmConversion, type UsePsmConversionResult } from './usePsmConversion';
import type { PsmConversionDirection } from './usePsmConversion.helpers';
import { ConvertFlow } from '../components/ConvertFlow';

export interface UseConvertLaunchParams {
  direction: PsmConversionDirection;
  /** Exact-in amount at the origin token's decimals (USDC 6 / USDS 18). */
  amount: bigint;
  /** Refetch balances / reset the form after a successful conversion. */
  onSuccess?: () => void;
  /**
   * Form validity (amount entered, within balance, any product gate open). Gates the
   * engine's prepare-time simulation: an input the form already knows is invalid is
   * never simulated, so no RPC round trip and no Sentry event for a foregone revert.
   */
  enabled?: boolean;
}

export interface UseConvertLaunchResult {
  /** Opens the "Review conversion" modal for the current direction + amount. */
  launch: () => void;
  /** The PSM engine's state for the page — guards, amounts, tokens. Never executed here. */
  conversion: UsePsmConversionResult;
  /** The form must not be edited: this flow's session is minimized (see useMinimizedSessionLock). */
  locked: boolean;
  /** Brings the minimized modal back. */
  restore: () => void;
}

/**
 * The Convert page's side of the review flow. The page reads the PSM engine for
 * its own guards and CTA (and warms the simulation the review then shares); the
 * review mounts its own engine in the session (`ConvertFlow`), with the amount and
 * direction it was opened at.
 */
export function useConvertLaunch({
  direction,
  amount,
  onSuccess,
  enabled = true
}: UseConvertLaunchParams): UseConvertLaunchResult {
  const { launch: launchModal } = useTransaction();
  const sessionId = useId();
  const chainId = useChainId();
  const [batchEnabled] = useBatchToggle();

  const conversion = usePsmConversion({
    direction,
    amount,
    enabled,
    referralCode: REFERRAL_CODE,
    shouldUseBatch: !!batchEnabled
  });
  const { locked, restore } = useMinimizedSessionLock(sessionId);

  const launch = useCallback(
    () =>
      launchModal({
        sessionId,
        // Convert runs on several chains, but THIS review was priced for the launch
        // chain: a wallet-side switch mid-review shows the guard (APP-563 #4) rather
        // than letting a Confirm fire the old figures on the new chain.
        supportedChainIds: [chainId],
        chainGuardReason: 'launch-chain',
        flow: <ConvertFlow direction={direction} amount={amount} onSuccess={onSuccess} />
      }),
    [launchModal, sessionId, chainId, direction, amount, onSuccess]
  );

  return { launch, conversion, locked, restore };
}
