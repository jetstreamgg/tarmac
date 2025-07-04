import { Button } from '@/components/ui/button';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { Card } from '@/components/ui/card';
import { useChatContext } from '../context/ChatContext';

export function TermsDeclinedMessage() {
  const { setShowChatbotTermsDialog } = useChatContext();

  const handleAcceptTerms = () => {
    setShowChatbotTermsDialog(true);
  };

  return (
    <div className="flex h-full items-center justify-center px-6">
      <Card className="mx-auto max-w-md bg-[#181720] p-6 text-center">
        <Text className="mb-4 text-lg font-semibold text-white">
          <Trans>Terms Not Accepted</Trans>
        </Text>
        <Text className="mb-6 text-sm text-white/70">
          <Trans>
            You have declined the chatbot terms of service. You need to accept the terms in order to use the
            chatbot.
          </Trans>
        </Text>
        <Button variant="primary" onClick={handleAcceptTerms} className="mx-auto">
          <Text>
            <Trans>Accept Terms</Trans>
          </Text>
        </Button>
      </Card>
    </div>
  );
}
