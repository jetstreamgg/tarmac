import { ReactNode } from 'react';
import { Vault } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Convert } from '@/modules/icons';

export type FilterOption = { value: string; label: ReactNode };

/**
 * The DS Button / Dropdown recipe as worn by a shadcn `SelectTrigger` (Figma
 * 5019:4105, sizes S/M). The trigger's own h-10/w-full/bg and its 16px
 * half-opacity chevron are overridden here rather than editing the vendored
 * component; the `[&>svg]` rules only reach the trigger's direct chevron
 * child, not icons inside option labels.
 *
 * The trigger's `[&>span]:line-clamp-1` also has to go: it puts `-webkit-box`
 * + overflow-hidden on the value span, which clipped the chain-icon stack of
 * the portfolio's "All networks" label to the text line box (APP-432 item 1).
 * Labels here are single-line by construction, so nothing needs the clamp.
 *
 * Exported because the per-product transaction filters (Savings "All", /stake
 * "All positions") wear it too — they were bare text chips before APP-443
 * items 13/16.
 */
export function filterTriggerClasses(size: 's' | 'm' = 's') {
  return cn(
    buttonVariants({ variant: 'dropdown', size: size === 'm' ? 'dropdownM' : 'dropdownS' }),
    '[&>svg]:text-fgTertiary h-auto w-auto bg-transparent [&>svg]:opacity-100 [&>svg]:transition-transform data-[state=open]:[&>svg]:rotate-180',
    '[&>span]:line-clamp-none [&>span]:flex [&>span]:items-center',
    size === 'm' ? '[&>svg]:size-4' : '[&>svg]:size-3'
  );
}

/**
 * The resting ("all") labels of the three domain filters every table toolbar
 * shares — network / stablecoin / product. Figma tints the glyph
 * fg-brand-primary against the white label and pairs each filter with the mark
 * its domain already uses elsewhere in the app: the globe, the Convert nav
 * mark, and the Vault mark the TVL detail rows carry. Shared so the Earn
 * toolbar (1036:201239) and the Portfolio transactions toolbar (1030:58802,
 * APP-443 item 9) can't drift apart.
 */
const FILTER_ICON = 'text-fgBrand shrink-0';

export const ALL_STABLECOINS_LABEL = (
  <span className="flex items-center gap-1.5">
    <Convert boxSize={12} className={FILTER_ICON} />
    <Trans>All stablecoins</Trans>
  </span>
);

export const ALL_PRODUCTS_LABEL = (
  <span className="flex items-center gap-1.5">
    <Vault className={cn('h-3 w-3', FILTER_ICON)} />
    <Trans>All products</Trans>
  </span>
);

/**
 * Rounded-pill dropdown used by the Earn Opportunities filters and the
 * Portfolio header network filter. Always offers an "all" reset row above the
 * provided options. Labels are arbitrary nodes, so callers can include token /
 * chain icons.
 */
export function FilterSelect({
  options,
  selected,
  onChange,
  allLabel,
  testId,
  size = 's',
  triggerClassName
}: {
  options: FilterOption[];
  selected: string;
  onChange: (value: string) => void;
  allLabel: ReactNode;
  testId: string;
  /** DS Button / Dropdown size: `s` for table filter bars, `m` for page headers. */
  size?: 's' | 'm';
  /** Extra classes on the trigger button, e.g. `w-full` for the M6.1 mobile header row. */
  triggerClassName?: string;
}) {
  return (
    <Select value={selected} onValueChange={onChange}>
      <SelectTrigger data-testid={testId} className={cn(filterTriggerClasses(size), triggerClassName)}>
        <SelectValue />
      </SelectTrigger>
      {/* Panel and rows are the DS Dropdown recipe (SelectContent/SelectItem defaults). */}
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
