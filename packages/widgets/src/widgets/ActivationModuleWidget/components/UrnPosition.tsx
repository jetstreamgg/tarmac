import { useCallback, useContext } from 'react';
import { Card } from '@widgets/components/ui/card';
import { Text } from '@widgets/shared/components/ui/Typography';
import {
  TransactionTypeEnum,
  ZERO_ADDRESS,
  useSealHistory,
  useSealPosition,
  useUrnAddress,
  useUrnSelectedRewardContract,
  useUrnSelectedVoteDelegate,
  useVault,
  SealHistoryKick
} from '@jetstreamgg/hooks';
import { ActivationModuleWidgetContext } from '../context/context';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { ActivationAction, ActivationStep } from '../lib/constants';
import { WidgetState } from '@widgets/index';
import { formatUrnIndex } from '../lib/utils';
import { PositionDetail } from './PositionDetail';
import { Button } from '@widgets/components/ui/button';
import { Edit } from '@widgets/shared/components/icons/Edit';
import { OnActivationUrnChange } from '..';
import { fromHex, trim } from 'viem';

interface UrnPositionProps {
  index: bigint;
  claimPrepared: boolean;
  claimExecute: () => void;
  onActivationUrnChange?: OnActivationUrnChange;
}

export const UrnPosition: React.FC<UrnPositionProps> = ({
  index,
  claimPrepared,
  claimExecute,
  onActivationUrnChange
}) => {
  const { data: urnAddress } = useUrnAddress(index);
  const { data: urnSelectedRewardContract } = useUrnSelectedRewardContract({
    urn: urnAddress || ZERO_ADDRESS
  });
  const { data: urnSelectedVoteDelegate } = useUrnSelectedVoteDelegate({ urn: urnAddress || ZERO_ADDRESS });
  const { data: vaultData } = useVault(urnAddress || ZERO_ADDRESS);

  const { setWidgetState } = useContext(WidgetContext);

  const { setSelectedRewardContract, setSelectedDelegate, setActiveUrn, setCurrentStep, setAcceptedExitFee } =
    useContext(ActivationModuleWidgetContext);

  const { data: urnHistory } = useSealHistory();
  const { data: urnPosition } = useSealPosition({ urnIndex: Number(index) });

  // TODO might be better to use a separate hook for this type but need to decide if we want it in history
  // it does not contain a index like the rest of the seal history items
  const liquidationHistory = urnHistory?.filter(
    (e): e is SealHistoryKick =>
      e.type === TransactionTypeEnum.UNSEAL_KICK &&
      'urnAddress' in e &&
      typeof e.urnAddress === 'string' &&
      e.urnAddress.toLowerCase() === urnAddress?.toLowerCase()
  );

  const mostRecentBark = urnPosition?.barks?.sort((a, b) => Number(b.clipperId) - Number(a.clipperId))[0];
  const liquidationAuctionUrl = mostRecentBark
    ? `https://unified-auctions.makerdao.com/collateral?auction=${fromHex(
        trim(mostRecentBark.ilk as `0x${string}`, { dir: 'right' }) as `0x${string}`,
        'string'
      )}%3A${mostRecentBark?.clipperId}`
    : '';
  const liquidationData = {
    isInLiquidatedState:
      Boolean(liquidationHistory && liquidationHistory.length > 0) && vaultData?.debtValue === 0n,
    urnAddress: urnAddress || ZERO_ADDRESS,
    liquidationAuctionUrl
  };

  const handleOnClick = useCallback(() => {
    if (vaultData?.collateralAmount && urnSelectedRewardContract) {
      setSelectedRewardContract(urnSelectedRewardContract);
    } else {
      setSelectedRewardContract(undefined);
    }
    if (vaultData?.collateralAmount && urnSelectedVoteDelegate) {
      setSelectedDelegate(urnSelectedVoteDelegate);
    } else {
      setSelectedDelegate(undefined);
    }
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action: ActivationAction.MULTICALL
    }));
    setActiveUrn({ urnAddress, urnIndex: index }, onActivationUrnChange ?? (() => {}));
    setCurrentStep(ActivationStep.OPEN_BORROW);
    setAcceptedExitFee(false);
  }, [urnAddress, index, vaultData, urnSelectedVoteDelegate, urnSelectedRewardContract]);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <Text className="text-sm leading-4">{`Position ${formatUrnIndex(index)}`}</Text>
        <Button variant="ghost" onClick={handleOnClick} className="h-fit px-0 py-1.5">
          Manage position <Edit className="ml-[5px]" />
        </Button>
      </div>
      <PositionDetail
        collateralizationRatio={vaultData?.collateralizationRatio}
        riskLevel={vaultData?.riskLevel}
        selectedRewardContract={urnSelectedRewardContract}
        selectedVoteDelegate={urnSelectedVoteDelegate}
        sealedAmount={vaultData?.collateralAmount}
        borrowedAmount={vaultData?.debtValue}
        delayedPrice={vaultData?.delayedPrice}
        liquidationPrice={vaultData?.liquidationPrice}
        liquidationData={liquidationData}
        urnAddress={urnAddress}
        index={index}
        claimPrepared={claimPrepared}
        claimExecute={claimExecute}
      />
    </Card>
  );
};
