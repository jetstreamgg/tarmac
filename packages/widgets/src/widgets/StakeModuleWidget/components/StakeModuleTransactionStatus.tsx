import { useContext, useEffect } from 'react';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { TransactionStatus } from '@widgets/shared/components/ui/transaction/TransactionStatus';
import { TxCardCopyText } from '@widgets/shared/types/txCardCopyText';
import { i18n } from '@lingui/core';
import { t } from '@lingui/core/macro';
import {
  TOKENS,
  useRewardContractTokens,
  useDelegateOwner,
  useStakeUrnSelectedRewardContract,
  useStakeUrnSelectedVoteDelegate,
  ZERO_ADDRESS
} from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { approveLoadingButtonText } from '@widgets/shared/constants';
import {
  claimLoadingButtonText,
  claimSubtitle,
  claimTitle,
  StakeAction,
  stakeApproveSubtitle,
  stakeApproveTitle,
  StakeFlow,
  stakeLoadingButtonText,
  StakeScreen,
  getStakeTitle,
  getStakeSubtitle,
  stakeApproveDescription,
  repayApproveDescription
} from '../lib/constants';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { TokenIconWithBalance } from '@widgets/shared/components/ui/token/TokenIconWithBalance';
import { Text } from '@widgets/shared/components/ui/Typography';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { StakeModuleWidgetContext } from '../context/context';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { useDelegateName } from '@jetstreamgg/sky-hooks';
import { JazziconComponent } from './Jazzicon';
import { needsDelegateUpdate, needsRewardUpdate } from '../lib/utils';
import React from 'react';
import { motion } from 'framer-motion';

type StakeModuleTransactionProps = {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

function TransactionDetail() {
  const {
    skyToLock,
    skyToFree,
    usdsToBorrow,
    usdsToWipe,
    wipeAll,
    selectedRewardContract,
    selectedDelegate,
    activeUrn
  } = useContext(StakeModuleWidgetContext);
  const { data: rewardContractTokens } = useRewardContractTokens(selectedRewardContract);

  const { data: selectedDelegateName } = useDelegateName(selectedDelegate);
  const { data: selectedDelegateOwner } = useDelegateOwner(selectedDelegate);

  const { data: urnSelectedRewardContract } = useStakeUrnSelectedRewardContract({
    urn: activeUrn?.urnAddress || ZERO_ADDRESS
  });
  const { data: urnSelectedVoteDelegate } = useStakeUrnSelectedVoteDelegate({
    urn: activeUrn?.urnAddress || ZERO_ADDRESS
  });

  const showSealing = !!skyToLock && skyToLock > 0n;
  const showUnsealing = !!skyToFree && skyToFree > 0n;
  const showBorrowing = !!usdsToBorrow && usdsToBorrow > 0n;
  const showRepaying = (!!usdsToWipe && usdsToWipe > 0n) || wipeAll;
  const showReward =
    needsRewardUpdate(activeUrn?.urnAddress, selectedRewardContract, urnSelectedRewardContract) &&
    rewardContractTokens;
  const showDelegate =
    needsDelegateUpdate(activeUrn?.urnAddress, selectedDelegate, urnSelectedVoteDelegate) &&
    selectedDelegateOwner &&
    selectedDelegateName;

  const transactionComponents = [
    {
      show: showSealing,
      component: (
        <VStack gap={3} className="mt-2">
          <Text variant="medium" className="text-textSecondary leading-4">
            Staking
          </Text>
          <TokenIconWithBalance token={TOKENS.sky} balance={formatBigInt(skyToLock)} textLarge />
        </VStack>
      )
    },
    {
      show: showUnsealing,
      component: (
        <VStack gap={3} className="mt-2">
          <Text variant="medium" className="text-textSecondary leading-4">
            Unstaking
          </Text>
          <TokenIconWithBalance token={TOKENS.sky} balance={formatBigInt(skyToFree)} textLarge />
        </VStack>
      )
    },
    {
      show: showReward,
      component: rewardContractTokens ? (
        <VStack gap={3} className="mt-2">
          <Text variant="medium" className="text-textSecondary leading-4">
            Staking reward
          </Text>
          <HStack gap={2}>
            <TokenIcon token={rewardContractTokens.rewardsToken} width={24} className="h-6 w-6 text-[18px]" />
            <Text>{rewardContractTokens.rewardsToken.symbol}</Text>
          </HStack>
        </VStack>
      ) : null
    },
    {
      show: showBorrowing,
      component: (
        <VStack gap={3} className="mt-2">
          <Text variant="medium" className="text-textSecondary leading-4">
            Borrowing
          </Text>
          <TokenIconWithBalance token={TOKENS.usds} balance={formatBigInt(usdsToBorrow)} textLarge />
        </VStack>
      )
    },
    {
      show: showRepaying,
      component: (
        <VStack gap={3} className="mt-2">
          <Text variant="medium" className="text-textSecondary leading-4">
            Repaying
          </Text>
          <TokenIconWithBalance token={TOKENS.usds} balance={formatBigInt(usdsToWipe)} textLarge />
        </VStack>
      )
    },
    {
      show: showDelegate && selectedDelegateOwner && selectedDelegateName,
      component: (
        <VStack gap={3} className="mt-2">
          <Text variant="medium" className="text-textSecondary leading-4">
            Delegate
          </Text>
          <HStack gap={2}>
            <JazziconComponent address={selectedDelegateOwner} />
            <Text>{selectedDelegateName}</Text>
          </HStack>
        </VStack>
      )
    }
  ];

  const transactionComponentsToShow = transactionComponents.filter(item => item.show);

  return (
    <motion.div className="py-4" variants={positionAnimations}>
      <div className="grid w-full grid-cols-2 gap-4">
        {transactionComponentsToShow.map((item, index) => (
          <React.Fragment key={index}>{item.component}</React.Fragment>
        ))}
      </div>
    </motion.div>
  );
}

export const StakeModuleTransactionStatus = ({ onExternalLinkClicked }: StakeModuleTransactionProps) => {
  const {
    setTxTitle,
    setTxSubtitle,
    txStatus: txStatus_,
    widgetState,
    setStep,
    setStepTwoTitle,
    setLoadingText,
    setOriginToken,
    setOriginAmount,
    setTxDescription
  } = useContext(WidgetContext);
  const { skyToLock, usdsToBorrow, skyToFree, usdsToWipe } = useContext(StakeModuleWidgetContext);

  const { flow, action, screen } = widgetState;

  const txStatus = txStatus_ as keyof TxCardCopyText;

  // This sets the correct token and amount in the transaction screens
  useEffect(() => {
    setOriginToken(
      skyToLock && skyToLock > 0n ? TOKENS.sky : usdsToWipe && usdsToWipe > 0n ? TOKENS.usds : undefined
    );
    setOriginAmount(
      skyToLock && skyToLock > 0n ? skyToLock : usdsToWipe && usdsToWipe > 0n ? usdsToWipe : undefined
    );
  }, [skyToLock]);

  // Sets the title and subtitle of the card
  useEffect(() => {
    if (flow === StakeFlow.OPEN) setStepTwoTitle(t`Open a position`);
    if (flow === StakeFlow.MANAGE) setStepTwoTitle(t`Update Position`);

    // Both flows will have the same approval copy
    if (action === StakeAction.APPROVE && screen === StakeScreen.TRANSACTION) {
      setStep(1);
      setLoadingText(i18n._(approveLoadingButtonText[txStatus]));
      setTxTitle(i18n._(stakeApproveTitle[txStatus]));
      setTxSubtitle(i18n._(stakeApproveSubtitle[txStatus]));
      setTxDescription(
        i18n._(
          usdsToWipe && usdsToWipe > 0n ? repayApproveDescription : stakeApproveDescription[TOKENS.sky.symbol]
        )
      );
    } else if (action === StakeAction.MULTICALL && screen === StakeScreen.TRANSACTION) {
      setStep(2);
      setLoadingText(
        i18n._(
          stakeLoadingButtonText({
            flow,
            txStatus
          })
        )
      );

      setTxTitle(i18n._(getStakeTitle(txStatus, flow)));
      setTxSubtitle(
        i18n._(
          getStakeSubtitle({
            flow,
            txStatus,
            collateralToLock: !!skyToLock && skyToLock > 0n ? formatBigInt(skyToLock) : undefined,
            borrowAmount: usdsToBorrow && usdsToBorrow > 0n ? formatBigInt(usdsToBorrow) : undefined,
            collateralToFree: skyToFree && skyToFree > 0n ? formatBigInt(skyToFree) : undefined,
            borrowToRepay: usdsToWipe && usdsToWipe > 0n ? formatBigInt(usdsToWipe) : undefined,
            selectedToken: TOKENS.sky.symbol
          })
        )
      );
    } else if (action === StakeAction.CLAIM && screen === StakeScreen.TRANSACTION) {
      setLoadingText(i18n._(claimLoadingButtonText({ txStatus })));
      setTxTitle(i18n._(claimTitle[txStatus]));
      setTxSubtitle(i18n._(claimSubtitle[txStatus]));
    }
  }, [txStatus, screen, flow, action, i18n.locale]);

  return (
    <TransactionStatus
      onExternalLinkClicked={onExternalLinkClicked}
      transactionDetail={action === StakeAction.MULTICALL ? <TransactionDetail /> : undefined}
    />
  );
};
