import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { BP, useBreakpointIndex } from '@/hooks';
import { formatDecimalPercentage, formatNumber, formatUsd } from '@/utils';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CellAmount, CellBadge, CellTokenIdle } from '@/components/ui/table-cells';
import { TransactionCard } from '@/components/product/TransactionCard';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { STABLECOIN_PEG_BADGE, type IdleSupplyInfo, type IdleToken } from '../helpers/idleView';

function tokenCell(token: IdleToken, info: IdleSupplyInfo | undefined) {
  const pegBadge = STABLECOIN_PEG_BADGE[token.symbol];
  return (
    <CellTokenIdle
      icon={
        <TokenIcon token={{ symbol: token.symbol }} width={28} showChainIcon={false} className="h-7 w-7" />
      }
      symbol={token.symbol}
      badges={
        <>
          {info?.bestRate !== undefined && (
            <CellBadge tone="success">
              {info.venueCount > 1 ? (
                <Trans>up to {formatDecimalPercentage(info.bestRate)}</Trans>
              ) : (
                formatDecimalPercentage(info.bestRate)
              )}
            </CellBadge>
          )}
          {pegBadge && <CellBadge>{pegBadge}</CellBadge>}
        </>
      }
      name={token.name}
    />
  );
}

function balanceCell(token: IdleToken) {
  return (
    <CellAmount
      icon={
        <TokenIcon token={{ symbol: token.symbol }} width={12} showChainIcon={false} className="h-3 w-3" />
      }
      amount={formatNumber(token.amount)}
      usd={formatUsd(token.amountUsd)}
    />
  );
}

/**
 * The Portfolio "Idle" view of the positions section (Figma Table/Idle
 * 5178:37659): a row per held stablecoin (Token Idle cell with best-rate +
 * 1:1-parity badges, Amount cell, full-width Supply CTA) that deep-links to
 * the Earn list filtered by that token. Below the md tier each row becomes a
 * TransactionCard (no Idle-specific mobile comp — the shared card pattern,
 * flagged on APP-371 for design review).
 */
export function IdleStablecoinsTable({
  tokens,
  supplyInfo,
  onSupply
}: {
  tokens: IdleToken[];
  supplyInfo: Map<string, IdleSupplyInfo>;
  onSupply: (symbol: string) => void;
}) {
  const { bpi } = useBreakpointIndex();

  if (bpi < BP.md) {
    return (
      <div data-testid="idle-stablecoins-table" className="mt-8 flex w-full flex-col gap-0.5">
        {tokens.map((token, index) => (
          <div
            key={token.symbol}
            data-testid="idle-row"
            className={cn(
              'overflow-hidden',
              index === 0 && 'rounded-t-[20px]',
              index === tokens.length - 1 && 'rounded-b-[20px]'
            )}
          >
            <TransactionCard
              header={tokenCell(token, supplyInfo.get(token.symbol))}
              fields={[{ label: <Trans>Balance</Trans>, value: balanceCell(token) }]}
              footer={
                <Button variant="primary" size="m" className="w-full" onClick={() => onSupply(token.symbol)}>
                  <Trans>Supply</Trans>
                </Button>
              }
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <Table data-testid="idle-stablecoins-table">
        <TableHeader>
          <TableRow>
            <TableHead>
              <Trans>Token</Trans>
            </TableHead>
            <TableHead className="w-[148px]">
              <Trans>Balance</Trans>
            </TableHead>
            {/* The CTA column's header stays visually empty (Figma) but keeps
                an accessible name for screen readers. */}
            <TableHead className="w-[148px]">
              <span className="sr-only">
                <Trans>Actions</Trans>
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tokens.map(token => (
            <TableRow key={token.symbol} data-testid="idle-row">
              <TableCell>{tokenCell(token, supplyInfo.get(token.symbol))}</TableCell>
              <TableCell>{balanceCell(token)}</TableCell>
              <TableCell className="px-4">
                <Button variant="primary" size="m" className="w-full" onClick={() => onSupply(token.symbol)}>
                  <Trans>Supply</Trans>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
