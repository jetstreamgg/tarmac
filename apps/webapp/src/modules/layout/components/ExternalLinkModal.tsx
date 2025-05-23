import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { useCallback } from 'react';
import { Text } from './Typography';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { Button } from '@/components/ui/button';
import { Warning } from '@/modules/icons/Warning';
import { ExternalLink } from './ExternalLink';
import { sanitizeUrl } from '@/lib/utils';

export const ExternalLinkModal: React.FC = () => {
  const {
    externalLinkModalOpened,
    externalLinkModalUrl,
    setExternalLinkModalOpened,
    setExternalLinkModalUrl
  } = useConfigContext();

  const handleCancel = useCallback(
    (change: boolean) => {
      setExternalLinkModalUrl('');
      setExternalLinkModalOpened(change);
    },
    [setExternalLinkModalOpened, setExternalLinkModalUrl]
  );

  const handleConfirm = useCallback(() => {
    setExternalLinkModalOpened(false);
    window.open(externalLinkModalUrl, '_blank');
  }, [externalLinkModalUrl, setExternalLinkModalOpened]);

  let termsLink: any[] = [];
  try {
    termsLink = JSON.parse(import.meta.env.VITE_TERMS_LINK);
  } catch (error) {
    console.error('Error parsing terms link: ', error);
  }

  return (
    <Dialog open={externalLinkModalOpened} onOpenChange={handleCancel}>
      <DialogContent className="bg-containerDark flex w-full flex-col items-center justify-center rounded-none p-5 md:w-[480px] md:rounded-2xl md:p-10">
        <Warning boxSize={50} />

        <DialogHeader>
          <DialogTitle className="text-text text-center text-[28px] md:text-[32px]">
            Leaving Our Website
          </DialogTitle>
        </DialogHeader>
        <div className="flex w-full flex-col items-center justify-between gap-6">
          <DialogDescription className="font-custom-450 text-text text-center">
            You are about to leave our website and enter a site controlled by an independent third party
            within the Sky Ecosystem. We disclaim any liability for your interaction with this, and any other,
            external sites hosted under sky.money subdomains. For more information, please visit our{' '}
            {Array.isArray(termsLink) && termsLink.length > 0 ? (
              <ExternalLink
                skipConfirm
                className="text-textEmphasis"
                showIcon={false}
                href={sanitizeUrl(termsLink[0].url)}
              >
                {termsLink[0].name}
              </ExternalLink>
            ) : (
              'Terms of Use'
            )}
            .
          </DialogDescription>
          <Text className="font-custom-450 text-text text-center">
            If you wish to proceed, click &quot;Continue.&quot; If not, click &quot;Cancel&quot; to remain on
            our site.
          </Text>
          <div className="mt-4 flex w-full justify-between gap-6 sm:mt-0 sm:w-auto">
            <DialogClose asChild>
              <Button
                variant="secondary"
                className="flex-1 border bg-transparent hover:bg-[rgb(17,16,31)] active:bg-[rgb(34,32,66)]"
                onClick={() => handleCancel(false)}
              >
                <Text>Cancel</Text>
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="primary" className="flex-1" onClick={handleConfirm}>
                <Text>Continue</Text>
              </Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
