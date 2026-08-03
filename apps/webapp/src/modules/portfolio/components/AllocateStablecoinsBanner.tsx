import { Trans } from '@lingui/react/macro';
import { formatDecimalPercentage, formatNumber, projectAnnualEarnings } from '@/utils';
import { Button } from '@/components/ui/button';
import { PromoBanner, BannerAccent } from '@/components/product/PromoBanner';

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
  idleUsd: number;
  savingsRate: number;
  onAllocate: () => void;
}) {
  const yearly = projectAnnualEarnings(idleUsd, savingsRate);

  return (
    <PromoBanner
      dataTestId="allocate-stablecoins-banner"
      illustration={<img src="/illustrations/illustration-savings-1.png" alt="" className="size-full" />}
      heading={
        <div className="flex items-baseline gap-1">
          <span className="font-circle text-fgPrimary text-[44px] leading-[48px] font-medium tracking-[-0.88px]">{`$${formatNumber(yearly)}`}</span>
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
        <Button variant="primary" size="xl" className="shrink-0" onClick={onAllocate}>
          <Trans>Allocate your stablecoins</Trans>
        </Button>
      }
    />
  );
}
