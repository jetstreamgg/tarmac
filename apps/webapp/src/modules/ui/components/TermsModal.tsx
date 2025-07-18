import { useState } from 'react';
import { useTermsModal } from '../context/TermsModalContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import termsMarkdown from '@/content/terms.md?raw'; //https://vitejs.dev/guide/assets#importing-asset-as-string
import { TermsMarkdownRenderer } from '@/modules/ui/components/markdown/TermsMarkdownRenderer';
import { useSignMessage, useAccount, useDisconnect } from 'wagmi';
import { useConnectedContext } from '../context/ConnectedContext';
import { LoadingSpinner } from './LoadingSpinner';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckedState } from '@radix-ui/react-checkbox';
import { useInView } from 'react-intersection-observer';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { sanitizeUrl } from '@/lib/utils';
import { BP, useBreakpointIndex } from '../hooks/useBreakpointIndex';

export function TermsModal() {
  const { closeModal, isModalOpen, openModal } = useTermsModal();
  const { isCheckingTerms, setHasAcceptedTerms } = useConnectedContext();
  const [isChecked, setIsChecked] = useState(false);
  const [signStatus, setSignStatus] = useState<'idle' | 'loading' | 'signing' | 'error'>('idle');
  const { address, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const [endOfTermsRef, hasScrolledToEnd] = useInView({ triggerOnce: true });
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;

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

  return (
    <Dialog open={isModalOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="connect" onClick={openModal}>
          <Trans>{isMobile ? 'Connect' : 'Connect Wallet'}</Trans>
        </Button>
      </DialogTrigger>
      {isCheckingTerms || signStatus === 'loading' ? (
        <DialogContent className="bg-containerDark max-w-[300px]">
          <div className="flex items-center justify-center p-4">
            <DialogTitle asChild>
              <Text className="text-text mr-2 text-center">
                <Trans>Please wait...</Trans>
              </Text>
            </DialogTitle>
            <LoadingSpinner />
          </div>
        </DialogContent>
      ) : (
        <DialogContent className="bg-containerDark max-h-[95dvh] overflow-y-auto">
          <DialogTitle asChild>
            <Text className="text-text text-center text-[26px] sm:text-[28px] md:text-[32px]">
              <Trans>Legal Terms</Trans>
            </Text>
          </DialogTitle>
          <Card className="mx-auto max-h-[256px] w-full overflow-y-auto bg-[#181720] p-3 sm:max-h-[432px] sm:p-4">
            <TermsMarkdownRenderer markdown={termsMarkdown} />
            <div ref={endOfTermsRef} data-testid="end-of-terms" />
          </Card>
          <Text className="text-center text-sm leading-none text-white/50 md:leading-tight">
            Please scroll to the bottom and read the entire terms and conditions; the checkbox will become
            enabled afterward.
          </Text>
          <div className="flex items-center sm:my-4">
            <Checkbox
              id="termsCheckbox"
              disabled={!hasScrolledToEnd}
              checked={isChecked}
              onCheckedChange={handleCheckboxChange}
              className="mr-2"
            />
            <label htmlFor="termsCheckbox" className="text-text ml-2 text-sm leading-none md:leading-tight">
              {import.meta.env.VITE_TERMS_CHECKBOX_TEXT}
            </label>
          </div>
          {signStatus === 'error' && (
            <Text className="text-error mb-4 text-center text-sm leading-none md:leading-tight">
              <Trans>
                An error occurred while submitting your signature. Please ensure your wallet is connected to
                either Ethereum mainnet, Base, Arbitrum, Optimism or Unichain and try again. If the issue
                persists, reach out for assistance in the official{' '}
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
          )}
          <div className="flex w-full justify-between gap-4 sm:mt-0 sm:w-auto">
            <DialogClose asChild>
              <Button
                variant="secondary"
                className="flex-1 border bg-transparent hover:bg-[rgb(17,16,31)] active:bg-[rgb(34,32,66)]"
                onClick={handleReject}
              >
                <Text>
                  <Trans>Reject</Trans>
                </Text>
              </Button>
            </DialogClose>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleAgreeAndSign}
              disabled={!isChecked || signStatus === 'signing'}
            >
              <Text>
                <Trans>{signStatus === 'signing' ? 'Signing...' : 'Agree and Sign'}</Trans>
              </Text>
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
