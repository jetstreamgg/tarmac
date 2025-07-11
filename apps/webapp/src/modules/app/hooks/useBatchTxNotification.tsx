import { useCallback, useEffect, useRef } from 'react';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { toast, useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Trans } from '@lingui/react/macro';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { HStack } from '@/modules/layout/components/HStack';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';

export const useBatchTxNotification = ({ isAuthorized }: { isAuthorized: boolean }) => {
  const { userConfig, updateUserConfig } = useConfigContext();
  const { dismiss } = useToast();
  const [batchEnabled] = useBatchToggle();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const onClose = useCallback(() => {
    updateUserConfig({ ...userConfig, batchTxNotificationShown: true });
  }, [updateUserConfig, userConfig]);

  const onActivate = useCallback(() => {
    updateUserConfig({ ...userConfig, batchEnabled: true, batchTxNotificationShown: true });
    dismiss();
  }, [dismiss, updateUserConfig, userConfig]);

  useEffect(() => {
    // Show notification if feature is enabled and hasn't been shown yet
    // (regardless of whether batch is already enabled)
    if (isAuthorized && !userConfig.batchTxNotificationShown) {
      timerRef.current = setTimeout(() => {
        toast({
          title: (
            <HStack>
              <Text variant="medium" className="text-text">
                <Trans>EIP-7702 Bundled transactions now supported</Trans>
              </Text>
            </HStack>
          ),
          description: (
            <VStack className="mt-3 w-full gap-3">
              <Text variant="medium">
                <Trans>
                  Bundled transactions enable a one-click, gas-optimized user experience that aligns with the
                  best practices of the broader Ethereum ecosystem.
                </Trans>
              </Text>
              <div className="scrollbar-thin max-h-24 overflow-y-auto rounded-md border p-3">
                <Text variant="captionSm" className="text-muted-foreground">
                  <Trans>
                    Please note however that all security checks, user confirmations, and error handling are
                    managed by your chosen wallet&apos;s delegate contract. As outlined in our{' '}
                    <ExternalLink
                      showIcon={false}
                      href="https://docs.sky.money/legal-terms"
                      className="text-textEmphasis"
                    >
                      Terms of Use
                    </ExternalLink>
                    , your use of a non-custodial digital wallet—including wallets supporting EIP-7702 and
                    smart account functionality—is governed by the terms of service of your third-party wallet
                    provider. We do not control or take responsibility for the security, functionality, or
                    behavior of third-party wallets, including their handling of bundled transactions or
                    delegate contracts. To ensure a secure and transparent experience, please ensure you are
                    using a trusted and up-to-date wallet before proceeding.
                  </Trans>
                </Text>
              </div>
              {!batchEnabled && (
                <Button className="self-start" variant="pill" size="xs" onClick={onActivate}>
                  <Trans>Activate smart account</Trans>
                </Button>
              )}
            </VStack>
          ),
          duration: Infinity,
          onClose
        });
      }, 3000);
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isAuthorized, userConfig.batchTxNotificationShown, batchEnabled]);
};
