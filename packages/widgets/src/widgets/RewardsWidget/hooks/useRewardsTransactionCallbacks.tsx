import {
  getTokenDecimals,
  RewardContract,
  useAvailableTokenRewardContracts,
  useRewardContractsToClaim
} from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { formatUnits } from 'viem';
import { useConnection, useChainId } from 'wagmi';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { useTransactionCallbacks } from '@widgets/shared/hooks/useTransactionCallbacks';
import { TransactionCallbacks } from '@widgets/shared/types/transactionCallbacks';
import { WidgetProps, WidgetState } from '@widgets/shared/types/widgetState';
import { WidgetAnalyticsEvent, WidgetAnalyticsEventType } from '@widgets/shared/types/analyticsEvents';
import { useContext, useMemo, useRef } from 'react';
import { RewardsAction, RewardsFlow, RewardsScreen } from '../lib/constants';

interface UseRewardsTransactionCallbacksParameters extends Pick<
  WidgetProps,
  'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification' | 'onAnalyticsEvent'
> {
  selectedRewardContract: RewardContract | undefined;
  amount: bigint;
  rewardsBalance: bigint | undefined;
  needsAllowance: boolean;
  shouldUseBatch: boolean;
  mutateAllowance: () => void;
  mutateTokenBalance: () => void;
  mutateRewardsBalance: () => void;
  mutateUserSuppliedBalance: () => void;
  setClaimAmount: React.Dispatch<React.SetStateAction<bigint>>;
}

export const useRewardsTransactionCallbacks = ({
  selectedRewardContract,
  amount,
  rewardsBalance,
  needsAllowance,
  shouldUseBatch,
  mutateAllowance,
  mutateTokenBalance,
  mutateRewardsBalance,
  mutateUserSuppliedBalance,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  onAnalyticsEvent,
  setClaimAmount
}: UseRewardsTransactionCallbacksParameters) => {
  const chainId = useChainId();
  const { address } = useConnection();

  // Fetch claimable rewards across all contracts (for claimAll analytics)
  const allRewardContracts = useAvailableTokenRewardContracts(chainId);
  const { data: rewardContractsToClaim } = useRewardContractsToClaim({
    rewardContractAddresses:
      allRewardContracts?.map(({ contractAddress }) => contractAddress as `0x${string}`) || [],
    addresses: address,
    chainId,
    enabled: !!allRewardContracts?.length && !!address
  });

  // Don't pass onAnalyticsEvent to the shared hook — we fire rich events directly below
  const { handleOnMutate, handleOnStart, handleOnSuccess, handleOnError } = useTransactionCallbacks({
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });
  const { setWidgetState } = useContext(WidgetContext);
  const { i18n } = useLingui();
  const locale = i18n.locale;

  // Tracks which step of a multi-call supply flow we're on (approve → action)
  const supplyStepRef = useRef(0);

  const assetDecimals = selectedRewardContract
    ? getTokenDecimals(selectedRewardContract.supplyToken, chainId)
    : 18;
  const assetSymbol = selectedRewardContract?.supplyToken.symbol ?? '';
  const formattedAmount = Number(formatUnits(amount, assetDecimals));
  const rewardsData = {
    module: 'rewards',
    product: selectedRewardContract?.name,
    productAddress: selectedRewardContract?.contractAddress,
    assetAddress: selectedRewardContract?.supplyToken.address[chainId],
    assetSymbol,
    isBatchTx: shouldUseBatch
  };

  // Claim-specific: reward token details for the claimedRewards array
  const rewardTokenDecimals = selectedRewardContract
    ? getTokenDecimals(selectedRewardContract.rewardToken, chainId)
    : 18;
  const rewardTokenSymbol = selectedRewardContract?.rewardToken.symbol ?? '';
  const formattedRewardsBalance = rewardsBalance
    ? Number(formatUnits(rewardsBalance, rewardTokenDecimals))
    : 0;

  // ClaimAll: build claimedRewards by joining rewardContractsToClaim with contract metadata
  const claimedRewardsForAll = rewardContractsToClaim
    ?.filter(r => r.claimBalance > 0n)
    .map(r => {
      const contract = allRewardContracts?.find(rc => rc.contractAddress === r.contractAddress);
      return {
        tokenSymbol: r.rewardSymbol,
        amount: Number(
          formatUnits(r.claimBalance, contract ? getTokenDecimals(contract.rewardToken, chainId) : 18)
        ),
        tokenAddress: contract?.rewardToken.address[chainId]
      };
    });

  /** Safe analytics fire — analytics must never break functionality */
  const fireAnalytics = (event: WidgetAnalyticsEvent) => {
    try {
      onAnalyticsEvent?.(event);
    } catch {
      // Silently swallow — analytics must never break functionality
    }
  };

  // Rewards supply
  const supplyTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        const step = supplyStepRef.current;
        supplyStepRef.current++;
        const isApproveStep = needsAllowance && !shouldUseBatch && step === 0;

        mutateAllowance();
        handleOnMutate();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_STARTED,
          action: isApproveStep ? RewardsAction.APPROVE : RewardsAction.SUPPLY,
          flow: RewardsFlow.SUPPLY,
          amount: formattedAmount,
          assetSymbol,
          data: rewardsData
        });
      },
      onStart: (hash?: string) => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Supplying ${formatBigInt(amount, { locale })} ${
            selectedRewardContract?.supplyToken.name ?? ''
          }`
        });
      },
      onSuccess: (hash: string | undefined) => {
        supplyStepRef.current = 0;
        handleOnSuccess({
          hash,
          notificationTitle: t`Supply successful`,
          notificationDescription: t`You supplied ${formatBigInt(amount, { locale })} ${
            selectedRewardContract?.supplyToken.name ?? ''
          }`
        });
        mutateAllowance();
        mutateTokenBalance();
        mutateRewardsBalance();
        mutateUserSuppliedBalance();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
          action: RewardsAction.SUPPLY,
          flow: RewardsFlow.SUPPLY,
          txHash: hash,
          amount: formattedAmount,
          assetSymbol,
          data: rewardsData
        });
      },
      onError: (error: Error, hash: string | undefined) => {
        supplyStepRef.current = 0;
        handleOnError({
          error,
          hash,
          notificationTitle: t`Supply failed`,
          notificationDescription: t`Something went wrong with your transaction. Please try again.`
        });
        mutateTokenBalance();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
          action: RewardsAction.SUPPLY,
          flow: RewardsFlow.SUPPLY,
          txHash: hash,
          amount: formattedAmount,
          assetSymbol,
          data: rewardsData
        });
      }
    }),
    [
      amount,
      formattedAmount,
      needsAllowance,
      shouldUseBatch,
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      locale,
      mutateAllowance,
      mutateRewardsBalance,
      mutateTokenBalance,
      mutateUserSuppliedBalance,
      selectedRewardContract?.supplyToken.name,
      onAnalyticsEvent
    ]
  );

  // Rewards withdraw
  const withdrawTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        handleOnMutate();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_STARTED,
          action: RewardsAction.WITHDRAW,
          flow: RewardsFlow.WITHDRAW,
          amount: formattedAmount,
          assetSymbol,
          data: rewardsData
        });
      },
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Withdrawing ${formatBigInt(amount, { locale })} ${
            selectedRewardContract?.supplyToken.name ?? ''
          }`
        });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Withdraw successful`,
          notificationDescription: t`You withdrew ${formatBigInt(amount, { locale })} ${
            selectedRewardContract?.supplyToken.name ?? ''
          }`
        });
        mutateTokenBalance();
        mutateRewardsBalance();
        mutateAllowance();
        mutateUserSuppliedBalance();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
          action: RewardsAction.WITHDRAW,
          flow: RewardsFlow.WITHDRAW,
          txHash: hash,
          amount: formattedAmount,
          assetSymbol,
          data: rewardsData
        });
      },
      onError: (error, hash) => {
        handleOnError({
          error,
          hash,
          notificationTitle: t`Withdraw failed`,
          notificationDescription: t`Something went wrong with your withdraw. Please try again.`
        });
        mutateTokenBalance();
        mutateAllowance();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
          action: RewardsAction.WITHDRAW,
          flow: RewardsFlow.WITHDRAW,
          txHash: hash,
          amount: formattedAmount,
          assetSymbol,
          data: rewardsData
        });
      }
    }),
    [
      amount,
      formattedAmount,
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      locale,
      mutateAllowance,
      mutateRewardsBalance,
      mutateTokenBalance,
      mutateUserSuppliedBalance,
      selectedRewardContract?.supplyToken.name,
      onAnalyticsEvent
    ]
  );

  // Create claim callbacks factory
  const createClaimCallbacks = (action: RewardsAction): TransactionCallbacks => {
    const isClaim = action === RewardsAction.CLAIM;

    // claimedRewards array matching Morpho's pattern: { tokenSymbol, amount, tokenAddress }
    const claimedRewards = isClaim
      ? [
          {
            tokenSymbol: rewardTokenSymbol,
            amount: formattedRewardsBalance,
            tokenAddress: selectedRewardContract?.rewardToken.address[chainId]
          }
        ]
      : claimedRewardsForAll;

    return {
      onMutate: () => {
        handleOnMutate();
        setClaimAmount(rewardsBalance || 0n);
        setWidgetState((prev: WidgetState) => ({
          ...prev,
          screen: RewardsScreen.TRANSACTION,
          action
        }));
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_STARTED,
          action,
          flow: RewardsFlow.CLAIM,
          assetSymbol,
          data: isClaim ? { ...rewardsData, claimedRewards } : { module: 'rewards', claimedRewards }
        });
      },
      onStart: hash => {
        handleOnStart({ hash, recentTransactionDescription: 'Claiming tokens' });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: 'Rewards claim successful',
          notificationDescription: 'You claimed your rewards!'
        });
        mutateRewardsBalance();
        mutateTokenBalance();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
          action,
          flow: RewardsFlow.CLAIM,
          txHash: hash,
          assetSymbol,
          data: isClaim ? { ...rewardsData, claimedRewards } : { module: 'rewards', claimedRewards }
        });
      },
      onError: (error, hash) => {
        handleOnError({
          error,
          hash,
          notificationTitle: 'Claim failed',
          notificationDescription: 'Something went wrong with claiming your rewards. Please try again.'
        });
        mutateTokenBalance();
        fireAnalytics({
          event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
          action,
          flow: RewardsFlow.CLAIM,
          txHash: hash,
          assetSymbol,
          data: isClaim ? rewardsData : { module: 'rewards' }
        });
      }
    };
  };

  // Rewards claim
  const claimTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => createClaimCallbacks(RewardsAction.CLAIM),
    [
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      mutateRewardsBalance,
      mutateTokenBalance,
      rewardsBalance,
      setClaimAmount,
      setWidgetState,
      selectedRewardContract,
      onAnalyticsEvent
    ]
  );

  // Rewards claim all
  const claimAllTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => createClaimCallbacks(RewardsAction.CLAIM_ALL),
    [
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      mutateRewardsBalance,
      mutateTokenBalance,
      rewardsBalance,
      setClaimAmount,
      setWidgetState,
      rewardContractsToClaim,
      onAnalyticsEvent
    ]
  );

  return {
    supplyTransactionCallbacks,
    withdrawTransactionCallbacks,
    claimTransactionCallbacks,
    claimAllTransactionCallbacks
  };
};
