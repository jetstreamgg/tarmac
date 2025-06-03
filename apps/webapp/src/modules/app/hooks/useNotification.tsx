import { NotificationType, TxStatus } from '@jetstreamgg/widgets';
import { Toast, toast } from '@/components/ui/use-toast';
import { LinkedAction } from '@/modules/ui/hooks/useUserSuggestedActions';
import { HStack } from '@/modules/layout/components/HStack';
import { t } from '@lingui/core/macro';
import { VStack } from '@/modules/layout/components/VStack';
import { Button } from '@/components/ui/button';
import { capitalizeFirstLetter } from '@/lib/helpers/string/capitalizeFirstLetter';
import { Text, TextProps } from '@/modules/layout/components/Typography';
import { useCallback } from 'react';
import { usePrepareNotification } from './usePrepareNotification';
import { RewardsModule } from '@/modules/icons';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { PopoverInfo } from '@/modules/ui/components/PopoverInfo';

const generateToastConfig = ({
  title,
  description,
  descriptionSub,
  buttonTxt,
  descriptionVariant = 'small',
  descriptionSubVariant,
  descriptionClassName = 'text-selectActive',
  descriptionSubClassName,
  variant = 'info',
  icon,
  onClick,
  rateType
}: {
  title: string;
  description: string;
  descriptionSub: string;
  buttonTxt: string;
  descriptionVariant?: TextProps['variant'];
  descriptionSubVariant?: TextProps['variant'];
  descriptionClassName?: string;
  descriptionSubClassName?: string;
  variant?: Toast['variant'];
  icon?: React.ReactNode;
  rateType?: 'ssr' | 'str';
  onClick: () => void;
}) =>
  ({
    title,
    description: (
      <HStack className="w-full justify-between">
        <VStack className="mt-4">
          <Text variant={descriptionVariant} className={descriptionClassName}>
            {description}
          </Text>
          <HStack>
            <Text variant={descriptionSubVariant} className={descriptionSubClassName}>
              {descriptionSub}
            </Text>
            {!!rateType && <PopoverInfo type={rateType} />}
          </HStack>
        </VStack>
        <Button className="place-self-end" variant="pill" size="xs" onClick={onClick}>
          {buttonTxt}
        </Button>
      </HStack>
    ),
    variant,
    icon
  }) as Toast;

export const useNotification = () => {
  const isRestricted = import.meta.env.VITE_RESTRICTED_BUILD === 'true';
  const { linkedActionConfig } = useConfigContext();
  const {
    navigate,
    action,
    rewardContract,
    rewardContractRate: rate,
    savingsRate,
    isSavingsModule,
    isRewardsModule,
    isTradeModule,
    isUpgradeModule
  } = usePrepareNotification();

  const handleInsufficientBalance = useCallback(() => {
    if (!action) return;

    const buttonTxt =
      action?.intent && (action as LinkedAction).la
        ? `${capitalizeFirstLetter(action.intent)} & ${capitalizeFirstLetter((action as LinkedAction).la)}`
        : `${capitalizeFirstLetter(action?.intent || '')}`;

    if (isRewardsModule) {
      toast(
        generateToastConfig({
          title: t`Looks like you need ${rewardContract?.supplyToken.symbol?.toUpperCase() ?? 'tokens'} to get rewards`,
          description: `${rewardContract?.name ?? 'Reward'} Reward Rate`,
          descriptionSub: rate || '',
          buttonTxt,
          rateType: 'str',
          onClick: navigate
        })
      );
    } else if (isSavingsModule) {
      toast(
        generateToastConfig({
          title: t`Looks like you need USDS`,
          description: 'Sky Savings Rate',
          descriptionSub: savingsRate || '',
          buttonTxt,
          rateType: 'ssr',
          onClick: navigate
        })
      );
    }
  }, [action, isRewardsModule, isSavingsModule, rewardContract, rate, savingsRate, navigate]);

  const handleTokenReceived = useCallback(
    (type: NotificationType) => {
      // Don't show the toast if the user is in a LA flow
      if (linkedActionConfig.showLinkedAction) return;

      if (type === NotificationType.USDS_RECEIVED && (isTradeModule || isUpgradeModule) && action) {
        setTimeout(() => {
          toast(
            generateToastConfig({
              title: t`Get rewards with USDS`,
              description: t`Get rewards with your USDS`,
              descriptionSub: t`See all rewards`,
              buttonTxt: t`Get rewards`,
              onClick: navigate,
              variant: 'custom',
              icon: <RewardsModule />
            })
          );
        }, 4000);
      } else if (type === NotificationType.DAI_RECEIVED && action && isTradeModule) {
        setTimeout(() => {
          toast(
            generateToastConfig({
              title: t`Upgrade and get rewards`,
              description: t`Upgrade DAI to USDS`,
              descriptionSub: t`then get rewards`,
              buttonTxt: t`Upgrade and get rewards`,
              descriptionClassName: 'text-text',
              descriptionSubClassName: 'text-text',
              descriptionSubVariant: 'small',
              onClick: navigate,
              variant: 'custom',
              icon: <RewardsModule />
            })
          );
        }, 4000);
      }
    },
    [isTradeModule, isUpgradeModule, action, navigate]
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
      if (!isRestricted && type === NotificationType.INSUFFICIENT_BALANCE) {
        handleInsufficientBalance();
      } else if (type && type !== NotificationType.INSUFFICIENT_BALANCE) {
        toast({
          title,
          description,
          variant: status === TxStatus.SUCCESS ? 'success' : 'failure',
          duration: 3500
        });
        handleTokenReceived(type);
      }
    },
    [isRestricted, handleInsufficientBalance, handleTokenReceived]
  );

  return onNotification;
};
