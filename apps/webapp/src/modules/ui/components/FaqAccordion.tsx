import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SafeMarkdownRenderer } from './markdown/SafeMarkdownRenderer';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { PopoverRateInfo, PopoverInfo, getTooltipById, resolvePopoverTooltipKey } from '@/widgets';

interface Item {
  question: string;
  answer: string;
}

export function FaqAccordion({ items }: { items: Item[] }): React.ReactElement {
  const parsedItems = items.map(({ question, answer }) => ({ title: question, content: answer }));
  return (
    <Accordion type="multiple" className="w-full">
      {parsedItems.map(({ title, content }) => (
        <AccordionItem key={title} value={title}>
          <AccordionTrigger className="gap-4 text-left">{title}</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <SafeMarkdownRenderer
              markdown={content}
              components={{
                a: ({ children, href, ...props }) => {
                  // Handle tooltip syntax: [text](#tooltip-type)
                  if (href?.startsWith('#tooltip-')) {
                    const tooltipId = href.replace('#tooltip-', '');

                    const popoverKey = resolvePopoverTooltipKey(tooltipId);
                    if (popoverKey) {
                      return (
                        <span className="inline-flex items-center gap-1">
                          {children}
                          <PopoverRateInfo type={popoverKey} />
                        </span>
                      );
                    }

                    // Fall back to the dynamic tooltip system for ids without
                    // a PopoverRateInfo equivalent (e.g. gas-fee, sealed).
                    const tooltip = getTooltipById(tooltipId);
                    if (tooltip) {
                      return (
                        <span className="inline-flex items-center gap-1">
                          {children}
                          <PopoverInfo title={tooltip.title} description={tooltip.tooltip} iconSize="large" />
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
      ))}
    </Accordion>
  );
}
