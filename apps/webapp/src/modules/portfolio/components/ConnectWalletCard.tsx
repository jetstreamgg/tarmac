import { Trans } from '@lingui/react/macro';
import { Button } from '@/components/ui/button';
import { PromoBanner, BannerAccent } from '@/components/product/PromoBanner';
import { useCustomConnectModal } from '@/modules/ui/hooks/useCustomConnectModal';

/**
 * Top-of-page banner shown to disconnected visitors: a short pitch and the same
 * connect flow the header uses (terms gate included, via useCustomConnectModal).
 * The DS Banners "Wallet" type (Figma 5273:45497).
 */
export function ConnectWalletCard() {
  const connect = useCustomConnectModal();

  return (
    <PromoBanner
      dataTestId="portfolio-connect-card"
      illustration={<img src="/illustrations/illustration-connect-wallet.png" alt="" className="size-full" />}
      heading={
        <p className="font-circle text-fgPrimary max-w-[480px] text-[32px] leading-[35px] font-medium tracking-[-0.64px]">
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
        <Button variant="primary" size="xl" onClick={connect} data-testid="portfolio-connect-card-button">
          <Trans>Connect wallet</Trans>
        </Button>
      }
    />
  );
}
