import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { TokenIconWithBalance } from '@widgets/shared/components/ui/token/TokenIconWithBalance';
import {
  RiskLevel,
  TOKENS,
  useRewardContractTokens,
  useDelegateName,
  useDelegateOwner,
  useStakeRewardContracts,
  lsSkyUsdsRewardAddress
} from '@jetstreamgg/sky-hooks';
import { capitalizeFirstLetter, formatBigInt, formatPercent } from '@jetstreamgg/sky-utils';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { getRiskTextColor } from '../lib/utils';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { Warning } from '@widgets/shared/components/icons/Warning';
import { ExternalLink } from '@widgets/shared/components/ExternalLink';
import { JazziconComponent } from './Jazzicon';
import { PopoverInfo } from '@widgets/shared/components/ui/PopoverInfo';
import { PositionDetailAccordion } from './PositionDetailsAccordion';
import { ClaimRewardsDropdown } from './ClaimRewardsDropdown';
import { getTooltipById } from '../../../data/tooltips';
import { useChainId } from 'wagmi';
import { UpdateRewardSelection } from './UpdateRewardSelection';
import { YellowWarning } from '@widgets/shared/components/icons/YellowWarning';
import { OnStakeUrnChange } from '..';

type Props = {
  collateralizationRatio?: bigint;
  riskLevel?: string;
  selectedRewardContract?: `0x${string}`;
  selectedVoteDelegate?: `0x${string}`;
  sealedAmount?: bigint;
  borrowedAmount?: bigint;
  liquidationData?: {
    isInLiquidatedState: boolean;
    urnAddress: string;
    liquidationAuctionUrl: string;
  };
  delayedPrice?: bigint;
  liquidationPrice?: bigint;
  urnAddress?: `0x${string}`;
  index: bigint;
  claimPrepared: boolean;
  claimExecute: () => void;
  claimAllPrepared: boolean;
  claimAllExecute: () => void;
  batchEnabledAndSupported: boolean;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  onStakeUrnChange?: OnStakeUrnChange;
};

// Copied from TransactionDetail, it could be reusable
export function PositionDetail({
  collateralizationRatio,
  riskLevel,
  selectedRewardContract,
  selectedVoteDelegate,
  sealedAmount,
  borrowedAmount,
  liquidationData,
  delayedPrice,
  liquidationPrice,
  urnAddress,
  index,
  claimPrepared,
  claimExecute,
  claimAllPrepared,
  claimAllExecute,
  batchEnabledAndSupported,
  onExternalLinkClicked,
  onStakeUrnChange
}: Props) {
  const { data: rewardContractTokens } = useRewardContractTokens(selectedRewardContract);
  const { data: selectedDelegateName } = useDelegateName(selectedVoteDelegate);
  const { data: selectedDelegateOwner } = useDelegateOwner(selectedVoteDelegate);
  const { data: stakeRewardContracts } = useStakeRewardContracts();

  const riskTextColor = getRiskTextColor(riskLevel as RiskLevel);

  const chainId = useChainId();
  const isUsdsReward =
    selectedRewardContract?.toLowerCase() ===
    lsSkyUsdsRewardAddress[chainId as keyof typeof lsSkyUsdsRewardAddress]?.toLowerCase();

  return (
    <MotionVStack variants={positionAnimations} className="mt-4 justify-between space-y-6">
      {liquidationData?.isInLiquidatedState && (
        <div className="flex items-center gap-2">
          <div>
            <Warning boxSize={16} viewBox="0 0 16 16" />
          </div>
          {/* TODO add link to FAQ */}
          <Text className="text-error text-xs">
            Your vault has been liquidated. For more info read the FAQs or please visit{' '}
            <ExternalLink
              className="text-error underline"
              showIcon={false}
              href={liquidationData?.liquidationAuctionUrl}
            >
              unified-auctions.makerdao.com
            </ExternalLink>
          </Text>
        </div>
      )}
      <HStack className="justify-between">
        <VStack gap={6} className="w-1/2">
          {/* only display collateralization ratio when > 0 */}
          {collateralizationRatio !== undefined && collateralizationRatio !== 0n && (
            <VStack gap={3}>
              <Text variant="medium" className="text-textSecondary leading-4">
                Collateralization ratio
                <PopoverInfo
                  title={getTooltipById('collateralization-ratio')?.title || 'Collateralization ratio'}
                  description={getTooltipById('collateralization-ratio')?.tooltip || ''}
                  iconClassName="text-textSecondary ml-1"
                />
              </Text>
              <Text className={`${riskTextColor}`}>{formatPercent(collateralizationRatio)}</Text>
            </VStack>
          )}
          <VStack gap={3}>
            <Text variant="medium" className="text-textSecondary leading-4">
              Staked
            </Text>
            <TokenIconWithBalance token={TOKENS.sky} balance={formatBigInt(sealedAmount || 0n)} />
          </VStack>
          {rewardContractTokens && (
            <VStack gap={3}>
              <Text variant="medium" className="text-textSecondary leading-4">
                Reward
              </Text>
              <div className="ml-8 flex items-center justify-start gap-1">
                <UpdateRewardSelection
                  rewardToken={rewardContractTokens.rewardsToken}
                  urnAddress={urnAddress}
                  index={index}
                  selectedVoteDelegate={selectedVoteDelegate}
                  onExternalLinkClicked={onExternalLinkClicked}
                  onStakeUrnChange={onStakeUrnChange}
                />
              </div>
            </VStack>
          )}
        </VStack>
        <VStack gap={6} className="w-1/2">
          {/* only display risk level when active debt/borrow amount is > 0 */}
          {!!riskLevel && borrowedAmount !== undefined && borrowedAmount > 0n && (
            <VStack gap={3}>
              <Text variant="medium" className="text-textSecondary leading-4">
                Risk level
                <PopoverInfo
                  title={getTooltipById('risk-level')?.title || 'Risk level'}
                  description={getTooltipById('risk-level')?.tooltip || ''}
                  iconClassName="text-textSecondary ml-1"
                />
              </Text>
              {liquidationData?.isInLiquidatedState ? (
                <Text className={'text-error text-right text-sm'}>Liquidated</Text>
              ) : (
                <Text className={`${riskTextColor}`}>{capitalizeFirstLetter(riskLevel.toLowerCase())}</Text>
              )}
            </VStack>
          )}
          {borrowedAmount !== undefined && (
            <VStack gap={3}>
              <Text variant="medium" className="text-textSecondary leading-4">
                Borrowing
              </Text>
              <TokenIconWithBalance token={TOKENS.usds} balance={formatBigInt(borrowedAmount)} />
            </VStack>
          )}

          {selectedDelegateOwner && selectedDelegateName && (
            <VStack gap={3}>
              <Text variant="medium" className="text-textSecondary leading-4">
                Delegate
              </Text>
              <div className="flex items-start">
                <JazziconComponent address={selectedDelegateOwner} />
                <Text className="ml-2">{selectedDelegateName}</Text>
              </div>
            </VStack>
          )}
        </VStack>
      </HStack>
      {isUsdsReward && (
        <HStack gap={2} className="items-center">
          <YellowWarning boxSize={16} viewBox="0 0 16 16" className="flex-shrink-0" />
          <Text className="text-textSecondary text-sm">
            <span className="font-bold text-white">Upgrade your reward selection.</span> USDS rewards are no
            longer available in favor of new SKY rewards.
          </Text>
        </HStack>
      )}
      <PositionDetailAccordion
        collateralizationRatio={collateralizationRatio}
        riskLevel={riskLevel}
        sealedAmount={sealedAmount}
        borrowedAmount={borrowedAmount}
        liquidationData={liquidationData}
        delayedPrice={delayedPrice}
        liquidationPrice={liquidationPrice}
      />
      {stakeRewardContracts && urnAddress && (
        <ClaimRewardsDropdown
          stakeRewardContracts={stakeRewardContracts}
          urnAddress={urnAddress}
          index={index}
          claimPrepared={claimPrepared}
          claimExecute={claimExecute}
          claimAllPrepared={claimAllPrepared}
          claimAllExecute={claimAllExecute}
          batchEnabledAndSupported={batchEnabledAndSupported}
        />
      )}
    </MotionVStack>
  );
}
