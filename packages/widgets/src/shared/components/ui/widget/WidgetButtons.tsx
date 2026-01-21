import React, { useContext, useMemo } from 'react';
import { Button } from '@widgets/components/ui/button';
import { WidgetButton } from './WidgetButton';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { useConnection } from 'wagmi';
import { ConnectWalletCopy } from '../ConnectWalletCopy';
import { AnimatePresence } from 'framer-motion';
import { ButtonsAnimationWrapper } from '@widgets/shared/animation/Wrappers';
import { VStack } from '../layout/VStack';

interface WidgetButtonsProps {
  onClickAction?: () => void;
  onClickBack?: () => void;
  onClickCancel?: () => void;
  showSecondaryButton?: boolean;
  enabled?: boolean;
  showCancelButton?: boolean;
  cancelLoading?: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}

export const WidgetButtons: React.FC<WidgetButtonsProps> = ({
  onClickAction,
  onClickBack,
  showSecondaryButton,
  enabled = true,
  showCancelButton = false,
  onClickCancel,
  cancelLoading,
  onExternalLinkClicked
}) => {
  const { backButtonText, cancelButtonText } = useContext(WidgetContext);
  const { isConnected } = useConnection();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);
  return (
    <div className="flex w-full flex-col items-stretch gap-5">
      {!isConnectedAndEnabled && (
        <ConnectWalletCopy className="hidden md:block" onExternalLinkClicked={onExternalLinkClicked} />
      )}
      <AnimatePresence mode="popLayout" initial={false}>
        {showSecondaryButton && onClickBack ? (
          <ButtonsAnimationWrapper className="flex flex-row space-x-4" key="two-buttons">
            <div className="flex-1">
              <Button
                variant={'secondary'}
                onClick={onClickBack}
                className="font-circle h-full w-full px-6 py-4 text-base"
              >
                {backButtonText || 'Back'}
              </Button>
            </div>
            <div className="flex-1">
              <WidgetButton className="w-full" onClickAction={onClickAction} disabled={!onClickAction} />
            </div>
          </ButtonsAnimationWrapper>
        ) : (
          <ButtonsAnimationWrapper className="flex-1" key="single-button">
            <VStack gap={2}>
              {showCancelButton && onClickCancel && (
                <Button
                  className="font-circle h-full w-full px-6 py-4 text-base"
                  variant={'secondary'}
                  onClick={onClickCancel}
                  disabled={!onClickCancel || cancelLoading}
                >
                  {cancelButtonText || 'Cancel'}
                </Button>
              )}
              <WidgetButton className="w-full" onClickAction={onClickAction} disabled={!onClickAction} />
            </VStack>
          </ButtonsAnimationWrapper>
        )}
      </AnimatePresence>
    </div>
  );
};
