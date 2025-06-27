import React, { useState, useEffect } from 'react';
import { TxStatus } from '../../../constants';
import { motion } from 'framer-motion';
import { SuccessCheckSolidColor } from '../../icons/Icons';
import { Text } from '@widgets/shared/components/ui/Typography';
import { cn } from '@widgets/lib/utils';

export interface StepIndicatorProps {
  stepNumber: number;
  txStatus: TxStatus;
  currentStep: boolean;
  text: string;
  className?: string;
  circleIndicator?: boolean;
}

const ProgressBar = ({ txStatus, currentStep }: { txStatus: TxStatus; currentStep: boolean }) => {
  const [prevProgress, setPrevProgress] = useState(0);

  const getProgress = () => {
    switch (txStatus) {
      case TxStatus.IDLE:
        return 0;
      case TxStatus.INITIALIZED:
        return 10;
      case TxStatus.LOADING:
        return 90;
      case TxStatus.SUCCESS:
        return 100;
      case TxStatus.ERROR:
        return 0;
      default:
        return 0;
    }
  };

  const currentProgress = getProgress();

  useEffect(() => {
    setPrevProgress(currentProgress);
  }, [currentProgress]);

  const getAnimationDuration = () => {
    if (!currentStep || currentProgress < prevProgress) {
      //don't animate backwards progress, or if it's not the current step
      return 0;
    } else if (
      txStatus === TxStatus.INITIALIZED ||
      txStatus === TxStatus.SUCCESS ||
      txStatus === TxStatus.ERROR
    ) {
      return 0.4;
    } else if (txStatus === TxStatus.LOADING) {
      return 15; //this should be the expected number of seconds for a transaction to be mined
    }
    return 0;
  };

  return (
    <div className="mt-2.5 h-[2px] w-full bg-white/30">
      <motion.div
        initial={{ width: '0%' }}
        animate={{ width: `${getProgress()}%` }}
        transition={{ duration: getAnimationDuration() }}
        className={`h-[2px] ${currentStep ? 'bg-white' : 'bg-white/40'}`}
      />
    </div>
  );
};

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  stepNumber,
  txStatus,
  currentStep,
  text,
  className,
  circleIndicator
}) => {
  return (
    <div className={cn(className, '')}>
      <div className={cn('flex items-center', circleIndicator ? 'mt-4' : 'mt-8')}>
        <div className="relative inline-flex h-5 w-5 items-center justify-center">
          {circleIndicator && txStatus === TxStatus.LOADING && (
            <span className="absolute inset-0 flex items-center justify-center">
              <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 20 20">
                <circle
                  className="text-white/30"
                  cx="10"
                  cy="10"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
                <path className="text-white" fill="none" stroke="currentColor" d="M10 1 A9 9 0 1 1 1 10" />
              </svg>
            </span>
          )}
          <Text
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full border-2 text-center text-xs ${
              currentStep
                ? cn(
                    'text-white',
                    txStatus === TxStatus.LOADING && circleIndicator ? 'border-transparent' : 'border-white'
                  )
                : 'border-white/60 text-white/60'
            }`}
          >
            {txStatus === TxStatus.SUCCESS ? <SuccessCheckSolidColor /> : stepNumber}
          </Text>
        </div>
        <Text
          className={`ml-3 inline-flex ${currentStep ? 'text-white' : 'text-white/60'}`}
          dataTestId="step-indicator"
        >
          {text}
        </Text>
      </div>
      {!circleIndicator && <ProgressBar txStatus={txStatus} currentStep={currentStep} />}
    </div>
  );
};
