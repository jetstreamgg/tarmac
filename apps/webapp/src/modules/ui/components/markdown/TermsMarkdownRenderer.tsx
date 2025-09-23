import { Text, Heading, List, ListVariant } from '@/modules/layout/components/Typography';
import { SafeMarkdownRenderer } from './SafeMarkdownRenderer';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';

export const TermsMarkdownRenderer = ({
  markdown,
  ulVariant = 'unordered',
  className = ''
}: {
  markdown: string;
  ulVariant?: ListVariant;
  className?: string;
}) => (
  <SafeMarkdownRenderer
    markdown={markdown}
    components={{
      h1: ({ children, ...props }) => (
        <Heading tag="h1" variant="large" className="mb-3 border-b pb-1.5 text-4xl" {...props}>
          {children}
        </Heading>
      ),
      h2: ({ children, ...props }) => (
        <Heading tag="h2" className="mb-3 border-b pb-1.5" {...props}>
          {children}
        </Heading>
      ),
      h3: ({ children, ...props }) => (
        <Heading tag="h3" variant="small" className="pb-3" {...props}>
          {children}
        </Heading>
      ),
      p: ({ children, ...props }) => (
        <Text variant="terms" tag="p" className={`pb-6 ${className}`} {...props}>
          {children}
        </Text>
      ),
      span: ({ children, ...props }) => (
        <Text variant="terms" tag="span" {...props}>
          {children}
        </Text>
      ),
      a: ({ children, ...props }) => (
        <ExternalLink href={props.href || ''} className="text-blue-500 hover:underline" showIcon={false}>
          {children}
        </ExternalLink>
      ),
      ul: ({ children, ...props }) => (
        <List className="pb-3" variant={ulVariant} {...props}>
          {children}
        </List>
      ),
      ol: ({ children, ...props }) => (
        <List variant="ordered" tag="ol" className="pb-3" {...props}>
          {children}
        </List>
      )
    }}
  />
);
