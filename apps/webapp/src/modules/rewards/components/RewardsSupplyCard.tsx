import { useChainId, useConnection } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { getTokenDecimals, useTokenBalance, type RewardContract } from '@/hooks';
import { formatDecimalPercentage, formatNumber } from '@/utils';
import { parseBannerContent } from '@/utils/bannerContentParser';
import { getBannerById } from '@/data/banners/banners';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

const NO_VALUE = '–';

/**
 * No-position rewards entry card (the rewards analogue of `SavingsSupplyCard`).
 * Shown when the user has nothing staked in the farm: a "Supply USDS and earn
 * {token} rewards" headline, the corpus about blurb, a Current Rate / Idle
 * balance stat row, and a full-width Supply CTA that opens the shared editable
 * modal (wired by the parent and handed in as `onSupply`).
 *
 * Deprecated farms never offer supply (the parent passes `onSupply` undefined),
 * so the CTA is omitted — existing positions manage via the position card.
 */
export function RewardsSupplyCard({
  contract,
  isPointsFarm,
  rate,
  onSupply
}: {
  contract: RewardContract;
  /** Farms rewarding off-chain points (Chronicle) — headline drops the rate. */
  isPointsFarm: boolean;
  /** Reward rate as a decimal fraction; undefined renders "–". */
  rate?: number;
  onSupply?: () => void;
}) {
  const chainId = useChainId();
  const { address, isConnected } = useConnection();

  const supplySymbol = contract.supplyToken.symbol;
  const rewardSymbol = contract.rewardToken.symbol;
  const formattedRate = rate !== undefined && rate > 0 ? formatDecimalPercentage(rate) : NO_VALUE;

  // Idle balance = the wallet balance of the farm's supply token (USDS, $1-pegged
  // so the token amount doubles as the USD figure).
  const { data: walletBalance } = useTokenBalance({
    address,
    chainId,
    token: contract.supplyToken.address[chainId]
  });
  const idleBalance = isConnected
    ? formatNumber(
        parseFloat(formatUnits(walletBalance?.value ?? 0n, getTokenDecimals(contract.supplyToken, chainId))),
        { maxDecimals: 2 }
      )
    : NO_VALUE;

  // Corpus-fed about blurb (sync pipeline) — the generic Sky Token Rewards
  // explainer, shared by every farm this card fronts.
  const aboutBanner = getBannerById('about-sky-token-rewards')?.description;

  // Built outside <Trans> so the icon+symbol cluster is a single message
  // placeholder, middle-aligned to the title's cap-height (savings convention).
  const inlineToken = (symbol: string) => (
    <span className="whitespace-nowrap">
      <TokenIcon
        token={{ symbol }}
        width={24}
        showChainIcon={false}
        className="mr-1 inline-block h-6 w-6 -translate-y-0.5 align-middle"
      />
      {symbol}
    </span>
  );
  const supplyToken = inlineToken(supplySymbol);
  const rewardToken = inlineToken(rewardSymbol);

  return (
    <div
      className="bg-panel flex flex-col gap-6 rounded-[20px] p-6 backdrop-blur-2xl"
      data-testid="rewards-supply-card"
    >
      <h3 className="text-text text-2xl leading-snug font-medium">
        {isPointsFarm ? (
          <Trans>
            Supply {supplyToken} and earn {rewardToken} points
          </Trans>
        ) : (
          <Trans>
            Supply {supplyToken} and earn {rewardToken} rewards
          </Trans>
        )}
      </h3>

      {aboutBanner && (
        <p className="text-textSecondary text-sm leading-relaxed">{parseBannerContent(aboutBanner)}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-textSecondary text-sm">
            <Trans>Current Rate</Trans>
          </span>
          <span className="text-text flex items-center gap-1.5 font-medium">
            {formattedRate}
            <TokenIcon
              token={{ symbol: rewardSymbol }}
              width={18}
              showChainIcon={false}
              className="h-4.5 w-4.5"
            />
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-textSecondary text-sm">
            <Trans>Idle balance</Trans>
          </span>
          <span className="text-text flex items-center gap-1.5 font-medium">
            {idleBalance}
            <TokenIcon
              token={{ symbol: supplySymbol }}
              width={18}
              showChainIcon={false}
              className="h-4.5 w-4.5"
            />
          </span>
        </div>
      </div>

      {onSupply && (
        <Button
          variant="primary"
          className="w-full"
          onClick={onSupply}
          disabled={!isConnected}
          data-testid="rewards-supply-cta"
        >
          <Trans>Supply</Trans>
        </Button>
      )}
    </div>
  );
}
