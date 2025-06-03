import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card } from '@/components/ui/card';
import { Heading } from '@/modules/layout/components/Typography';
import { SafeMarkdownRenderer } from './markdown/SafeMarkdownRenderer';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { PopoverInfo } from './PopoverInfo';

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
                      const tooltipType = href.replace('#tooltip-', '') as
                        | 'str'
                        | 'ssr'
                        | 'sbr'
                        | 'srr'
                        | 'dtc'
                        | 'psm';
                      return (
                        <span className="inline-flex items-center gap-1">
                          {children}
                          <PopoverInfo type={tooltipType} />
                        </span>
                      );
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
