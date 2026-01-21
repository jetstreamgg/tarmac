import { Button } from '@widgets/components/ui/button';
import { Text } from '@widgets/shared/components/ui/Typography';
import { useRewardContractTokens, useRewardsRewardsBalance } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { useChainId } from 'wagmi';
import { TokenIcon } from '@widgets/shared/components/ui/token/TokenIcon';
import { Rewards } from '@widgets/shared/components/icons/Rewards';

export function ClaimRewardsButton({
  rewardContract,
  urnAddress,
  handleSelectOption
}: {
  rewardContract: `0x${string}`;
  urnAddress: `0x${string}`;
  handleSelectOption: (params: { contracts: `0x${string}`[]; restakeSky?: boolean }) => void;
}) {
  const chainId = useChainId();

  const { data: rewardsBalance } = useRewardsRewardsBalance({
    contractAddress: rewardContract,
    address: urnAddress,
    chainId
  });

  const { data: rewardContractTokens } = useRewardContractTokens(rewardContract);

  if (!rewardsBalance || !rewardContractTokens) return null;

  return (
    <div className="flex h-14 items-center justify-between rounded-2xl bg-linear-to-r from-[#403570] to-[#4B337B] px-5 py-4">
      <div className="flex items-center gap-2">
        <TokenIcon token={{ symbol: rewardContractTokens.rewardsToken.symbol }} className="h-7 w-7" />
        <Text variant="medium">
          {formatBigInt(rewardsBalance)} {rewardContractTokens.rewardsToken.symbol}{' '}
          <span className="text-[#f2dcfc]">Rewards</span>
        </Text>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="chip"
          onClick={() => handleSelectOption({ contracts: [rewardContract] })}
          className="h-fit px-2 py-1.5"
        >
          <Text variant="medium" className="leading-4">
            Claim
          </Text>
        </Button>
        <Rewards className="h-9 w-9" />
      </div>
    </div>
  );
}
