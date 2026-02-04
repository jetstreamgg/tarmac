import { NotificationType, TxStatus } from '@jetstreamgg/sky-widgets';
import { toast, toastWithClose } from '@/components/ui/use-toast';
import { LinkedAction } from '@/modules/ui/hooks/useUserSuggestedActions';
import { HStack } from '@/modules/layout/components/HStack';
import { t } from '@lingui/core/macro';
import { VStack } from '@/modules/layout/components/VStack';
import { Button } from '@/components/ui/button';
import { capitalizeFirstLetter } from '@/lib/helpers/string/capitalizeFirstLetter';
import { Text, TextProps } from '@/modules/layout/components/Typography';
import { useCallback, useRef } from 'react';
import { usePrepareNotification } from './usePrepareNotification';
import { RewardsModule, Savings } from '@/modules/icons';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { PopoverRateInfo as PopoverInfo } from '@jetstreamgg/sky-widgets';
import { isL2ChainId } from '@jetstreamgg/sky-utils';
import { isDeprecatedRewardContract } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';

const generateToastContent = ({
  description,
  descriptionSub,
  buttonTxt,
  descriptionVariant = 'small',
  descriptionSubVariant,
  descriptionClassName = 'text-selectActive',
  descriptionSubClassName,
  onClick,
  rateType
}: {
  description: string;
  descriptionSub: string;
  buttonTxt: string;
  descriptionVariant?: TextProps['variant'];
  descriptionSubVariant?: TextProps['variant'];
  descriptionClassName?: string;
  descriptionSubClassName?: string;
  onClick: () => void;
  rateType?: 'ssr' | 'str';
}) => (
  <HStack className="w-full justify-between">
    <VStack className="mt-4">
      <Text variant={descriptionVariant} className={descriptionClassName}>
        {description}
      </Text>
      <HStack>
        <Text variant={descriptionSubVariant} className={descriptionSubClassName}>
          {descriptionSub}
        </Text>
        {!!rateType && <PopoverInfo type={rateType} popoverClassName="z-[42]" />}
      </HStack>
    </VStack>
    <Button className="place-self-end" variant="pill" size="xs" onClick={onClick}>
      {buttonTxt}
    </Button>
  </HStack>
);

const duration = 10000;
const delay = 4000;
const NOTIFICATION_DEBOUNCE_MS = 2000; // Prevent duplicate notifications within 2 seconds

export const useNotification = () => {
  const isRestricted = import.meta.env.VITE_RESTRICTED_BUILD === 'true';
  const chainId = useChainId();
  const isL2 = isL2ChainId(chainId);
  const { linkedActionConfig } = useConfigContext();

  // Track last notification to prevent duplicates
  const lastNotificationRef = useRef<{
    type?: NotificationType;
    title?: string;
    timestamp: number;
  }>({ timestamp: 0 });

  // Track internal notification handlers to prevent duplicates
  const lastInternalNotificationRef = useRef<{
    type: 'insufficient' | 'token-received';
    subtype?: NotificationType;
    timestamp: number;
  }>({ type: 'insufficient', timestamp: 0 });
  const {
    navigate,
    action,
    rewardContract,
    rewardContractRate: rate,
    savingsRate,
    isSavingsModule,
    isRewardsModule,
    isTradeModule,
    isUpgradeModule,
    url
  } = usePrepareNotification();

  const handleInsufficientBalance = useCallback(() => {
    if (!action) return;

    const now = Date.now();
    const lastInternal = lastInternalNotificationRef.current;

    // Prevent duplicate insufficient balance notifications
    if (lastInternal.type === 'insufficient' && now - lastInternal.timestamp < NOTIFICATION_DEBOUNCE_MS) {
      return;
    }

    lastInternalNotificationRef.current = {
      type: 'insufficient',
      timestamp: now
    };

    const buttonTxt =
      action?.intent && (action as LinkedAction).la
        ? `${capitalizeFirstLetter(action.intent)} & ${capitalizeFirstLetter((action as LinkedAction).la)}`
        : `${capitalizeFirstLetter(action?.intent || '')}`;

    setTimeout(() => {
      if (isRewardsModule) {
        // Don't show toast for deprecated reward contracts
        if (isDeprecatedRewardContract(rewardContract?.contractAddress || '', chainId)) {
          return;
        }

        toastWithClose(
          toastId => (
            <div>
              <Text variant="medium">
                {t`Looks like you need ${rewardContract?.supplyToken.symbol?.toUpperCase() ?? 'tokens'} to get rewards`}
              </Text>
              {generateToastContent({
                description: `${rewardContract?.name ?? 'Reward'} Reward Rate`,
                descriptionSub: rate || '',
                buttonTxt,
                rateType: 'str',
                onClick: () => {
                  navigate();
                  toast.dismiss(toastId);
                }
              })}
            </div>
          ),
          {
            // id: 'insufficient-balance-rewards',
            classNames: {
              content: 'w-full'
            },
            duration
          }
        );
      } else if (isSavingsModule) {
        toastWithClose(
          toastId => (
            <div>
              <Text variant="medium">{t`Looks like you need USDS`}</Text>
              {generateToastContent({
                description: 'Sky Savings Rate',
                descriptionSub: savingsRate || '',
                buttonTxt,
                rateType: 'ssr',
                onClick: () => {
                  navigate();
                  toast.dismiss(toastId);
                }
              })}
            </div>
          ),
          {
            // id: 'insufficient-balance-savings',
            classNames: {
              content: 'w-full'
            },
            duration
          }
        );
      }
    }, delay); // delay for insufficient balance notifications
  }, [action, isRewardsModule, isSavingsModule, rewardContract, rate, savingsRate, navigate, chainId]);

  const handleTokenReceived = useCallback(
    (type: NotificationType) => {
      // Don't show the toast if the user is in a LA flow
      if (linkedActionConfig.showLinkedAction) return;

      const now = Date.now();
      const lastInternal = lastInternalNotificationRef.current;

      // Prevent duplicate token received notifications of the same type
      if (
        lastInternal.type === 'token-received' &&
        lastInternal.subtype === type &&
        now - lastInternal.timestamp < NOTIFICATION_DEBOUNCE_MS
      ) {
        return;
      }

      lastInternalNotificationRef.current = {
        type: 'token-received',
        subtype: type,
        timestamp: now
      };

      const urlL2Ready = url && isL2;
      if (
        type === NotificationType.USDS_RECEIVED &&
        (isTradeModule || isUpgradeModule) &&
        (action || urlL2Ready)
      ) {
        setTimeout(() => {
          if (isL2) {
            toastWithClose(
              toastId => (
                <div>
                  <HStack>
                    <Savings />
                    <Text variant="medium">{t`Get the Sky Savings Rate`}</Text>
                  </HStack>
                  {generateToastContent({
                    description: t`With: USDS Get: USDS`,
                    descriptionSub: savingsRate ? t`Rate: ${savingsRate}` : '',
                    rateType: savingsRate ? 'ssr' : undefined,
                    buttonTxt: t`Go to Savings`,
                    onClick: () => {
                      navigate();
                      toast.dismiss(toastId);
                    }
                  })}
                </div>
              ),
              {
                // id: 'usds-received-l2-savings',
                classNames: {
                  content: 'w-full'
                },
                duration
              }
            );
          } else {
            toastWithClose(
              toastId => (
                <div>
                  <HStack>
                    <RewardsModule />
                    <Text variant="medium">{t`Get rewards with USDS`}</Text>
                  </HStack>
                  {generateToastContent({
                    description: t`With: USDS Get: SKY`,
                    descriptionSub: rate ? t`Rate: ${rate}` : '',
                    rateType: rate ? 'str' : undefined,
                    buttonTxt: t`Go to Rewards`,
                    onClick: () => {
                      navigate();
                      toast.dismiss(toastId);
                    }
                  })}
                </div>
              ),
              {
                // id: 'usds-received-rewards',
                classNames: {
                  content: 'w-full'
                },
                duration
              }
            );
          }
        }, delay);
      } else if (type === NotificationType.DAI_RECEIVED && action && isTradeModule) {
        setTimeout(() => {
          toastWithClose(
            toastId => (
              <div>
                <HStack>
                  <RewardsModule />
                  <Text variant="medium">{t`Upgrade and get rewards`}</Text>
                </HStack>
                {generateToastContent({
                  description: t`Upgrade DAI to USDS`,
                  descriptionSub: t`then get rewards`,
                  buttonTxt: t`Upgrade and get rewards`,
                  descriptionClassName: 'text-text',
                  descriptionSubClassName: 'text-text',
                  descriptionSubVariant: 'small',
                  onClick: () => {
                    navigate();
                    toast.dismiss(toastId);
                  }
                })}
              </div>
            ),
            {
              // id: 'dai-received-upgrade',
              classNames: {
                content: 'w-full'
              },
              duration
            }
          );
        }, delay);
      }
    },
    [isTradeModule, isUpgradeModule, action, navigate, isL2, url]
  );

  const onNotification = useCallback(
    ({
      title,
      description,
      status,
      type
    }: {
      title: string;
      description: string;
      status: TxStatus;
      type?: NotificationType;
    }) => {
      const now = Date.now();
      const lastNotif = lastNotificationRef.current;

      // Check if this is a duplicate notification (same type and title within debounce window)
      const isDuplicate =
        lastNotif.type === type &&
        lastNotif.title === title &&
        now - lastNotif.timestamp < NOTIFICATION_DEBOUNCE_MS;

      if (isDuplicate) {
        return; // Skip duplicate notification
      }

      // Update last notification tracking
      lastNotificationRef.current = {
        type,
        title,
        timestamp: now
      };

      if (!isRestricted && type === NotificationType.INSUFFICIENT_BALANCE) {
        handleInsufficientBalance();
      } else if (type && type !== NotificationType.INSUFFICIENT_BALANCE) {
        if (status === TxStatus.SUCCESS) {
          toast.success(title, {
            unstyled: true,
            description,
            duration,
            className: 'justify-start'
          });
        } else {
          toast.error(title, {
            unstyled: true,
            description,
            duration,
            className: 'justify-start'
          });
        }
        handleTokenReceived(type);
      }
    },
    [isRestricted, handleInsufficientBalance, handleTokenReceived]
  );

  return onNotification;
};
