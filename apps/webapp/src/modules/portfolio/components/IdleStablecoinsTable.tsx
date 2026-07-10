import { Trans } from '@lingui/react/macro';
import { formatDecimalPercentage, formatNumber, formatUsd } from '@/utils';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CellAmount, CellBadge, CellTokenIdle } from '@/components/ui/table-cells';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { STABLECOIN_PEG_BADGE, type IdleSupplyInfo, type IdleToken } from '../helpers/idleView';

/**
 * The Portfolio "Idle" view of the positions section (Figma Table/Idle
 * 5178:37659): a row per held stablecoin (Token Idle cell with best-rate +
 * 1:1-parity badges, Amount cell, full-width Supply CTA) that deep-links to
 * the Earn list filtered by that token.
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
  return (
    <div className="mt-6">
      <Table data-testid="idle-stablecoins-table">
        <TableHeader>
          <TableRow>
            <TableHead>
              <Trans>Token</Trans>
            </TableHead>
            <TableHead className="w-[148px]">
              <Trans>Balance</Trans>
            </TableHead>
            {/* The CTA column's header cell exists but stays empty (Figma). */}
            <TableHead className="w-[148px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tokens.map(token => {
            const info = supplyInfo.get(token.symbol);
            const pegBadge = STABLECOIN_PEG_BADGE[token.symbol];
            return (
              <TableRow key={token.symbol} data-testid="idle-row">
                <TableCell>
                  <CellTokenIdle
                    icon={
                      <TokenIcon
                        token={{ symbol: token.symbol }}
                        width={28}
                        showChainIcon={false}
                        className="h-7 w-7"
                      />
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
                </TableCell>
                <TableCell>
                  <CellAmount
                    icon={
                      <TokenIcon
                        token={{ symbol: token.symbol }}
                        width={12}
                        showChainIcon={false}
                        className="h-3 w-3"
                      />
                    }
                    amount={formatNumber(token.amount)}
                    usd={formatUsd(token.amountUsd)}
                  />
                </TableCell>
                <TableCell className="px-4">
                  <Button
                    variant="primary"
                    size="m"
                    className="w-full"
                    onClick={() => onSupply(token.symbol)}
                  >
                    <Trans>Supply</Trans>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
