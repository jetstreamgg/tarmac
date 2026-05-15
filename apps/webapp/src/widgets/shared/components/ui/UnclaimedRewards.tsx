import { Text } from './Typography';
import { TokenIcon } from './token/TokenIcon';
import { t } from '@lingui/core/macro';

interface UnclaimedRewardsProps {
  uniqueRewardTokens: string[];
}

export const UnclaimedRewards = ({ uniqueRewardTokens }: UnclaimedRewardsProps) => {
  return (
    <div className="flex items-center gap-1.5">
      <Text variant="small" className="text-white">
        {t`Unclaimed rewards`}
      </Text>
      <div className="flex items-center -space-x-0.5">
        {uniqueRewardTokens.map((tokenSymbol, index) => (
          <div key={tokenSymbol} style={{ zIndex: uniqueRewardTokens.length - index }}>
            <TokenIcon token={{ symbol: tokenSymbol }} width={16} className="h-4 w-4" noChain />
          </div>
        ))}
      </div>
    </div>
  );
};
