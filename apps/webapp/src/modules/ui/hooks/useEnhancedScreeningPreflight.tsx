import { useQuery } from '@tanstack/react-query';
import { useConnection } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { getAuthUrl, shouldSkipAuthChecks } from '@/lib/authCheck';
import {
  enhancedAddressScreeningQueryKey,
  fetchEnhancedAddressScreening,
  requiresEnhancedScreening
} from '@/hooks';
import type { PreflightHook, TransactionPreflight } from '@/modules/ui/context/preTransactionGate';
import { SCREENING_MAX_AGE_MS } from './useTermsSignatureGate';

const CLEAR: TransactionPreflight = { kind: 'clear' };
const PENDING: TransactionPreflight = { kind: 'pending' };

/**
 * The modal-side enhanced-screening check for $250k+ transactions (APP-517).
 * Watches the active session's live USD value; once it crosses the threshold
 * (or is unknown), fetches the enhanced verdict for the connected address —
 * so by the time the user reaches the screen whose Confirm fires the
 * transaction, the verdict is usually already in. The result gates the
 * modal's transaction-firing CTAs and, on a failure, supplies the message
 * rendered above them.
 *
 * Shares its query (key + staleness) with the gate's enforcement path in
 * `useTermsSignatureGate`, so a verdict warmed here lets the gate pass
 * synchronously at Confirm — and a risky verdict found by the gate flips this
 * hook's blocked state through the same cache. Deliberately a different key
 * from the standard screening: a standard "clean" can never satisfy the
 * enhanced path.
 *
 * Fail closed: an errored check blocks. The query keeps retrying on a
 * 60s interval (matching the connect-time screening cadence) so a transient
 * outage recovers without the user having to relaunch the flow.
 */
export const useEnhancedScreeningPreflight: PreflightHook = ({ usdValue, active }) => {
  const { address } = useConnection();
  const required = active && !shouldSkipAuthChecks() && !!address && requiresEnhancedScreening(usdValue);

  const { data, isError } = useQuery({
    queryKey: enhancedAddressScreeningQueryKey(address),
    queryFn: () => fetchEnhancedAddressScreening(address, getAuthUrl()),
    enabled: required,
    staleTime: SCREENING_MAX_AGE_MS,
    retry: 1,
    refetchInterval: query => (query.state.status === 'error' ? 60_000 : false)
  });

  if (!required) return CLEAR;
  if (isError) {
    return {
      kind: 'blocked',
      message: (
        <Trans>
          We couldn&apos;t run the additional verification required for transactions of this size, so it
          can&apos;t be submitted right now. This is usually temporary — please try again in a few minutes.
        </Trans>
      )
    };
  }
  if (data === undefined) return PENDING;
  if (!data.addressAllowed) {
    return {
      kind: 'blocked',
      message: (
        <Trans>
          This wallet didn&apos;t pass the additional verification required for transactions of this size, so
          the transaction can&apos;t be completed.
        </Trans>
      )
    };
  }
  return CLEAR;
};
