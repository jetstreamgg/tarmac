import { Text, Heading, List } from '@/modules/layout/components/Typography';
import { SafeMarkdownRenderer } from './SafeMarkdownRenderer';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';

export const ChatMarkdownRenderer = ({ markdown }: { markdown: string }) => (
  <SafeMarkdownRenderer
    markdown={markdown}
    components={{
      h1: ({ children, ...props }) => (
        <Heading tag="h1" className="@max-sm/chat:pb-2 @max-sm/chat:text-base pb-3" {...props}>
          {children}
        </Heading>
      ),
      h2: ({ children, ...props }) => (
        <Heading tag="h2" className="@max-sm/chat:pb-2 @max-sm/chat:text-base pb-3" {...props}>
          {children}
        </Heading>
      ),
      h3: ({ children, ...props }) => (
        <Heading tag="h3" className="@max-sm/chat:pb-2 @max-sm/chat:text-base pb-3" {...props}>
          {children}
        </Heading>
      ),
      h4: ({ children, ...props }) => (
        <Heading
          tag="h4"
          variant="small"
          className="@max-sm/chat:pb-1.5 @max-sm/chat:text-sm pb-3"
          {...props}
        >
          {children}
        </Heading>
      ),
      p: ({ children, ...props }) => (
        <Text className="@max-sm/chat:pb-2 @max-sm/chat:text-sm @max-sm/chat:leading-relaxed pb-3" {...props}>
          {children}
        </Text>
      ),
      span: ({ children, ...props }) => (
        <Text tag="span" className="@max-sm/chat:text-sm" {...props}>
          {children}
        </Text>
      ),
      a: ({ children, ...props }) => {
        return (
          <ExternalLink
            href={props.href}
            className="@max-sm/chat:text-sm text-blue-500 hover:underline"
            showIcon={false}
          >
            {children}
          </ExternalLink>
        );
      },
      ul: ({ children, ...props }) => (
        <List
          className="@max-sm/chat:pb-2 @max-sm/chat:text-sm @max-sm/chat:leading-relaxed pb-3 text-base"
          {...props}
        >
          {children}
        </List>
      ),
      ol: ({ children, ...props }) => (
        <List
          variant="ordered"
          tag="ol"
          className="@max-sm/chat:pb-2 @max-sm/chat:text-sm @max-sm/chat:leading-relaxed pb-3 text-base"
          {...props}
        >
          {children}
        </List>
      )
    }}
  />
);
