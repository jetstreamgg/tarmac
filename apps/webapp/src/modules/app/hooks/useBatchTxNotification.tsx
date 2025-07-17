import { useCallback, useEffect, useRef } from 'react';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { toast, useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Trans } from '@lingui/react/macro';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { Zap } from '@/modules/icons/Zap';
import { BATCH_TX_LEGAL_NOTICE_URL } from '@/lib/constants';
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
          icon: <Zap width={22} height={22} />,
          title: (
            <Text variant="medium" className="text-text">
              <Trans>EIP-7702 Bundled transactions now supported</Trans>
            </Text>
          ),
          description: (
            <VStack className="mt-3 w-full gap-3">
              <Text variant="medium">
                <Trans>
                  Bundled transactions enable a one-click, gas-optimized user experience that aligns with the
                  best practices of the broader Ethereum ecosystem.
                </Trans>
              </Text>
              {batchEnabled && (
                <Text variant="medium" className="text-muted-foreground">
                  <Trans>
                    Bundled transactions:{' '}
                    <Text tag="span" variant="medium" className="text-bullish">
                      Active
                    </Text>
                  </Trans>
                </Text>
              )}
              <ExternalLink
                href={BATCH_TX_LEGAL_NOTICE_URL}
                className="text-textEmphasis hover:text-textEmphasis self-start text-sm hover:underline"
                showIcon={false}
              >
                <Trans>Legal Notice</Trans>
              </ExternalLink>
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
