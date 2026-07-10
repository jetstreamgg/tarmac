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
  return (
    <span className="flex items-center gap-1.5">
      <TokenIcon token={{ symbol }} width={20} showChainIcon={false} className="h-5 w-5" />
      <Text className="font-medium">{symbol}</Text>
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

  const itemClasses =
    'text-textSecondary hover:text-text focus:text-text hover:bg-surfaceAlt focus:bg-surfaceAlt data-[state=checked]:bg-surface data-[state=checked]:text-text cursor-pointer rounded-md px-3 py-2 transition-colors';

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
      <SelectContent className="bg-containerDark border-borderPrimary rounded-xl p-1.5 backdrop-blur-[50px]">
        {options.map(symbol => (
          <SelectItem
            key={symbol}
            value={symbol}
            hideIndicator
            data-testid={`savings-origin-${symbol.toLowerCase()}`}
            className={itemClasses}
          >
            <OriginOption symbol={symbol} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
