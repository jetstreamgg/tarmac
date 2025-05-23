import { useContext } from 'react';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { LoadingButton } from '@widgets/shared/components/ui/LoadingButton';

export const WidgetButton = ({
  onClickAction,
  disabled,
  className
}: {
  onClickAction?: () => void;
  disabled?: boolean;
  className?: string;
}) => {
  const { isDisabled, isLoading, buttonText, loadingText } = useContext(WidgetContext);

  return (
    <VStack className={`w-full items-stretch ${className || ''}`}>
      <LoadingButton
        onClick={e => {
          if (onClickAction) {
            onClickAction();
          }
          if (e) {
            e.currentTarget.blur(); // Removes focus from button after clicking
          }
        }}
        disabled={isDisabled || disabled || isLoading}
        isLoading={isLoading}
        buttonText={buttonText}
        loadingText={loadingText}
        dataTestId="widget-button"
        variant="primaryAlt"
        className="font-circle disabled:text-textMuted h-full px-6 py-4 text-base"
      />
    </VStack>
  );
};
