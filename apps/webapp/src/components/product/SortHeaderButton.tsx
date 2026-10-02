import { AriaAttributes, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export type SortDirection = 'asc' | 'desc';

/** `aria-sort` for the header cell that holds a SortHeaderButton. */
export const ariaSortFor = (isSorted: boolean, direction: SortDirection): AriaAttributes['aria-sort'] =>
  isSorted ? (direction === 'asc' ? 'ascending' : 'descending') : undefined;

/** Table header label that sorts its column: the active one reads fg-primary with its chevron lit. */
export function SortHeaderButton({
  label,
  isSorted,
  direction,
  onClick,
  dataTestId
}: {
  label: ReactNode;
  isSorted: boolean;
  direction: SortDirection;
  onClick: () => void;
  dataTestId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={dataTestId}
      onClick={onClick}
      className={cn(
        'hover:text-fgPrimary inline-flex items-center gap-1 transition-colors',
        isSorted && 'text-fgPrimary'
      )}
    >
      {label}
      <ChevronDown
        size={12}
        className={cn(
          'transition-transform',
          isSorted ? 'opacity-100' : 'opacity-40',
          isSorted && direction === 'asc' && 'rotate-180'
        )}
      />
    </button>
  );
}
