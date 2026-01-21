import { t } from '@lingui/core/macro';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { StepIndicator } from '@widgets/shared/components/ui/transaction/StepIndicator';
import { TxStatus } from '@widgets/shared/constants';
import { motion } from 'framer-motion';
import { useContext } from 'react';

export const UpgradeAndSupplySteps = () => {
  const { txStatus } = useContext(WidgetContext);

  return (
    <>
      <motion.div variants={positionAnimations} className="flex w-full flex-col pt-4">
        <StepIndicator
          stepNumber={1}
          currentStep={txStatus !== TxStatus.IDLE}
          txStatus={txStatus}
          text={t`Approve DAI`}
          className="flex-1"
          circleIndicator
        />
        <StepIndicator
          stepNumber={2}
          currentStep={txStatus !== TxStatus.IDLE}
          txStatus={txStatus}
          text={t`Upgrade DAI to USDS`}
          className="flex-1"
          circleIndicator
        />
        <StepIndicator
          stepNumber={3}
          currentStep={txStatus !== TxStatus.IDLE}
          txStatus={txStatus}
          text={t`Approve USDS`}
          className="flex-1"
          circleIndicator
        />
        <StepIndicator
          stepNumber={4}
          currentStep={txStatus !== TxStatus.IDLE}
          txStatus={txStatus}
          text={t`Supply USDS`}
          className="flex-1"
          circleIndicator
        />
      </motion.div>
    </>
  );
};
