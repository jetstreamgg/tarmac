import { t } from '@lingui/core/macro';
import { TOKENS, type Token } from '@/hooks';
import { cn } from '@/lib/cn';
import { buttonVariants } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

/**
 * Supply origin tokens. DAI (mainnet) routes `useSavingsLaunch` to the
 * upgrade-and-supply engine (DAI → USDS → deposit); USDC (L2) routes to the PSM
 * swap. Withdraw is USDS-only on mainnet (single option → static chip) and gains a
 * USDS/USDC destination choice on L2 (slice 05).
 */
export type OriginSymbol = 'USDS' | 'DAI' | 'USDC';

export const ORIGIN_TOKENS: Record<OriginSymbol, Token> = {
  USDS: TOKENS.usds,
  DAI: TOKENS.dai,
  USDC: TOKENS.usdc
};

export const MAINNET_SUPPLY_ORIGINS: OriginSymbol[] = ['USDS', 'DAI'];
export const L2_SUPPLY_ORIGINS: OriginSymbol[] = ['USDS', 'USDC'];
// L2 withdraw lets the user pick the destination token (USDS / USDC); mainnet
// withdraw is always USDS.
export const L2_WITHDRAW_ORIGINS: OriginSymbol[] = ['USDS', 'USDC'];

function OriginOption({ symbol }: { symbol: OriginSymbol }) {
  // DS Button / Dropdown (859:36036 instance): 16px token icon, Label 5 text.
  return (
    <span className="flex items-center gap-1">
      <TokenIcon token={{ symbol }} width={16} showChainIcon={false} className="h-4 w-4" />
      <Text className="font-circle text-fgPrimary text-sm leading-4 font-medium tracking-[-0.28px]">
        {symbol}
      </Text>
    </span>
  );
}

/**
 * The Figma `USDS ▾` origin/destination token selector, shared by both supply
 * surfaces — the inline no-position card (`SavingsSupplyWithdrawPanel`) and the
 * has-position modal (`SavingsModalForm`). One option collapses to a static chip:
 * the dropdown affordance only appears when there is an actual alternative to pick
 * (mainnet withdraw is USDS-only, so it reads as a plain chip).
 *
 * Purely presentational — it owns no token state. The parent maps the selected
 * symbol to the `Token` (via `ORIGIN_TOKENS`) and resets the amount/Max on change,
 * so DAI routes to the existing upgrade-and-supply path with calldata unchanged.
 */
export function SavingsOriginSelect({
  value,
  options,
  onChange,
  disabled = false
}: {
  value: OriginSymbol;
  options: OriginSymbol[];
  onChange: (next: OriginSymbol) => void;
  disabled?: boolean;
}) {
  if (options.length <= 1) {
    return (
      <div className="text-text flex shrink-0 items-center gap-1.5" data-testid="savings-origin-select">
        <OriginOption symbol={value} />
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={next => onChange(next as OriginSymbol)} disabled={disabled}>
      {/* Design-system Button / Dropdown, size S (Figma 5019:4105); same
          shadcn-trigger overrides as FilterSelect. */}
      <SelectTrigger
        data-testid="savings-origin-select"
        aria-label={t`Select token`}
        className={cn(
          buttonVariants({ variant: 'dropdown', size: 'dropdownS' }),
          'h-auto w-auto shrink-0 bg-transparent [&>svg]:size-3 [&>svg]:opacity-100 [&>svg]:transition-transform data-[state=open]:[&>svg]:rotate-180'
        )}
      >
        <SelectValue>
          <OriginOption symbol={value} />
        </SelectValue>
      </SelectTrigger>
      {/* Panel and rows are the DS Dropdown recipe (SelectContent/SelectItem defaults). */}
      <SelectContent>
        {options.map(symbol => (
          <SelectItem key={symbol} value={symbol} data-testid={`savings-origin-${symbol.toLowerCase()}`}>
            <OriginOption symbol={symbol} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
