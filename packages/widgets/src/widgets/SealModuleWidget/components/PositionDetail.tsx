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
  useDelegateOwner,
  useVault,
  ZERO_ADDRESS,
  useUrnAddress,
  useUrnSelectedRewardContract,
  useUrnSelectedVoteDelegate,
  useIsSealUrnAuth
} from '@jetstreamgg/hooks';
import { captitalizeFirstLetter, formatBigInt, formatPercent, math } from '@jetstreamgg/utils';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { getRiskTextColor } from '../lib/utils';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';
import { Warning } from '@widgets/shared/components/icons/Warning';
import { ExternalLink } from '@widgets/shared/components/ExternalLink';
import { JazziconComponent } from './Jazzicon';
import { TextWithTooltip } from '@widgets/shared/components/ui/tooltip/TextWithTooltip';
import { PositionDetailAccordion } from './PositionDetailsAccordion';
import { ClaimRewardsButton } from './ClaimRewardsButton';
import { useCallback, useContext } from 'react';
import { SealModuleWidgetContext } from '../context/context';
import { Button } from '@widgets/components/ui/button';
import { SealAction, SealFlow, SealStep } from '../lib/constants';
import { WidgetState } from '@widgets/index';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { OnSealUrnChange } from '../lib/types';
import { Success } from '@widgets/shared/components/icons/Success';

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
  isMigrated?: boolean;
  onNavigateToMigratedUrn?: (index?: bigint) => void;
  onSealUrnChange?: OnSealUrnChange;
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
  isMigrated,
  onNavigateToMigratedUrn,
  onSealUrnChange
}: Props) {
  const { data: rewardContractTokens } = useRewardContractTokens(selectedRewardContract);
  const { data: selectedDelegateName } = useDelegateName(selectedVoteDelegate);
  const { data: selectedDelegateOwner } = useDelegateOwner(selectedVoteDelegate);
  const { data: sealRewardContracts } = useSaRewardContracts();
  const { displayToken, setDisplayToken } = useContext(SealModuleWidgetContext);
  const { data: isOldUrnAuth } = useIsSealUrnAuth({
    urnIndex: index || 0n
  });
  const needsOldUrnAuth = isOldUrnAuth === undefined || !isOldUrnAuth;

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
      <MigrateButton
        isMigrated={isMigrated}
        index={index}
        onNavigateToMigratedUrn={onNavigateToMigratedUrn}
        sealedAmount={sealedAmount}
        onSealUrnChange={onSealUrnChange}
        borrowedAmount={borrowedAmount}
        needsOldUrnAuth={needsOldUrnAuth}
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

const MigrateButton = ({
  isMigrated,
  index,
  sealedAmount,
  onNavigateToMigratedUrn,
  onSealUrnChange,
  borrowedAmount,
  needsOldUrnAuth
}: {
  isMigrated?: boolean;
  index: bigint;
  onNavigateToMigratedUrn?: (index?: bigint) => void;
  onSealUrnChange?: OnSealUrnChange;
  sealedAmount?: bigint;
  borrowedAmount?: bigint;
  needsOldUrnAuth?: boolean;
}) => {
  const { setWidgetState } = useContext(WidgetContext);
  const { setCurrentStep, setSelectedRewardContract, setSelectedDelegate, setActiveUrn } =
    useContext(SealModuleWidgetContext);

  //TODO this stuff is just to help  mock the transaction screens temporarily
  const { data: urnAddress } = useUrnAddress(index);
  const { data: urnSelectedRewardContract } = useUrnSelectedRewardContract({
    urn: urnAddress || ZERO_ADDRESS
  });
  const { data: urnSelectedVoteDelegate } = useUrnSelectedVoteDelegate({ urn: urnAddress || ZERO_ADDRESS });
  const { data: vaultData } = useVault(urnAddress || ZERO_ADDRESS);

  const handleOnClick = useCallback(() => {
    if (urnAddress && urnAddress !== ZERO_ADDRESS && urnSelectedRewardContract) {
      setSelectedRewardContract(urnSelectedRewardContract);
    } else {
      setSelectedRewardContract(undefined);
    }
    if (urnAddress && urnAddress !== ZERO_ADDRESS && urnSelectedVoteDelegate) {
      setSelectedDelegate(urnSelectedVoteDelegate);
    } else {
      setSelectedDelegate(undefined);
    }

    setWidgetState((prev: WidgetState) => ({
      ...prev,
      flow: SealFlow.MIGRATE,
      action: SealAction.MULTICALL
    }));

    setActiveUrn({ urnAddress, urnIndex: index }, onSealUrnChange ?? (() => {}));
    setCurrentStep(SealStep.ABOUT);
  }, [urnAddress, index, vaultData, urnSelectedVoteDelegate, urnSelectedRewardContract]);

  if (isMigrated === undefined) return null;

  if (isMigrated) {
    return (
      <>
        <Text variant="small" className="text-warning text-center">
          This position has been migrated to the new Staking Engine.
        </Text>
        {onNavigateToMigratedUrn && (
          <Button variant="primaryAlt" className="mt-2 w-full" onClick={() => onNavigateToMigratedUrn(index)}>
            <Text>Manage position in Staking Engine</Text>
          </Button>
        )}
      </>
    );
  }

  // TODO: turn this back on after testing is done
  if (sealedAmount === undefined || sealedAmount === 0n) {
    return (
      <Text variant="small" className="text-warning text-center">
        Only positions with collateral can be migrated.
      </Text>
    );
  }

  return (
    <VStack gap={3}>
      {!borrowedAmount && (
        <Text variant="captionSm" className="text-warning text-center">
          Note: It will be more gas-efficient to manually close this position and open a new one in the
          Staking Engine.
        </Text>
      )}
      <Button
        variant="primaryAlt"
        onClick={handleOnClick}
        // disabled={!!rewardContractToClaim && indexToClaim !== undefined}
      >
        <Text>Migrate Position</Text>
      </Button>
      {!needsOldUrnAuth && (
        <HStack className="items-center justify-between">
          <Text variant="captionSm">This position has been approved for migration</Text>
          <Success />
        </HStack>
      )}
    </VStack>
  );
};
