import { motion } from 'framer-motion';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { Card, CardContent, CardFooter, CardHeader } from '@widgets/components/ui/card';
import { Zap } from '@widgets/shared/components/icons/Icons';
import { TransactionDetail } from '@widgets/shared/components/ui/transaction/BatchTransactionStatus';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { Switch } from '@widgets/components/ui/switch';
import { useContext } from 'react';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { PopoverInfo } from '../PopoverInfo';
import { useIsBatchSupported } from '@jetstreamgg/sky-hooks';
import { StepIndicator } from './StepIndicator';
import { TxStatus } from '@widgets/shared/constants';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { ExternalLink } from '@widgets/shared/components/ExternalLink';

export function TransactionReview({
  batchEnabled,
  setBatchEnabled,
  transactionDetail,
  customSteps,
  legalBatchTxUrl,
  isBatchFlowSupported = true
}: {
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  transactionDetail?: React.ReactElement;
  customSteps?: React.ReactElement;
  legalBatchTxUrl?: string;
  isBatchFlowSupported?: boolean;
}) {
  const { txTitle, txSubtitle, stepTwoTitle, showStepIndicator } = useContext(WidgetContext);
  const { data: batchSupported } = useIsBatchSupported();

  return (
    <motion.div variants={positionAnimations} className="my-3 w-full">
      <Card>
        <CardHeader>
          <motion.div variants={positionAnimations} className="flex gap-4">
            <Zap />
            <Heading variant="medium">{txTitle}</Heading>
          </motion.div>
        </CardHeader>
        <CardContent className="my-5">
          <motion.div variants={positionAnimations}></motion.div>
          <motion.div variants={positionAnimations} className="min-h-12">
            <Text className="mt-2">{txSubtitle}</Text>
          </motion.div>
          {showStepIndicator &&
            (customSteps || (
              <motion.div variants={positionAnimations} className="flex w-full flex-col pt-4">
                <StepIndicator
                  stepNumber={1}
                  currentStep={false}
                  txStatus={TxStatus.IDLE}
                  text={t`Approve`}
                  className="flex-1"
                  circleIndicator
                />
                <StepIndicator
                  stepNumber={2}
                  currentStep={false}
                  txStatus={TxStatus.IDLE}
                  text={stepTwoTitle}
                  className="flex-1"
                  circleIndicator
                />
              </motion.div>
            ))}
          {transactionDetail ?? <TransactionDetail />}
        </CardContent>
        {batchEnabled !== undefined && !!setBatchEnabled && !!batchSupported && showStepIndicator && (
          <motion.div variants={positionAnimations}>
            <CardFooter className="border-selectActive border-t pt-5">
              <div>
                <HStack className="w-full items-center justify-between">
                  <HStack className="flex-wrap gap-1 space-x-0">
                    <HStack className="gap-1 space-x-0">
                      <Text className="text-[13px]">Bundle transactions</Text>
                      <PopoverInfo
                        title="Bundle transactions"
                        description={
                          <>
                            <Text className="text-[13px] text-white/60">
                              Bundled transactions are set &apos;on&apos; by default to complete transactions
                              in a single step. Combining actions improves the user experience and reduces gas
                              fees. Manually toggle off to cancel this feature.
                              {legalBatchTxUrl && (
                                <>
                                  <br />
                                  <br />
                                  <ExternalLink
                                    href={legalBatchTxUrl}
                                    className="text-textEmphasis hover:text-textEmphasis self-start text-sm hover:underline"
                                    showIcon={false}
                                  >
                                    <Trans>Legal Notice</Trans>
                                  </ExternalLink>
                                </>
                              )}
                            </Text>
                          </>
                        }
                      />
                    </HStack>
                    <Text className="text-textSecondary text-[13px]">(toggled on by default)</Text>
                  </HStack>
                  <Switch
                    checked={batchEnabled}
                    onCheckedChange={setBatchEnabled}
                    disabled={!isBatchFlowSupported}
                  />
                </HStack>
                {!isBatchFlowSupported && (
                  <Text className="text-textSecondary mt-2 text-[11px]">
                    This flow is currently not supported as a bundled transaction by your wallet provider.
                  </Text>
                )}
              </div>
            </CardFooter>
          </motion.div>
        )}
      </Card>
    </motion.div>
  );
}
