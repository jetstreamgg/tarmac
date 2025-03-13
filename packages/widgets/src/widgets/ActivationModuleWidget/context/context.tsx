import {
  getSaDrawCalldata,
  getSaFreeSkyCalldata,
  getSaLockSkyCalldata,
  getSaOpenCalldata,
  getSaSelectDelegateCalldata,
  getSaSelectRewardContractCalldata,
  getSaWipeAllCalldata,
  getSaWipeCalldata,
  useUrnSelectedRewardContract,
  useUrnSelectedVoteDelegate,
  ZERO_ADDRESS
} from '@jetstreamgg/hooks';
import {
  Dispatch,
  ReactElement,
  ReactNode,
  SetStateAction,
  createContext,
  useCallback,
  useContext,
  useState
} from 'react';
import { ActivationFlow, ActivationStep } from '../lib/constants';
import { OnActivationUrnChange } from '..';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { needsDelegateUpdate, needsRewardUpdate } from '../lib/utils';

export interface ActivationModuleWidgetContextProps {
  isLockCompleted: boolean;
  setIsLockCompleted: Dispatch<SetStateAction<boolean>>;

  isSelectRewardContractCompleted: boolean;
  setIsSelectRewardContractCompleted: Dispatch<SetStateAction<boolean>>;

  isSelectDelegateCompleted: boolean;
  setIsSelectDelegateCompleted: Dispatch<SetStateAction<boolean>>;

  isBorrowCompleted: boolean;
  setIsBorrowCompleted: Dispatch<SetStateAction<boolean>>;

  skyToLock: bigint;
  setSkyToLock: Dispatch<SetStateAction<bigint>>;

  skyToFree: bigint;
  setSkyToFree: Dispatch<SetStateAction<bigint>>;

  usdsToWipe: bigint;
  setUsdsToWipe: Dispatch<SetStateAction<bigint>>;

  wipeAll: boolean;
  setWipeAll: Dispatch<SetStateAction<boolean>>;

  acceptedExitFee: boolean;
  setAcceptedExitFee: Dispatch<SetStateAction<boolean>>;

  selectedRewardContract: `0x${string}` | undefined;
  setSelectedRewardContract: Dispatch<SetStateAction<`0x${string}` | undefined>>;

  selectedDelegate: `0x${string}` | undefined;
  setSelectedDelegate: Dispatch<SetStateAction<`0x${string}` | undefined>>;

  usdsToBorrow: bigint;
  setUsdsToBorrow: Dispatch<SetStateAction<bigint>>;

  calldata: `0x${string}`[];
  setCalldata: Dispatch<SetStateAction<`0x${string}`[]>>;

  generateAllCalldata: (
    ownerAddress: `0x${string}`,
    urnIndex: bigint,
    referralCode?: number
  ) => `0x${string}`[];

  currentStep: ActivationStep;
  setCurrentStep: Dispatch<SetStateAction<ActivationStep>>;

  activeUrn: { urnAddress: `0x${string}` | undefined; urnIndex: bigint | undefined } | undefined;
  setActiveUrn: (
    urn: { urnAddress: `0x${string}` | undefined; urnIndex: bigint | undefined } | undefined,
    onActivationUrnChange: OnActivationUrnChange
  ) => void;
  indexToClaim: bigint | undefined;
  setIndexToClaim: Dispatch<SetStateAction<bigint | undefined>>;

  rewardContractToClaim: `0x${string}` | undefined;
  setRewardContractToClaim: Dispatch<SetStateAction<`0x${string}` | undefined>>;
}

export const ActivationModuleWidgetContext = createContext<ActivationModuleWidgetContextProps>({
  isLockCompleted: false,
  setIsLockCompleted: () => null,

  isSelectRewardContractCompleted: false,
  setIsSelectRewardContractCompleted: () => null,

  isSelectDelegateCompleted: false,
  setIsSelectDelegateCompleted: () => null,

  isBorrowCompleted: false,
  setIsBorrowCompleted: () => null,

  skyToLock: 0n,
  setSkyToLock: () => null,

  skyToFree: 0n,
  setSkyToFree: () => null,

  usdsToWipe: 0n,
  setUsdsToWipe: () => null,

  wipeAll: false,
  setWipeAll: () => null,

  acceptedExitFee: false,
  setAcceptedExitFee: () => null,

  selectedRewardContract: undefined,
  setSelectedRewardContract: () => null,

  selectedDelegate: undefined,
  setSelectedDelegate: () => null,

  usdsToBorrow: 0n,
  setUsdsToBorrow: () => null,

  calldata: [],
  setCalldata: () => null,

  generateAllCalldata: () => [],

  currentStep: ActivationStep.ABOUT,
  setCurrentStep: () => null,

  activeUrn: undefined,
  setActiveUrn: () => undefined,

  indexToClaim: undefined,
  setIndexToClaim: () => undefined,

  rewardContractToClaim: undefined,
  setRewardContractToClaim: () => undefined
});

export const ActivationModuleWidgetProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const [isLockCompleted, setIsLockCompleted] = useState<boolean>(false);
  const [isSelectRewardContractCompleted, setIsSelectRewardContractCompleted] = useState<boolean>(false);
  const [isSelectDelegateCompleted, setIsSelectDelegateCompleted] = useState<boolean>(false);
  const [isBorrowCompleted, setIsBorrowCompleted] = useState<boolean>(false);
  const [skyToLock, setSkyToLock] = useState<bigint>(0n);
  const [skyToFree, setSkyToFree] = useState<bigint>(0n);
  const [usdsToWipe, setUsdsToWipe] = useState<bigint>(0n);
  const [wipeAll, setWipeAll] = useState<boolean>(false);
  const [acceptedExitFee, setAcceptedExitFee] = useState<boolean>(false);
  const [selectedRewardContract, setSelectedRewardContract] = useState<`0x${string}` | undefined>();
  const [selectedDelegate, setSelectedDelegate] = useState<`0x${string}` | undefined>();
  const [usdsToBorrow, setUsdsToBorrow] = useState<bigint>(0n);
  const [currentStep, setCurrentStep] = useState<ActivationStep>(ActivationStep.ABOUT);
  const [calldata, setCalldata] = useState<`0x${string}`[]>([]);
  const [activeUrn, setActiveUrnState] = useState<
    { urnAddress: `0x${string}` | undefined; urnIndex: bigint | undefined } | undefined
  >();
  const [indexToClaim, setIndexToClaim] = useState<bigint | undefined>();
  const [rewardContractToClaim, setRewardContractToClaim] = useState<`0x${string}` | undefined>();

  const { widgetState } = useContext(WidgetContext);

  const setActiveUrn = (
    urn: { urnAddress: `0x${string}` | undefined; urnIndex: bigint | undefined } | undefined,
    onActivationUrnChange: OnActivationUrnChange
  ) => {
    setActiveUrnState(urn);
    onActivationUrnChange?.(urn);
  };

  const { data: urnSelectedRewardContract } = useUrnSelectedRewardContract({
    urn: activeUrn?.urnAddress || ZERO_ADDRESS
  });
  const { data: urnSelectedVoteDelegate } = useUrnSelectedVoteDelegate({
    urn: activeUrn?.urnAddress || ZERO_ADDRESS
  });

  const generateAllCalldata = useCallback(
    (ownerAddress: `0x${string}`, urnIndex: bigint, referralCode: number = 0) => {
      // --- CALLDATA GENERATION ---
      // If we have an activeUrn address, we're not opening a new one, we're managing an existing one
      const openCalldata = !activeUrn?.urnAddress ? getSaOpenCalldata({ urnIndex }) : undefined;

      // SKY to lock
      const lockSkyCalldata =
        skyToLock && skyToLock > 0n
          ? getSaLockSkyCalldata({ ownerAddress, urnIndex, amount: skyToLock, refCode: referralCode })
          : undefined;

      // USDS to wipe
      const repayCalldata =
        !wipeAll && usdsToWipe && usdsToWipe > 0n
          ? getSaWipeCalldata({ ownerAddress, urnIndex, amount: usdsToWipe })
          : undefined;

      // Wipe All USDS
      const repayAllCalldata = wipeAll ? getSaWipeAllCalldata({ ownerAddress, urnIndex }) : undefined;

      // SKY to free
      const freeSkyCalldata =
        skyToFree && skyToFree > 0n
          ? getSaFreeSkyCalldata({ ownerAddress, urnIndex, toAddress: ownerAddress, amount: skyToFree })
          : undefined;

      // USDS to borrow
      const borrowUsdsCalldata =
        usdsToBorrow && usdsToBorrow > 0n
          ? getSaDrawCalldata({
              ownerAddress,
              urnIndex,
              toAddress: ownerAddress,
              amount: usdsToBorrow
            })
          : undefined;

      // Select reward
      const selectRewardContractCalldata = needsRewardUpdate(
        activeUrn?.urnAddress,
        selectedRewardContract,
        urnSelectedRewardContract
      )
        ? getSaSelectRewardContractCalldata({
            ownerAddress,
            urnIndex,
            rewardContractAddress: selectedRewardContract || ZERO_ADDRESS,
            refCode: referralCode
          })
        : undefined;

      // Select delegate
      const selectDelegateCalldata = needsDelegateUpdate(
        activeUrn?.urnAddress,
        selectedDelegate,
        urnSelectedVoteDelegate
      )
        ? getSaSelectDelegateCalldata({
            ownerAddress,
            urnIndex,
            delegateAddress: selectedDelegate || ZERO_ADDRESS
          })
        : undefined;

      // Order calldata based on the flow
      const sortedCalldata =
        widgetState.flow === ActivationFlow.OPEN
          ? [
              openCalldata,
              lockSkyCalldata,
              borrowUsdsCalldata,
              selectRewardContractCalldata,
              selectDelegateCalldata
            ]
          : [
              /* For the manage flow, we need to sort the calldatas that unseal SKY before the ones that seal it
               * to avoid conflicts with the selectDelegate calldata, as the DSChief has a protection that
               * prevents `lock`ing and then `free`ing SKY in the same block
               * Also, sort repay before free to prevent free from failing due to the position becoming unsafe */
              repayCalldata,
              repayAllCalldata,
              freeSkyCalldata,
              selectRewardContractCalldata,
              selectDelegateCalldata,
              lockSkyCalldata,
              borrowUsdsCalldata
            ];

      // Filter out undefined calldata
      const filteredCalldata = sortedCalldata.filter(calldata => !!calldata) as `0x${string}`[];

      return filteredCalldata;
    },
    [
      skyToLock,
      skyToFree,
      usdsToWipe,
      usdsToBorrow,
      selectedRewardContract,
      selectedDelegate,
      urnSelectedRewardContract,
      urnSelectedVoteDelegate,
      activeUrn,
      widgetState.flow
    ]
  );

  return (
    <ActivationModuleWidgetContext.Provider
      value={{
        isLockCompleted,
        setIsLockCompleted,
        isSelectRewardContractCompleted,
        setIsSelectRewardContractCompleted,
        isSelectDelegateCompleted,
        setIsSelectDelegateCompleted,
        isBorrowCompleted,
        setIsBorrowCompleted,
        skyToLock,
        setSkyToLock,
        skyToFree,
        setSkyToFree,
        usdsToWipe,
        setUsdsToWipe,
        wipeAll,
        setWipeAll,
        acceptedExitFee,
        setAcceptedExitFee,
        selectedRewardContract,
        setSelectedRewardContract,
        selectedDelegate,
        setSelectedDelegate,
        usdsToBorrow,
        setUsdsToBorrow,
        calldata,
        setCalldata,
        generateAllCalldata,
        currentStep,
        setCurrentStep,
        activeUrn,
        setActiveUrn,
        indexToClaim,
        setIndexToClaim,
        rewardContractToClaim,
        setRewardContractToClaim
      }}
    >
      {children}
    </ActivationModuleWidgetContext.Provider>
  );
};
