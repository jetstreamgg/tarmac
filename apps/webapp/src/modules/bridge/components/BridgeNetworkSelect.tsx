import { t } from '@lingui/core/macro';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getBridgeNetwork, type BridgeNetworkId } from '../model/networks';
import { BridgeNetworkIcon, BridgeNetworkBadge } from './BridgeNetworkIcon';

function NetworkOption({ network }: { network: BridgeNetworkId }) {
  return (
    <span className="flex items-center gap-1">
      <BridgeNetworkIcon network={network} className="size-4" />
      <span className="font-circle text-sm leading-4 font-medium">{getBridgeNetwork(network).name}</span>
    </span>
  );
}

/**
 * The network Button / Dropdown beside "From"/"To" on the bridge card (Figma
 * 3574:64008). `options` is the allowed list for this side; a static source
 * (Safe wallets) renders the plain badge instead.
 */
export function BridgeNetworkSelect({
  value,
  options,
  onChange,
  isStatic = false,
  dataTestId
}: {
  value: BridgeNetworkId;
  options: BridgeNetworkId[];
  onChange: (next: BridgeNetworkId) => void;
  isStatic?: boolean;
  dataTestId: string;
}) {
  if (isStatic) {
    return (
      <span data-testid={dataTestId}>
        <BridgeNetworkBadge network={value} />
      </span>
    );
  }

  return (
    <Select value={value} onValueChange={next => onChange(next as BridgeNetworkId)}>
      <SelectTrigger
        data-testid={dataTestId}
        aria-label={t`Select network`}
        className={cn(
          buttonVariants({ variant: 'dropdown', size: 'dropdownXs' }),
          'h-7 w-auto shrink-0 bg-transparent [&>svg]:size-3 [&>svg]:opacity-100 [&>svg]:transition-transform data-[state=open]:[&>svg]:rotate-180'
        )}
      >
        <SelectValue>
          <NetworkOption network={value} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map(network => (
          <SelectItem key={network} value={network} data-testid={`${dataTestId}-${network}`}>
            <NetworkOption network={network} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
