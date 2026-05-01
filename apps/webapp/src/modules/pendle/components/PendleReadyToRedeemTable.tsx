import { useEffect, useMemo, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { useConnection } from 'wagmi';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import {
  isMarketMatured,
  PENDLE_MARKETS,
  usePendleUserPtBalances,
  type PendleMarketConfig
} from '@jetstreamgg/sky-hooks';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Text } from '@/modules/layout/components/Typography';
import { HStack } from '@/modules/layout/components/HStack';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { usePendleRedeemModal } from '../hooks/usePendleRedeemModal';
import { usePendleRedeemAllModal } from '../hooks/usePendleRedeemAllModal';

/**
 * Right-pane table of matured positions with per-row Redeem + Claim selected
 * footer. Mirrors the shape of Vaults' ClaimableRewardsTable. Renders null
 * when no matured PT held — the parent DetailSection wraps it.
 */
export const PendleReadyToRedeemTable = () => {
  const { address } = useConnection();
  const { data: ptBalances } = usePendleUserPtBalances();

  const maturedHeld = useMemo<{ market: PendleMarketConfig; ptBalance: bigint }[]>(() => {
    if (!address || !ptBalances) return [];
    const held: { market: PendleMarketConfig; ptBalance: bigint }[] = [];
    PENDLE_MARKETS.forEach(market => {
      if (!isMarketMatured(market.expiry)) return;
      const balance = ptBalances[market.marketAddress];
      if (balance !== undefined && balance > 0n) held.push({ market, ptBalance: balance });
    });
    return held;
  }, [address, ptBalances]);

  const [selected, setSelected] = useState<Set<`0x${string}`>>(new Set());

  // Auto-select all rows when the matured set changes (matches Vaults UX:
  // user lands with everything ticked; can untick).
  // Stable string key so React doesn't think `maturedHeld` changed every render
  // when its contents are equivalent. Only the joined-address-list matters.
  const maturedKey = maturedHeld.map(p => p.market.marketAddress).join(',');
  useEffect(() => {
    const next = maturedKey === '' ? [] : maturedKey.split(',');
    setSelected(new Set(next as `0x${string}`[]));
  }, [maturedKey]);

  const selectedPositions = useMemo(
    () => maturedHeld.filter(p => selected.has(p.market.marketAddress)),
    [maturedHeld, selected]
  );

  const { openRedeemAllModal, isPrepared: allPrepared } = usePendleRedeemAllModal(selectedPositions);

  if (maturedHeld.length === 0) return null;

  const allSelected = selected.size === maturedHeld.length && maturedHeld.length > 0;

  const toggleRow = (addr: `0x${string}`) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(addr)) next.delete(addr);
      else next.add(addr);
      return next;
    });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(maturedHeld.map(p => p.market.marketAddress)));

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
            </TableHead>
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
            <PendleMaturedRow
              key={market.marketAddress}
              market={market}
              ptBalance={ptBalance}
              isSelected={selected.has(market.marketAddress)}
              onToggle={() => toggleRow(market.marketAddress)}
            />
          ))}
        </TableBody>
      </Table>
      {selectedPositions.length > 1 && (
        <div className="flex justify-end">
          <Button
            onClick={openRedeemAllModal}
            disabled={!allPrepared}
            data-testid="pendle-claim-selected-button"
          >
            <Trans>Claim selected ({selectedPositions.length} markets)</Trans>
          </Button>
        </div>
      )}
    </div>
  );
};

type RowProps = {
  market: PendleMarketConfig;
  ptBalance: bigint;
  isSelected: boolean;
  onToggle: () => void;
};

const PendleMaturedRow = ({ market, ptBalance, isSelected, onToggle }: RowProps) => {
  const formatted = formatBigInt(ptBalance, { unit: market.underlyingDecimals, maxDecimals: 4 });

  const tokenTile = (
    <HStack className="items-center" gap={2}>
      <TokenIcon className="h-5 w-5" token={{ symbol: 'USDS' }} showChainIcon={false} />
      <Text>
        {formatted} PT-{market.underlyingSymbol} → {formatted} {market.underlyingSymbol}
      </Text>
    </HStack>
  );

  const { openRedeemModal, isPrepared } = usePendleRedeemModal(market, { transactionContent: tokenTile });

  return (
    <TableRow data-testid="pendle-matured-row" data-market={market.marketAddress}>
      <TableCell>
        <Checkbox checked={isSelected} onCheckedChange={onToggle} aria-label={`Select ${market.name}`} />
      </TableCell>
      <TableCell>
        <HStack className="items-center" gap={2}>
          <TokenIcon className="h-5 w-5" token={{ symbol: 'USDS' }} showChainIcon={false} />
          <Text>PT-{market.underlyingSymbol}</Text>
        </HStack>
      </TableCell>
      <TableCell>
        <Text>{formatted} PT</Text>
      </TableCell>
      <TableCell>
        <Text>
          {formatted} {market.underlyingSymbol}
        </Text>
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="secondary"
          size="sm"
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
