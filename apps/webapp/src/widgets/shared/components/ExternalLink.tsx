import { cn } from '@/widgets/lib/utils';
import { LinkExternal } from '@/widgets/shared/components/icons/LinkExternal';
import React from 'react';

export function ExternalLink({
  href,
  children,
  iconSize = 16,
  showIcon = true,
  className,
  wrapperClassName,
  inline,
  dataTestId
}: {
  href: string;
  children?: React.ReactNode;
  showIcon?: boolean;
  iconSize?: number;
  className?: string;
  wrapperClassName?: string;
  inline?: boolean;
  dataTestId?: string;
}): React.ReactElement {
  const content = inline ? (
    <span className={cn(wrapperClassName)}>
      {children ? children : null}
      {showIcon && <LinkExternal className="mb-px ml-2 inline" boxSize={iconSize} />}
    </span>
  ) : (
    <span className={cn('flex items-center gap-2', wrapperClassName)}>
      {children ? children : null}
      {showIcon && <LinkExternal boxSize={iconSize} />}
    </span>
  );

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn('text-text inline-flex items-center', className)}
      data-testid={dataTestId}
    >
      {content}
    </a>
  );
}
