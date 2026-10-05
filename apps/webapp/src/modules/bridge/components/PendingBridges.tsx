import { Fragment, useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/utils';
import { Button } from '@/components/ui/button';
import { LinkExternal } from '@/modules/icons';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { getBridgeNetwork } from '../model/networks';
import type { PendingBridge, PendingBridgeStatus } from '../model/types';
import { BridgeNetworkIcon } from './BridgeNetworkIcon';
import {
  buildPendingBridgeRows,
  formatBridgeDate,
  PENDING_STATUS_LABEL,
  type PendingBridgeCell
} from './pendingBridgeRows';

const STATUS_CLASS: Record<PendingBridgeStatus, string> = {
  pending: 'bg-statusWarningBg text-statusWarning',
  ready: 'bg-statusBrandBg text-statusBrand',
  arrived: 'bg-statusSuccessBg text-statusSuccess',
  claimed: 'bg-statusSuccessBg text-statusSuccess',
  failed: 'bg-statusErrorBg text-statusError'
};

const valueClassName = 'font-circle text-fgPrimary text-sm leading-4 font-medium tracking-[-0.28px]';

function CellValue({ cell }: { cell: PendingBridgeCell }) {
  switch (cell.kind) {
    case 'network':
      return (
        <span className="flex items-center gap-1">
          <BridgeNetworkIcon network={cell.network} className="size-3" />
          <span className={valueClassName}>{getBridgeNetwork(cell.network).name}</span>
        </span>
      );
    case 'status':
      return (
        <span
          className={cn(
            'font-circle flex h-[18px] w-fit items-center rounded-full px-1.5 text-[11px] leading-3 font-medium tracking-[-0.22px]',
            STATUS_CLASS[cell.status]
          )}
          data-testid="pending-bridge-status"
        >
          {PENDING_STATUS_LABEL[cell.status]}
        </span>
      );
    case 'link':
      return cell.href ? (
        <a
          href={cell.href}
          target="_blank"
          rel="noreferrer"
          className={cn(valueClassName, 'flex items-center gap-1 hover:underline')}
        >
          {cell.value}
          <LinkExternal boxSize={12} className="text-fgSecondary shrink-0" />
        </a>
      ) : (
        <span className={valueClassName}>{cell.value}</span>
      );
    default:
      return <span className={valueClassName}>{cell.value}</span>;
  }
}

function PendingBridgeCard({
  bridge,
  now,
  onClaim
}: {
  bridge: PendingBridge;
  now: number;
  onClaim: (bridge: PendingBridge) => void;
}) {
  const amount = formatNumber(parseFloat(formatUnits(bridge.amount, 18)), { minDecimals: 2, maxDecimals: 2 });
  return (
    <div
      className="bg-bgSecondary flex flex-col gap-6 rounded-2xl p-5 backdrop-blur-[20px] md:rounded-3xl md:p-8"
      data-testid="pending-bridge-card"
    >
      <div className="border-glassBorder flex items-center justify-between gap-3 border-b pb-8">
        <span className="flex items-center gap-3">
          <span className="border-borderTertiary flex size-9 shrink-0 items-center justify-center rounded-full border-[1.5px]">
            <TokenIcon token={{ symbol: 'USDS' }} width={28} showChainIcon={false} className="size-7" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="font-circle text-fgPrimary text-base leading-[18px] font-medium tracking-[-0.32px]">
              {amount}
            </span>
            <Text className="text-fgSecondary text-xs leading-[18px]">
              {formatBridgeDate(bridge.startedAt)}
            </Text>
          </span>
        </span>
        {bridge.requiresClaim && (
          <Button
            variant="primary"
            size="m"
            className="w-24"
            disabled={bridge.status !== 'ready'}
            onClick={() => onClaim(bridge)}
            data-testid="pending-bridge-claim"
          >
            <Trans>Claim</Trans>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {buildPendingBridgeRows(bridge, now).map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-8">
            {row.map((cell, cellIndex) => (
              <Fragment key={cell.label}>
                {cellIndex > 0 && <span aria-hidden className="bg-glassBorder h-8 w-px" />}
                <div className="flex min-w-0 flex-col gap-1">
                  <Text className="text-fgSecondary text-xs leading-[18px]">{cell.label}</Text>
                  <CellValue cell={cell} />
                </div>
              </Fragment>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** "Pending bridges" list under the bridge form (Figma 3574:64348). */
export function PendingBridges({
  bridges,
  onClaim
}: {
  bridges: PendingBridge[];
  onClaim: (bridge: PendingBridge) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const hasPending = bridges.some(bridge => bridge.status === 'pending');

  // Ticks the remaining-time estimate while something is in flight.
  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [hasPending]);

  if (bridges.length === 0) return null;

  return (
    <section className="flex w-full flex-col gap-6" data-testid="pending-bridges">
      <h2 className="font-circle text-fgPrimary text-lg leading-5.5 font-medium tracking-[-0.36px]">
        <Trans>Pending bridges</Trans>
      </h2>
      {bridges.map(bridge => (
        <PendingBridgeCard key={bridge.id} bridge={bridge} now={now} onClaim={onClaim} />
      ))}
    </section>
  );
}
