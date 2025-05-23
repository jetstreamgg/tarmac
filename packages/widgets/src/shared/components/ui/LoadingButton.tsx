import React from 'react';
import { Button, ButtonVariant } from '@widgets/components/ui/button';
import { LoadingSpinner } from '@widgets/shared/components/ui/spinner/LoadingSpinner';

interface LoadingButtonProps {
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  isLoading?: boolean;
  disabled?: boolean;
  loadingText?: string;
  buttonText: string;
  className?: string;
  dataTestId?: string;
  variant?: ButtonVariant;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  onClick,
  isLoading = false,
  disabled = false,
  loadingText,
  buttonText,
  className,
  variant,
  dataTestId
}) => (
  <Button
    variant={variant}
    disabled={disabled || isLoading}
    onClick={onClick}
    className={className}
    data-testid={dataTestId}
  >
    {isLoading && loadingText ? loadingText : buttonText}
    {isLoading && <LoadingSpinner className="ml-2" />}
  </Button>
);
