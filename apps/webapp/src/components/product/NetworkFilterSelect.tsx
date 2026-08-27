import { useMemo } from 'react';
import { useChains } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/cn';
import { getChainIcon } from '@/utils';
import { useNetworkFilter } from '@/hooks';
import { IconStack } from '@/modules/ui/components/TokenIconStack';
import { FilterSelect, type FilterOption } from './FilterSelect';

/**
 * The one network filter, worn by all four surfaces that scope data by chain:
 * the Portfolio header, the Portfolio transactions toolbar, the Earn
 * Opportunities toolbar and the wallet drawer. They share the store
 * (lib/networkFilter) *and* this component, so the option set can't drift —
 * which matters more than it looks: the shared value has to be representable
 * on every surface, and a Radix Select whose `value` isn't among its items
 * renders a blank trigger. Each of these used to derive its own list (the
 * transactions toolbar only offered chains its rows happened to cover).
 *
 * Sizes follow the DS Button / Dropdown recipe already in FilterSelect: `m`
 * for page headers (24px chain marks), `s` for table toolbars (16px).
 */
export function NetworkFilterSelect({
  size = 's',
  allLabelStyle = 'globe',
  testId,
  triggerClassName
}: {
  size?: 's' | 'm';
  /**
   * The resting label's mark. 'globe' is the toolbar treatment shared with the
   * stablecoin/product filters; 'stack' is the Portfolio header's overlapped
   * chain discs (Figma 2376:225130).
   */
  allLabelStyle?: 'globe' | 'stack';
  testId: string;
  triggerClassName?: string;
}) {
  const chains = useChains();
  const { chainId, setChainId, supportedChainIds } = useNetworkFilter();

  const options: FilterOption[] = useMemo(() => {
    const iconSize = size === 'm' ? 'h-6 w-6' : 'h-4 w-4';
    return supportedChainIds.map(id => ({
      value: String(id),
      label: (
        <span className={cn('flex items-center', size === 'm' ? 'gap-2' : 'gap-1.5')}>
          <span className={cn('flex shrink-0', iconSize)}>{getChainIcon(id, 'h-full w-full')}</span>
          {/* Named from the wagmi config, not the static map, so a config swap
              that renames a chain (dev's "Tenderly …") stays correct. */}
          {chains.find(chain => chain.id === id)?.name ?? `Chain ${id}`}
        </span>
      )
    }));
  }, [supportedChainIds, chains, size]);

  // The stack is decoration on an "All networks" label, so it shows the
  // leading three chains rather than every supported one (Figma 2376:225130,
  // "Limit here to maximum 3 top networks"): past three the 8px-overlapped
  // discs eat the trigger's width and stop reading as distinct marks. The list
  // below still offers every chain.
  const allLabel =
    allLabelStyle === 'stack' ? (
      <span className="flex items-center gap-2">
        <IconStack size={24}>
          {supportedChainIds.slice(0, 3).map(id => getChainIcon(id, 'h-full w-full'))}
        </IconStack>
        <Trans>All networks</Trans>
      </span>
    ) : (
      <span className="flex items-center gap-1.5">
        <Globe className="text-fgBrand h-3 w-3 shrink-0" />
        <Trans>All networks</Trans>
      </span>
    );

  return (
    <FilterSelect
      options={options}
      selected={chainId === null ? 'all' : String(chainId)}
      onChange={value => setChainId(value === 'all' ? null : Number(value))}
      allLabel={allLabel}
      testId={testId}
      size={size}
      triggerClassName={triggerClassName}
    />
  );
}
