import { t } from '@lingui/core/macro';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

export type ConvertTokenSymbol = 'USDS' | 'USDC';

export const CONVERT_TOKEN_SYMBOLS: ConvertTokenSymbol[] = ['USDS', 'USDC'];

function TokenOption({ symbol }: { symbol: ConvertTokenSymbol }) {
  return (
    <span className="flex items-center gap-1.5">
      <TokenIcon token={{ symbol }} width={20} showChainIcon={false} className="h-5 w-5" />
      <Text className="font-medium">{symbol}</Text>
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
  const itemClasses =
    'text-textSecondary hover:text-text focus:text-text hover:bg-surfaceAlt focus:bg-surfaceAlt data-[state=checked]:bg-surface data-[state=checked]:text-text cursor-pointer rounded-md px-3 py-2 transition-colors';

  return (
    <Select value={value} onValueChange={next => onChange(next as ConvertTokenSymbol)}>
      <SelectTrigger
        data-testid={dataTestId}
        aria-label={t`Select token`}
        className="text-text bg-panel h-auto w-auto shrink-0 gap-1.5 rounded-full border-none px-2.5 py-1 font-medium focus:ring-0 focus:ring-offset-0"
      >
        <SelectValue>
          <TokenOption symbol={value} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-containerDark border-borderPrimary rounded-xl p-1.5 backdrop-blur-[50px]">
        {CONVERT_TOKEN_SYMBOLS.map(symbol => (
          <SelectItem key={symbol} value={symbol} className={itemClasses}>
            <TokenOption symbol={symbol} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
