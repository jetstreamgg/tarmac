import {
  getSaDrawCalldata,
  getSaFreeMkrCalldata,
  getSaFreeSkyCalldata,
  getSaLockMkrCalldata,
  getSaLockSkyCalldata,
  getSaOpenCalldata,
  getSaWipeAllCalldata,
  getSaWipeCalldata,
  Token,
  TOKENS,
  useUrnSelectedRewardContract,
  useUrnSelectedVoteDelegate,
  ZERO_ADDRESS
} from '@jetstreamgg/sky-hooks';
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
import { SealFlow, SealStep } from '../lib/constants';
import { OnSealUrnChange } from '../lib/types';
import { WidgetContext } from '@widgets/context/WidgetContext';

export interface SealModuleWidgetContextProps {
  isLockCompleted: boolean;
  setIsLockCompleted: Dispatch<SetStateAction<boolean>>;

  isSelectRewardContractCompleted: boolean;
  setIsSelectRewardContractCompleted: Dispatch<SetStateAction<boolean>>;

  isSelectDelegateCompleted: boolean;
  setIsSelectDelegateCompleted: Dispatch<SetStateAction<boolean>>;

  isBorrowCompleted: boolean;
  setIsBorrowCompleted: Dispatch<SetStateAction<boolean>>;

  mkrToLock: bigint;
  setMkrToLock: Dispatch<SetStateAction<bigint>>;

  skyToLock: bigint;
  setSkyToLock: Dispatch<SetStateAction<bigint>>;

  mkrToFree: bigint;
  setMkrToFree: Dispatch<SetStateAction<bigint>>;

  skyToFree: bigint;
  setSkyToFree: Dispatch<SetStateAction<bigint>>;

  usdsToWipe: bigint;
  setUsdsToWipe: Dispatch<SetStateAction<bigint>>;

  wipeAll: boolean;
  setWipeAll: Dispatch<SetStateAction<boolean>>;

  acceptedExitFee: boolean;
  setAcceptedExitFee: Dispatch<SetStateAction<boolean>>;

  acceptedMkrUpgrade: boolean;
  setAcceptedMkrUpgrade: Dispatch<SetStateAction<boolean>>;

  selectedToken: Token;
  setSelectedToken: Dispatch<SetStateAction<Token>>;

  displayToken: Token;
  setDisplayToken: Dispatch<SetStateAction<Token>>;

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

  currentStep: SealStep;
  setCurrentStep: Dispatch<SetStateAction<SealStep>>;

  activeUrn: { urnAddress: `0x${string}` | undefined; urnIndex: bigint | undefined } | undefined;
  setActiveUrn: (
    urn: { urnAddress: `0x${string}` | undefined; urnIndex: bigint | undefined } | undefined,
    onSealUrnChange: OnSealUrnChange
  ) => void;

  newStakeUrn: { urnAddress: `0x${string}` | undefined; urnIndex: bigint | undefined } | undefined;
  setNewStakeUrn: (
    urn: { urnAddress: `0x${string}` | undefined; urnIndex: bigint | undefined } | undefined,
    onSealUrnChange: OnSealUrnChange
  ) => void;

  indexToClaim: bigint | undefined;
  setIndexToClaim: Dispatch<SetStateAction<bigint | undefined>>;

  rewardContractToClaim: `0x${string}` | undefined;
  setRewardContractToClaim: Dispatch<SetStateAction<`0x${string}` | undefined>>;
}

export const SealModuleWidgetContext = createContext<SealModuleWidgetContextProps>({
  isLockCompleted: false,
  setIsLockCompleted: () => null,

  isSelectRewardContractCompleted: false,
  setIsSelectRewardContractCompleted: () => null,

  isSelectDelegateCompleted: false,
  setIsSelectDelegateCompleted: () => null,

  isBorrowCompleted: false,
  setIsBorrowCompleted: () => null,

  mkrToLock: 0n,
  setMkrToLock: () => null,

  skyToLock: 0n,
  setSkyToLock: () => null,

  mkrToFree: 0n,
  setMkrToFree: () => null,

  skyToFree: 0n,
  setSkyToFree: () => null,

  usdsToWipe: 0n,
  setUsdsToWipe: () => null,

  wipeAll: false,
  setWipeAll: () => null,

  acceptedExitFee: false,
  setAcceptedExitFee: () => null,

  acceptedMkrUpgrade: false,
  setAcceptedMkrUpgrade: () => null,

  selectedRewardContract: undefined,
  setSelectedRewardContract: () => null,

  selectedDelegate: undefined,
  setSelectedDelegate: () => null,

  selectedToken: TOKENS.mkr,
  setSelectedToken: () => null,

  displayToken: TOKENS.mkr,
  setDisplayToken: () => null,

  usdsToBorrow: 0n,
  setUsdsToBorrow: () => null,

  calldata: [],
  setCalldata: () => null,

  generateAllCalldata: () => [],

  currentStep: SealStep.ABOUT,
  setCurrentStep: () => null,

  activeUrn: undefined,
  setActiveUrn: () => undefined,

  newStakeUrn: undefined,
  setNewStakeUrn: () => undefined,

  indexToClaim: undefined,
  setIndexToClaim: () => undefined,

  rewardContractToClaim: undefined,
  setRewardContractToClaim: () => undefined
});

export const SealModuleWidgetProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const [isLockCompleted, setIsLockCompleted] = useState<boolean>(false);
  const [isSelectRewardContractCompleted, setIsSelectRewardContractCompleted] = useState<boolean>(false);
  const [isSelectDelegateCompleted, setIsSelectDelegateCompleted] = useState<boolean>(false);
  const [isBorrowCompleted, setIsBorrowCompleted] = useState<boolean>(false);
  const [mkrToLock, setMkrToLock] = useState<bigint>(0n);
  const [skyToLock, setSkyToLock] = useState<bigint>(0n);
  const [mkrToFree, setMkrToFree] = useState<bigint>(0n);
  const [skyToFree, setSkyToFree] = useState<bigint>(0n);
  const [usdsToWipe, setUsdsToWipe] = useState<bigint>(0n);
  const [wipeAll, setWipeAll] = useState<boolean>(false);
  const [acceptedExitFee, setAcceptedExitFee] = useState<boolean>(false);
  const [acceptedMkrUpgrade, setAcceptedMkrUpgrade] = useState<boolean>(false);
  const [selectedRewardContract, setSelectedRewardContract] = useState<`0x${string}` | undefined>();
  const [selectedDelegate, setSelectedDelegate] = useState<`0x${string}` | undefined>();
  const [selectedToken, setSelectedToken] = useState<Token>(TOKENS.mkr);
  const [displayToken, setDisplayToken] = useState<Token>(TOKENS.mkr);
  const [usdsToBorrow, setUsdsToBorrow] = useState<bigint>(0n);
  const [currentStep, setCurrentStep] = useState<SealStep>(SealStep.ABOUT);
  const [calldata, setCalldata] = useState<`0x${string}`[]>([]);
  const [activeUrn, setActiveUrnState] = useState<
    { urnAddress: `0x${string}` | undefined; urnIndex: bigint | undefined } | undefined
  >();
  const [newStakeUrn, setNewStakeUrnState] = useState<
    { urnAddress: `0x${string}` | undefined; urnIndex: bigint | undefined } | undefined
  >();
  const [indexToClaim, setIndexToClaim] = useState<bigint | undefined>();
  const [rewardContractToClaim, setRewardContractToClaim] = useState<`0x${string}` | undefined>();

  const { widgetState } = useContext(WidgetContext);

  const setActiveUrn = (
    urn: { urnAddress: `0x${string}` | undefined; urnIndex: bigint | undefined } | undefined,
    onSealUrnChange: OnSealUrnChange
  ) => {
    setActiveUrnState(urn);
    onSealUrnChange?.(urn);
  };

  const setNewStakeUrn = (
    urn: { urnAddress: `0x${string}` | undefined; urnIndex: bigint | undefined } | undefined
    // TODO: is this required for migration flow?
    // onSealUrnChange: OnSealUrnChange
  ) => {
    setNewStakeUrnState(urn);
    // onSealUrnChange?.(urn);
  };

  // Seal
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

      // MKR to lock
      const lockMkrCalldata =
        mkrToLock && mkrToLock > 0n
          ? getSaLockMkrCalldata({ ownerAddress, urnIndex, amount: mkrToLock, refCode: referralCode })
          : undefined;

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

      // MKR to free
      const freeMkrCalldata =
        mkrToFree && mkrToFree > 0n
          ? getSaFreeMkrCalldata({ ownerAddress, urnIndex, toAddress: ownerAddress, amount: mkrToFree })
          : undefined;

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
      const selectRewardContractCalldata = undefined;

      // Select delegate
      const selectDelegateCalldata = undefined;

      // Order calldata based on the flow
      const sortedCalldata =
        widgetState.flow === SealFlow.OPEN
          ? [
              openCalldata,
              lockMkrCalldata,
              lockSkyCalldata,
              borrowUsdsCalldata,
              selectRewardContractCalldata,
              selectDelegateCalldata
            ]
          : [
              /* For the manage flow, we need to sort the calldatas that unseal MKR before the ones that seal it
               * to avoid conflicts with the selectDelegate calldata, as the DSChief has a protection that
               * prevents `lock`ing and then `free`ing MKR in the same block
               * Also, sort repay before free to prevent free from failing due to the position becoming unsafe */
              repayCalldata,
              repayAllCalldata,
              freeMkrCalldata,
              freeSkyCalldata,
              selectRewardContractCalldata,
              selectDelegateCalldata,
              lockMkrCalldata,
              lockSkyCalldata,
              borrowUsdsCalldata
            ];

      // Filter out undefined calldata
      const filteredCalldata = sortedCalldata.filter(calldata => !!calldata) as `0x${string}`[];

      return filteredCalldata;
    },
    [
      mkrToLock,
      mkrToFree,
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
    <SealModuleWidgetContext.Provider
      value={{
        isLockCompleted,
        setIsLockCompleted,
        isSelectRewardContractCompleted,
        setIsSelectRewardContractCompleted,
        isSelectDelegateCompleted,
        setIsSelectDelegateCompleted,
        isBorrowCompleted,
        setIsBorrowCompleted,
        mkrToLock,
        setMkrToLock,
        mkrToFree,
        setMkrToFree,
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
        acceptedMkrUpgrade,
        setAcceptedMkrUpgrade,
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
        newStakeUrn,
        setNewStakeUrn,
        indexToClaim,
        setIndexToClaim,
        rewardContractToClaim,
        setRewardContractToClaim,
        selectedToken,
        setSelectedToken,
        displayToken,
        setDisplayToken
      }}
    >
      {children}
    </SealModuleWidgetContext.Provider>
  );
};
