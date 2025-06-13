import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { Text } from '@widgets/shared/components/ui/Typography';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { TokenIconWithBalance } from '@widgets/shared/components/ui/token/TokenIconWithBalance';
import {
  RiskLevel,
  TOKENS,
  useRewardContractTokens,
  useDelegateName,
  useSaRewardContracts,
  useDelegateOwner
} from '@jetstreamgg/sky-hooks';
import { captitalizeFirstLetter, formatBigInt, formatPercent, math } from '@jetstreamgg/sky-utils';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { getRiskTextColor } from '../lib/utils';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { Warning } from '@widgets/shared/components/icons/Warning';
import { ExternalLink } from '@widgets/shared/components/ExternalLink';
import { JazziconComponent } from './Jazzicon';
import { TextWithTooltip } from '@widgets/shared/components/ui/tooltip/TextWithTooltip';
import { PositionDetailAccordion } from './PositionDetailsAccordion';
import { ClaimRewardsButton } from './ClaimRewardsButton';
import { useContext } from 'react';
import { SealModuleWidgetContext } from '../context/context';

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
  claimExecute
}: Props) {
  const { data: rewardContractTokens } = useRewardContractTokens(selectedRewardContract);
  const { data: selectedDelegateName } = useDelegateName(selectedVoteDelegate);
  const { data: selectedDelegateOwner } = useDelegateOwner(selectedVoteDelegate);
  const { data: sealRewardContracts } = useSaRewardContracts();
  const { displayToken, setDisplayToken } = useContext(SealModuleWidgetContext);

  const riskTextColor = getRiskTextColor(riskLevel as RiskLevel);

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
              <TextWithTooltip
                text="Collateralization ratio"
                tooltip="The ratio between the value of collateral you've provided and the amount you've borrowed against that collateral."
                contentClassname="w-[400px]"
                textClassName="leading-4"
                gap={1}
                iconClassName="text-textSecondary"
              />
              <Text className={`${riskTextColor}`}>{formatPercent(collateralizationRatio)}</Text>
            </VStack>
          )}
          <VStack gap={3}>
            <Text variant="medium" className="text-textSecondary leading-4">
              Sealed
            </Text>
            <TokenIconWithBalance
              token={displayToken}
              balance={formatBigInt(
                displayToken === TOKENS.mkr
                  ? sealedAmount || 0n
                  : math.calculateConversion(TOKENS.mkr, sealedAmount || 0n)
              )}
            />
          </VStack>
          {rewardContractTokens && (
            <VStack gap={3}>
              <Text variant="medium" className="text-textSecondary leading-4">
                Reward
              </Text>
              <div className="flex items-start">
                <TokenIcon token={rewardContractTokens.rewardsToken} width={24} className="h-6 w-6" />
                <Text className="ml-2">{rewardContractTokens.rewardsToken.symbol}</Text>
              </div>
            </VStack>
          )}
        </VStack>
        <VStack gap={6} className="w-1/2">
          {/* only display risk level when active debt/borrow amount is > 0 */}
          {!!riskLevel && borrowedAmount !== undefined && borrowedAmount > 0n && (
            <VStack gap={3}>
              <TextWithTooltip
                text="Risk level"
                tooltip="Risk level indicates the likelihood of your collateral being liquidated. This is primarily determined by your Loan-to-Value (LTV) ratio, which represents the amount you've borrowed compared to the value of your crypto collateral. A high risk level means your collateral is close to the liquidation price threshold, and most vulnerable to market changes. A medium risk level means you have a reasonable balance between borrowing power and a safety buffer. A low risk level means you have a comparatively wider safety next against price fluctuations."
                textClassName="leading-4"
                contentClassname="w-[400px]"
                gap={1}
                iconClassName="text-textSecondary"
              />
              {liquidationData?.isInLiquidatedState ? (
                <Text className={'text-error text-right text-sm'}>Liquidated</Text>
              ) : (
                <Text className={`${riskTextColor}`}>{captitalizeFirstLetter(riskLevel.toLowerCase())}</Text>
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
      <PositionDetailAccordion
        displayToken={displayToken}
        setDisplayToken={setDisplayToken}
        collateralizationRatio={collateralizationRatio}
        riskLevel={riskLevel}
        sealedAmount={sealedAmount}
        borrowedAmount={borrowedAmount}
        liquidationData={liquidationData}
        delayedPrice={delayedPrice}
        liquidationPrice={liquidationPrice}
      />
      <>
        {sealRewardContracts &&
          urnAddress &&
          sealRewardContracts.map(({ contractAddress }) => (
            <ClaimRewardsButton
              key={`${index}-${contractAddress}`}
              rewardContract={contractAddress}
              urnAddress={urnAddress}
              index={index}
              claimPrepared={claimPrepared}
              claimExecute={claimExecute}
            />
          ))}
      </>
    </MotionVStack>
  );
}
