import { ReactNode, useState } from 'react';
import { useTermsModal } from '../context/TermsModalContext';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle
} from '@/components/ui/responsive-modal';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useDisconnect } from 'wagmi';
import { useConnectedContext } from '../context/ConnectedContext';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckedState } from '@radix-ui/react-checkbox';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { Close } from '@/modules/icons';
import { LoadingSpinner } from './LoadingSpinner';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from '@/lib/constants';
import { setDisconnectSource } from '@/modules/analytics/lib/disconnectSource';
import { cn } from '@/lib/cn';

const USER_RISK_DOCS_URL = 'https://docs.sky.money/user-risks';

// Inline prose link — links must be visibly distinguished from body text
// (APP-500 AC), and fg-brand is the comp's link color (Figma 1868:80725).
// ExternalLink's inline-flex wrapper breaks mid-sentence wrapping, so this is
// a plain anchor. Also used by the transaction signature step's helper copy
// (APP-501), which carries the same two links.
export const TermsLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-fgBrand hover:underline">
    {children}
  </a>
);

// The key-points block (copy AND layout: Figma 1868:80727/1868:80765 — the
// comps were realigned 18 Aug 2026 and now supersede the FigJam board text
// C4 first shipped). The bracketed [LINK] placeholders in the comp resolve to
// the existing docs URLs. Built per render so the Trans macros re-evaluate on
// locale switches.
const getKeyPoints = (): { title: ReactNode; body: ReactNode }[] => [
  {
    title: <Trans>Your assets stay with you</Trans>,
    body: (
      <Trans>
        We never take custody or control of your assets. You transact directly with the protocol through your
        own wallet. Skybase International is not a broker, exchange, adviser, or fiduciary.
      </Trans>
    )
  },
  {
    title: <Trans>Eligibility</Trans>,
    body: (
      <Trans>
        By continuing, you confirm that you are not located in a restricted jurisdiction, are not subject to
        sanctions (OFAC, EU, UK or UN lists), and are not acting on behalf of anyone who is. Certain features
        are unavailable in certain jurisdictions.
      </Trans>
    )
  },
  {
    title: <Trans>Disputes are resolved by binding arbitration, not in court</Trans>,
    body: (
      <Trans>
        The Terms include an arbitration agreement and a waiver of class actions and jury trials (Terms,
        Section 5)
      </Trans>
    )
  },
  {
    title: <Trans>Risk</Trans>,
    body: (
      <Trans>
        Interacting with blockchain protocols can result in the loss of your assets. Rates shown are variable,
        set by Sky governance, and not guaranteed by Skybase International. See the{' '}
        <TermsLink href={USER_RISK_DOCS_URL}>User Risk Documentation</TermsLink>.
      </Trans>
    )
  },
  {
    title: <Trans>Limited liability</Trans>,
    body: (
      <Trans>
        The Interface is provided &ldquo;as is&rdquo;; Skybase International&apos;s liability is limited as
        set out in the Terms (Section 3)
      </Trans>
    )
  },
  {
    title: <Trans>Third-party integrations</Trans>,
    body: (
      <Trans>
        Some features (including Vaults) access third-party protocols such as Morpho and Pendle; your use of
        those features is also subject to the applicable third-party terms and disclaimers referenced in the{' '}
        <TermsLink href={TERMS_OF_USE_URL}>Terms of Use</TermsLink>.
      </Trans>
    )
  }
];

export function TermsModal() {
  const { closeModal, isModalOpen, openModal } = useTermsModal();
  const {
    isCheckingTerms,
    termsCheckError,
    termsCheckDenied,
    retryTermsCheck,
    isConnectedAndAcceptedTerms,
    latestTermsVersion,
    termsEffectiveDate,
    acceptTerms
  } = useConnectedContext();
  const [isChecked, setIsChecked] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const isSubmitting = submitStatus === 'submitting';
  const { disconnect } = useDisconnect();

  // Phase A is checkbox-only (APP-424). The wallet signature that used to fire
  // here is what blocked hardware-wallet and multisig users from browsing at
  // all; it moves to the per-transaction step for US/VPN users (C6).
  const handleAgree = async () => {
    setSubmitStatus('submitting');
    const accepted = await acceptTerms();
    if (accepted) {
      setSubmitStatus('idle');
      closeModal();
    } else {
      setSubmitStatus('error');
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // No exits while the acceptance POST is in flight: the record would land
      // server-side for a wallet the dismissal just disconnected.
      if (isSubmitting) return;
      setSubmitStatus('idle');
      setIsChecked(false);
      // Dismissing the modal without accepting must disconnect the wallet, otherwise wagmi stays
      // connected while the terms-gated app UI shows "not connected" (split-brain state).
      if (!isConnectedAndAcceptedTerms) {
        setDisconnectSource('terms_dismissed');
        disconnect();
      }
      closeModal();
    }
  };

  const handleReject = () => {
    // closeModal() flips the controlled prop, so onOpenChange (and its reset)
    // never fires for this path — a stale error banner would otherwise greet
    // the next auto-open, since the component stays mounted across reconnects.
    setSubmitStatus('idle');
    setIsChecked(false);
    setDisconnectSource('terms_declined');
    disconnect();
    closeModal();
  };

  const handleCheckboxChange = (checkedState: CheckedState) => {
    setIsChecked(checkedState === true);
  };

  const submitErrorContent = submitStatus === 'error' && (
    <Text className="text-error text-center text-sm leading-none md:leading-tight">
      <Trans>
        An error occurred while recording your acceptance. Please check your connection and try again. If the
        issue persists, reach out for assistance in the official{' '}
        <ExternalLink
          className="text-textEmphasis hover:underline"
          href="https://discord.gg/skyecosystem"
          showIcon={true}
          iconSize={12}
          iconClassName="ml-1"
          iconColor="var(--primary-pink)"
        >
          Sky Discord
        </ExternalLink>
      </Trans>
    </Text>
  );

  // Renders in the navbar wallet slot, so it wears the same DS connect recipe
  // as WalletChip (Figma 5069:27086): primary button at navbar height.
  const triggerButton = (
    <Button variant="primary" size="m" onClick={termsCheckError ? retryTermsCheck : openModal}>
      <Trans>Connect Wallet</Trans>
    </Button>
  );

  const checkingContent = (
    <div className="flex items-center justify-center gap-2 p-4">
      <ResponsiveModalTitle asChild>
        <Text className="text-text text-center">
          <Trans>Please wait...</Trans>
        </Text>
      </ResponsiveModalTitle>
      <LoadingSpinner />
    </div>
  );

  const termsCheckErrorContent = (
    <div className="flex flex-col items-center gap-4 p-4">
      <ResponsiveModalTitle asChild>
        <Text className="text-text text-center">
          <Trans>Something went wrong</Trans>
        </Text>
      </ResponsiveModalTitle>
      <Text className="text-error text-center text-sm leading-none md:leading-tight">
        <Trans>
          We couldn&apos;t verify your terms acceptance. Please check your connection and try again.
        </Trans>
      </Text>
      <Button variant="primary" size="l" onClick={retryTermsCheck}>
        <Trans>Retry</Trans>
      </Button>
      <Button variant="link" size="l" onClick={handleReject}>
        <Trans>Disconnect Wallet</Trans>
      </Button>
    </div>
  );

  // The worker's /check refused this address (403) after the client-side
  // screening let it through. A dead end with a way out — not the interactive
  // terms, whose accept would loop on a misleading connection error, and not
  // the error screen, whose retry can never change a deliberate refusal.
  const termsCheckDeniedContent = (
    <div className="flex flex-col items-center gap-4 p-4">
      <ResponsiveModalTitle asChild>
        <Text className="text-text text-center">
          <Trans>Access restricted</Trans>
        </Text>
      </ResponsiveModalTitle>
      <Text className="text-textSecondary text-center text-sm leading-none md:leading-tight">
        <Trans>This wallet can&apos;t be used with Sky.money from your current location.</Trans>
      </Text>
      <Button variant="link" size="l" onClick={handleReject}>
        <Trans>Disconnect Wallet</Trans>
      </Button>
    </div>
  );

  // The version + effective-date sentence rides the header subtitle (comp
  // 2009:54582). The comp's "Version 1.0" is live copy again: the terms carry
  // BOTH a numeric version and an effective date, which reverses the earlier
  // "date only" decision on APP-513. The worker serves the two separately —
  // `latestTermsVersion` is the identity, `termsEffectiveDate` is display.
  //
  // Three cases, because the version and the date arrive independently. The
  // version is what the user is actually agreeing to — the acceptance is
  // recorded against it — so it stays on screen even when the date does not
  // arrive (a worker predating the split sends no `effectiveDate`). Only the
  // date is dropped in that case; rendering "effective undefined" would be
  // worse than saying nothing, but so would naming no version at all.
  const readTheFullTerms = (
    <Trans>
      Please read the full <TermsLink href={TERMS_OF_USE_URL}>Terms of Use</TermsLink> and{' '}
      <TermsLink href={PRIVACY_POLICY_URL}>Privacy Policy</TermsLink> before continuing.
    </Trans>
  );

  const acceptanceContent = (
    <>
      {/* Header — Figma 1868:80729 (realigned comps 1868:80727/80765): Label 3
          title + Body 7 effective-date line with the document links, DS
          secondary icon-button close. The comp's back arrow is omitted (user
          decision, 18 Aug 2026): this is the flow's first screen, and the only
          dismissal is the X, which disconnects (APP-270). */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <ResponsiveModalTitle className="text-fgPrimary font-circle text-lg leading-5.5 font-medium tracking-[-0.36px]">
            <Trans>Terms & Privacy</Trans>
          </ResponsiveModalTitle>
          <Text tag="p" className="text-fgSecondary max-w-[368px] text-[11px] leading-4">
            {latestTermsVersion && termsEffectiveDate ? (
              <>
                <Trans>
                  Version {latestTermsVersion}, effective {termsEffectiveDate}.
                </Trans>{' '}
                {readTheFullTerms}
              </>
            ) : latestTermsVersion ? (
              <>
                <Trans>Version {latestTermsVersion}.</Trans> {readTheFullTerms}
              </>
            ) : (
              readTheFullTerms
            )}
          </Text>
        </div>
        <Button
          variant="secondary"
          size="iconM"
          aria-label={t`Close`}
          onClick={() => handleOpenChange(false)}
          disabled={isSubmitting}
          data-testid="terms-modal-close"
        >
          <Close className="size-4" />
        </Button>
      </div>

      {/* Key points — label + scrollable card (comp 2009:54572/54592). The
          scroll-to-end gate is gone with the embedded document: the full terms
          are a link-out, so only the checkbox gates the button. */}
      <div className="flex min-h-0 flex-col gap-3">
        <Text tag="p" className="text-fgSecondary text-xs leading-[18px]">
          <Trans>Key points</Trans>
        </Text>
        <ul className="bg-bgSecondary divide-glassBorder max-h-[40dvh] divide-y overflow-y-auto rounded-3xl px-5 sm:max-h-[417px]">
          {getKeyPoints().map((point, i) => (
            <li key={i} className="flex flex-col gap-3 py-5">
              <Text
                tag="p"
                className="text-fgPrimary font-circle text-sm leading-4 font-medium tracking-[-0.28px]"
              >
                {point.title}
              </Text>
              <Text tag="p" className="text-fgSecondary text-xs leading-[18px]">
                {point.body}
              </Text>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="termsCheckbox"
          checked={isChecked}
          onCheckedChange={handleCheckboxChange}
          disabled={isSubmitting}
        />
        <label htmlFor="termsCheckbox" className="text-fgPrimary text-sm leading-5.5">
          <Trans>
            I have read and agree to the sky.money <TermsLink href={TERMS_OF_USE_URL}>Terms of Use</TermsLink>{' '}
            and <TermsLink href={PRIVACY_POLICY_URL}>Privacy Policy</TermsLink>.
          </Trans>
        </label>
      </div>

      {submitErrorContent}

      {/* Single full-width CTA (comp 1868:80762/80800) — Cancel and the
          retention footer were dropped with the comp realignment (user
          decisions, 18 Aug 2026; the retention sentence is flagged for legal
          on the PR). */}
      <Button
        variant="primary"
        size="xl"
        className="w-full"
        disabled={!isChecked}
        loading={submitStatus === 'submitting'}
        onClick={handleAgree}
      >
        <Trans>Agree and continue</Trans>
      </Button>
    </>
  );

  const showCompactState = isCheckingTerms || !!termsCheckError || !!termsCheckDenied;

  return (
    <>
      {triggerButton}
      <ResponsiveModal open={isModalOpen} onOpenChange={handleOpenChange}>
        <ResponsiveModalContent
          aria-describedby={undefined}
          // This is a gate, not a dismissible panel (APP-534): a click on the
          // scrim would disconnect the wallet, which reads as the app throwing
          // the user out for missing the card. The X and Escape still exit —
          // both deliberate, and both route through `handleOpenChange`.
          onInteractOutside={event => event.preventDefault()}
          // The top of the app's z stack. The default dialog tier (z-50) sits
          // *below* the toast stack (z-[60], deliberately readable over other
          // modals) and below the desktop cookie banner (md:z-[999]), both of
          // which were drawing over the gate. Nothing may overlap this one, so
          // it clears the highest of them; the scrim is lifted with the card
          // because they are portal siblings, not nested.
          overlayClassName="z-[1000]"
          // DS Modal card (Figma 1868:80728): bg-secondary tint at radius-2xl
          // over the frosted scrim, 610px wide — same recipe as TransactionModal.
          className={cn(
            'z-[1000]',
            showCompactState
              ? 'bg-bgSecondary flex flex-col p-6 sm:max-w-[300px] sm:min-w-[300px] md:rounded-[28px]'
              : 'bg-bgSecondary flex flex-col gap-6 p-5 sm:max-w-152.5 sm:min-w-152.5 sm:gap-8 sm:p-8 md:rounded-[28px]'
          )}
          onOpenAutoFocus={e => e.preventDefault()}
          data-testid="terms-modal"
        >
          {isCheckingTerms
            ? checkingContent
            : termsCheckDenied
              ? termsCheckDeniedContent
              : termsCheckError
                ? termsCheckErrorContent
                : acceptanceContent}
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}
