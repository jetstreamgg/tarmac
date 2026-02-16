import React from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/modules/layout/components/Typography';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { Close } from '@/modules/icons';
import { Check, X, Loader2 } from 'lucide-react';
import { useChainId, useConnection } from 'wagmi';
import { getTransactionLink, useIsSafeWallet } from '@jetstreamgg/sky-utils';
import { PopoverInfo } from '@jetstreamgg/sky-widgets';
import { Trans } from '@lingui/react/macro';

export enum TransactionModalScreen {
  REVIEW = 'review',
  EXECUTING = 'executing',
  SUCCESS = 'success',
  ERROR = 'error'
}

export type TransactionModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  // Transaction hook binding
  execute: () => void;
  prepared: boolean;
  isLoading: boolean;
  error: Error | null;
  txHash?: string;
  // Screen state (managed externally by consumer, driven by hook callbacks)
  screen: TransactionModalScreen;
  // Batch toggle
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  showBatchToggle?: boolean;
  // Content slots
  reviewContent: React.ReactNode;
  successTitle?: string;
  successDescription?: string;
  errorTitle?: string;
  onRetry: () => void;
};

export function TransactionModal({
  open,
  onClose,
  title,
  execute,
  prepared,
  isLoading,
  error,
  txHash,
  screen,
  batchEnabled,
  setBatchEnabled,
  showBatchToggle = false,
  reviewContent,
  successTitle,
  successDescription,
  errorTitle,
  onRetry
}: TransactionModalProps) {
  const chainId = useChainId();
  const { address } = useConnection();
  const isSafeWallet = useIsSafeWallet();

  const explorerLink =
    txHash && address ? getTransactionLink(chainId, address, txHash, isSafeWallet) : undefined;

  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <DialogContent
        className="bg-containerDark sm:max-w-[540px] sm:min-w-[540px]"
        onOpenAutoFocus={e => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-text text-2xl">
              {screen === TransactionModalScreen.REVIEW && title}
              {screen === TransactionModalScreen.EXECUTING && <Trans>Processing...</Trans>}
              {screen === TransactionModalScreen.SUCCESS &&
                (successTitle || <Trans>Transaction Successful</Trans>)}
              {screen === TransactionModalScreen.ERROR && (errorTitle || <Trans>Transaction Failed</Trans>)}
            </DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" className="text-textSecondary hover:text-text h-8 w-8 rounded-full p-0">
                <Close className="h-5 w-5" />
              </Button>
            </DialogClose>
          </div>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>

        {screen === TransactionModalScreen.REVIEW && (
          <div className="flex flex-col gap-4">
            {reviewContent}

            {showBatchToggle && setBatchEnabled && (
              <div className="border-selectActive border-t pt-4">
                <div className="flex w-full items-center justify-between">
                  <div className="flex flex-wrap items-center gap-1">
                    <div className="flex items-center gap-1">
                      <Text className="text-text text-[13px]">
                        <Trans>Bundle transactions</Trans>
                      </Text>
                      <PopoverInfo
                        title="Bundle transactions"
                        description={
                          <Text className="text-[13px] text-white/60">
                            Bundled transactions are set &apos;on&apos; by default to complete transactions in
                            a single step. Combining actions improves the user experience and reduces gas
                            fees. Manually toggle off to cancel this feature.
                          </Text>
                        }
                      />
                    </div>
                    <Text className="text-textSecondary text-[13px]">
                      <Trans>(toggled on by default)</Trans>
                    </Text>
                  </div>
                  <Switch checked={batchEnabled} onCheckedChange={setBatchEnabled} />
                </div>
              </div>
            )}

            <Button variant="primary" className="w-full" disabled={!prepared || isLoading} onClick={execute}>
              <Trans>Confirm</Trans>
            </Button>
          </div>
        )}

        {screen === TransactionModalScreen.EXECUTING && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="text-textEmphasis h-12 w-12 animate-spin" />
            <Text className="text-textSecondary text-center">
              <Trans>Confirm this transaction in your wallet.</Trans>
            </Text>
          </div>
        )}

        {screen === TransactionModalScreen.SUCCESS && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="bg-bullish/20 flex h-12 w-12 items-center justify-center rounded-full">
              <Check className="text-bullish h-6 w-6" />
            </div>
            {successDescription && (
              <Text className="text-textSecondary text-center">{successDescription}</Text>
            )}
            {explorerLink && (
              <ExternalLink href={explorerLink} className="text-textEmphasis text-sm">
                <Trans>View on Explorer</Trans>
              </ExternalLink>
            )}
            <Button variant="primary" className="mt-2 w-full" onClick={onClose}>
              <Trans>Close</Trans>
            </Button>
          </div>
        )}

        {screen === TransactionModalScreen.ERROR && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="bg-bearish/20 flex h-12 w-12 items-center justify-center rounded-full">
              <X className="text-bearish h-6 w-6" />
            </div>
            <Text className="text-textSecondary text-center">
              {error?.message || <Trans>Something went wrong. Please try again.</Trans>}
            </Text>
            {explorerLink && (
              <ExternalLink href={explorerLink} className="text-textEmphasis text-sm">
                <Trans>View on Explorer</Trans>
              </ExternalLink>
            )}
            <div className="mt-2 flex w-full gap-2">
              <Button variant="primary" className="flex-1" onClick={onRetry}>
                <Trans>Try Again</Trans>
              </Button>
              <Button variant="outline" className="flex-1" onClick={onClose}>
                <Trans>Close</Trans>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
