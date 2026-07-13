import { t } from '@lingui/core/macro';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

export type ConvertTokenSymbol = 'USDS' | 'USDC';

export const CONVERT_TOKEN_SYMBOLS: ConvertTokenSymbol[] = ['USDS', 'USDC'];

function TokenOption({ symbol }: { symbol: ConvertTokenSymbol }) {
  return (
    <span className="flex items-center gap-1">
      <TokenIcon token={{ symbol }} width={16} showChainIcon={false} className="h-4 w-4" />
      <Text className="text-sm font-medium">{symbol}</Text>
    </span>
  );
}

/**
 * The Figma `USDS ▾` token chip on the Convert card (486:31193). Both selectors
 * list both PSM tokens; picking the token already on the *other* side flips the
 * conversion direction (the parent owns that state), so the two chips can never
 * show the same token.
 */
export function ConvertTokenSelect({
  value,
  onChange,
  dataTestId
}: {
  value: ConvertTokenSymbol;
  onChange: (next: ConvertTokenSymbol) => void;
  dataTestId: string;
}) {
  return (
    <Select value={value} onValueChange={next => onChange(next as ConvertTokenSymbol)}>
      {/* Design-system Button / Dropdown, size S (Figma 5019:4105); same
          shadcn-trigger overrides as FilterSelect. */}
      <SelectTrigger
        data-testid={dataTestId}
        aria-label={t`Select token`}
        className={cn(
          buttonVariants({ variant: 'dropdown', size: 'dropdownS' }),
          'h-auto w-auto shrink-0 bg-transparent [&>svg]:size-3 [&>svg]:opacity-100 [&>svg]:transition-transform data-[state=open]:[&>svg]:rotate-180'
        )}
      >
        <SelectValue>
          <TokenOption symbol={value} />
        </SelectValue>
      </SelectTrigger>
      {/* Panel and rows are the DS Dropdown recipe (SelectContent/SelectItem defaults). */}
      <SelectContent>
        {CONVERT_TOKEN_SYMBOLS.map(symbol => (
          <SelectItem key={symbol} value={symbol}>
            <TokenOption symbol={symbol} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
