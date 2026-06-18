import { ReactNode } from 'react';
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
      <SelectTrigger
        data-testid={testId}
        className="border-borderPrimary text-text bg-secondary hover:bg-surfaceAlt h-8 w-auto gap-1.5 rounded-full px-3 text-sm transition-colors"
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
