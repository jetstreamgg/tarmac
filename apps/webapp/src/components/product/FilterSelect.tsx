import { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type FilterOption = { value: string; label: ReactNode };

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
  testId
}: {
  options: FilterOption[];
  selected: string;
  onChange: (value: string) => void;
  allLabel: ReactNode;
  testId: string;
}) {
  // Same surface/item treatment as the header's MoreMenu popover: container
  // background, hover rows, selection shown by a prominent row background.
  const itemClasses =
    'text-textSecondary hover:text-text focus:text-text hover:bg-surfaceAlt focus:bg-surfaceAlt data-[state=checked]:bg-surface data-[state=checked]:text-text cursor-pointer rounded-md px-3 py-2 transition-colors';
  return (
    <Select value={selected} onValueChange={onChange}>
      {/* Design-system Button / Dropdown, size S (Figma 5019:4105). The
          shadcn trigger's own h-10/w-full/bg and its 16px half-opacity chevron
          are overridden here rather than editing the vendored component; the
          [&>svg] rules only reach the trigger's direct chevron child, not
          icons inside option labels. */}
      <SelectTrigger
        data-testid={testId}
        className={cn(
          buttonVariants({ variant: 'dropdown', size: 'dropdownS' }),
          'h-auto w-auto bg-transparent [&>svg]:size-3 [&>svg]:opacity-100 [&>svg]:transition-transform data-[state=open]:[&>svg]:rotate-180'
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-containerDark border-borderPrimary rounded-xl p-1.5 backdrop-blur-[50px]">
        <SelectItem value="all" hideIndicator className={itemClasses}>
          {allLabel}
        </SelectItem>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value} hideIndicator className={itemClasses}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
