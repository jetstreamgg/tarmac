import {
  RewardContract,
  useRewardsRewardsBalance,
  useRewardsSuppliedBalance,
  useTokenAllowance,
  useTokenBalance,
  getTokenDecimals,
  useIsBatchSupported,
  useRewardsChartInfo
} from '@jetstreamgg/sky-hooks';
import { useDebounce, formatBigInt, formatDecimalPercentage } from '@jetstreamgg/sky-utils';
import { useContext, useEffect, useMemo, useState } from 'react';
import { WidgetContainer } from '../../shared/components/ui/widget/WidgetContainer';
import { RewardsFlow, RewardsAction, RewardsScreen } from './lib/constants';
import { WidgetContext } from '../../context/WidgetContext';
import { NotificationType, TxStatus } from '../../shared/constants';
import { WidgetProps, WidgetState } from '../../shared/types/widgetState';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useConnection, useChainId } from 'wagmi';
import { RewardsTransactionStatus } from './components/RewardsTransactionStatus';
import { ManagePosition } from './components/ManagePosition';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { RewardsOverview } from './components/RewardsOverview';
import { Button } from '@widgets/components/ui/button';
import { getValidatedState } from '../../lib/utils';
import { formatUnits, parseUnits } from 'viem';
import { WidgetButtons } from '@widgets/shared/components/ui/widget/WidgetButtons';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { ArrowLeft } from 'lucide-react';
import { TransactionOverview } from '@widgets/shared/components/ui/transaction/TransactionOverview';
import { useNotifyWidgetState } from '@widgets/shared/hooks/useNotifyWidgetState';
import { AnimatePresence, motion } from 'framer-motion';
import { CardAnimationWrapper } from '@widgets/shared/animation/Wrappers';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { RewardsTransactionReview } from './components/RewardsTransactionReview';
import { useRewardsTransactions } from './hooks/useRewardsTransactions';
import { withWidgetProvider } from '@widgets/shared/hocs/withWidgetProvider';
import { RewardsClaimAllTransactionStatus } from './components/RewardsClaimAllTransactionStatus';

export type RewardsWidgetProps = WidgetProps & {
  onRewardContractChange?: (rewardContract?: RewardContract) => void;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
};

// HOC Widget
const RewardsWidgetWrapped = ({
  onConnect,
  addRecentTransaction,
  rightHeaderComponent,
  onRewardContractChange,
  externalWidgetState,
  onStateValidated,
  onNotification,
  onWidgetStateChange,
  onExternalLinkClicked,
  enabled = true,
  legalBatchTxUrl,
  referralCode,
  batchEnabled,
  setBatchEnabled
}: RewardsWidgetProps) => {
  const validatedExternalState = getValidatedState(externalWidgetState);
  const chainId = useChainId();
  const { address, isConnecting, isConnected } = useConnection();
  const isConnectedAndEnabled = useMemo(() => isConnected && enabled, [isConnected, enabled]);
  const [selectedRewardContract, setSelectedRewardContract] = useState<RewardContract | undefined>(undefined);
  const [amount, setAmount] = useState(parseUnits(validatedExternalState?.amount || '0', 18));
  const [claimAmount, setClaimAmount] = useState(0n);
  const { data: batchSupported } = useIsBatchSupported();

  useEffect(() => {
    onStateValidated?.(validatedExternalState);
  }, [onStateValidated, validatedExternalState]);

  useEffect(() => {
    setSelectedRewardContract(validatedExternalState?.selectedRewardContract);
    setAmount(parseUnits(validatedExternalState?.amount || '0', 18));
  }, [validatedExternalState?.selectedRewardContract, validatedExternalState?.amount]);

  // Balance of the token to be supplied
  const { data: tokenBalance, refetch: mutateTokenBalance } = useTokenBalance({
    chainId,
    address: address,
    token: selectedRewardContract?.supplyToken.address[chainId]
  });
  // Amount of tokens supplied in the contract
  const { data: suppliedBalance, mutate: mutateUserSuppliedBalance } = useRewardsSuppliedBalance({
    chainId,
    address: address,
    contractAddress: selectedRewardContract?.contractAddress as `0x${string}`
  });

  // Rewards balance
  const { data: rewardsBalance, mutate: mutateRewardsBalance } = useRewardsRewardsBalance({
    chainId,
    address: address,
    contractAddress: selectedRewardContract?.contractAddress as `0x${string}`
  });

  // Rewards chart info for rate
  const { data: chartData } = useRewardsChartInfo({
    rewardContractAddress: selectedRewardContract?.contractAddress || ''
  });

  // Get the most recent rate from chart data
  const mostRecentRate = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    const sortedData = [...chartData].sort((a, b) => b.blockTimestamp - a.blockTimestamp);
    return sortedData[0].rate;
  }, [chartData]);

  const { data: allowance, mutate: mutateAllowance } = useTokenAllowance({
    chainId,
    contractAddress: selectedRewardContract?.supplyToken.address[chainId],
    spender: selectedRewardContract?.contractAddress as `0x${string}`,
    owner: address
  });

  const debouncedAmount = useDebounce(amount);
  const initialTabIndex = validatedExternalState?.flow === RewardsFlow.WITHDRAW ? 1 : 0;
  const [tabIndex, setTabIndex] = useState<0 | 1>(initialTabIndex);
  const linguiCtx = useLingui();

  useEffect(() => {
    setTabIndex(initialTabIndex);
  }, [initialTabIndex]);

  const {
    setButtonText,
    setIsDisabled,
    setIsLoading,
    setTxStatus,
    txStatus,
    setExternalLink,
    widgetState,
    setWidgetState,
    setShowStepIndicator
  } = useContext(WidgetContext);

  useNotifyWidgetState({ widgetState, txStatus, onWidgetStateChange });

  const needsAllowance = !!(!allowance || allowance < amount);
  useEffect(() => {
    // Check claim actions first - txStatus won't be idle when claim is triggered
    if (widgetState.action === RewardsAction.CLAIM || widgetState.action === RewardsAction.CLAIM_ALL) {
      setShowStepIndicator(false);
    } else if (txStatus === TxStatus.IDLE) {
      const shouldShow = widgetState.action === RewardsAction.SUPPLY && needsAllowance;
      setShowStepIndicator(shouldShow);
    }
  }, [txStatus, widgetState.action, needsAllowance, setShowStepIndicator]);
  const shouldUseBatch =
    !!batchEnabled && !!batchSupported && needsAllowance && widgetState.flow === RewardsFlow.SUPPLY;

  const { batchSupply, withdraw, claim, claimAll } = useRewardsTransactions({
    selectedRewardContract,
    amount,
    referralCode,
    rewardsBalance,
    shouldUseBatch,
    addRecentTransaction,
    onWidgetStateChange,
    onNotification,
    mutateAllowance,
    mutateTokenBalance,
    mutateRewardsBalance,
    mutateUserSuppliedBalance,
    setClaimAmount
  });

  useEffect(() => {
    // Set the widget state based on tabIndex and selectedRewardContract
    setWidgetState({
      flow: selectedRewardContract ? (tabIndex === 1 ? RewardsFlow.WITHDRAW : RewardsFlow.SUPPLY) : null,
      action:
        widgetState.action === RewardsAction.CLAIM
          ? RewardsAction.CLAIM
          : widgetState.action === RewardsAction.CLAIM_ALL
            ? RewardsAction.CLAIM_ALL
            : selectedRewardContract
              ? tabIndex === 1
                ? RewardsAction.WITHDRAW
                : RewardsAction.SUPPLY
              : RewardsAction.OVERVIEW,
      screen: RewardsScreen.ACTION
    });
    //for some reason without the widgetState.flow dependency, the action can be stuck in approve even when we're in the withdraw flow
  }, [tabIndex, widgetState.flow, selectedRewardContract]);

  const isSupplyBalanceError =
    txStatus === TxStatus.IDLE &&
    (tokenBalance?.value || tokenBalance?.value === 0n) &&
    debouncedAmount > tokenBalance.value &&
    amount !== 0n //don't wait for debouncing on default state
      ? true
      : false;

  const isWithdrawBalanceError =
    txStatus === TxStatus.IDLE &&
    (suppliedBalance === 0n || !!suppliedBalance) &&
    debouncedAmount > suppliedBalance &&
    amount !== 0n //don't wait for debouncing on default state
      ? true
      : false;

  const currentError =
    widgetState.flow === RewardsFlow.SUPPLY ? isSupplyBalanceError : isWithdrawBalanceError;

  const isAmountWaitingForDebounce = debouncedAmount !== amount;

  const withdrawDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isWithdrawBalanceError ||
    !withdraw.prepared ||
    withdraw.isLoading ||
    isAmountWaitingForDebounce;

  const batchSupplyDisabled =
    [TxStatus.INITIALIZED, TxStatus.LOADING].includes(txStatus) ||
    isSupplyBalanceError ||
    !batchSupply.prepared ||
    batchSupply.isLoading ||
    isAmountWaitingForDebounce;

  useEffect(() => {
    if (withdraw.prepareError) {
      console.log(withdraw.prepareError);
      onNotification?.({
        title: t`Error preparing transaction`,
        description: withdraw.prepareError.message,
        status: TxStatus.ERROR
      });
    }
  }, [withdraw.prepareError]);

  useEffect(() => {
    if (claim.prepareError) {
      console.log(claim.prepareError);
      onNotification?.({
        title: t`Error preparing transaction`,
        description: claim.prepareError.message,
        status: TxStatus.ERROR
      });
    }
  }, [claim.prepareError]);

  const debouncedBalanceError = useDebounce(isSupplyBalanceError, 2000);
  useEffect(() => {
    if (debouncedBalanceError) {
      onNotification?.({
        title: t`Error preparing transaction`,
        description: t`An error occurred while preparing the transaction`,
        status: TxStatus.ERROR,
        type: NotificationType.INSUFFICIENT_BALANCE
      });
    }
  }, [debouncedBalanceError]);

  const nextOnClick = () => {
    setTxStatus(TxStatus.IDLE);
    setAmount(0n);

    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action:
        prev.action === RewardsAction.CLAIM_ALL
          ? RewardsAction.OVERVIEW
          : prev.flow === RewardsFlow.WITHDRAW
            ? RewardsAction.WITHDRAW
            : RewardsAction.SUPPLY,
      screen: RewardsScreen.ACTION
    }));
  };

  const reviewOnClick = () => {
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      screen: RewardsScreen.REVIEW
    }));
  };

  const onClickBack = () => {
    setTxStatus(TxStatus.IDLE);
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action:
        prev.action === RewardsAction.CLAIM_ALL
          ? RewardsAction.OVERVIEW
          : prev.flow === RewardsFlow.SUPPLY
            ? RewardsAction.SUPPLY
            : RewardsAction.WITHDRAW,
      screen: RewardsScreen.ACTION
    }));
  };

  // Handle the error onClicks separately to keep it clean
  const errorOnClick = () => {
    return widgetState.action === RewardsAction.SUPPLY
      ? batchSupply.execute()
      : widgetState.action === RewardsAction.WITHDRAW
        ? withdraw.execute()
        : widgetState.action === RewardsAction.CLAIM_ALL
          ? claimAll.execute()
          : widgetState.action === RewardsAction.CLAIM
            ? claim.execute()
            : undefined;
  };

  const onClickAction = !isConnectedAndEnabled
    ? onConnect
    : txStatus === TxStatus.SUCCESS
      ? nextOnClick
      : txStatus === TxStatus.ERROR
        ? errorOnClick
        : widgetState.screen === RewardsScreen.ACTION
          ? reviewOnClick
          : widgetState.flow === RewardsFlow.SUPPLY
            ? batchSupply.execute
            : widgetState.flow === RewardsFlow.WITHDRAW && widgetState.action === RewardsAction.WITHDRAW
              ? withdraw.execute
              : undefined;

  const showSecondaryButton = txStatus === TxStatus.ERROR || widgetState.screen === RewardsScreen.REVIEW;

  // Update button state according to action and tx
  // Ref: https://lingui.dev/tutorials/react-patterns#memoization-pitfall
  useEffect(() => {
    if (isConnectedAndEnabled) {
      if (txStatus === TxStatus.SUCCESS && widgetState.action !== RewardsAction.APPROVE) {
        setButtonText(t`Back to Rewards`);
      } else if (txStatus === TxStatus.ERROR) {
        setButtonText(t`Retry`);
      } else if (widgetState.screen === RewardsScreen.ACTION && amount === 0n) {
        setButtonText(t`Enter amount`);
      } else if (widgetState.screen === RewardsScreen.ACTION) {
        setButtonText(t`Review`);
      } else if (widgetState.screen === RewardsScreen.REVIEW) {
        if (widgetState.flow === RewardsFlow.WITHDRAW) {
          setButtonText(t`Confirm withdrawal`);
        } else if (shouldUseBatch) {
          setButtonText(t`Confirm bundled transaction`);
        } else if (needsAllowance) {
          setButtonText(t`Confirm 2 transactions`);
        } else if (widgetState.flow === RewardsFlow.SUPPLY) {
          setButtonText(t`Confirm supply`);
        }
      }
    } else {
      setButtonText(t`Connect Wallet`);
    }
  }, [widgetState, txStatus, linguiCtx, amount, isConnectedAndEnabled, shouldUseBatch, needsAllowance]);

  // Set widget button to be disabled depending on which action we're in
  useEffect(() => {
    setIsDisabled(
      isConnectedAndEnabled &&
        ((widgetState.action === RewardsAction.SUPPLY && batchSupplyDisabled) ||
          (widgetState.action === RewardsAction.WITHDRAW && withdrawDisabled))
    );
  }, [isConnectedAndEnabled, widgetState.action, withdrawDisabled, batchSupplyDisabled]);

  // Set isLoading to be consumed by WidgetButton
  useEffect(() => {
    setIsLoading(isConnecting || txStatus === TxStatus.LOADING || txStatus === TxStatus.INITIALIZED);
  }, [isConnecting, txStatus]);

  const onSelectRewardContract = (rewardContract: RewardContract) => {
    setSelectedRewardContract(rewardContract);
    onRewardContractChange?.(rewardContract);
  };

  const onViewAllRewardContracts = () => {
    setSelectedRewardContract(undefined);
    onRewardContractChange?.(undefined);
    setWidgetState({
      ...widgetState,
      action: RewardsAction.OVERVIEW,
      flow: RewardsFlow.SUPPLY
    });
    setTxStatus(TxStatus.IDLE);
    setAmount(0n);
  };

  // Reset widget state after switching network
  useEffect(() => {
    // Reset all state variables
    setAmount(parseUnits(validatedExternalState?.amount || '0', 18));
    setClaimAmount(0n);
    setTxStatus(TxStatus.IDLE);
    setExternalLink(undefined);

    // Reset selected reward contract to initial value
    setSelectedRewardContract(validatedExternalState?.selectedRewardContract);

    // Reset widget state to overview screen
    setWidgetState({
      flow: null,
      action: RewardsAction.OVERVIEW,
      screen: RewardsScreen.ACTION
    });

    // Refresh data
    mutateAllowance?.();
    mutateTokenBalance?.();
    mutateRewardsBalance?.();
    mutateUserSuppliedBalance?.();
  }, [chainId]);

  return (
    <WidgetContainer
      header={
        widgetState.action === RewardsAction.OVERVIEW ? (
          <CardAnimationWrapper key="widget-title">
            <Heading variant="x-large">
              <Trans>Sky Token Rewards</Trans>
            </Heading>
          </CardAnimationWrapper>
        ) : (
          <CardAnimationWrapper key="widget-back-button">
            <Button variant="link" onClick={onViewAllRewardContracts} className="p-0">
              <HStack className="space-x-2">
                <ArrowLeft className="self-center" />
                <Heading tag="h3" variant="small" className="text-textSecondary">
                  View all Sky Token Rewards
                </Heading>
              </HStack>
            </Button>
          </CardAnimationWrapper>
        )
      }
      subHeader={
        widgetState.action === RewardsAction.OVERVIEW ? (
          <Text className="text-textSecondary" variant="small">
            <Trans>Use USDS to access Sky Token Rewards</Trans>
          </Text>
        ) : undefined
      }
      rightHeader={rightHeaderComponent}
      footer={
        <AnimatePresence mode="popLayout" initial={false}>
          {widgetState.action !== RewardsAction.OVERVIEW && (
            <CardAnimationWrapper key="widget-footer" className="w-full">
              {widgetState.action !== RewardsAction.OVERVIEW && (
                <WidgetButtons
                  onClickAction={onClickAction}
                  onClickBack={onClickBack}
                  showSecondaryButton={showSecondaryButton}
                  enabled={enabled}
                  onExternalLinkClicked={onExternalLinkClicked}
                />
              )}
            </CardAnimationWrapper>
          )}
        </AnimatePresence>
      }
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {widgetState.screen === RewardsScreen.ACTION && widgetState.action === RewardsAction.OVERVIEW ? (
          <CardAnimationWrapper key="widget-overview">
            <RewardsOverview
              onSelectRewardContract={onSelectRewardContract}
              isConnectedAndEnabled={isConnectedAndEnabled}
              onExternalLinkClicked={onExternalLinkClicked}
              claimAllExecute={claimAll.execute}
              claimAllPrepared={claimAll.prepared}
              batchEnabledAndSupported={!!batchEnabled && !!batchSupported}
            />
          </CardAnimationWrapper>
        ) : txStatus !== TxStatus.IDLE && selectedRewardContract ? (
          <CardAnimationWrapper key="widget-transaction-status">
            <RewardsTransactionStatus
              rewardToken={
                widgetState.action === RewardsAction.CLAIM
                  ? selectedRewardContract?.rewardToken
                  : selectedRewardContract?.supplyToken
              }
              rewardAmount={widgetState.action === RewardsAction.CLAIM ? claimAmount : amount}
              selectedRewardContract={selectedRewardContract}
              onExternalLinkClicked={onExternalLinkClicked}
              isBatchTransaction={shouldUseBatch}
              needsAllowance={needsAllowance}
            />
          </CardAnimationWrapper>
        ) : txStatus !== TxStatus.IDLE && widgetState.action === RewardsAction.CLAIM_ALL ? (
          <CardAnimationWrapper key="widget-transaction-status">
            <RewardsClaimAllTransactionStatus onExternalLinkClicked={onExternalLinkClicked} />
          </CardAnimationWrapper>
        ) : widgetState.screen === RewardsScreen.REVIEW && selectedRewardContract ? (
          <CardAnimationWrapper key="widget-transaction-review">
            <RewardsTransactionReview
              batchEnabled={batchEnabled}
              setBatchEnabled={setBatchEnabled}
              isBatchTransaction={shouldUseBatch}
              rewardToken={
                widgetState.action === RewardsAction.CLAIM
                  ? selectedRewardContract?.rewardToken
                  : selectedRewardContract?.supplyToken
              }
              rewardAmount={widgetState.action === RewardsAction.CLAIM ? claimAmount : amount}
              selectedRewardContract={selectedRewardContract}
              needsAllowance={needsAllowance}
              legalBatchTxUrl={legalBatchTxUrl}
            />
          </CardAnimationWrapper>
        ) : (
          <CardAnimationWrapper key="widget-inputs">
            <>
              <motion.div variants={positionAnimations}>
                <ManagePosition
                  rewardContract={selectedRewardContract}
                  amount={amount}
                  tokenBalance={tokenBalance?.value}
                  suppliedBalance={suppliedBalance}
                  rewardsBalance={rewardsBalance}
                  claim={claim}
                  error={currentError}
                  onChange={(newValue: bigint, userTriggered?: boolean) => {
                    setAmount(newValue);
                    if (userTriggered && selectedRewardContract?.supplyToken) {
                      // If newValue is 0n and it was triggered by user, it means they're clearing the input
                      const formattedValue =
                        newValue === 0n
                          ? ''
                          : formatUnits(
                              newValue,
                              getTokenDecimals(selectedRewardContract.supplyToken, chainId)
                            );
                      onWidgetStateChange?.({
                        originAmount: formattedValue,
                        txStatus,
                        widgetState
                      });
                    }
                  }}
                  onToggle={index => {
                    setTabIndex(index);
                    setAmount(0n);
                    onWidgetStateChange?.({
                      originAmount: '',
                      txStatus,
                      widgetState
                    });
                  }}
                  onClaimClick={claim.execute}
                  isConnectedAndEnabled={isConnectedAndEnabled}
                  tabIndex={tabIndex}
                  onExternalLinkClicked={onExternalLinkClicked}
                />
              </motion.div>
              {!!amount && !currentError && (
                <motion.div variants={positionAnimations}>
                  <TransactionOverview
                    title={t`Transaction overview`}
                    isFetching={false}
                    fetchingMessage={t`Fetching transaction details`}
                    rateType="str"
                    onExternalLinkClicked={onExternalLinkClicked}
                    transactionData={[
                      {
                        label:
                          widgetState.flow === RewardsFlow.SUPPLY ? t`You will supply` : t`You will withdraw`,
                        value: `${formatBigInt(amount, { maxDecimals: 2, compact: true })} ${selectedRewardContract?.supplyToken.symbol ?? ''}`
                      },
                      ...(mostRecentRate && parseFloat(mostRecentRate) > 0
                        ? [
                            {
                              label: t`Rate`,
                              value: formatDecimalPercentage(parseFloat(mostRecentRate))
                            }
                          ]
                        : []),
                      ...(isConnectedAndEnabled
                        ? [
                            {
                              label: t`Your wallet ${selectedRewardContract?.supplyToken.symbol ?? ''} balance`,
                              value:
                                tokenBalance?.value !== undefined
                                  ? [
                                      formatBigInt(tokenBalance.value, { maxDecimals: 2, compact: true }),
                                      formatBigInt(
                                        widgetState.flow === RewardsFlow.SUPPLY
                                          ? tokenBalance.value - amount
                                          : tokenBalance.value + amount,
                                        { maxDecimals: 2, compact: true }
                                      )
                                    ]
                                  : '--'
                            },
                            {
                              label: t`Your ${selectedRewardContract?.rewardToken.symbol ?? ''} rewards ${selectedRewardContract?.supplyToken.symbol ?? ''} balance`,
                              value:
                                suppliedBalance !== undefined
                                  ? [
                                      formatBigInt(suppliedBalance, { maxDecimals: 2, compact: true }),
                                      formatBigInt(
                                        widgetState.flow === RewardsFlow.SUPPLY
                                          ? suppliedBalance + amount
                                          : suppliedBalance - amount,
                                        { maxDecimals: 2, compact: true }
                                      )
                                    ]
                                  : '--'
                            }
                          ]
                        : [])
                    ]}
                  />
                </motion.div>
              )}
            </>
          </CardAnimationWrapper>
        )}
      </AnimatePresence>
    </WidgetContainer>
  );
};

export const RewardsWidget = withWidgetProvider(RewardsWidgetWrapped, 'RewardsWidget');
