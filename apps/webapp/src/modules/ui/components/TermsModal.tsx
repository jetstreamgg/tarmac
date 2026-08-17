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

const TERMS_OF_USE_URL = 'https://docs.sky.money/legal-terms';
const PRIVACY_POLICY_URL = 'https://docs.sky.money/legal-terms#privacy-policy';
const USER_RISK_DOCS_URL = 'https://docs.sky.money/user-risks';

// Inline prose link — links must be visibly distinguished from body text
// (APP-500 AC), and fg-brand is the comp's link color (Figma 1868:80725).
// ExternalLink's inline-flex wrapper breaks mid-sentence wrapping, so this is
// a plain anchor.
const TermsLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-fgBrand hover:underline">
    {children}
  </a>
);

// The key-points block (copy: FigJam board fsckqhSPJs669Qpwm1W7wt node
// 27:1614 — the board wins over the comp's draft copy; layout: Figma
// 1868:80725). Built per render so the Trans macros re-evaluate on locale
// switches.
const getKeyPoints = (): { title: ReactNode; body: ReactNode }[] => [
  {
    title: <Trans>Your assets stay with you</Trans>,
    body: (
      <Trans>
        We do not take custody of your assets. You transact directly with the protocol through your own
        wallet. Skybase International is not a broker, exchange, adviser, or fiduciary, and owes you no
        fiduciary duties.
      </Trans>
    )
  },
  {
    title: <Trans>Eligibility</Trans>,
    body: (
      <Trans>
        By ticking the box below you confirm that you are not located in a restricted jurisdiction, are not
        subject to sanctions (OFAC, EU, UK or UN lists), and are not acting on behalf of anyone who is.
        Certain features are unavailable in certain jurisdictions, as set out in the Terms.
      </Trans>
    )
  },
  {
    title: <Trans>Disputes are resolved by binding arbitration, not in court</Trans>,
    body: (
      <Trans>
        The Terms include an arbitration agreement and a waiver of class actions and jury trials (Terms,
        Section 5).
      </Trans>
    )
  },
  {
    title: <Trans>Risk</Trans>,
    body: (
      <Trans>
        Interacting with blockchain protocols can result in the loss of your assets. Rates shown are neither
        set nor guaranteed by Skybase International, and may change. Further risks are set out in the Terms
        (Section 3) and in the <TermsLink href={USER_RISK_DOCS_URL}>User Risk Documentation</TermsLink>.
      </Trans>
    )
  },
  {
    title: <Trans>Limited liability</Trans>,
    body: (
      <Trans>
        The Interface is provided &ldquo;as is&rdquo;; Skybase International&apos;s liability is limited as
        set out in the Terms (Section 3).
      </Trans>
    )
  },
  {
    title: <Trans>Third-party integrations</Trans>,
    body: (
      <Trans>
        Some features (including Vaults and fixed-rate products) access third-party protocols such as Morpho
        and Pendle. Skybase International is not the issuer of, and does not assess or endorse, any
        third-party asset or protocol. Your use of those features is also subject to the applicable
        third-party terms and disclaimers referenced in the{' '}
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
    acceptTerms
  } = useConnectedContext();
  const [isChecked, setIsChecked] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
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
      setSubmitStatus('idle');
      setIsChecked(false);
      // Dismissing the modal without accepting must disconnect the wallet, otherwise wagmi stays
      // connected while the terms-gated app UI shows "not connected" (split-brain state).
      if (!isConnectedAndAcceptedTerms) {
        disconnect();
      }
      closeModal();
    }
  };

  const handleReject = () => {
    setIsChecked(false);
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

  const acceptanceContent = (
    <>
      {/* Header — Figma 1868:80729: Label 3 title + Body 7 positioning line,
          DS icon-button close. The comp's back arrow is omitted: this is the
          flow's first screen (TransactionModal draws the same call), and both
          exits — Cancel and dismiss — disconnect (APP-270). */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <ResponsiveModalTitle className="text-fgPrimary font-circle text-lg leading-5.5 font-medium tracking-[-0.36px]">
            <Trans>Terms of Use</Trans>
          </ResponsiveModalTitle>
          <Text tag="p" className="text-fgSecondary text-[11px] leading-4">
            <Trans>
              Sky.money is a non-custodial web interface operated by Skybase International. It provides access
              to the Sky Protocol: open-source smart contracts governed by decentralized Sky governance.
              Skybase International does not hold your assets or execute transactions on your behalf, and does
              not set the Sky Savings Rate.
            </Trans>
          </Text>
        </div>
        <Button
          variant="secondary"
          size="iconM"
          aria-label={t`Close`}
          onClick={() => handleOpenChange(false)}
          data-testid="terms-modal-close"
        >
          <Close className="size-4" />
        </Button>
      </div>

      {/* Key points — scrollable card (Figma 1868:80736). The scroll-to-end
          gate is gone with the embedded document: the full terms are a
          link-out, so only the checkbox gates the button. */}
      <div className="flex min-h-0 flex-col gap-3">
        <Text tag="p" className="text-fgSecondary text-xs leading-[18px]">
          <Trans>
            Key points. Please read the full <TermsLink href={TERMS_OF_USE_URL}>Terms of Use</TermsLink> and{' '}
            <TermsLink href={PRIVACY_POLICY_URL}>Privacy Policy</TermsLink> before continuing:
          </Trans>
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
        <Checkbox id="termsCheckbox" checked={isChecked} onCheckedChange={handleCheckboxChange} />
        <label htmlFor="termsCheckbox" className="text-fgPrimary text-sm leading-5.5">
          <Trans>
            By ticking this box and selecting Agree and continue, I accept the sky.money{' '}
            <TermsLink href={TERMS_OF_USE_URL}>Terms of Use</TermsLink> and{' '}
            <TermsLink href={PRIVACY_POLICY_URL}>Privacy Policy</TermsLink>.
          </Trans>
        </label>
      </div>

      {submitErrorContent}

      <div className="flex flex-col gap-2">
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
        <Button variant="link" size="l" className="w-full" onClick={handleReject}>
          <Trans>Cancel</Trans>
        </Button>
      </div>

      {/* The value is the terms' effective date — the terms carry a date and
          no version number (Kacper with Ann Sofie, 13 Aug 2026 — APP-513),
          and `terms_version.latest_version` holds that date. */}
      {latestTermsVersion && (
        <Text tag="p" className="text-fgTertiary text-center text-[11px] leading-4">
          <Trans>
            Terms of Use effective {latestTermsVersion}. A record of your acceptance, including the version
            accepted, is retained.
          </Trans>
        </Text>
      )}
    </>
  );

  const showCompactState = isCheckingTerms || !!termsCheckError || !!termsCheckDenied;

  return (
    <>
      {triggerButton}
      <ResponsiveModal open={isModalOpen} onOpenChange={handleOpenChange}>
        <ResponsiveModalContent
          aria-describedby={undefined}
          // DS Modal card (Figma 1868:80728): bg-secondary tint at radius-2xl
          // over the frosted scrim, 610px wide — same recipe as TransactionModal.
          className={
            showCompactState
              ? 'bg-bgSecondary flex flex-col p-6 sm:max-w-[300px] sm:min-w-[300px] md:rounded-[28px]'
              : 'bg-bgSecondary flex flex-col gap-6 p-5 sm:max-w-152.5 sm:min-w-152.5 sm:gap-8 sm:p-8 md:rounded-[28px]'
          }
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
