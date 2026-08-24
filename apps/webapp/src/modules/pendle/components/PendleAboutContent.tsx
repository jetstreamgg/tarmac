import { type ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { Activity, ArrowUpFromLine, AudioLines } from 'lucide-react';
import { usePendleMarketsApiData, type PendleMarketConfig } from '@/hooks';
import { formatDecimalPercentage, formatNumber } from '@/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { IconboxAction } from '@/components/ui/iconbox';
import { USER_RISKS_URL } from '@/lib/constants';
import { remainingDaysToMaturity } from '@/modules/earn/helpers/daysToMaturity';

const EXAMPLE_SUPPLY = 100;

/**
 * About body for the fixed-yield detail page (Figma 486:33885 expanded /
 * 486:34021 closed): an intro paragraph with a worked example computed from the
 * live implied APY and remaining term, then three icon accordion rows
 * (Fixed vs. variable / Withdrawing / APY) in a single bordered container.
 */
export function PendleAboutContent({ market }: { market: PendleMarketConfig }) {
  const { data: marketsApi } = usePendleMarketsApiData();
  const stats = marketsApi?.[market.marketAddress];

  // Pegged markets are framed in USDS everywhere on this page (position card,
  // hero copy) — 1 PT redeems 1 USDS at maturity. The fixed-vs-variable row
  // still names the actual underlying: that's the variable-yield instrument.
  const symbol = market.usdsEquivalence === 'pegged' ? 'USDS' : market.underlyingSymbol;
  const variableSymbol = market.underlyingSymbol;
  const ptSymbol = `PT-${market.underlyingSymbol}`;

  const expirySec = stats?.expirySec ?? market.expiry;
  const remainingDays = remainingDaysToMaturity(expirySec, Date.now());
  const apy = stats?.impliedApy;
  // Worked example: what 100 underlying redeems for at maturity, compounding
  // the current implied APY over the remaining term. The floored day count
  // hits 0 in the last stretch before expiry, where the example would claim a
  // withdrawal of exactly what was supplied - drop it and keep the plain
  // sentence, matching how `FixedYieldTerm` handles the same boundary.
  const exampleOut =
    apy !== undefined && remainingDays > 0
      ? EXAMPLE_SUPPLY * Math.pow(1 + apy, remainingDays / 365)
      : undefined;

  const items: { id: string; icon: ReactNode; title: ReactNode; body: ReactNode }[] = [
    {
      id: 'fixed-vs-variable',
      icon: <Activity className="h-4 w-4" />,
      title: <Trans>Fixed vs. variable</Trans>,
      body: (
        <Trans>
          {variableSymbol} gives you a variable yield that moves with the market. {ptSymbol} gives you a fixed
          yield, locked in at supply. Pick fixed if you want predictability or expect rates to drop. Pick
          variable if you want flexibility or expect rates to rise.
        </Trans>
      )
    },
    {
      id: 'withdrawing',
      icon: <ArrowUpFromLine className="h-4 w-4" />,
      title: <Trans>Withdrawing</Trans>,
      body: (
        <Trans>
          Hold until maturity to get your fixed yield, guaranteed. Exit early anytime by selling on the market
          — price depends on current conditions, so you may earn more or less than the locked-in rate.
        </Trans>
      )
    },
    {
      id: 'apy',
      icon: <AudioLines className="h-4 w-4" />,
      title: <Trans>APY</Trans>,
      body: (
        <Trans>
          The fixed APY changes day to day based on the market — your rate is frozen the moment you supply. We
          offer multiple maturity dates, each with its own rate.
        </Trans>
      )
    }
  ];

  return (
    <div className="flex flex-col gap-6" data-testid="pendle-detail-about">
      <p>
        {apy === undefined || exampleOut === undefined ? (
          <Trans>Lock in a fixed yield on your {symbol}.</Trans>
        ) : remainingDays === 1 ? (
          <Trans>
            Lock in a fixed yield on your {symbol}, e.g. supply {EXAMPLE_SUPPLY} {symbol} and withdraw{' '}
            {formatNumber(exampleOut, { maxDecimals: 2 })} {symbol} in one day ({formatDecimalPercentage(apy)}{' '}
            fixed APY).
          </Trans>
        ) : (
          <Trans>
            Lock in a fixed yield on your {symbol}, e.g. supply {EXAMPLE_SUPPLY} {symbol} and withdraw{' '}
            {formatNumber(exampleOut, { maxDecimals: 2 })} {symbol} in {remainingDays} days (
            {formatDecimalPercentage(apy)} fixed APY).
          </Trans>
        )}{' '}
        <Trans>
          Check out the{' '}
          <a href="https://pendle.finance/" target="_blank" rel="noreferrer" className="text-fgBrand">
            Pendle site
          </a>{' '}
          for more details.
        </Trans>{' '}
        <a href={USER_RISKS_URL} target="_blank" rel="noreferrer" className="text-fgBrand">
          <Trans>Learn more in the User Risk Documentation.</Trans>
        </a>
      </p>
      <Accordion type="multiple" data-testid="pendle-detail-faq">
        {items.map(item => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger>
              <span className="flex items-center gap-3">
                <IconboxAction>{item.icon}</IconboxAction>
                {item.title}
              </span>
            </AccordionTrigger>
            <AccordionContent>{item.body}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
