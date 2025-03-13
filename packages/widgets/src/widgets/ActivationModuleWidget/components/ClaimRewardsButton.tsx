import { Button } from '@widgets/components/ui/button';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { Text } from '@widgets/shared/components/ui/Typography';
import { useRewardContractTokens, useRewardsRewardsBalance } from '@jetstreamgg/hooks';
import { formatBigInt } from '@jetstreamgg/utils';
import { useContext, useEffect } from 'react';
import { useChainId } from 'wagmi';
import { TxStatus } from '@widgets/shared/constants';
import { WidgetState } from '@widgets/shared/types/widgetState';
import { ActivationAction, ActivationScreen } from '../lib/constants';
import { ActivationModuleWidgetContext } from '../context/context';

export function ClaimRewardsButton({
  rewardContract,
  urnAddress,
  index,
  claimPrepared,
  claimExecute
}: {
  rewardContract: `0x${string}`;
  urnAddress: `0x${string}`;
  index: bigint;
  claimPrepared: boolean;
  claimExecute: () => void;
}) {
  const { setTxStatus, setExternalLink, setShowStepIndicator, setWidgetState } = useContext(WidgetContext);
  const { indexToClaim, setIndexToClaim, rewardContractToClaim, setRewardContractToClaim } = useContext(
    ActivationModuleWidgetContext
  );

  const chainId = useChainId();

  const { data: rewardsBalance } = useRewardsRewardsBalance({
    contractAddress: rewardContract,
    address: urnAddress,
    chainId
  });

  const { data: rewardContractTokens } = useRewardContractTokens(rewardContract);

  const handleClick = () => {
    setIndexToClaim(index);
    setRewardContractToClaim(rewardContract);
  };

  useEffect(() => {
    if (indexToClaim === index && rewardContractToClaim === rewardContract && claimPrepared) {
      setShowStepIndicator(false);
      setWidgetState((prev: WidgetState) => ({
        ...prev,
        action: ActivationAction.CLAIM,
        screen: ActivationScreen.TRANSACTION
      }));
      setTxStatus(TxStatus.INITIALIZED);
      setExternalLink(undefined);
      claimExecute();
    }
  }, [indexToClaim, index, rewardContractToClaim, rewardContract, claimPrepared]);

  if (!rewardsBalance || !rewardContractTokens) return null;

  return (
    <Button
      variant="primaryAlt"
      onClick={handleClick}
      disabled={!!rewardContractToClaim && indexToClaim !== undefined}
    >
      <Text>
        {indexToClaim === index && rewardContractToClaim === rewardContract
          ? 'Preparing your claim transaction...'
          : `Claim ${formatBigInt(rewardsBalance)} ${rewardContractTokens.rewardsToken.symbol}`}
      </Text>
    </Button>
  );
}
