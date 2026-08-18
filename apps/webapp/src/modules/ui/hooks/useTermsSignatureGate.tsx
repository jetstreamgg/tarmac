import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useConnection } from 'wagmi';
import { TriangleAlert } from 'lucide-react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Text } from '@/modules/layout/components/Typography';
import { getAuthUrl, shouldSkipAuthChecks } from '@/lib/authCheck';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '@/lib/constants';
import { addressScreeningQueryKey, fetchAddressScreening, type AddressScreeningResult } from '@/hooks';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { TermsLink } from '@/modules/ui/components/TermsModal';
import type {
  GateControls,
  GateStatusCopy,
  PreTransactionGate
} from '@/modules/ui/context/preTransactionGate';
import type { TransactionStep } from '@/modules/ui/components/transactionStepsModel';

/**
 * How old a screening verdict may be and still clear a transaction without a
 * re-check (APP-501; the edge caches 12h, so this is the tighter bound). In
 * practice the connect-time hook re-polls every 60s while the tab is focused,
 * so the async re-screen only runs when that polling has been failing or
 * paused for four hours straight.
 */
const SCREENING_MAX_AGE_MS = 4 * 60 * 60 * 1000;

/** Built per call: lingui's `t` must run after locale activation, not at module load. */
const termsSignatureStep = (): TransactionStep => ({
  // Label and description per the realigned comp (Figma 1868:80823,
  // 18 Aug 2026) — it supersedes the ticket's briefing text.
  label: t`Sign Terms of Use & Privacy Policy`,
  kind: 'signature',
  description: (
    <Trans>
      Please review and accept the <TermsLink href={TERMS_OF_USE_URL}>Terms of Use</TermsLink> and{' '}
      <TermsLink href={PRIVACY_POLICY_URL}>Privacy Policy</TermsLink> to proceed. We are verifying your
      connection to ensure compliance, including checks for VPN use or location within the US.
    </Trans>
  )
});

/**
 * The real pre-transaction gate (APP-501), filling the APP-496 plumbing. On
 * every Confirm (and retry, and secondary CTA), in order:
 *
 *  1. Address screening — the same query the connect-time check uses, so the
 *     two share one cached verdict per address. Fresh-and-allowed passes
 *     synchronously (preserving the same-tick onConfirm contract); risky
 *     closes the transaction modal and denies, and the app-level blocked
 *     dialog takes over through the shared query cache. A failed re-check
 *     fails closed: the transaction never starts.
 *  2. Location — only US and VPN users owe the per-transaction signature.
 *     Unknown (the /ip/status check unresolved or failed) counts as US/VPN:
 *     requiring a signature we may not have owed beats skipping one we did.
 *  3. Signature — skipped when the DB already holds one for the current terms
 *     version (`hasSignedCurrentTerms`; a version bump re-arms this by
 *     construction). Otherwise the off-chain signature step is mounted ahead
 *     of the flow's own steps and the wallet prompted; only a recorded
 *     signature (or the worker's already-signed no-op) lets the transaction
 *     proceed.
 *
 * A future $250k+ transaction check (board note, TBD) slots into step 1 — it
 * would need the transaction's USD value threaded into the gate context.
 */
export function useTermsSignatureGate(): { gate: PreTransactionGate; screeningDialog: ReactNode } {
  const queryClient = useQueryClient();
  const { address } = useConnection();
  const {
    hasSignedCurrentTerms,
    termsMessageToSign,
    signTerms,
    retryTermsCheck,
    retryAccessChecks,
    isUsUser,
    vpnData
  } = useConnectedContext();

  // Shown when a re-screen failed while a stale cached verdict exists: in that
  // one shape ConnectedContext keeps trusting its cached data (deliberately —
  // a failed background refetch shouldn't lock the app), so no app-level
  // dialog appears and the denial needs its own surface. With no cached
  // verdict at all, the same failure flips the app-level screening-unavailable
  // state through the shared query, and this stays closed. Keyed to the
  // address whose re-screen failed: a switch or disconnect closes it by
  // derivation — wallet A's failure never hangs over wallet B.
  const [screeningUnavailableFor, setScreeningUnavailableFor] = useState<string | null>(null);
  const screeningUnavailableOpen = screeningUnavailableFor !== null && screeningUnavailableFor === address;

  // The gate closure is stable (runGated and the modal callbacks hang off its
  // identity); it reads the render-fresh values through this ref.
  const live = useRef({
    queryClient: undefined as unknown as QueryClient,
    address: undefined as string | undefined,
    hasSignedCurrentTerms: false,
    termsMessageToSign: undefined as string | undefined,
    signTerms: async () => false as boolean,
    retryTermsCheck: () => {},
    isUsUser: undefined as boolean | undefined,
    isConnectedToVpn: undefined as boolean | undefined
  });
  // Synced every render; the gate only runs from user events, which always
  // land after effects.
  useEffect(() => {
    live.current = {
      queryClient,
      address,
      hasSignedCurrentTerms,
      termsMessageToSign,
      signTerms,
      retryTermsCheck,
      isUsUser,
      isConnectedToVpn: vpnData.isConnectedToVpn
    };
  });

  const gate = useMemo<PreTransactionGate>(() => {
    // Gate-owned copy per phase (MED: the flow's copy narrates on-chain
    // writes, which is wrong while only an HTTP check or an off-chain
    // signature is running). Built per call — lingui `t` must run after
    // locale activation.
    const screeningCopy = (): GateStatusCopy => ({
      message: <Trans>Verifying your wallet address…</Trans>,
      subtitle: t`Running a quick check before your transaction starts.`
    });
    const signaturePendingCopy = (): GateStatusCopy => ({
      message: <Trans>Review and sign the Terms of Use confirmation in your wallet.</Trans>,
      subtitle: t`Signature needed to continue.`
    });
    const signatureFailedCopy = (): GateStatusCopy => ({
      message: (
        <Trans>The signature request was declined or could not be completed. Try again to continue.</Trans>
      ),
      subtitle: t`The signature wasn't completed.`
    });

    // Deny after an async phase drove INITIALIZED: hand the status back to
    // IDLE (synchronously, via the ref) BEFORE closing, so handleClose doesn't
    // read INITIALIZED and fire the abandoned-wallet-prompt toast + cancelled
    // analytics for a prompt that never existed.
    const denyAndClose = (controls: GateControls) => {
      controls.setGateStatus('idle');
      controls.closeModal();
      return { allow: false };
    };

    // Steps 2–3, after screening cleared. Synchronous when no signature is
    // owed; `wentAsync` tells us to hand the status back to IDLE first so the
    // engine's onMutate doesn't read the pending INITIALIZED as "a prelude
    // step to advance past". `gatedAddress` is the address screening cleared:
    // if the wallet switched under us at any await point, the run dies —
    // nothing decided for the old address may carry over to the new one.
    const proceedPastScreening = (
      controls: GateControls,
      wentAsync: boolean,
      gatedAddress: string
    ): { allow: boolean } | Promise<{ allow: boolean }> => {
      const s = live.current;
      const clearedOfSignature = s.isUsUser === false && s.isConnectedToVpn === false;
      if (clearedOfSignature || s.hasSignedCurrentTerms) {
        // Also clears a prelude left from an earlier attempt (the signature
        // landed, the transaction then failed): the retry restarts with the
        // flow's own steps and step 0 meaning the first real step again.
        controls.setPreludeSteps(null);
        if (wentAsync) controls.setGateStatus('idle');
        return { allow: true };
      }

      return (async () => {
        controls.setPreludeSteps([termsSignatureStep()]);
        controls.setGateStatus('initialized', signaturePendingCopy());
        if (!s.termsMessageToSign) {
          // The /check response didn't carry the text (or never landed), so
          // nothing verifiable can be signed. Fail the step — and kick the
          // terms check so a retry has a fresh chance at the message.
          s.retryTermsCheck();
          controls.setGateStatus('error', signatureFailedCopy());
          return { allow: false };
        }
        // Last liveness check before the wallet prompt — the one side effect
        // the session-scoped controls cannot absorb once started.
        if (controls.isStale() || live.current.address !== gatedAddress) {
          return { allow: false };
        }
        const signed = await s.signTerms();
        if (controls.isStale() || live.current.address !== gatedAddress) {
          // Session closed or wallet switched while the prompt was up: the
          // controls below would no-op anyway (or belong to a new address's
          // session); just deny silently.
          return { allow: false };
        }
        if (!signed) {
          controls.setGateStatus('error', signatureFailedCopy());
          return { allow: false };
        }
        // Leave INITIALIZED standing: the first onMutate advances currentStep
        // past the signature step (the existing INITIALIZED-advancement rule).
        return { allow: true };
      })();
    };

    return ({ controls }) => {
      if (shouldSkipAuthChecks()) return { allow: true };
      const s = live.current;
      // No connected address: nothing to screen and nothing to sign for. The
      // config's confirm path can't start a write without a wallet anyway.
      if (!s.address) return { allow: true };

      const cached = s.queryClient.getQueryState<AddressScreeningResult>(addressScreeningQueryKey(s.address));
      const hasFreshVerdict =
        cached?.data !== undefined && Date.now() - cached.dataUpdatedAt < SCREENING_MAX_AGE_MS;

      if (hasFreshVerdict) {
        if (!cached!.data!.addressAllowed) {
          // Risky: the transaction must not start, and the app-level blocked
          // dialog (reading this same query through ConnectedContext) is the
          // surface that replaces the modal. Status is still IDLE on this
          // sync path, so a plain close carries no abandoned-prompt side
          // effects.
          controls.closeModal();
          return { allow: false };
        }
        return proceedPastScreening(controls, false, s.address);
      }

      const gatedAddress = s.address;
      const hadStaleVerdict = cached?.data !== undefined;
      return (async () => {
        // The modal is already on its transaction screen; don't leave it on IDLE.
        controls.setGateStatus('initialized', screeningCopy());
        let screening: AddressScreeningResult;
        try {
          screening = await s.queryClient.fetchQuery({
            queryKey: addressScreeningQueryKey(gatedAddress),
            queryFn: () => fetchAddressScreening(gatedAddress, getAuthUrl()),
            staleTime: SCREENING_MAX_AGE_MS,
            retry: 1
          });
        } catch {
          // Fail closed — screening being down never falls through to the
          // transaction (APP-501 AC). No dialog if the session already ended.
          if (controls.isStale()) return { allow: false };
          if (hadStaleVerdict && live.current.address === gatedAddress) {
            setScreeningUnavailableFor(gatedAddress);
          }
          return denyAndClose(controls);
        }
        // The verdict belongs to gatedAddress: if the session ended or the
        // wallet switched during the fetch, nothing below may act on it.
        if (controls.isStale() || live.current.address !== gatedAddress) {
          return { allow: false };
        }
        if (!screening.addressAllowed) {
          return denyAndClose(controls);
        }
        return proceedPastScreening(controls, true, gatedAddress);
      })();
    };
  }, []);

  const handleCheckAgain = useCallback(() => {
    setScreeningUnavailableFor(null);
    retryAccessChecks();
  }, [retryAccessChecks]);

  // Styled on the APP-497 blocked/unavailable states (UnauthorizedPage) —
  // Bartek's real designs for these don't exist yet either.
  const screeningDialog = screeningUnavailableOpen ? (
    <Dialog open onOpenChange={open => !open && setScreeningUnavailableFor(null)}>
      <DialogContent
        aria-describedby={undefined}
        className="bg-containerDark w-full max-w-[500px] gap-8 p-8 sm:min-w-[500px] sm:p-8"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <TriangleAlert className="text-error size-5 shrink-0" />
            <DialogTitle asChild>
              <Text className="text-text font-circle text-xl">
                <Trans>Unable to verify this wallet</Trans>
              </Text>
            </DialogTitle>
          </div>
          <Text className="font-graphik text-textSecondary text-sm">
            <Trans>
              We couldn&apos;t run the checks required before a transaction can start, so it wasn&apos;t
              submitted. This is usually temporary — please try again in a few minutes.
            </Trans>
          </Text>
        </div>
        <div className="flex w-full gap-4">
          <Button
            variant="secondary"
            size="l"
            className="flex-1"
            onClick={() => setScreeningUnavailableFor(null)}
          >
            <Trans>Close</Trans>
          </Button>
          <Button variant="primary" size="l" className="flex-1" onClick={handleCheckAgain}>
            <Trans>Check again</Trans>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  ) : null;

  return { gate, screeningDialog };
}
