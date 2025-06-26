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
  useUrnSelectedRewardContract,
  useUrnSelectedVoteDelegate,
  ZERO_ADDRESS
} from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { approveLoadingButtonText } from '@widgets/shared/constants';
import {
  claimLoadingButtonText,
  claimSubtitle,
  claimTitle,
  SealAction,
  sealApproveSubtitle,
  sealApproveTitle,
  SealFlow,
  sealLoadingButtonText,
  SealScreen,
  getSealTitle,
  getSealSubtitle,
  sealApproveDescription,
  repayApproveDescription
} from '../lib/constants';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { TokenIconWithBalance } from '@widgets/shared/components/ui/token/TokenIconWithBalance';
import { Text } from '@widgets/shared/components/ui/Typography';
import { VStack } from '@widgets/shared/components/ui/layout/VStack';
import { SealModuleWidgetContext } from '../context/context';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { useDelegateName } from '@jetstreamgg/sky-hooks';
import { JazziconComponent } from './Jazzicon';
import { needsDelegateUpdate, needsRewardUpdate } from '../lib/utils';
import React from 'react';
import { motion } from 'framer-motion';

type SealModuleTransactionProps = {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

function TransactionDetail() {
  const {
    mkrToLock,
    mkrToFree,
    skyToLock,
    skyToFree,
    usdsToBorrow,
    usdsToWipe,
    wipeAll,
    selectedRewardContract,
    selectedDelegate,
    activeUrn,
    selectedToken
  } = useContext(SealModuleWidgetContext);
  const { data: rewardContractTokens } = useRewardContractTokens(selectedRewardContract);

  const { data: selectedDelegateName } = useDelegateName(selectedDelegate);
  const { data: selectedDelegateOwner } = useDelegateOwner(selectedDelegate);

  const { data: urnSelectedRewardContract } = useUrnSelectedRewardContract({
    urn: activeUrn?.urnAddress || ZERO_ADDRESS
  });
  const { data: urnSelectedVoteDelegate } = useUrnSelectedVoteDelegate({
    urn: activeUrn?.urnAddress || ZERO_ADDRESS
  });

  const showSealing = (!!mkrToLock && mkrToLock > 0n) || (!!skyToLock && skyToLock > 0n);
  const showUnsealing = (!!mkrToFree && mkrToFree > 0n) || (!!skyToFree && skyToFree > 0n);
  const showBorrowing = !!usdsToBorrow && usdsToBorrow > 0n;
  const showRepaying = (!!usdsToWipe && usdsToWipe > 0n) || wipeAll;
  const showReward =
    needsRewardUpdate(activeUrn?.urnAddress, selectedRewardContract, urnSelectedRewardContract) &&
    rewardContractTokens;
  const showDelegate =
    needsDelegateUpdate(activeUrn?.urnAddress, selectedDelegate, urnSelectedVoteDelegate) &&
    selectedDelegateOwner &&
    selectedDelegateName;

  const amountToLock = !!skyToLock && skyToLock > 0n ? skyToLock : mkrToLock;
  const amountToFree = !!skyToFree && skyToFree > 0n ? skyToFree : mkrToFree;

  const transactionComponents = [
    {
      show: showSealing,
      component: (
        <VStack gap={3} className="mt-2">
          <Text variant="medium" className="text-textSecondary leading-4">
            Sealing
          </Text>
          <TokenIconWithBalance token={selectedToken} balance={formatBigInt(amountToLock)} textLarge />
        </VStack>
      )
    },
    {
      show: showUnsealing,
      component: (
        <VStack gap={3} className="mt-2">
          <Text variant="medium" className="text-textSecondary leading-4">
            Unsealing
          </Text>
          <TokenIconWithBalance token={selectedToken} balance={formatBigInt(amountToFree)} textLarge />
        </VStack>
      )
    },
    {
      show: showReward,
      component: rewardContractTokens ? (
        <VStack gap={3} className="mt-2">
          <Text variant="medium" className="text-textSecondary leading-4">
            {'Seal reward'}
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

export const SealModuleTransactionStatus = ({ onExternalLinkClicked }: SealModuleTransactionProps) => {
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
  const { mkrToLock, skyToLock, usdsToBorrow, mkrToFree, skyToFree, usdsToWipe, selectedToken } =
    useContext(SealModuleWidgetContext);

  const { flow, action, screen } = widgetState;

  const txStatus = txStatus_ as keyof TxCardCopyText;

  // This sets the correct token and amount in the transaction screens
  useEffect(() => {
    setOriginToken(
      mkrToLock && mkrToLock > 0n
        ? TOKENS.mkr
        : skyToLock && skyToLock > 0n
          ? TOKENS.sky
          : usdsToWipe && usdsToWipe > 0n
            ? TOKENS.usds
            : undefined
    );
    setOriginAmount(
      mkrToLock && mkrToLock > 0n
        ? mkrToLock
        : skyToLock && skyToLock > 0n
          ? skyToLock
          : usdsToWipe && usdsToWipe > 0n
            ? usdsToWipe
            : undefined
    );
  }, [mkrToLock, skyToLock]);

  // Sets the title and subtitle of the card
  useEffect(() => {
    if (flow === SealFlow.OPEN) setStepTwoTitle(t`Open a position`);
    if (flow === SealFlow.MANAGE) setStepTwoTitle(t`Change Position`);

    if (action === SealAction.APPROVE && screen === SealScreen.TRANSACTION) {
      // Both flows will have the same approval copy
      setStep(1);
      setLoadingText(i18n._(approveLoadingButtonText[txStatus]));
      setTxTitle(i18n._(sealApproveTitle[txStatus]));
      setTxSubtitle(i18n._(sealApproveSubtitle[txStatus]));
      setTxDescription(
        i18n._(
          usdsToWipe && usdsToWipe > 0n
            ? repayApproveDescription
            : sealApproveDescription[selectedToken.symbol as keyof typeof sealApproveDescription]
        )
      );
    } else if (action === SealAction.MULTICALL && screen === SealScreen.TRANSACTION) {
      setStep(2);
      setLoadingText(
        i18n._(
          sealLoadingButtonText({
            flow,
            txStatus
          })
        )
      );

      setTxTitle(i18n._(getSealTitle(txStatus, flow)));
      setTxSubtitle(
        i18n._(
          getSealSubtitle({
            flow,
            txStatus,
            collateralToLock:
              !!mkrToLock && mkrToLock > 0n
                ? formatBigInt(mkrToLock)
                : !!skyToLock && skyToLock > 0n
                  ? formatBigInt(skyToLock)
                  : undefined,
            borrowAmount: usdsToBorrow && usdsToBorrow > 0n ? formatBigInt(usdsToBorrow) : undefined,
            collateralToFree:
              mkrToFree && mkrToFree > 0n
                ? formatBigInt(mkrToFree)
                : skyToFree && skyToFree > 0n
                  ? formatBigInt(skyToFree)
                  : undefined,
            borrowToRepay: usdsToWipe && usdsToWipe > 0n ? formatBigInt(usdsToWipe) : undefined,
            selectedToken: selectedToken.symbol
          })
        )
      );
    } else if (action === SealAction.CLAIM && screen === SealScreen.TRANSACTION) {
      setLoadingText(i18n._(claimLoadingButtonText({ txStatus })));
      setTxTitle(i18n._(claimTitle[txStatus]));
      setTxSubtitle(i18n._(claimSubtitle[txStatus]));
    }
  }, [txStatus, screen, flow, action, i18n.locale]);

  return (
    <TransactionStatus
      onExternalLinkClicked={onExternalLinkClicked}
      transactionDetail={action === SealAction.MULTICALL ? <TransactionDetail /> : undefined}
    />
  );
};
