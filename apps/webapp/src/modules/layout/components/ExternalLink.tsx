import React from 'react';
import { HStack } from './HStack';
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
        <HStack className={contentClassName}>{content}</HStack>
      )}
    </a>
  );
}
