import { Trans } from '@lingui/react/macro';
import { formatAddress, formatBigInt } from '@/utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

function AmountBlock({ label, amount, symbol }: { label: React.ReactNode; amount: bigint; symbol: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-fgSecondary text-sm">{label}</span>
        <span className="text-text font-circle flex items-center gap-2 text-3xl font-medium tracking-tight">
          <TokenIcon token={{ symbol }} width={28} className="h-7 w-7" showChainIcon={false} />
          {formatBigInt(amount)}
        </span>
      </div>
      <span className="bg-surfaceAlt text-text font-circle flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
        <TokenIcon token={{ symbol }} width={14} className="h-3.5 w-3.5" showChainIcon={false} />
        {symbol}
      </span>
    </div>
  );
}

/**
 * Confirm-modal review body (hi-fi 486:33412): stake / borrow amount heroes
 * with token chips. The step list, batch toggle, and wallet states are all
 * rendered by the shared TransactionModal. The reward row echoes the picker
 * card's selection; a farm whose reward token can't be named yet (outside the
 * address books, on-chain symbol unresolved) renders its shortened address —
 * the row must never hide or mislabel a selectFarm leg the multicall carries.
 */
export function StakeTakeoverConfirmSummary({
  skyToLock,
  usdsToBorrow,
  rewardSymbol,
  rewardContract
}: {
  skyToLock: bigint;
  usdsToBorrow: bigint;
  rewardSymbol?: string;
  /** The selected farm — the row's shortened-address fallback when the symbol is unknown. */
  rewardContract?: `0x${string}`;
}) {
  return (
    <div data-testid="stake-takeover-confirm-summary" className="flex flex-col gap-5">
      <AmountBlock label={<Trans>Stake amount</Trans>} amount={skyToLock} symbol="SKY" />
      {usdsToBorrow > 0n && (
        <AmountBlock label={<Trans>Borrow amount</Trans>} amount={usdsToBorrow} symbol="USDS" />
      )}
      {(rewardSymbol || rewardContract) && (
        <div data-testid="stake-takeover-confirm-reward" className="flex items-center justify-between gap-4">
          <span className="text-fgSecondary text-sm">
            <Trans>Reward</Trans>
          </span>
          <span className="bg-surfaceAlt text-text font-circle flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
            {rewardSymbol && (
              <TokenIcon
                token={{ symbol: rewardSymbol }}
                width={14}
                className="h-3.5 w-3.5"
                showChainIcon={false}
              />
            )}
            {rewardSymbol ?? formatAddress(rewardContract!, 6, 4)}
          </span>
        </div>
      )}
    </div>
  );
}
