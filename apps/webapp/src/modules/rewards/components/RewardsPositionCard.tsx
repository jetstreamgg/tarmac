import { useCallback } from 'react';
import { useConnection } from 'wagmi';
import { formatUnits } from 'viem';
import { TrendingUp } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import {
  ZERO_ADDRESS,
  getTokenDecimals,
  isDeprecatedRewardContract,
  useRewardsRewardsBalance,
  useRewardsSuppliedBalance,
  useUserRewardsBalance,
  type RewardContract
} from '@/hooks';
import { formatDecimalPercentage, formatNumber, projectAnnualEarnings } from '@/utils';
import { Button } from '@/components/ui/button';
import { PositionHero } from '@/components/product/PositionHero';
import { PositionCardSkeleton } from '@/components/product/PositionCardSkeleton';
import {
  ProductActions,
  ProductFigure,
  ProductPercent,
  ProductPositionCard,
  ProductStat,
  ProductStatPair
} from '@/components/product/ProductCard';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useClaimRewardsModal } from '@/modules/claim';
import { useRewardsModal, type RewardsModalArgs } from '../hooks/useRewardsModal';
import { rewardContractDisplayName } from '../helpers/rewardContractDisplayName';
import { RewardsSupplyCard } from './RewardsSupplyCard';
import { NO_VALUE } from '@/lib/constants';

/**
 * Position-aware action card for the rewards product page (ProductDetailTemplate
 * `position` slot). The staked balance picks the card:
 *  - no position (incl. disconnected) → the no-position "Supply" entry card.
 *  - has position → the "My position" summary below, with Supply / Claim rewards
 *    / Withdraw buttons that each open their shared modal. Claim goes through
 *    the D5 claim panel scoped to this contract (`{kind: 'reward-contract'}`).
 *
 * Farm flavours: Chronicle rewards off-chain points (BA Labs), so its accrual
 * row shows points and no Claim ever surfaces (on-chain `earned()` stays 0).
 * The deprecated SKY farm hides Supply — withdraw/claim only, with a notice.
 * All amount entry happens in the modals; neither card renders an inline input.
 */
export function RewardsPositionCard({
  contract,
  isPointsFarm,
  rate
}: {
  contract: RewardContract;
  /** Farms rewarding off-chain points (Chronicle). */
  isPointsFarm: boolean;
  /** Reward rate as a decimal fraction; undefined/0 renders "–". */
  rate?: number;
}) {
  const { address, isConnected } = useConnection();
  const contractAddress = contract.contractAddress as `0x${string}`;
  const chainId = contract.chainId;
  const decimals = getTokenDecimals(contract.supplyToken, chainId);
  const isDeprecated = isDeprecatedRewardContract(contractAddress, chainId);

  const { data: suppliedBalance, mutate: mutateSupplied } = useRewardsSuppliedBalance({
    contractAddress,
    address,
    chainId
  });
  // On-chain accrued rewards (earned) — drives the Claim gate. Zero forever on
  // points farms, so the Claim button never shows there.
  const { data: rewardsBalance, mutate: mutateRewards } = useRewardsRewardsBalance({
    contractAddress,
    address,
    chainId
  });
  // Off-chain points accrual (Chronicle) — display only, nothing to claim.
  const { data: pointsData } = useUserRewardsBalance({
    address: address || ZERO_ADDRESS,
    contractAddress
  });

  // Refresh the position + accrued rewards after a supply/withdraw/claim. A
  // no-position supply also flips this card to "My position" once the staked
  // balance refetches above zero.
  const refresh = useCallback(() => {
    mutateSupplied();
    mutateRewards();
  }, [mutateSupplied, mutateRewards]);

  const { openSupply, openWithdraw } = useRewardsModal({ onSuccess: refresh });
  const { openClaim } = useClaimRewardsModal({ onSuccess: refresh });

  // Per-farm inputs for the supply/withdraw modal (passed at open time).
  const modalArgs: RewardsModalArgs = {
    contractAddress,
    supplyToken: contract.supplyToken,
    displayName: rewardContractDisplayName(contract),
    productName: contract.name,
    rewardTokenSymbol: isPointsFarm ? undefined : contract.rewardToken.symbol,
    rate
  };

  // Hold the card slot until the position read resolves — deciding on the 0n
  // fallback flashes the supply pitch at users who hold a position.
  if (isConnected && suppliedBalance === undefined) {
    return <PositionCardSkeleton testId="rewards-position-card-skeleton" />;
  }

  const staked = suppliedBalance ?? 0n;
  const hasPosition = staked > 0n;
  if (!hasPosition) {
    return (
      <RewardsSupplyCard
        contract={contract}
        isPointsFarm={isPointsFarm}
        rate={rate}
        // Deprecated farms are withdraw/claim-only; no supply entry point.
        onSupply={isDeprecated ? undefined : () => openSupply(modalArgs)}
      />
    );
  }

  // Position value in supply-token units (USDS is $1-pegged, so it doubles as
  // the USD value used for the projection).
  const positionValue = parseFloat(formatUnits(staked, decimals));
  const projectedEarnings = projectAnnualEarnings(positionValue, rate);

  const rewardSymbol = contract.rewardToken.symbol;
  const accruedRewards =
    rewardsBalance !== undefined
      ? formatNumber(
          parseFloat(formatUnits(rewardsBalance, getTokenDecimals(contract.rewardToken, chainId))),
          {
            maxDecimals: 2
          }
        )
      : NO_VALUE;
  const accruedPoints = pointsData?.rewardBalance
    ? formatNumber(parseFloat(pointsData.rewardBalance), { maxDecimals: 2, compact: true })
    : NO_VALUE;
  const hasClaimable = (rewardsBalance ?? 0n) > 0n;

  const supplyIcon = (
    <TokenIcon
      token={{ symbol: contract.supplyToken.symbol }}
      width={12}
      showChainIcon={false}
      className="h-3 w-3 shrink-0"
    />
  );
  const rewardIcon = (
    <TokenIcon
      token={{ symbol: rewardSymbol }}
      width={12}
      showChainIcon={false}
      className="h-3 w-3 shrink-0"
    />
  );
  const currentRate = rate !== undefined && rate > 0 ? formatDecimalPercentage(rate) : NO_VALUE;

  return (
    <ProductPositionCard
      data-testid="rewards-position-card"
      hero={
        <PositionHero
          pillSymbol={rewardSymbol}
          balanceSymbol={contract.supplyToken.symbol}
          amount={positionValue}
        />
      }
      // No comp of its own (APP-432 item 16) — the grid follows the Morpho
      // vault card, whose claimable-rewards row this farm shares.
      stats={
        <>
          <ProductStatPair grow>
            <ProductStat label={<Trans>Supply</Trans>}>
              {supplyIcon}
              {formatNumber(positionValue, { maxDecimals: 2 })}
            </ProductStat>
            <ProductStat label={<Trans>Est. earnings (1Y)</Trans>}>
              {rate !== undefined && rate > 0 ? (
                <>
                  <TrendingUp className="text-bullish h-3 w-3 shrink-0" />
                  {formatNumber(projectedEarnings, { maxDecimals: 2 })}
                  {supplyIcon}
                </>
              ) : (
                <span className="text-fgSecondary">{NO_VALUE}</span>
              )}
            </ProductStat>
          </ProductStatPair>
          <ProductStatPair grow>
            {isPointsFarm ? (
              <ProductStat label={<Trans>Points accrued</Trans>}>
                <ProductFigure value={accruedPoints}>
                  {accruedPoints}
                  {rewardIcon}
                </ProductFigure>
              </ProductStat>
            ) : (
              <ProductStat label={<Trans>Claimable rewards</Trans>}>
                <ProductFigure value={accruedRewards}>
                  {accruedRewards}
                  {rewardIcon}
                </ProductFigure>
              </ProductStat>
            )}
            <ProductStat label={<Trans>Current rate</Trans>}>
              <ProductPercent value={currentRate} />
            </ProductStat>
          </ProductStatPair>
        </>
      }
      actions={
        /* Supply / Claim rewards / Withdraw — each opens its shared modal. */
        <div className="flex flex-col gap-3">
          {isDeprecated && (
            <p className="text-fgSecondary text-xs leading-[18px]" data-testid="rewards-position-deprecated">
              <Trans>SKY Rewards have been disabled and other reward options are available.</Trans>
            </p>
          )}
          {!isDeprecated && (
            <ProductActions>
              <Button
                variant="primary"
                size="l"
                onClick={() => openSupply(modalArgs)}
                disabled={!isConnected}
                data-testid="rewards-position-supply"
              >
                <Trans>Supply</Trans>
              </Button>
            </ProductActions>
          )}
          <ProductActions>
            {hasClaimable && (
              <Button
                variant="secondary"
                size="l"
                onClick={() => openClaim({ kind: 'reward-contract', address: contractAddress })}
                data-testid="rewards-position-claim"
              >
                <Trans>Claim rewards</Trans>
              </Button>
            )}
            <Button
              variant="secondary"
              size="l"
              onClick={() => openWithdraw(modalArgs)}
              disabled={!isConnected}
              data-testid="rewards-position-withdraw"
            >
              <Trans>Withdraw</Trans>
            </Button>
          </ProductActions>
        </div>
      }
    />
  );
}
