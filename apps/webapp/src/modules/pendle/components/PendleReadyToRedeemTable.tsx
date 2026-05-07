import { useMemo } from 'react';
import { Trans } from '@lingui/react/macro';
import { useConnection } from 'wagmi';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import {
  isMarketMatured,
  PENDLE_MARKETS,
  usePendleRedeemPreview,
  usePendleUserPtBalances,
  type PendleMarketConfig
} from '@jetstreamgg/sky-hooks';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/modules/layout/components/Typography';
import { HStack } from '@/modules/layout/components/HStack';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { usePendleRedeemModal } from '../hooks/usePendleRedeemModal';

type PendleReadyToRedeemTableProps = {
  marketFilter?: PendleMarketConfig;
};

export const PendleReadyToRedeemTable = ({ marketFilter }: PendleReadyToRedeemTableProps = {}) => {
  const { address } = useConnection();
  const { data: ptBalances } = usePendleUserPtBalances();

  const maturedHeld = useMemo<{ market: PendleMarketConfig; ptBalance: bigint }[]>(() => {
    if (!address || !ptBalances) return [];
    const candidateMarkets = marketFilter ? [marketFilter] : PENDLE_MARKETS;
    const held: { market: PendleMarketConfig; ptBalance: bigint }[] = [];
    candidateMarkets.forEach(market => {
      if (!isMarketMatured(market.expiry)) return;
      const balance = ptBalances[market.marketAddress];
      if (balance !== undefined && balance > 0n) held.push({ market, ptBalance: balance });
    });
    return held;
  }, [address, ptBalances, marketFilter]);

  if (maturedHeld.length === 0) return null;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Trans>Token</Trans>
          </TableHead>
          <TableHead>
            <Trans>Balance</Trans>
          </TableHead>
          <TableHead>
            <Trans>Receive</Trans>
          </TableHead>
          <TableHead className="text-right">
            <Trans>Action</Trans>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {maturedHeld.map(({ market, ptBalance }) => (
          <PendleMaturedRow key={market.marketAddress} market={market} ptBalance={ptBalance} />
        ))}
      </TableBody>
    </Table>
  );
};

type RowProps = {
  market: PendleMarketConfig;
  ptBalance: bigint;
};

const PendleMaturedRow = ({ market, ptBalance }: RowProps) => {
  const formatted = formatBigInt(ptBalance, { unit: market.underlyingDecimals, maxDecimals: 4 });
  const { data: previewAmount, isLoading: previewLoading } = usePendleRedeemPreview(market, ptBalance);
  const formattedReceive =
    previewAmount !== undefined
      ? formatBigInt(previewAmount as bigint, { unit: market.underlyingDecimals, maxDecimals: 4 })
      : undefined;

  const tokenTile = (
    <HStack className="items-center" gap={2}>
      <HStack className="items-center" gap={2}>
        <TokenIcon
          className="h-5 w-5"
          token={{ symbol: `PT-${market.underlyingSymbol}` }}
          showChainIcon={false}
        />
        <Text>
          {formatted} PT-{market.underlyingSymbol}
        </Text>
      </HStack>
      {formattedReceive && (
        <HStack className="items-center" gap={2}>
          <Text>→</Text>
          <TokenIcon className="h-5 w-5" token={{ symbol: market.underlyingSymbol }} showChainIcon={false} />
          <Text>
            {formattedReceive} {market.underlyingSymbol}
          </Text>
        </HStack>
      )}
    </HStack>
  );

  const { openRedeemModal, isPrepared } = usePendleRedeemModal(market, { transactionContent: tokenTile });

  return (
    <TableRow data-testid="pendle-matured-row" data-market={market.marketAddress}>
      <TableCell>
        <HStack className="items-center" gap={2}>
          <TokenIcon
            className="h-5 w-5"
            token={{ symbol: `PT-${market.underlyingSymbol}` }}
            showChainIcon={false}
          />
          <Text>PT-{market.underlyingSymbol}</Text>
        </HStack>
      </TableCell>
      <TableCell>
        <Text>{formatted} PT</Text>
      </TableCell>
      <TableCell>
        {previewLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : formattedReceive !== undefined ? (
          <Text>
            {formattedReceive} {market.underlyingSymbol}
          </Text>
        ) : (
          <Text className="text-textSecondary">—</Text>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="primary"
          size="sm"
          className="rounded-xl px-4"
          onClick={openRedeemModal}
          disabled={!isPrepared}
          data-testid="pendle-row-redeem-button"
        >
          <Trans>Redeem</Trans>
        </Button>
      </TableCell>
    </TableRow>
  );
};
