import { Text, Heading, List } from '@/modules/layout/components/Typography';
import { SafeMarkdownRenderer } from './SafeMarkdownRenderer';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';

export const ChatMarkdownRenderer = ({ markdown }: { markdown: string }) => (
  <SafeMarkdownRenderer
    markdown={markdown}
    components={{
      h1: ({ children, ...props }) => (
        <Heading tag="h1" className="pb-3" {...props}>
          {children}
        </Heading>
      ),
      h2: ({ children, ...props }) => (
        <Heading tag="h2" className="pb-3" {...props}>
          {children}
        </Heading>
      ),
      h3: ({ children, ...props }) => (
        <Heading tag="h3" className="pb-3" {...props}>
          {children}
        </Heading>
      ),
      h4: ({ children, ...props }) => (
        <Heading tag="h4" variant="small" className="pb-3" {...props}>
          {children}
        </Heading>
      ),
      p: ({ children, ...props }) => (
        <Text className="pb-3" {...props}>
          {children}
        </Text>
      ),
      span: ({ children, ...props }) => (
        <Text tag="span" {...props}>
          {children}
        </Text>
      ),
      a: ({ children, ...props }) => (
        <ExternalLink href={props.href || ''} className="text-blue-500 hover:underline" showIcon={false}>
          {children}
        </ExternalLink>
      ),
      ul: ({ children, ...props }) => (
        <List className="pb-3" {...props}>
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
