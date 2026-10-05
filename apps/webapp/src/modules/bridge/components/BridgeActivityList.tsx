import { formatUnits } from 'viem';
import { formatDistanceToNowStrict } from 'date-fns';
import { ArrowDownToLine } from 'lucide-react';
import { formatNumber, formatUsd } from '@/utils';
import { getEtherscanLink } from '@/utils/getEtherscanLink';
import { IconboxAction } from '@/components/ui/iconbox';
import { ConvertArrows } from '@/modules/icons';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { getBridgeNetwork } from '../model/networks';
import { useBridgeHistory } from '../hooks/useBridgeHistory';
import { BridgeNetworkIcon } from './BridgeNetworkIcon';
import { BRIDGE_ACTIVITY_TITLE, buildBridgeActivity, type BridgeActivityEntry } from './bridgeActivity';

// USDS is pegged 1:1; the mock feed has no price source of its own.
const USDS_USD = 1;

/** Bridge / Funds claim rows (Figma Wallet Activity 3574:64437), styled as BalancesHistoryItem. */
export function BridgeActivityList() {
  const entries = buildBridgeActivity(useBridgeHistory());
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col" data-testid="bridge-activity">
      {entries.map(entry => (
        <BridgeActivityItem key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function BridgeActivityItem({ entry }: { entry: BridgeActivityEntry }) {
  const chainId = getBridgeNetwork(entry.network).chainId;
  const href = chainId === undefined ? undefined : getEtherscanLink(chainId, entry.txHash, 'tx');
  const value = parseFloat(formatUnits(entry.amount, 18));

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={new Date(entry.timestamp).toLocaleString()}
      className="hover:bg-bgSecondary flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl p-4 transition-colors"
      data-testid={`bridge-activity-item-${entry.kind}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative shrink-0">
          <IconboxAction>
            {entry.kind === 'bridge' ? (
              <ConvertArrows width={16} height={16} />
            ) : (
              <ArrowDownToLine className="size-4" />
            )}
          </IconboxAction>
          <span className="absolute -right-0.5 -bottom-0.5 flex size-4">
            <BridgeNetworkIcon network={entry.network} className="size-4" />
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-fgPrimary font-circle truncate text-base leading-[18px] font-medium tracking-[-0.32px]">
            {BRIDGE_ACTIVITY_TITLE[entry.kind]}
          </span>
          <span className="text-fgSecondary font-graphik text-xs leading-[18px]">
            {formatDistanceToNowStrict(entry.timestamp, { addSuffix: true })}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        <span className="text-fgPrimary font-circle flex items-center gap-1 text-lg leading-[22px] font-medium tracking-[-0.36px]">
          <TokenIcon token={{ symbol: 'USDS' }} className="size-4" width={16} showChainIcon={false} />
          {formatNumber(value, { minDecimals: 2, maxDecimals: 2 })}
        </span>
        <span className="text-fgSecondary font-graphik text-xs leading-[18px]">
          {formatUsd(value * USDS_USD)}
        </span>
      </div>
    </a>
  );
}
