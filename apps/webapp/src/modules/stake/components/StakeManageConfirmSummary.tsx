import { Trans } from '@lingui/react/macro';
import { ArrowDown } from 'lucide-react';
import { formatBigInt, formatUsd, formatAddress } from '@/utils';
import { formatUnits } from 'viem';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { CustomAvatar } from '@/modules/ui/components/Avatar';

/** A reward-block endpoint: the farm, plus its reward-token symbol when known. */
export interface StakeRewardEndpoint {
  address: `0x${string}`;
  /** Missing = outside the address books with the on-chain symbol unresolved — renders the shortened farm address. */
  symbol?: string;
}

/** Icon + symbol when the token is known; the shortened farm address otherwise. */
function RewardEndpoint({ endpoint }: { endpoint: StakeRewardEndpoint }) {
  return (
    <>
      {endpoint.symbol && (
        <TokenIcon token={{ symbol: endpoint.symbol }} width={28} className="h-7 w-7" showChainIcon={false} />
      )}
      {endpoint.symbol ?? formatAddress(endpoint.address, 6, 4)}
    </>
  );
}

function AmountHero({
  label,
  amount,
  symbol,
  usdValue,
  dataTestId
}: {
  label: React.ReactNode;
  amount: bigint;
  symbol: string;
  usdValue: number | null;
  dataTestId: string;
}) {
  return (
    <div className="flex flex-col gap-1" data-testid={dataTestId}>
      <span className="text-textSecondary text-sm">{label}</span>
      <span className="text-text font-circle flex items-center gap-2 text-2xl font-medium tracking-tight">
        <TokenIcon token={{ symbol }} width={28} className="h-7 w-7" showChainIcon={false} />
        {formatBigInt(amount)} {symbol}
      </span>
      {usdValue !== null && <span className="text-textSecondary text-xs">{formatUsd(usdValue)}</span>}
    </div>
  );
}

/**
 * Manage review-screen body (M8, UX 1104:6429 / 1104:20198 / 1104:21216): one
 * amount hero per staged action; staged reward/delegate changes render
 * From → To blocks instead (token chip vs avatar rows). USD subvalues: SKY via
 * the protocol price, USDS at parity.
 */
export function StakeManageConfirmSummary({
  skyToLock,
  skyToFree,
  usdsToBorrow,
  usdsToWipe,
  skyPriceUsd,
  rewardFrom,
  rewardTo,
  delegateFrom,
  delegateTo
}: {
  skyToLock: bigint;
  skyToFree: bigint;
  usdsToBorrow: bigint;
  usdsToWipe: bigint;
  skyPriceUsd: number | null;
  /** Reward farms — `rewardTo` set renders the reward From → To block. */
  rewardFrom?: StakeRewardEndpoint;
  rewardTo?: StakeRewardEndpoint;
  /** Set both to render the delegate From → To block. */
  delegateFrom?: `0x${string}`;
  delegateTo?: `0x${string}`;
}) {
  const skyUsd = (amount: bigint) =>
    skyPriceUsd !== null ? Number(formatUnits(amount, 18)) * skyPriceUsd : null;
  // A staged reward/delegate change always previews — including mixed bundles
  // where amounts are staged too, since each is a step either way.
  const showReward = !!rewardTo;
  const showDelegate = !!delegateTo;

  return (
    <div data-testid="stake-manage-confirm-summary" className="flex flex-col gap-5">
      {skyToLock > 0n && (
        <AmountHero
          label={<Trans>Stake amount</Trans>}
          amount={skyToLock}
          symbol="SKY"
          usdValue={skyUsd(skyToLock)}
          dataTestId="stake-manage-summary-stake"
        />
      )}
      {skyToFree > 0n && (
        <AmountHero
          label={<Trans>Withdraw amount</Trans>}
          amount={skyToFree}
          symbol="SKY"
          usdValue={skyUsd(skyToFree)}
          dataTestId="stake-manage-summary-withdraw"
        />
      )}
      {usdsToBorrow > 0n && (
        <AmountHero
          label={<Trans>Borrow amount</Trans>}
          amount={usdsToBorrow}
          symbol="USDS"
          usdValue={Number(formatUnits(usdsToBorrow, 18))}
          dataTestId="stake-manage-summary-borrow"
        />
      )}
      {usdsToWipe > 0n && (
        <AmountHero
          label={<Trans>Repay amount</Trans>}
          amount={usdsToWipe}
          symbol="USDS"
          usdValue={Number(formatUnits(usdsToWipe, 18))}
          dataTestId="stake-manage-summary-repay"
        />
      )}

      {showReward && (
        <div className="flex flex-col gap-3" data-testid="stake-manage-summary-reward">
          <div className="flex flex-col gap-1.5">
            <span className="text-textSecondary text-sm">
              <Trans>From</Trans>
            </span>
            <span className="text-text font-circle flex items-center gap-2 text-lg font-medium">
              {rewardFrom ? <RewardEndpoint endpoint={rewardFrom} /> : <Trans>No reward</Trans>}
            </span>
          </div>
          <ArrowDown className="text-textSecondary h-4 w-4" aria-hidden />
          <div className="flex flex-col gap-1.5">
            <span className="text-textSecondary text-sm">
              <Trans>To</Trans>
            </span>
            <span className="text-text font-circle flex items-center gap-2 text-lg font-medium">
              <RewardEndpoint endpoint={rewardTo!} />
            </span>
          </div>
        </div>
      )}

      {showDelegate && (
        <div className="flex flex-col gap-3" data-testid="stake-manage-summary-delegate">
          <div className="flex flex-col gap-1.5">
            <span className="text-textSecondary text-sm">
              <Trans>From</Trans>
            </span>
            <span className="text-text font-circle flex items-center gap-2 text-lg font-medium">
              {delegateFrom ? (
                <>
                  <CustomAvatar address={delegateFrom} size={28} />
                  {formatAddress(delegateFrom, 6, 4)}
                </>
              ) : (
                <Trans>No delegate</Trans>
              )}
            </span>
          </div>
          <ArrowDown className="text-textSecondary h-4 w-4" aria-hidden />
          <div className="flex flex-col gap-1.5">
            <span className="text-textSecondary text-sm">
              <Trans>To</Trans>
            </span>
            <span className="text-text font-circle flex items-center gap-2 text-lg font-medium">
              <CustomAvatar address={delegateTo!} size={28} />
              {formatAddress(delegateTo!, 6, 4)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
