import { useCallback, useEffect, useRef, useState } from 'react';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { toast, useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Trans } from '@lingui/react/macro';
import { Text } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { Zap } from '@/modules/icons/Zap';
import { BATCH_TX_LEGAL_NOTICE_URL, BATCH_TX_NOTIFICATION_KEY, USER_SETTINGS_KEY } from '@/lib/constants';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';

export const useBatchTxNotification = ({ isAuthorized }: { isAuthorized: boolean }) => {
  const { updateUserConfig } = useConfigContext();
  const { dismiss } = useToast();
  const [batchEnabled] = useBatchToggle();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Use localStorage directly for notification state
  const [notificationShown, setNotificationShown] = useState(() => {
    return localStorage.getItem(BATCH_TX_NOTIFICATION_KEY) === 'true';
  });

  const onClose = useCallback(() => {
    localStorage.setItem(BATCH_TX_NOTIFICATION_KEY, 'true');
    setNotificationShown(true);
  }, []);

  const onActivate = useCallback(() => {
    // Get fresh config from localStorage to avoid stale closures
    try {
      const currentConfig = JSON.parse(localStorage.getItem(USER_SETTINGS_KEY) || '{}');
      updateUserConfig({ ...currentConfig, batchEnabled: true });
      localStorage.setItem(BATCH_TX_NOTIFICATION_KEY, 'true');
    } catch (error) {
      console.error('Error parsing user settings', error);
    }
    setNotificationShown(true);
    dismiss();
  }, [dismiss, updateUserConfig]);

  useEffect(() => {
    // Show notification if feature is enabled and hasn't been shown yet
    // (regardless of whether batch is already enabled)
    if (isAuthorized && !notificationShown) {
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
  }, [isAuthorized, notificationShown, batchEnabled]);
};
