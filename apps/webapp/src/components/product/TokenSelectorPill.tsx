import { t } from '@lingui/core/macro';
import type { Token } from '@/hooks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

/**
 * The DS Button / Dropdown pill beside the percent presets (Figma 859:41136,
 * 84×28): 16px token icon + Label 5 symbol + 12px chevron. Collapses to the
 * static chip (no chevron affordance) when there is only one option — same
 * divergence the vault modal ships for its single-asset market. Extracted from
 * the Pendle modal form; shared by the amount-field token selectors (Pendle,
 * Upgrade).
 */
export function TokenSelectorPill({
  tokens,
  selected,
  onSelect,
  testId
}: {
  tokens: Token[];
  selected: Token;
  /** Unused by the single-option static chip, so optional there. */
  onSelect?: (token: Token) => void;
  testId: string;
}) {
  const face = (symbol: string) => (
    <span className="flex items-center gap-1">
      <TokenIcon token={{ symbol }} width={16} showChainIcon={false} className="size-4" />
      <span className="font-circle text-fgPrimary text-sm leading-4 font-medium tracking-[-0.28px]">
        {symbol}
      </span>
    </span>
  );

  if (tokens.length <= 1) {
    return (
      <span
        className="border-glassBorder flex h-7 shrink-0 items-center rounded-full border px-1.5"
        data-testid={testId}
      >
        {face(selected.symbol)}
      </span>
    );
  }

  return (
    <Select
      value={selected.symbol}
      onValueChange={symbol => {
        const next = tokens.find(option => option.symbol === symbol);
        if (next) onSelect?.(next);
      }}
    >
      <SelectTrigger
        aria-label={t`Select token`}
        data-testid={testId}
        className={cn(
          'border-glassBorder flex h-7 w-auto shrink-0 items-center gap-1 rounded-full border bg-transparent px-1.5 py-0 shadow-none',
          '[&>svg]:text-fgPrimary [&>svg]:size-3 [&>svg]:opacity-100 [&>svg]:transition-transform data-[state=open]:[&>svg]:rotate-180'
        )}
      >
        <SelectValue>{face(selected.symbol)}</SelectValue>
      </SelectTrigger>
      {/* Panel and rows are the DS Dropdown recipe (SelectContent/SelectItem defaults). */}
      <SelectContent>
        {tokens.map(option => (
          <SelectItem key={option.symbol} value={option.symbol}>
            {face(option.symbol)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
