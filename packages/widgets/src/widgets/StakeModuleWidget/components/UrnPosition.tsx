import { useCallback, useContext } from 'react';
import { Card } from '@widgets/components/ui/card';
import { Text } from '@widgets/shared/components/ui/Typography';
import {
  TransactionTypeEnum,
  ZERO_ADDRESS,
  useSealPosition,
  useStakeUrnAddress,
  useStakeUrnSelectedRewardContract,
  useStakeUrnSelectedVoteDelegate,
  useVault,
  SealHistoryKick,
  getIlkName,
  useStakeHistory
} from '@jetstreamgg/sky-hooks';
import { StakeModuleWidgetContext } from '../context/context';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { StakeAction, StakeStep } from '../lib/constants';
import { WidgetState } from '@widgets/index';
import { formatUrnIndex } from '../lib/utils';
import { PositionDetail } from './PositionDetail';
import { Button } from '@widgets/components/ui/button';
import { Edit } from '@widgets/shared/components/icons/Edit';
import { OnStakeUrnChange } from '..';
import { fromHex, trim } from 'viem';

interface UrnPositionProps {
  index: bigint;
  onStakeUrnChange?: OnStakeUrnChange;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}

export const UrnPosition: React.FC<UrnPositionProps> = ({
  index,
  onStakeUrnChange,
  onExternalLinkClicked
}) => {
  const { data: urnAddress } = useStakeUrnAddress(index);
  const { data: urnSelectedRewardContract } = useStakeUrnSelectedRewardContract({
    urn: urnAddress || ZERO_ADDRESS
  });

  const { data: urnSelectedVoteDelegate } = useStakeUrnSelectedVoteDelegate({
    urn: urnAddress || ZERO_ADDRESS
  });

  const { data: vaultData } = useVault(urnAddress || ZERO_ADDRESS, getIlkName(2));

  const { setWidgetState } = useContext(WidgetContext);

  const { setSelectedRewardContract, setSelectedDelegate, setActiveUrn, setCurrentStep } =
    useContext(StakeModuleWidgetContext);

  const { data: urnHistory } = useStakeHistory();
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
    if (urnAddress && urnAddress !== ZERO_ADDRESS && urnSelectedRewardContract) {
      setSelectedRewardContract(urnSelectedRewardContract);
    } else {
      setSelectedRewardContract(undefined);
    }
    if (urnAddress && urnAddress !== ZERO_ADDRESS && urnSelectedVoteDelegate) {
      setSelectedDelegate(urnSelectedVoteDelegate);
    } else {
      setSelectedDelegate(undefined);
    }
    setWidgetState((prev: WidgetState) => ({
      ...prev,
      action: StakeAction.MULTICALL
    }));
    setActiveUrn({ urnAddress, urnIndex: index }, onStakeUrnChange ?? (() => {}));
    setCurrentStep(StakeStep.OPEN_BORROW);
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
        onExternalLinkClicked={onExternalLinkClicked}
        onStakeUrnChange={onStakeUrnChange}
      />
    </Card>
  );
};
