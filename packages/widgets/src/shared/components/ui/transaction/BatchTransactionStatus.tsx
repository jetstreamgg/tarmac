import React, { useContext } from 'react';
import { WidgetContext } from '../../../../context/WidgetContext';
import { TxStatus } from '../../../constants';
import { Trans } from '@lingui/react/macro';
import { VStack } from '../layout/VStack';
import { Heading, Text } from '../Typography';
import { Clock, FailedX, InProgress, SuccessCheck, Cancel } from '../../icons/Icons';
import { Card, CardContent, CardFooter, CardHeader } from '@widgets/components/ui/card';
import { formatBigInt, ExplorerName, getExplorerName, useIsSafeWallet } from '@jetstreamgg/sky-utils';
import { TokenIconWithBalance } from '../token/TokenIconWithBalance';
import { StepIndicator } from './StepIndicator';
import { t } from '@lingui/core/macro';
import { ExternalLink } from '@widgets/shared/components/ExternalLink';
import { HStack } from '../layout/HStack';
import { ArrowRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { IconAnimationWrapper, PositionAnimationWithExitWrapper } from '@widgets/shared/animation/Wrappers';
import { useChainId } from 'wagmi';
import { getTokenDecimals } from '@jetstreamgg/sky-hooks';

export function TransactionDetail() {
  const { txDescription, originToken, originAmount, targetToken, targetAmount } = useContext(WidgetContext);
  const chainId = useChainId();

  return (
    <>
      <motion.div variants={positionAnimations}>
        {!!originToken && !!originAmount && (
          <HStack className="mt-9 items-center">
            <TokenIconWithBalance
              token={originToken}
              balance={formatBigInt(originAmount, {
                unit: getTokenDecimals(originToken, chainId)
              })}
              textLarge
            />
            {!!targetToken && !!targetAmount && (
              <>
                <ArrowRight />
                <TokenIconWithBalance
                  token={targetToken}
                  balance={formatBigInt(targetAmount, {
                    unit: getTokenDecimals(targetToken, chainId)
                  })}
                  textLarge
                />
              </>
            )}
          </HStack>
        )}
      </motion.div>
      <motion.div variants={positionAnimations}>
        <Text variant="medium" className="text-textSecondary mt-3 leading-4">
          {txDescription}
        </Text>
      </motion.div>
    </>
  );
}

export function BatchTransactionStatus({
  explorerName: paramExplorerName,
  onExternalLinkClicked,
  transactionDetail,
  isBatchTransaction,
  customSteps
}: {
  explorerName?: ExplorerName;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  transactionDetail?: React.ReactElement;
  isBatchTransaction?: boolean;
  customSteps?: React.ReactElement;
}): React.ReactElement {
  const { txStatus, txTitle, txSubtitle, externalLink, step, stepTwoTitle, showStepIndicator } =
    useContext(WidgetContext);
  const chainId = useChainId();
  const isSafeWallet = useIsSafeWallet();
  const explorerName = paramExplorerName ?? getExplorerName(chainId, isSafeWallet);

  const approvalSuccess = txStatus === TxStatus.SUCCESS && step === 1;
  const flowSuccess = txStatus === TxStatus.SUCCESS && step === 2;

  return (
    <VStack className="w-full items-center justify-center" color="primary">
      <motion.div variants={positionAnimations} className="my-3 w-full">
        <Card
          data-status={flowSuccess && 'success'}
          className="ease-out-expo from-primary-start/0 to-primary-end/0 data-[status=success]:from-primary-start/100 data-[status=success]:to-primary-end/100 w-full transition-[background-color,background-image] duration-500"
        >
          <CardHeader>
            <motion.div variants={positionAnimations} className="flex gap-4">
              <AnimatePresence mode="popLayout" initial={false}>
                <IconAnimationWrapper key={txStatus}>
                  {txStatus === TxStatus.INITIALIZED && <Clock />}
                  {(txStatus === TxStatus.LOADING || approvalSuccess) && <InProgress />}
                  {flowSuccess && <SuccessCheck />}
                  {txStatus === TxStatus.ERROR && <FailedX />}
                  {txStatus === TxStatus.CANCELLED && <Cancel />}
                </IconAnimationWrapper>
              </AnimatePresence>
              <AnimatePresence mode="popLayout" initial={false}>
                <PositionAnimationWithExitWrapper key={txTitle} className="flex items-center">
                  <Heading variant="medium">{txTitle}</Heading>
                </PositionAnimationWithExitWrapper>
              </AnimatePresence>
            </motion.div>
          </CardHeader>
          <CardContent className="my-5">
            <motion.div variants={positionAnimations} className="min-h-12">
              <AnimatePresence mode="popLayout" initial={false}>
                <PositionAnimationWithExitWrapper key={txSubtitle}>
                  <Text className="mt-2">{txSubtitle}</Text>
                </PositionAnimationWithExitWrapper>
              </AnimatePresence>
            </motion.div>
            {showStepIndicator &&
              (customSteps || (
                <motion.div variants={positionAnimations} className="flex w-full flex-col pt-4">
                  <StepIndicator
                    stepNumber={1}
                    currentStep={isBatchTransaction || step === 1}
                    txStatus={isBatchTransaction ? txStatus : step === 2 ? TxStatus.SUCCESS : txStatus}
                    text={t`Approve`}
                    className="flex-1"
                    circleIndicator
                  />
                  <StepIndicator
                    stepNumber={2}
                    currentStep={isBatchTransaction || step === 2}
                    txStatus={isBatchTransaction ? txStatus : step === 1 ? TxStatus.IDLE : txStatus}
                    text={stepTwoTitle}
                    className="flex-1"
                    circleIndicator
                  />
                </motion.div>
              ))}
            {transactionDetail ?? <TransactionDetail />}
          </CardContent>
          <motion.div variants={positionAnimations}>
            <CardFooter className="border-selectActive border-t pt-5">
              <HStack className="w-full justify-center">
                {(txStatus === TxStatus.LOADING ||
                  txStatus === TxStatus.SUCCESS ||
                  txStatus === TxStatus.ERROR ||
                  txStatus === TxStatus.CANCELLED) &&
                externalLink ? (
                  <ExternalLink
                    href={externalLink}
                    iconSize={14}
                    className="text-text"
                    onExternalLinkClicked={onExternalLinkClicked}
                  >
                    View on {explorerName}
                  </ExternalLink>
                ) : (
                  <Text className="text-center">
                    {txStatus === TxStatus.ERROR ? (
                      <Trans>Please try again</Trans>
                    ) : (
                      <Trans>Confirm this transaction in your wallet.</Trans>
                    )}
                  </Text>
                )}
              </HStack>
            </CardFooter>
          </motion.div>
        </Card>
      </motion.div>
    </VStack>
  );
}
