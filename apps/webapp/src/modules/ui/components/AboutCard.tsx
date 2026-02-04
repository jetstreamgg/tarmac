import { Button } from '@/components/ui/button';
import { Trans } from '@lingui/react/macro';
import { ExternalLinkIcon } from 'lucide-react';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { GradientShapeCard } from './GradientShapeCard';
import { TokenIcon } from './TokenIcon';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
import { useSendMessage } from '@/modules/chat/hooks/useSendMessage';
import { useChatContext } from '@/modules/chat/context/ChatContext';
import { Chat } from '@/modules/icons';
import { CHATBOT_ABOUT_CARD_ASK_ENABLED, QueryParams } from '@/lib/constants';
import { t } from '@lingui/core/macro';
import { useBreakpointIndex, BP } from '@/modules/ui/hooks/useBreakpointIndex';

interface AboutCardProps {
  title?: ReactNode;
  tokenSymbol?: string;
  description: ReactNode;
  linkHref: string;
  linkLabel?: ReactNode;
  colorMiddle: string;
  height?: number | undefined;
  contentWidth?: 'w-2/3' | 'w-1/2';
}

export const AboutCard = ({
  title,
  tokenSymbol,
  description,
  linkHref,
  linkLabel = <Trans>View contract</Trans>,
  colorMiddle,
  height,
  contentWidth = 'w-2/3'
}: AboutCardProps) => {
  const [, setSearchParams] = useSearchParams();
  const { sendMessage } = useSendMessage();
  const { isLoading } = useChatContext();
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi === BP.sm;

  // Get display name for the chat question (use title text if available, otherwise tokenSymbol)
  const displayName = tokenSymbol || (typeof title === 'string' ? title : '');

  const handleAskAboutToken = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Open chat pane via URL param
    setSearchParams(prevParams => {
      prevParams.set(QueryParams.Chat, 'true');
      return prevParams;
    });

    // Send question about the token after small delay to ensure chat is open
    setTimeout(() => {
      sendMessage(t`What is ${displayName} and how can I use it?`);
    }, 100);
  };

  const renderTitle = () => {
    if (title && tokenSymbol) {
      return (
        <>
          <TokenIcon token={{ symbol: tokenSymbol }} width={24} className="h-6 w-6" showChainIcon={false} />
          {title}
        </>
      );
    }

    if (tokenSymbol) {
      return (
        <>
          <TokenIcon token={{ symbol: tokenSymbol }} width={24} className="h-6 w-6" showChainIcon={false} />
          <Trans>{tokenSymbol}</Trans>
        </>
      );
    }

    if (title) {
      return title;
    }

    return null;
  };

  const titleContent = renderTitle();

  return (
    <div className="group/about">
      <GradientShapeCard
        colorLeft="radial-gradient(200.08% 406.67% at 5.14% 108.47%, #4331E9 0%, #2A197D 21.68%)"
        colorMiddle={colorMiddle}
        colorRight="#1e1a4b"
        className="mb-6"
        height={height}
      >
        {/* Chat icon - top right corner, appears on hover */}
        {CHATBOT_ABOUT_CARD_ASK_ENABLED && !isMobile && displayName && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleAskAboutToken}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleAskAboutToken(e as unknown as React.MouseEvent);
              }
            }}
            className={`absolute top-4 right-3 z-20 rounded-md p-1.5 opacity-0 transition-opacity group-hover/about:opacity-100 xl:right-6 ${
              isLoading ? 'cursor-not-allowed' : 'hover:bg-white/10'
            }`}
            title={t`Ask about ${displayName}`}
          >
            <Chat className="text-textSecondary h-4 w-4" />
          </span>
        )}
        <div
          className={cn('w-[80%] space-y-2 self-start', contentWidth === 'w-1/2' ? 'xl:w-1/2' : 'xl:w-2/3')}
        >
          {titleContent && <Heading className="flex items-center gap-2">{titleContent}</Heading>}
          <Text variant="small">{description}</Text>
        </div>
        <ExternalLink href={linkHref} showIcon={false} className="mt-auto w-fit pt-3 xl:self-end xl:pt-0">
          <Button variant="outline" className="border-border gap-2">
            {linkLabel}
            <ExternalLinkIcon size={16} />
          </Button>
        </ExternalLink>
      </GradientShapeCard>
    </div>
  );
};
