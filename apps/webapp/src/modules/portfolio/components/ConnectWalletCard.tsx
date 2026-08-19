import { useEffect } from 'react';
import { Trans } from '@lingui/react/macro';
import { Button } from '@/components/ui/button';
import { PromoBanner, BannerAccent } from '@/components/product/PromoBanner';
import { useCustomConnectModal } from '@/modules/ui/hooks/useCustomConnectModal';
import { trackPromoImpression, trackPromoClicked } from '@/modules/analytics/lib/trackAmbientSurfaces';

/**
 * Top-of-page banner shown to disconnected visitors: a short pitch and the same
 * connect flow the header uses (terms gate included, via useCustomConnectModal).
 * The DS Banners "Wallet" type (Figma 5273:45497).
 */
export function ConnectWalletCard() {
  const connect = useCustomConnectModal();

  useEffect(() => {
    trackPromoImpression({ promoId: 'connect_wallet_card' });
  }, []);

  // Not-connected comps (1222:16510 mobile / 1222:14807 desktop): the
  // layered-glass-panels asset in a 96px box on the phone tier, 160 from md
  // (the asset bakes the comp's inner margins), heading a tier down at 24/26,
  // and the CTA as a full-width 48px pill below md.
  return (
    <PromoBanner
      dataTestId="portfolio-connect-card"
      illustration={
        <img src="/illustrations/illustration-connect-glass-panels.png" alt="" className="size-full" />
      }
      illustrationClassName="size-24 md:size-40"
      heading={
        <p className="font-circle text-fgPrimary max-w-[480px] text-2xl leading-[26px] font-medium tracking-[-0.48px] md:text-[32px] md:leading-[35px] md:tracking-[-0.64px]">
          <Trans>
            <BannerAccent>Connect your wallet</BannerAccent> to see your balances and start earning
          </Trans>
        </p>
      }
      subtitle={
        <p className="text-fgSecondary text-xs leading-[18px]">
          <Trans>
            Your portfolio, active positions, and available assets will appear here once connected.
          </Trans>
        </p>
      }
      action={
        <Button
          variant="primary"
          size="xl"
          className="h-12 w-full md:h-14 md:w-auto"
          onClick={() => {
            trackPromoClicked({ promoId: 'connect_wallet_card' });
            connect();
          }}
          data-testid="portfolio-connect-card-button"
        >
          <Trans>Connect wallet</Trans>
        </Button>
      }
    />
  );
}
