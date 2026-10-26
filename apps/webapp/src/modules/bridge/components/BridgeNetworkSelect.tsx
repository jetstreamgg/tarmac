import { t } from '@lingui/core/macro';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getBridgeNetwork, type BridgeNetworkId } from '../model/networks';
import { BridgeNetworkIcon, BridgeNetworkBadge } from './BridgeNetworkIcon';

type NetworkOptionProps = { network: BridgeNetworkId; onFork?: boolean };

function NetworkOption({ network, onFork = false }: NetworkOptionProps) {
  return (
    <span className="flex items-center gap-1">
      <BridgeNetworkIcon network={network} className="size-4" />
      <span className="font-circle text-sm leading-4 font-medium">{getBridgeNetwork(network).name}</span>
      {onFork && (
        <span className="bg-glassBadge text-textSecondary rounded-full px-1.5 py-0.5 text-[10px] leading-3 font-medium">
          Tenderly
        </span>
      )}
    </span>
  );
}

const FORK_PREFIX = 'tenderly:';

type BridgeNetworkSelectProps = {
  value: BridgeNetworkId;
  /** The value is the network's Tenderly fork. */
  valueOnFork?: boolean;
  options: BridgeNetworkId[];
  /** Tenderly fork options, listed after `options` (dev builds with the fork L2s). */
  forkOptions?: BridgeNetworkId[];
  onChange: (next: BridgeNetworkId, onFork: boolean) => void;
  isStatic?: boolean;
  dataTestId: string;
};

/**
 * The network Button / Dropdown beside "From"/"To" on the bridge card (Figma
 * 3574:64008). `options` is the allowed list for this side; a static source
 * (Safe wallets) renders the plain badge instead. A Tenderly fork carries a
 * "Tenderly" pill, in the list and on the trigger.
 */
export function BridgeNetworkSelect({
  value,
  valueOnFork = false,
  options,
  forkOptions = [],
  onChange,
  isStatic = false,
  dataTestId
}: BridgeNetworkSelectProps) {
  if (isStatic) {
    return (
      <span data-testid={dataTestId}>
        <BridgeNetworkBadge network={value} />
      </span>
    );
  }

  return (
    <Select
      value={valueOnFork ? `${FORK_PREFIX}${value}` : value}
      onValueChange={next =>
        next.startsWith(FORK_PREFIX)
          ? onChange(next.slice(FORK_PREFIX.length) as BridgeNetworkId, true)
          : onChange(next as BridgeNetworkId, false)
      }
    >
      <SelectTrigger
        data-testid={dataTestId}
        aria-label={t`Select network`}
        className={cn(
          buttonVariants({ variant: 'dropdown', size: 'dropdownXs' }),
          'h-7 w-auto shrink-0 bg-transparent [&>svg]:size-3 [&>svg]:opacity-100 [&>svg]:transition-transform data-[state=open]:[&>svg]:rotate-180'
        )}
      >
        <SelectValue>
          <NetworkOption network={value} onFork={valueOnFork} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map(network => (
          <SelectItem key={network} value={network} data-testid={`${dataTestId}-${network}`}>
            <NetworkOption network={network} />
          </SelectItem>
        ))}
        {options.length > 0 && forkOptions.length > 0 && (
          <div className="bg-borderPrimary my-1 h-px w-full" aria-hidden />
        )}
        {forkOptions.map(network => (
          <SelectItem
            key={`${FORK_PREFIX}${network}`}
            value={`${FORK_PREFIX}${network}`}
            data-testid={`${dataTestId}-${network}-tenderly`}
          >
            <NetworkOption network={network} onFork />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
