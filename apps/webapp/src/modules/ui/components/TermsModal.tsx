import { useState } from 'react';
import { useTermsModal } from '../context/TermsModalContext';
import { Button } from '@/components/ui/button';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { TermsMarkdownRenderer } from '@/modules/ui/components/markdown/TermsMarkdownRenderer';
import { useSignMessage, useConnection, useDisconnect } from 'wagmi';
import { useConnectedContext } from '../context/ConnectedContext';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckedState } from '@radix-ui/react-checkbox';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { sanitizeUrl } from '@/lib/utils';
import { TermsDialog } from './TermsDialog';
import { getTermsContent } from './terms-loader';

export function TermsModal() {
  const { closeModal, isModalOpen, openModal } = useTermsModal();
  const { isCheckingTerms, setHasAcceptedTerms } = useConnectedContext();
  const [isChecked, setIsChecked] = useState(false);
  const [signStatus, setSignStatus] = useState<'idle' | 'loading' | 'signing' | 'error'>('idle');
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const { address, chainId } = useConnection();
  const { disconnect } = useDisconnect();
  const [termsMarkdown] = useState<string>(getTermsContent());

  const onSuccess = async (signature: string) => {
    const payload = {
      address,
      signedMessage: import.meta.env.VITE_TERMS_MESSAGE_TO_SIGN,
      signature,
      chainId
    };

    try {
      const response = await fetch(sanitizeUrl(`${import.meta.env.VITE_TERMS_ENDPOINT}/add`) || '', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setHasAcceptedTerms(true);
        closeModal();
      } else {
        console.error('Failed to send signature');
        setSignStatus('error');
        // TODO show error message to user
      }
    } catch (error) {
      console.error('Error sending signature:', error);
      setSignStatus('error');
      // TODO show error message to user
    }
  };

  const { signMessage } = useSignMessage({
    mutation: {
      onSuccess: data => onSuccess(data),
      onError: error => {
        setSignStatus('error');
        console.log('error signing message: ', error);
      }
    }
  });

  const handleAgreeAndSign = () => {
    setSignStatus('signing');
    if (import.meta.env.VITE_USE_MOCK_WALLET === 'true') {
      setHasAcceptedTerms(true);
      closeModal();
    } else {
      signMessage({ message: import.meta.env.VITE_TERMS_MESSAGE_TO_SIGN });
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSignStatus('idle');
      setIsChecked(false);
      setHasScrolledToEnd(false);
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
    if (checkedState === true) {
      setSignStatus('signing');
      signMessage({ message: import.meta.env.VITE_TERMS_MESSAGE_TO_SIGN });
    }
  };

  const termsContent = <TermsMarkdownRenderer markdown={termsMarkdown} />;

  // Compute button text based on state
  const getButtonText = () => {
    if (signStatus === 'signing') return 'Signing...';
    if (!hasScrolledToEnd) return 'Scroll down ↓';
    if (!isChecked) return 'Check to continue';
    return 'Agree and Sign';
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

  const errorContent = signStatus === 'error' && (
    <Text className="text-error mb-4 text-center text-sm leading-none md:leading-tight">
      <Trans>
        An error occurred while submitting your signature. Please ensure your wallet is connected to either
        Ethereum mainnet, Base, Arbitrum, Optimism or Unichain and try again. If the issue persists, reach out
        for assistance in the official{' '}
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

  const triggerButton = (
    <Button variant="connect" onClick={openModal}>
      <Trans>Connect Wallet</Trans>
    </Button>
  );

  return (
    <TermsDialog
      isOpen={isModalOpen}
      onOpenChange={handleOpenChange}
      title={<Trans>Legal Terms</Trans>}
      content={termsContent}
      additionalContent={checkboxContent}
      customError={errorContent}
      isLoading={signStatus === 'signing'}
      onAccept={handleAgreeAndSign}
      onDecline={handleReject}
      acceptButtonText={getButtonText()}
      declineButtonText="Reject"
      acceptButtonDisabled={!isChecked}
      showScrollInstruction={true}
      scrollInstructionText="Please scroll to the bottom and read the entire terms and conditions; the checkbox will become enabled afterward."
      hideScrollTracking={false}
      triggerButton={triggerButton}
      showLoadingState={isCheckingTerms || signStatus === 'loading'}
    />
  );
}
