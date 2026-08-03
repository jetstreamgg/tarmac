import { MouseEvent } from 'react';
import { useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { TriangleAlert } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import {
  useStakeUrnAddress,
  useStakeRewardContracts,
  useRewardContractsToClaim,
  useVault,
  usePrices,
  getIlkName,
  ZERO_ADDRESS
} from '@/hooks';
import { formatBigInt, formatUsd, WAD_PRECISION } from '@/utils';
import { Button } from '@/components/ui/button';
import { formatStakeAmount } from '../lib/formatStakeAmount';
import { isAtRiskOfLiquidation } from '../lib/liquidation';
import { liquidationDropPercent } from '../lib/positionDetail';
import { isLiquidatedStakePosition, StakeUserPosition } from '../hooks/useStakeUserPositions';

const NO_VALUE = '–';

function stopRowClick(event: MouseEvent) {
  event.stopPropagation();
}

/**
 * Below-row banner for an at-risk or liquidated staking position: shares the
 * table's per-row vault read (`useStakeUrnAddress` + `useVault`, same ilk),
 * so mounting this alongside `PositionRiskCell` costs no extra RPC. Liquidated
 * takes precedence — it's a historical fact independent of the current vault
 * read. Either variant waits for its figures to load before rendering, so the
 * banner never flashes a 0.00 refund or a false healthy→warning transition.
 */
export function StakePositionRowBanner({
  position,
  onRemediate,
  onClaim
}: {
  position: StakeUserPosition;
  onRemediate: (action: 'stake' | 'repay') => void;
  onClaim: () => void;
}) {
  const chainId = useChainId();
  const { data: urnAddress } = useStakeUrnAddress(BigInt(position.index));
  const { data: vault, isLoading: vaultLoading } = useVault(urnAddress || ZERO_ADDRESS, getIlkName(2));
  const { data: rewardContracts } = useStakeRewardContracts();
  const {
    data: toClaim,
    isLoading: claimableLoading,
    error: claimableError
  } = useRewardContractsToClaim({
    rewardContractAddresses: rewardContracts?.map(({ contractAddress }) => contractAddress) ?? [],
    addresses: urnAddress ? [urnAddress] : [],
    chainId,
    enabled: Boolean(urnAddress && rewardContracts?.length)
  });
  const { data: prices } = usePrices();

  if (isLiquidatedStakePosition(position)) {
    // The risk-cell badge already marks the row as liquidated from the pure
    // predicate; hold the banner (which quotes the refund/reward figures) until
    // the reads land so it never flashes a 0.00 refund.
    if (vaultLoading || claimableLoading) return null;

    const claimable = toClaim ?? [];
    // A failed claimables read is "unknown", not $0.00.
    const rewardsUsd =
      claimableError && !toClaim
        ? NO_VALUE
        : formatUsd(
            claimable.reduce((total, reward) => {
              const price = parseFloat(prices?.[reward.rewardSymbol]?.price ?? '0');
              return total + Number(formatUnits(reward.claimBalance, 18)) * price;
            }, 0)
          );
    const refund = formatStakeAmount(vault?.collateralAmount ?? 0n);

    return (
      <div
        data-testid="stake-position-liquidated-banner"
        onClick={stopRowClick}
        className="bg-error/10 flex w-full items-start gap-3 rounded-lg px-4 py-3"
      >
        <TriangleAlert className="text-error mt-0.5 h-4 w-4 shrink-0" />
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-text font-circle text-sm font-medium">
            <Trans>This position was liquidated</Trans>
          </p>
          <p className="text-textSecondary text-sm">
            <Trans>
              Your {refund} SKY refund and {rewardsUsd} in rewards are still claimable. You can open a new
              position at any time.
            </Trans>
          </p>
        </div>
        <Button variant="primary" onClick={onClaim} data-testid="stake-liquidated-claim-cta">
          <Trans>Claim</Trans>
        </Button>
      </div>
    );
  }

  if (vaultLoading) return null;
  if (!isAtRiskOfLiquidation(vault)) return null;

  const dropPercent = liquidationDropPercent(vault?.liquidationProximityPercentage);
  // 4 decimals pinned like every other liquidation-price display in the module.
  const formattedLiqPrice =
    vault?.liquidationPrice !== undefined
      ? `$${formatBigInt(vault.liquidationPrice, { unit: WAD_PRECISION, maxDecimals: 4 })}`
      : NO_VALUE;

  return (
    <div
      data-testid="stake-position-warning-banner"
      onClick={stopRowClick}
      className="bg-error/10 flex w-full items-start gap-3 rounded-lg px-4 py-3"
    >
      <TriangleAlert className="text-error mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-text font-circle text-sm font-medium">
          <Trans>Your liquidation buffer dropped to {dropPercent}%</Trans>
        </p>
        <p className="text-textSecondary text-sm">
          <Trans>
            If SKY drops to {formattedLiqPrice}, this position will be liquidated. Add collateral or repay
            debt to lower the risk.
          </Trans>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="primary"
          size="m"
          onClick={() => onRemediate('stake')}
          data-testid="stake-warning-stake-cta"
        >
          <Trans>Stake SKY</Trans>
        </Button>
        <Button
          variant="secondary"
          size="m"
          onClick={() => onRemediate('repay')}
          data-testid="stake-warning-repay-cta"
        >
          <Trans>Repay debt</Trans>
        </Button>
      </div>
    </div>
  );
}
