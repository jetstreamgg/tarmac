import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { BP, useBreakpointIndex } from '@/hooks';
import { formatUsd } from '@/utils';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CellAmount, CellTokenIdle } from '@/components/ui/table-cells';
import { TransactionCard } from '@/components/product/TransactionCard';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import type { ClaimableReward } from '@/modules/claim';

/**
 * Token cell (Figma 1036:190238): the 28px logo in its 36px ring, the symbol,
 * and the token's full name underneath — the same Token Idle cell the idle
 * stablecoins table uses, since the comp reuses that Table / Idle component.
 */
function tokenCell(reward: ClaimableReward) {
  return (
    <CellTokenIdle
      icon={
        <TokenIcon
          token={{ symbol: reward.tokenSymbol }}
          width={28}
          showChainIcon={false}
          className="h-7 w-7"
        />
      }
      symbol={reward.tokenSymbol}
      name={reward.tokenName}
    />
  );
}

/** Available-to-claim cell: 12px logo + amount over the USD value. */
function amountCell(reward: ClaimableReward) {
  return (
    <CellAmount
      icon={
        <TokenIcon
          token={{ symbol: reward.tokenSymbol }}
          width={12}
          showChainIcon={false}
          className="h-3 w-3"
        />
      }
      amount={reward.formattedAmount}
      usd={formatUsd(reward.amountUsd)}
    />
  );
}

/**
 * The claimable-rewards table shared by the Portfolio's Ecosystem and Merkl
 * reward sections (Figma Table / Idle 1036:190247): a row per reward token with
 * a Claim CTA.
 *
 * `ctaVariant` follows the section's row count — with a "Claim all" in the
 * heading the row buttons step down to secondary; as the only action in a
 * one-row section the row button is the primary. Below the md tier each row
 * becomes a TransactionCard, matching the idle table (no reward-specific mobile
 * comp exists).
 */
export function RewardsClaimTable({
  rewards,
  ctaVariant,
  onClaim,
  testId
}: {
  rewards: ClaimableReward[];
  ctaVariant: 'primary' | 'secondary';
  onClaim: (reward: ClaimableReward) => void;
  testId: string;
}) {
  const { bpi } = useBreakpointIndex();

  const claimButton = (reward: ClaimableReward) => (
    <Button
      variant={ctaVariant}
      size="m"
      className="w-full"
      onClick={() => onClaim(reward)}
      data-testid="reward-claim-button"
    >
      <Trans>Claim</Trans>
    </Button>
  );

  if (bpi < BP.md) {
    return (
      <div data-testid={testId} className="flex w-full flex-col gap-0.5">
        {rewards.map((reward, index) => (
          <div
            key={reward.id}
            data-testid="reward-row"
            className={cn(
              'overflow-hidden',
              index === 0 && 'rounded-t-[20px]',
              index === rewards.length - 1 && 'rounded-b-[20px]'
            )}
          >
            <TransactionCard
              header={tokenCell(reward)}
              fields={[{ label: <Trans>Available to claim</Trans>, value: amountCell(reward) }]}
              footer={claimButton(reward)}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <Table data-testid={testId}>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Trans>Token</Trans>
          </TableHead>
          <TableHead className="w-[148px]">
            <Trans>Available to claim</Trans>
          </TableHead>
          {/* The CTA column's header stays visually empty (Figma 1036:190252)
              but keeps an accessible name for screen readers. */}
          <TableHead className="w-[160px]">
            <span className="sr-only">
              <Trans>Actions</Trans>
            </span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rewards.map(reward => (
          <TableRow key={reward.id} data-testid="reward-row">
            <TableCell>{tokenCell(reward)}</TableCell>
            <TableCell>{amountCell(reward)}</TableCell>
            <TableCell className="px-6">{claimButton(reward)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
