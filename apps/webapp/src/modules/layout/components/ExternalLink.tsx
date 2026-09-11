import React from 'react';
import { LinkExternal } from '@/modules/icons';
import { cn } from '@/lib/utils';

export function ExternalLink({
  href,
  children,
  className,
  iconSize = 16,
  showIcon = true,
  iconClassName,
  iconColor,
  contentClassName
}: {
  href?: string;
  children?: React.ReactNode;
  showIcon?: boolean;
  iconSize?: number;
  className?: string;
  iconClassName?: string;
  iconColor?: string;
  contentClassName?: string;
}): React.ReactElement {
  const content = (
    <>
      {children ? children : null}
      {showIcon && <LinkExternal boxSize={iconSize} className={iconClassName} stroke={iconColor} />}
    </>
  );
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('text-text inline-flex items-center', className)}
    >
      {['string', 'number'].includes(typeof children) || children === undefined ? (
        content
      ) : (
        // A span, not HStack's div: the link sits inside <p> copy (the batch
        // toggle, the bundle explainer, the terms modal), and a div there is
        // invalid HTML that React logs on every page the TopNav menu opens on
        // (APP-563 #7). Same flex recipe HStack drew, on an inline element.
        <span className={cn('flex flex-row space-x-4', contentClassName)}>{content}</span>
      )}
    </a>
  );
}
