import { Trans } from '@lingui/react/macro';
import { formatBigInt, formatUsd } from '@/utils';
import { formatUnits } from 'viem';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

export type { StakeRewardEndpoint } from './StakeConfirmGrid';

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
 * Manage review-screen heroes (M8, UX 1104:6429 / 1104:20198 / 1104:21216):
 * one amount hero per staged amount. USD subvalues: SKY via the protocol
 * price, USDS at parity.
 *
 * The staged reward / delegate switches used to stack here as further
 * full-width From → To blocks, which made a mixed bundle's review a long
 * column of headings with no transaction facts in it at all. They are now
 * `Reward` / `Delegate` before→after cells in `StakeConfirmGrid`, alongside
 * the position, rate and Network / Network fee cells every other product
 * review shows — so this component is the heroes only, and doubles as the
 * compact wallet-screen summary.
 */
export function StakeManageConfirmSummary({
  skyToLock,
  skyToFree,
  usdsToBorrow,
  usdsToWipe,
  skyPriceUsd
}: {
  skyToLock: bigint;
  skyToFree: bigint;
  usdsToBorrow: bigint;
  usdsToWipe: bigint;
  skyPriceUsd: number | null;
}) {
  const skyUsd = (amount: bigint) =>
    skyPriceUsd !== null ? Number(formatUnits(amount, 18)) * skyPriceUsd : null;

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
    </div>
  );
}
