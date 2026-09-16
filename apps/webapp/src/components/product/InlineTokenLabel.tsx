import { TokenIcon } from '@/modules/ui/components/TokenIcon';

/**
 * The token mark used inline in running copy (a supply card's "Supply {USDS}
 * at X% APY" headline). align-middle centers to the line's x-height; the
 * ~2px nudge up centers the icon on the uppercase symbol's cap-height instead
 * of sitting low.
 */
export function InlineTokenIcon({ symbol }: { symbol: string }) {
  return (
    <TokenIcon
      token={{ symbol }}
      width={24}
      showChainIcon={false}
      className="mr-1 inline-block h-5 w-5 -translate-y-0.5 align-middle md:h-6 md:w-6"
    />
  );
}

/**
 * An icon + symbol cluster for a headline built outside `<Trans>` so it lands
 * as a single message placeholder (Lingui can't extract JSX helpers inside the
 * macro). Only the icon is middle-aligned — the symbol stays on the title's
 * baseline, so the cluster lines up with the surrounding copy.
 */
export function InlineTokenLabel({ symbol }: { symbol: string }) {
  return (
    <span className="whitespace-nowrap">
      <InlineTokenIcon symbol={symbol} />
      {symbol}
    </span>
  );
}
