import { useEffect } from 'react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { formatDecimalPercentage, formatNumber, projectAnnualEarnings } from '@/utils';
import { Button } from '@/components/ui/button';
import { PromoBanner, BannerAccent } from '@/components/product/PromoBanner';
import { trackPromoImpression, trackPromoClicked } from '@/modules/analytics/lib/trackAmbientSurfaces';

/**
 * Top-of-page nudge shown when the user holds idle stablecoins but has no
 * significant earn position: how much those idle funds could earn at the Sky
 * Savings Rate, with a CTA into the Sky Savings product. The DS Banners
 * "Yearly estimation" type (Figma 5273:45495).
 */
export function AllocateStablecoinsBanner({
  idleUsd,
  savingsRate,
  onAllocate
}: {
  /** undefined while the figures behind the projection load — chips the number. */
  idleUsd: number | undefined;
  savingsRate: number;
  onAllocate: () => void;
}) {
  const yearly = idleUsd === undefined ? undefined : projectAnnualEarnings(idleUsd, savingsRate);

  // Impression = denominator for the CTA's click-through; the banner's 3-way
  // render condition is unreconstructable from clicks alone (APP-444 F).
  useEffect(() => {
    trackPromoImpression({ promoId: 'allocate_stablecoins' });
  }, []);

  return (
    <PromoBanner
      dataTestId="allocate-stablecoins-banner"
      illustration={<img src="/illustrations/illustration-savings-1.png" alt="" className="size-full" />}
      heading={
        <div className="flex items-baseline gap-1">
          {/* While loading the figure wears the same skeleton dress as the TVL
              callout: transparent same-width stand-in over a pulsing pill. */}
          <span
            className={cn(
              'font-circle text-fgPrimary text-[44px] leading-[48px] font-medium tracking-[-0.88px]',
              yearly === undefined && 'bg-surface animate-pulse rounded text-transparent select-none'
            )}
            data-testid={yearly === undefined ? 'allocate-banner-skeleton' : undefined}
          >{`$${formatNumber(yearly ?? 1000)}`}</span>
          <BannerAccent className="font-circle text-lg leading-[22px] font-medium tracking-[-0.36px]">
            <Trans>/year</Trans>
          </BannerAccent>
        </div>
      }
      subtitle={
        <p className="text-fgSecondary max-w-[248px] text-xs leading-[18px]">
          <Trans>
            That&apos;s what your idle stablecoins can earn at today&apos;s{' '}
            <span className="text-fgPrimary">{formatDecimalPercentage(savingsRate)} Sky Savings Rate</span>.
          </Trans>
        </p>
      }
      action={
        <Button
          variant="primary"
          size="xl"
          className="shrink-0"
          onClick={() => {
            trackPromoClicked({ promoId: 'allocate_stablecoins' });
            onAllocate();
          }}
        >
          <Trans>Allocate your stablecoins</Trans>
        </Button>
      }
    />
  );
}
