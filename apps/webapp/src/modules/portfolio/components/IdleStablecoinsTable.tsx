import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { formatDecimalPercentage, formatNumber, formatUsd } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { STABLECOIN_PEG_BADGE, type IdleSupplyInfo, type IdleToken } from '../helpers/idleView';

// Fixed-width balance/action columns so the headers align over the row values.
const BALANCE_COL = 'w-28 shrink-0 sm:w-32';
const ACTION_COL = 'w-24 shrink-0 sm:w-28';

/**
 * The Portfolio "Idle" view of the positions section: a row per held stablecoin
 * (balance + best supply rate + 1:1 conversion badge) with a Supply CTA that
 * deep-links to the Earn list filtered by that token.
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
    <div className="mt-6" data-testid="idle-stablecoins-table">
      <div className="text-textSecondary flex items-center gap-4 px-6 pb-3">
        <Text variant="medium" tag="span" className="flex-1">
          <Trans>Token</Trans>
        </Text>
        <Text variant="medium" tag="span" className={cn(BALANCE_COL, 'text-right')}>
          <Trans>Balance</Trans>
        </Text>
        <span className={ACTION_COL} aria-hidden />
      </div>

      <Card className="divide-borderPrimary divide-y p-0">
        {tokens.map(token => {
          const info = supplyInfo.get(token.symbol);
          const pegBadge = STABLECOIN_PEG_BADGE[token.symbol];
          return (
            <div key={token.symbol} className="flex items-center gap-4 px-6 py-5" data-testid="idle-row">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <TokenIcon
                  token={{ symbol: token.symbol }}
                  width={40}
                  showChainIcon={false}
                  className="h-10 w-10 shrink-0"
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-text font-medium">{token.symbol}</span>
                    {info?.bestRate !== undefined && (
                      <Badge>
                        {info.venueCount > 1 ? (
                          <Trans>up to {formatDecimalPercentage(info.bestRate)}</Trans>
                        ) : (
                          formatDecimalPercentage(info.bestRate)
                        )}
                      </Badge>
                    )}
                    {pegBadge && <Badge>{pegBadge}</Badge>}
                  </div>
                  <Text variant="medium" tag="span" className="text-textSecondary truncate">
                    {token.name}
                  </Text>
                </div>
              </div>

              <div className={cn(BALANCE_COL, 'flex flex-col items-end gap-0.5')}>
                <span className="text-text font-medium">{formatNumber(token.amount)}</span>
                <Text variant="medium" tag="span" className="text-textSecondary">
                  {formatUsd(token.amountUsd)}
                </Text>
              </div>

              <Button variant="primary" className={ACTION_COL} onClick={() => onSupply(token.symbol)}>
                <Trans>Supply</Trans>
              </Button>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="bg-surface text-text rounded-full px-2 py-0.5 text-xs font-medium">{children}</span>
  );
}
