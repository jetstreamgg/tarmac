import { useSearchParams } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card } from '@/components/ui/card';
import { Heading } from '@/modules/layout/components/Typography';
import { SafeMarkdownRenderer } from './markdown/SafeMarkdownRenderer';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import {
  PopoverRateInfo,
  PopoverInfo,
  getTooltipById,
  POPOVER_TOOLTIP_TYPES,
  type PopoverTooltipType
} from '@jetstreamgg/sky-widgets';
import { useSendMessage } from '@/modules/chat/hooks/useSendMessage';
import { useChatContext } from '@/modules/chat/context/ChatContext';
import { Chat } from '@/modules/icons';
import { CHATBOT_FAQ_ASK_ENABLED, QueryParams } from '@/lib/constants';
import { t } from '@lingui/core/macro';
import { useBreakpointIndex, BP } from '@/modules/ui/hooks/useBreakpointIndex';

interface Item {
  question: string;
  answer: string;
}

export function FaqAccordion({ items }: { items: Item[] }): React.ReactElement {
  const parsedItems = items.map(({ question, answer }) => ({ title: question, content: answer }));
  const [, setSearchParams] = useSearchParams();
  const { sendMessage } = useSendMessage();
  const { isLoading } = useChatContext();
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi === BP.sm;

  const handleAskAboutQuestion = (e: React.MouseEvent, question: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Open chat pane via URL param
    setSearchParams(prevParams => {
      prevParams.set(QueryParams.Chat, 'true');
      return prevParams;
    });

    // Send the FAQ question to chat after small delay to ensure chat is open
    setTimeout(() => {
      sendMessage(t`${question}`);
    }, 100);
  };

  return (
    <Accordion type="multiple" className="w-full">
      {parsedItems.map(({ title, content }) => (
        <Card key={title} className="group/faq mb-3">
          <AccordionItem value={title} className="p-0">
            <AccordionTrigger className="p-0 text-left">
              <Heading variant="extraSmall" className="flex-1">
                {title}
              </Heading>
              {CHATBOT_FAQ_ASK_ENABLED && !isMobile && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={e => handleAskAboutQuestion(e, title)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleAskAboutQuestion(e as unknown as React.MouseEvent, title);
                    }
                  }}
                  className={`mr-2 rounded-md p-1.5 opacity-0 transition-opacity group-hover/faq:opacity-100 ${
                    isLoading ? 'cursor-not-allowed' : 'hover:bg-white/10'
                  }`}
                  title={t`Ask about this question`}
                >
                  <Chat className="text-textSecondary h-4 w-4" />
                </span>
              )}
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4 pr-5 pb-0 leading-5">
              <SafeMarkdownRenderer
                markdown={content}
                components={{
                  a: ({ children, href, ...props }) => {
                    // Handle tooltip syntax: [text](#tooltip-type)
                    if (href?.startsWith('#tooltip-')) {
                      const tooltipId = href.replace('#tooltip-', '');

                      // Check if it's a hardcoded PopoverRateInfo tooltip type
                      if (POPOVER_TOOLTIP_TYPES.includes(tooltipId as PopoverTooltipType)) {
                        return (
                          <span className="inline-flex items-center gap-1">
                            {children}
                            <PopoverRateInfo type={tooltipId as PopoverTooltipType} />
                          </span>
                        );
                      }

                      // Otherwise, try to get it from the dynamic tooltip system
                      const tooltip = getTooltipById(tooltipId);
                      if (tooltip) {
                        return (
                          <span className="inline-flex items-center gap-1">
                            {children}
                            <PopoverInfo
                              title={tooltip.title}
                              description={tooltip.tooltip}
                              iconSize="large"
                            />
                          </span>
                        );
                      }

                      // If tooltip not found, just render the text without tooltip
                      return <>{children}</>;
                    }

                    // Handle regular links
                    return (
                      <ExternalLink
                        href={href || ''}
                        className="text-blue-500 hover:underline"
                        showIcon={false}
                        {...props}
                      >
                        {children}
                      </ExternalLink>
                    );
                  }
                }}
              />
            </AccordionContent>
          </AccordionItem>
        </Card>
      ))}
    </Accordion>
  );
}
