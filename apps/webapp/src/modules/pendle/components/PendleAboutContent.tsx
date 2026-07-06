import { type ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { Activity, ArrowUpFromLine, AudioLines } from 'lucide-react';
import { usePendleMarketsApiData, type PendleMarketConfig } from '@/hooks';
import { formatDecimalPercentage, formatNumber } from '@/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const SECONDS_PER_DAY = 86_400;
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
  const ptSymbol = market.name;

  const expirySec = stats?.expirySec ?? market.expiry;
  const remainingDays = Math.max(
    0,
    Math.floor((expirySec - Math.floor(Date.now() / 1000)) / SECONDS_PER_DAY)
  );
  const apy = stats?.impliedApy;
  // Worked example: what 100 underlying redeems for at maturity, compounding
  // the current implied APY over the remaining term.
  const exampleOut = apy !== undefined ? EXAMPLE_SUPPLY * Math.pow(1 + apy, remainingDays / 365) : undefined;

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
        <Trans>
          Lock in a fixed yield on your {symbol}. Supply {symbol} today, withdraw a guaranteed amount on a
          future date. The yield is locked in the moment you supply — no surprises from changing rates.
        </Trans>{' '}
        {apy !== undefined && exampleOut !== undefined && (
          <>
            <Trans>
              Supply {EXAMPLE_SUPPLY} {symbol} and withdraw {formatNumber(exampleOut, { maxDecimals: 2 })}{' '}
              {symbol} in {remainingDays} days ({formatDecimalPercentage(apy)} fixed APY).
            </Trans>{' '}
          </>
        )}
        <Trans>
          Do you want to learn more about Pendle tokens?{' '}
          <a
            href="https://pendle.finance/"
            target="_blank"
            rel="noreferrer"
            className="text-blue-500 hover:underline"
          >
            Click here
          </a>
        </Trans>
      </p>
      <Accordion
        type="multiple"
        className="border-borderPrimary overflow-hidden rounded-xl border"
        data-testid="pendle-detail-faq"
      >
        {items.map(item => (
          <AccordionItem
            key={item.id}
            value={item.id}
            className="border-borderPrimary border-b px-6 last:border-b-0"
          >
            <AccordionTrigger className="py-6 [&>svg]:h-4 [&>svg]:w-4">
              <span className="flex items-center gap-3">
                <span className="border-borderPrimary flex h-9 w-9 items-center justify-center rounded-full border">
                  <span className="bg-surface text-text flex h-[30px] w-[30px] items-center justify-center rounded-full">
                    {item.icon}
                  </span>
                </span>
                <span className="text-text text-base font-medium">{item.title}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-textSecondary pb-6 text-xs leading-[18px]">
              {item.body}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
