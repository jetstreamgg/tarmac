import { useState } from 'react';
import { useTermsModal } from '../context/TermsModalContext';
import { Button } from '@/components/ui/button';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { TermsMarkdownRenderer } from '@/modules/ui/components/markdown/TermsMarkdownRenderer';
import { useDisconnect } from 'wagmi';
import { useConnectedContext } from '../context/ConnectedContext';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckedState } from '@radix-ui/react-checkbox';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { DialogTitle } from '@/components/ui/dialog';
import { TermsDialog } from './TermsDialog';
import { getTermsContent } from './terms-loader';
import { setDisconnectSource } from '@/modules/analytics/lib/disconnectSource';

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
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const { disconnect } = useDisconnect();
  const [termsMarkdown] = useState<string>(getTermsContent());

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
      setHasScrolledToEnd(false);
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
    setIsChecked(false);
    setDisconnectSource('terms_declined');
    disconnect();
    closeModal();
  };

  const handleCheckboxChange = (checkedState: CheckedState) => {
    setIsChecked(checkedState === true);
  };

  const termsContent = <TermsMarkdownRenderer markdown={termsMarkdown} />;

  // Compute button text based on state
  const getButtonText = () => {
    if (submitStatus === 'submitting') return 'Submitting...';
    if (!hasScrolledToEnd) return 'Scroll down ↓';
    if (!isChecked) return 'Check to continue';
    return 'Agree and continue';
  };

  const checkboxContent = (scrolledToEnd: boolean) => {
    // Update local state when scroll status changes
    if (scrolledToEnd !== hasScrolledToEnd) {
      setHasScrolledToEnd(scrolledToEnd);
    }

    return (
      <div className="flex items-center sm:my-4">
        <Checkbox
          id="termsCheckbox"
          disabled={!scrolledToEnd}
          checked={isChecked}
          onCheckedChange={handleCheckboxChange}
          className="mr-2"
        />
        <label htmlFor="termsCheckbox" className="text-text ml-2 text-sm leading-none md:leading-tight">
          {import.meta.env.VITE_TERMS_CHECKBOX_TEXT}
        </label>
      </div>
    );
  };

  const errorContent = submitStatus === 'error' && (
    <Text className="text-error mb-4 text-center text-sm leading-none md:leading-tight">
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

  const termsCheckErrorContent = (
    <div className="flex flex-col items-center gap-4 p-4">
      <DialogTitle asChild>
        <Text className="text-text text-center">
          <Trans>Something went wrong</Trans>
        </Text>
      </DialogTitle>
      <Text className="text-error text-center text-sm leading-none md:leading-tight">
        <Trans>
          We couldn&apos;t verify your terms acceptance. Please check your connection and try again.
        </Trans>
      </Text>
      <Button variant="primary" onClick={retryTermsCheck}>
        <Text>
          <Trans>Retry</Trans>
        </Text>
      </Button>
      <Button variant="outline" onClick={handleReject}>
        <Text>
          <Trans>Disconnect Wallet</Trans>
        </Text>
      </Button>
    </div>
  );

  // The worker's /check refused this address (403) after the client-side
  // screening let it through. A dead end with a way out — not the interactive
  // terms, whose accept would loop on a misleading connection error, and not
  // the error screen, whose retry can never change a deliberate refusal.
  const termsCheckDeniedContent = (
    <div className="flex flex-col items-center gap-4 p-4">
      <DialogTitle asChild>
        <Text className="text-text text-center">
          <Trans>Access restricted</Trans>
        </Text>
      </DialogTitle>
      <Text className="text-textSecondary text-center text-sm leading-none md:leading-tight">
        <Trans>This wallet can&apos;t be used with Sky.money from your current location.</Trans>
      </Text>
      <Button variant="outline" onClick={handleReject}>
        <Text>
          <Trans>Disconnect Wallet</Trans>
        </Text>
      </Button>
    </div>
  );

  // Renders in the navbar wallet slot, so it wears the same DS connect recipe
  // as WalletChip (Figma 5069:27086): primary button at navbar height.
  const triggerButton = (
    <Button variant="primary" size="m" onClick={termsCheckError ? retryTermsCheck : openModal}>
      <Trans>Connect Wallet</Trans>
    </Button>
  );

  return (
    <TermsDialog
      isOpen={isModalOpen}
      onOpenChange={handleOpenChange}
      title={<Trans>Legal Terms</Trans>}
      termsVersion={latestTermsVersion}
      content={termsContent}
      additionalContent={checkboxContent}
      customError={errorContent}
      isLoading={submitStatus === 'submitting'}
      onAccept={handleAgree}
      onDecline={handleReject}
      acceptButtonText={getButtonText()}
      declineButtonText="Reject"
      acceptButtonDisabled={!isChecked}
      showScrollInstruction={false}
      hideScrollTracking={false}
      triggerButton={triggerButton}
      showLoadingState={isCheckingTerms || termsCheckError || termsCheckDenied}
      loadingContent={
        termsCheckDenied ? termsCheckDeniedContent : termsCheckError ? termsCheckErrorContent : undefined
      }
    />
  );
}
