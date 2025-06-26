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
import { InfoTooltip } from '../tooltip/InfoTooltip';
import { useIsBatchSupported } from '@jetstreamgg/sky-hooks';
import { StepIndicator } from './StepIndicator';
import { TxStatus } from '@widgets/shared/constants';
import { t } from '@lingui/core/macro';

export function TransactionReview({
  batchEnabled,
  setBatchEnabled,
  transactionDetail
}: {
  batchEnabled?: boolean;
  setBatchEnabled?: (enabled: boolean) => void;
  transactionDetail?: React.ReactElement;
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
          {showStepIndicator && (
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
          )}
          {transactionDetail ?? <TransactionDetail />}
        </CardContent>
        {batchEnabled !== undefined && !!setBatchEnabled && !!batchSupported && (
          <motion.div variants={positionAnimations}>
            <CardFooter className="border-selectActive border-t pt-5">
              <HStack className="w-full items-center justify-between">
                <HStack className="gap-1 space-x-0">
                  <Text className="text-textSecondary">Bundle transctions</Text>
                  <InfoTooltip
                    contentClassname="max-w-[300px]"
                    iconClassName="text-textSecondary"
                    content={
                      <>
                        <Text className="text-sm">
                          {batchEnabled
                            ? 'Your transactions will be completed in a single step, combining actions to save time and reduce gas fees.'
                            : 'Your transactions will be completed in multiple steps'}
                        </Text>
                      </>
                    }
                  />
                </HStack>
                <Switch checked={batchEnabled} onCheckedChange={setBatchEnabled} />
              </HStack>
            </CardFooter>
          </motion.div>
        )}
      </Card>
    </motion.div>
  );
}
