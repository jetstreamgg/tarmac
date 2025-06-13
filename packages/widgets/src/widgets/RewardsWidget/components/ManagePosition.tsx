import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { RewardContract, WriteHook } from '@jetstreamgg/sky-hooks';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@widgets/components/ui/tabs';
import { TokenInput } from '@widgets/shared/components/ui/token/TokenInput';
import { SelectedRewardsCard } from './SelectedRewardsCard';
import { motion } from 'framer-motion';
import { RewardsFlow } from '../lib/constants';
import { positionAnimations } from '@widgets/shared/animation/presets';

type Props = {
  amount: bigint;
  error: boolean;
  isConnectedAndEnabled: boolean;
  rewardContract?: RewardContract;
  tokenBalance?: bigint;
  suppliedBalance?: bigint;
  rewardsBalance?: bigint;
  claim?: WriteHook;
  onChange: (val: bigint, userTriggered?: boolean) => void;
  onToggle: (number: 0 | 1) => void;
  onClaimClick: () => void;
  tabIndex: 0 | 1;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

export function ManagePosition({
  rewardContract,
  tokenBalance,
  suppliedBalance,
  rewardsBalance,
  claim,
  amount,
  error,
  onChange,
  onToggle,
  onClaimClick,
  tabIndex,
  isConnectedAndEnabled,
  onExternalLinkClicked
}: Props) {
  return (
    <VStack className="items-stretch">
      <Tabs value={tabIndex === 0 ? RewardsFlow.SUPPLY : RewardsFlow.WITHDRAW} className="space-y-4">
        <motion.div variants={positionAnimations}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger
              position="left"
              data-testid="rewards-toggle-left"
              value={RewardsFlow.SUPPLY}
              onClick={() => onToggle(0)}
            >
              <Trans>Supply</Trans>
            </TabsTrigger>
            <TabsTrigger
              position="right"
              data-testid="rewards-toggle-right"
              value={RewardsFlow.WITHDRAW}
              onClick={() => onToggle(1)}
            >
              <Trans>Withdraw</Trans>
            </TabsTrigger>
          </TabsList>
        </motion.div>
        <motion.div variants={positionAnimations}>
          {rewardContract && (
            <SelectedRewardsCard
              rewardContract={rewardContract}
              rewardsBalance={rewardsBalance}
              claim={claim}
              isConnectedAndEnabled={isConnectedAndEnabled}
              onClaimClick={onClaimClick}
              onExternalLinkClicked={onExternalLinkClicked}
            />
          )}
        </motion.div>
        <TabsContent value={RewardsFlow.SUPPLY}>
          <motion.div variants={positionAnimations}>
            <TokenInput
              token={rewardContract?.supplyToken}
              tokenList={[]}
              className="w-full"
              balance={tokenBalance}
              onChange={(val, event) => onChange(val, !!event)}
              value={amount}
              dataTestId="supply-input-rewards"
              label={t`How much ${rewardContract?.supplyToken.name ?? ''} would you like to supply?`}
              error={error ? t`Insufficient funds` : undefined}
              showPercentageButtons={isConnectedAndEnabled}
              enabled={isConnectedAndEnabled}
            />
          </motion.div>
        </TabsContent>
        <TabsContent value={RewardsFlow.WITHDRAW}>
          <motion.div variants={positionAnimations}>
            <TokenInput
              token={rewardContract?.supplyToken}
              tokenList={[]}
              className="w-full"
              balance={suppliedBalance}
              onChange={(val, event) => onChange(val, !!event)}
              value={amount}
              dataTestId="withdraw-input-rewards"
              label={t`How much ${rewardContract?.supplyToken.name ?? ''} would you like to withdraw?`}
              error={error ? t`Insufficient funds` : undefined}
              showPercentageButtons={isConnectedAndEnabled}
              enabled={isConnectedAndEnabled}
            />
          </motion.div>
        </TabsContent>
      </Tabs>
    </VStack>
  );
}
