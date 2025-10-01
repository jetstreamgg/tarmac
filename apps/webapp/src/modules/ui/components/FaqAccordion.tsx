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

interface Item {
  question: string;
  answer: string;
}

export function FaqAccordion({ items }: { items: Item[] }): React.ReactElement {
  const parsedItems = items.map(({ question, answer }) => ({ title: question, content: answer }));
  return (
    <Accordion type="multiple" className="w-full">
      {parsedItems.map(({ title, content }) => (
        <Card key={title} className="mb-3">
          <AccordionItem value={title} className="p-0">
            <AccordionTrigger className="p-0 text-left">
              <Heading variant="extraSmall">{title}</Heading>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-0 pr-5 pt-4 leading-5">
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
                            <PopoverInfo title={tooltip.title} description={tooltip.tooltip} />
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
