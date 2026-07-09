import { ReactNode, useCallback } from 'react';
import { useConnection } from 'wagmi';
import { formatUnits } from 'viem';
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
import { formatDecimalPercentage, formatNumber, projectAnnualEarnings, splitAmount } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GainValue } from '@/components/ui/GainValue';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { useClaimRewardsModal } from '@/modules/claim';
import { useRewardsModal, type RewardsModalArgs } from '../hooks/useRewardsModal';
import { rewardContractDisplayName } from '../helpers/rewardContractDisplayName';
import { RewardsSupplyCard } from './RewardsSupplyCard';

const NO_VALUE = '–';

function StatRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-textSecondary text-sm">{label}</span>
      <span className="text-text flex items-center gap-1.5 text-sm font-medium">{children}</span>
    </div>
  );
}

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
    rewardTokenSymbol: isPointsFarm ? undefined : contract.rewardToken.symbol,
    rate
  };

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
  const { whole, fraction } = splitAmount(positionValue);
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

  return (
    <Card className="flex flex-col gap-5 p-2" data-testid="rewards-position-card">
      {/* Hero — "My position" pill + staked balance over a soft brand-tinted inset. */}
      <div className="flex flex-col gap-6 rounded-2xl bg-[radial-gradient(130%_130%_at_15%_0%,_rgba(126,107,242,0.22)_0%,_rgba(58,46,125,0.1)_55%,_transparent_100%)] p-5">
        <span className="bg-surface text-textSecondary flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm">
          <TokenIcon token={{ symbol: rewardSymbol }} width={16} showChainIcon={false} className="h-4 w-4" />
          <Trans>My position</Trans>
        </span>
        <span className="text-text flex items-end gap-2 font-semibold">
          <TokenIcon
            token={{ symbol: contract.supplyToken.symbol }}
            width={32}
            showChainIcon={false}
            className="mb-1 h-8 w-8"
          />
          <span className="text-4xl leading-none">{whole}</span>
          {fraction && <span className="text-textSecondary text-2xl leading-tight">.{fraction}</span>}
        </span>
      </div>

      <div className="flex flex-col gap-5 px-3 pb-3">
        <div className="flex flex-col gap-3">
          {isPointsFarm ? (
            <StatRow label={<Trans>Points accrued</Trans>}>
              <TokenIcon
                token={{ symbol: rewardSymbol }}
                width={18}
                showChainIcon={false}
                className="h-4.5 w-4.5"
              />
              {accruedPoints} {rewardSymbol}
            </StatRow>
          ) : (
            <StatRow label={<Trans>Rewards to be claimed</Trans>}>
              <TokenIcon
                token={{ symbol: rewardSymbol }}
                width={18}
                showChainIcon={false}
                className="h-4.5 w-4.5"
              />
              {accruedRewards} {rewardSymbol}
            </StatRow>
          )}
          <StatRow label={<Trans>1Y projected earnings</Trans>}>
            {rate !== undefined && rate > 0 ? (
              <GainValue value={projectedEarnings} />
            ) : (
              <span className="text-textSecondary">{NO_VALUE}</span>
            )}
          </StatRow>
          <StatRow label={<Trans>Current rate</Trans>}>
            {rate !== undefined && rate > 0 ? formatDecimalPercentage(rate) : NO_VALUE}
          </StatRow>
        </div>

        {isDeprecated && (
          <p className="text-textSecondary text-sm" data-testid="rewards-position-deprecated">
            <Trans>SKY Rewards have been disabled and other reward options are available.</Trans>
          </p>
        )}

        {/* Supply / Claim rewards / Withdraw — each opens its shared modal. */}
        <div className="flex flex-col gap-3">
          {!isDeprecated && (
            <Button
              variant="primary"
              className="w-full"
              onClick={() => openSupply(modalArgs)}
              disabled={!isConnected}
              data-testid="rewards-position-supply"
            >
              <Trans>Supply</Trans>
            </Button>
          )}
          {hasClaimable && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => openClaim({ kind: 'reward-contract', address: contractAddress })}
              data-testid="rewards-position-claim"
            >
              <Trans>Claim rewards</Trans>
            </Button>
          )}
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => openWithdraw(modalArgs)}
            disabled={!isConnected}
            data-testid="rewards-position-withdraw"
          >
            <Trans>Withdraw</Trans>
          </Button>
        </div>
      </div>
    </Card>
  );
}
