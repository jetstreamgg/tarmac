import { useChainId, useConnection } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { getTokenDecimals, useTokenBalance, type RewardContract } from '@/hooks';
import { formatDecimalPercentage, formatNumber } from '@/utils';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import {
  ProductBadge,
  ProductFigure,
  ProductStat,
  ProductStatPair,
  ProductSupplyCard
} from '@/components/product/ProductCard';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { RateInfo } from '@/components/product/RateInfo';
import { NO_VALUE } from '@/lib/constants';

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

  // Per-farm blurb (APP-526): token farms name their reward token, the points
  // farm credits Chronicle with distribution.
  const description = isPointsFarm ? (
    <Trans>
      Supply to Sky Protocol to receive Chronicle Points. Point distribution and related opportunities are
      managed by Chronicle.
    </Trans>
  ) : (
    <Trans>
      Supply to Sky Protocol to receive {rewardSymbol} tokens. The reward rate is set by Sky Protocol
      governance and distributed proportionally to the supplied USDS.
    </Trans>
  );

  // Built outside <Trans> so the icon+symbol cluster is a single message
  // placeholder, middle-aligned to the title's cap-height (savings convention).
  const inlineToken = (symbol: string) => (
    <span className="whitespace-nowrap">
      <TokenIcon
        token={{ symbol }}
        width={24}
        showChainIcon={false}
        className="mr-1 inline-block h-5 w-5 -translate-y-0.5 align-middle md:h-6 md:w-6"
      />
      {symbol}
    </span>
  );
  const supplyToken = inlineToken(supplySymbol);
  const rewardToken = inlineToken(rewardSymbol);

  return (
    <ProductSupplyCard
      data-testid="rewards-supply-card"
      // No comp of its own (APP-432 item 16) — the badge follows the savings
      // card, tagged with the farm's reward token.
      badges={
        <ProductBadge
          icon={
            <TokenIcon
              token={{ symbol: rewardSymbol }}
              width={12}
              showChainIcon={false}
              className="h-3 w-3"
            />
          }
        >
          <Trans>Sky Ecosystem Rewards</Trans>
        </ProductBadge>
      }
      title={
        isPointsFarm ? (
          <Trans>
            Supply {supplyToken} to receive {rewardToken} points
          </Trans>
        ) : (
          <Trans>
            Supply {supplyToken} to receive {rewardToken} rewards
          </Trans>
        )
      }
      description={description}
      stats={
        <ProductStatPair>
          <ProductStat size="lg" label={<Trans>Current Rate</Trans>}>
            <ProductFigure value={formattedRate}>
              {formattedRate}
              <TokenIcon
                token={{ symbol: rewardSymbol }}
                width={16}
                showChainIcon={false}
                className="h-4 w-4 shrink-0"
              />
              <RateInfo type="str" />
            </ProductFigure>
          </ProductStat>
          <ProductStat size="lg" label={<Trans>Idle balance</Trans>}>
            <ProductFigure value={idleBalance}>
              {idleBalance}
              <TokenIcon
                token={{ symbol: supplySymbol }}
                width={16}
                showChainIcon={false}
                className="h-4 w-4 shrink-0"
              />
            </ProductFigure>
          </ProductStat>
        </ProductStatPair>
      }
      cta={
        onSupply && (
          <Button
            variant="primary"
            size="l"
            className="w-full"
            onClick={onSupply}
            disabled={!isConnected}
            data-testid="rewards-supply-cta"
          >
            <Trans>Supply</Trans>
          </Button>
        )
      }
    />
  );
}
