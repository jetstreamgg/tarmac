import * as React from 'react';

import { cn } from '@widgets/lib/utils';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { Warning } from '@widgets/shared/components/icons/Warning';
import { Tooltip, TooltipArrow, TooltipContent, TooltipPortal, TooltipTrigger } from './tooltip';
import { useState } from 'react';
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  rightElement?: React.ReactNode;
  error?: string;
  errorTooltip?: string;
  containerClassName?: string;
}

const ErrorMessage = ({ error }: { error: string }) => (
  <HStack className="items-center pt-4" gap={2}>
    <Warning boxSize={16} viewBox="0 0 16 16" />
    <Text className="text-error text-xs font-normal leading-none">{error}</Text>
  </HStack>
);

const ErrorTooltip = ({ tooltipMessage, error }: { tooltipMessage: string; error: string }) => (
  <Tooltip>
    <TooltipTrigger>
      <ErrorMessage error={error} />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent side="bottom" align="start" className="max-w-64">
        <Text variant="small">{tooltipMessage}</Text>
        <TooltipArrow width={12} height={8} />
      </TooltipContent>
    </TooltipPortal>
  </Tooltip>
);

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      containerClassName,
      type,
      label,
      rightElement,
      error,
      errorTooltip,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <div>
        {label && <Text className="text-text text-sm font-normal leading-none">{label}</Text>}
        <HStack
          className={cn(
            `items-center justify-between ${
              error ? 'text-error border-error' : `${isFocused ? 'border-text' : 'border-selectActive'}`
            } border-b py-4`,
            containerClassName
          )}
        >
          <input
            type={type}
            className={cn(
              `bg-background flex h-6 w-full px-3 py-0 pl-0 ${
                error ? 'text-error' : 'text-text'
              } focus-visible:ring-ring ring-offset-background placeholder:text-textDimmed focus-visible:outline-hidden text-base leading-tight file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 lg:text-lg lg:leading-normal`,
              className
            )}
            ref={ref}
            onFocus={e => {
              setIsFocused(true);
              onFocus?.(e);
            }}
            onBlur={e => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            {...props}
          />
          {rightElement}
        </HStack>
        {error &&
          (errorTooltip ? (
            <ErrorTooltip tooltipMessage={errorTooltip} error={error} />
          ) : (
            <ErrorMessage error={error} />
          ))}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
