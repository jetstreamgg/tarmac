import React, { useState } from 'react';
import { WidgetState } from '@widgets/shared/types/widgetState';
import { TxStatus } from '@widgets/shared/constants';
import { I18nWidgetProvider } from './I18nWidgetProvider';
import { TooltipProvider } from '@widgets/components/ui/tooltip';
import { Token } from '@jetstreamgg/sky-hooks';

export interface WidgetContextProps {
  // Button state
  buttonText: string;
  setButtonText: (text: string) => void;

  // Back Button state
  backButtonText: string;
  setBackButtonText: (text: string) => void;

  // Cancel Button state
  cancelButtonText: string;
  setCancelButtonText: (text: string) => void;

  isLoading: boolean;
  setIsLoading: (bool: boolean) => void;

  loadingText?: string;
  setLoadingText: (text?: string) => void;

  isDisabled: boolean;
  setIsDisabled: (bool: boolean) => void;

  // TX state
  txStatus: TxStatus;
  setTxStatus: (status: TxStatus) => void;

  txTitle: string;
  setTxTitle: (title: string) => void;

  txSubtitle: string;
  setTxSubtitle: (subtitle: string) => void;

  txDescription: string;
  setTxDescription: (description: string) => void;

  originToken?: Token;
  setOriginToken: (token?: Token) => void;

  originAmount?: bigint;
  setOriginAmount: (amount?: bigint) => void;

  targetToken?: Token;
  setTargetToken: (token?: Token) => void;

  targetAmount?: bigint;
  setTargetAmount: (amount?: bigint) => void;

  externalLink?: string;
  setExternalLink: (link?: string) => void;

  // Widget state
  widgetState: WidgetState;
  setWidgetState: (state: WidgetState | ((prev: WidgetState) => WidgetState)) => void;

  dataTestIdPrefix: string;
  setDataTestIdPrefix: (id: string) => void;

  step: 1 | 2;
  setStep: (step: 1 | 2) => void;

  stepTwoTitle: string;
  setStepTwoTitle: (title: string) => void;

  showStepIndicator: boolean;
  setShowStepIndicator: (show: boolean) => void;

  orderId?: `0x${string}`;
  setOrderId: (id?: `0x${string}`) => void;
}

const widgetInitialState = {
  flow: null,
  action: null,
  screen: null
};

export const WidgetContext = React.createContext<WidgetContextProps>({
  buttonText: '',
  setButtonText: () => null,

  backButtonText: '',
  setBackButtonText: () => null,

  cancelButtonText: '',
  setCancelButtonText: () => null,

  loadingText: undefined,
  setLoadingText: () => null,

  isDisabled: true,
  setIsDisabled: () => null,

  isLoading: false,
  setIsLoading: () => null,

  txStatus: TxStatus.IDLE,
  setTxStatus: () => null,

  txTitle: '',
  setTxTitle: () => null,

  txSubtitle: '',
  setTxSubtitle: () => null,

  txDescription: '',
  setTxDescription: () => null,

  originToken: undefined,
  setOriginToken: () => null,

  originAmount: undefined,
  setOriginAmount: () => null,

  targetToken: undefined,
  setTargetToken: () => null,

  targetAmount: undefined,
  setTargetAmount: () => null,

  externalLink: undefined,
  setExternalLink: () => null,

  widgetState: widgetInitialState,
  setWidgetState: () => null,

  dataTestIdPrefix: '',
  setDataTestIdPrefix: () => null,

  step: 1,
  setStep: () => null,

  stepTwoTitle: '',
  setStepTwoTitle: () => null,

  showStepIndicator: true,
  setShowStepIndicator: () => null,

  orderId: undefined,
  setOrderId: () => null
});

export const WidgetProvider = ({
  children,
  locale
}: {
  children: React.ReactNode;
  locale?: string;
}): React.ReactElement => {
  const [buttonText, setButtonText] = useState<string>('');
  const [backButtonText, setBackButtonText] = useState<string>('');
  const [cancelButtonText, setCancelButtonText] = useState<string>('');
  const [loadingText, setLoadingText] = useState<string | undefined>();
  const [isDisabled, setIsDisabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [txStatus, setTxStatus] = useState<TxStatus>(TxStatus.IDLE);
  const [txTitle, setTxTitle] = useState<string>('');
  const [txSubtitle, setTxSubtitle] = useState<string>('');
  const [txDescription, setTxDescription] = useState<string>('');
  const [originToken, setOriginToken] = useState<Token | undefined>();
  const [originAmount, setOriginAmount] = useState<bigint | undefined>();
  const [targetToken, setTargetToken] = useState<Token | undefined>();
  const [targetAmount, setTargetAmount] = useState<bigint | undefined>();
  const [externalLink, setExternalLink] = useState<string | undefined>();
  const [step, setStep] = useState<1 | 2>(1);
  const [stepTwoTitle, setStepTwoTitle] = useState<string>('');
  const [showStepIndicator, setShowStepIndicator] = useState<boolean>(true);

  const [widgetState, setWidgetState] = useState<WidgetState>(widgetInitialState);

  const [dataTestIdPrefix, setDataTestIdPrefix] = useState<string>('');
  const [orderId, setOrderId] = useState<`0x${string}` | undefined>();

  return (
    <I18nWidgetProvider locale={locale}>
      <WidgetContext.Provider
        value={{
          buttonText,
          setButtonText,

          backButtonText,
          setBackButtonText,

          cancelButtonText,
          setCancelButtonText,

          loadingText,
          setLoadingText,

          isDisabled,
          setIsDisabled,

          isLoading,
          setIsLoading,

          txStatus,
          setTxStatus,

          txTitle,
          setTxTitle,

          txSubtitle,
          setTxSubtitle,

          txDescription,
          setTxDescription,

          originToken,
          setOriginToken,

          originAmount,
          setOriginAmount,

          targetToken,
          setTargetToken,

          targetAmount,
          setTargetAmount,

          externalLink,
          setExternalLink,

          widgetState,
          setWidgetState,

          dataTestIdPrefix,
          setDataTestIdPrefix,

          step,
          setStep,

          stepTwoTitle,
          setStepTwoTitle,

          showStepIndicator,
          setShowStepIndicator,

          orderId,
          setOrderId
        }}
      >
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      </WidgetContext.Provider>
    </I18nWidgetProvider>
  );
};
