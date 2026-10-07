import { useQuery } from '@tanstack/react-query';
import { useConnection } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { getAuthUrl, shouldSkipAuthChecks } from '@/lib/authCheck';
import {
  addressScreeningQueryKey,
  enhancedAddressScreeningQueryKey,
  fetchAddressScreening,
  fetchEnhancedAddressScreening,
  requiresEnhancedScreening,
  SCREENING_MAX_AGE_MS
} from '@/hooks';
import type { PreflightHook, TransactionPreflight } from '@/modules/ui/context/preTransactionGate';

const CLEAR: TransactionPreflight = { kind: 'clear' };
const PENDING: TransactionPreflight = { kind: 'pending' };

/**
 * The modal-side address screening for a transaction: the standard check, or
 * the enhanced one for $250k+ transactions (APP-517). Watches the active
 * session's live USD value; WHILE the flow is actionable — its own confirm
 * gating (balance, quote, resolved claim set) would let the user proceed — it
 * fetches the verdict of the tier that value calls for (at/above the
 * threshold, or unknown: enhanced; below: standard), so by the time the user
 * reaches the screen whose Confirm fires the transaction, the verdict is
 * usually already in. A user merely playing with the amount input never
 * triggers a call, and a verdict is fetched once per address and tier per
 * `SCREENING_MAX_AGE_MS` however much the amount moves. The result gates the
 * modal's transaction-firing CTAs and, on a failure, supplies the message
 * rendered above them.
 *
 * Nothing screens on connect (a wallet that has accepted the terms is first
 * screened here), so this is what keeps the check off the Confirm click.
 * Each tier shares its query (key + staleness) with the gate's enforcement
 * path in `useTermsSignatureGate` — and the standard one with ConnectedContext
 * — so a verdict warmed here lets the gate pass synchronously at Confirm, and
 * a verdict the gate finds flips this hook through the same cache. The tiers
 * never satisfy each other: they run different risk policies.
 *
 * Fail closed: an errored check blocks, and keeps retrying on a 60s interval
 * so a transient outage recovers without the user relaunching the flow. A
 * RISKY enhanced verdict re-polls on a 5-minute cadence (false positives are
 * expected most on that tier and the backend ships an admin purge for them,
 * api-workers #114); a risky standard verdict is re-polled by ConnectedContext's
 * query, which also puts the app-level blocked dialog up over the modal.
 */
export const useScreeningPreflight: PreflightHook = ({ usdValue, active, actionable }) => {
  const { address } = useConnection();
  const armed = active && actionable && !shouldSkipAuthChecks() && !!address;
  const enhanced = requiresEnhancedScreening(usdValue);

  // Both queries are declared on every render (hooks can't be conditional);
  // only the tier the value calls for is enabled.
  const enhancedQuery = useQuery({
    queryKey: enhancedAddressScreeningQueryKey(address),
    // `armed` (in the enabled flag) guarantees the address; the fetcher
    // demands one at the type level.
    queryFn: () => fetchEnhancedAddressScreening(address!, getAuthUrl()),
    enabled: armed && enhanced,
    staleTime: SCREENING_MAX_AGE_MS,
    retry: 1,
    refetchInterval: query =>
      query.state.status === 'error'
        ? 60_000
        : query.state.data?.addressAllowed === false
          ? 5 * 60_000
          : false
  });
  const standardQuery = useQuery({
    queryKey: addressScreeningQueryKey(address),
    queryFn: () => fetchAddressScreening(address, getAuthUrl()),
    enabled: armed && !enhanced,
    staleTime: SCREENING_MAX_AGE_MS,
    retry: 1,
    refetchInterval: query => (query.state.status === 'error' ? 60_000 : false)
  });

  if (!armed) return CLEAR;
  const { data, isError } = enhanced ? enhancedQuery : standardQuery;
  if (isError) {
    return {
      kind: 'blocked',
      message: enhanced ? (
        <Trans>
          We couldn&apos;t run the additional verification required for transactions of this size, so it
          can&apos;t be submitted right now. This is usually temporary — please try again in a few minutes.
        </Trans>
      ) : (
        <Trans>
          We couldn&apos;t run the checks required before a transaction can start, so it can&apos;t be
          submitted right now. This is usually temporary — please try again in a few minutes.
        </Trans>
      )
    };
  }
  if (data === undefined) return PENDING;
  if (!data.addressAllowed) {
    return {
      kind: 'blocked',
      message: enhanced ? (
        <Trans>
          This wallet didn&apos;t pass the additional verification required for transactions of this size, so
          the transaction can&apos;t be completed.
        </Trans>
      ) : (
        <Trans>
          This wallet didn&apos;t pass the checks required to transact, so the transaction can&apos;t be
          completed.
        </Trans>
      )
    };
  }
  return CLEAR;
};
