import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIconStack } from '@/modules/ui/components/TokenIconStack';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { IconboxStatus } from '@/components/ui/iconbox';
import { RateBadge } from '@/components/ui/RateBadge';
import { RiskTierDetailsTrigger } from '@/components/product/RiskTierDetails';
import { Vaults } from '@/widgets/shared/components/icons/Vaults';
import type { EarnWithSkyProduct, EarnWithSkyProductId } from '../helpers/earnWithSky';

/**
 * The editorial half of each product group's card (Figma 2376:225231): icon,
 * title, blurb and CTA label. The live half (rate, supply, risk, destination)
 * arrives as the EarnWithSkyProduct.
 */
const CARD_CONTENT: Record<
  EarnWithSkyProductId,
  { icon: ReactNode; title: ReactNode; description: ReactNode; cta: ReactNode }
> = {
  savings: {
    icon: <TokenIcon token={{ symbol: 'sUSDS' }} width={52} showChainIcon={false} />,
    title: 'sUSDS',
    description: <Trans>Powered by the Sky Savings Rate: Sky’s benchmark rate for stablecoin capital</Trans>,
    cta: <Trans>Access sUSDS</Trans>
  },
  vaults: {
    // The vault family has no token of its own; its mark is the module glyph,
    // clipped round so it sits in the status ring like the token logos.
    icon: <Vaults className="size-[52px] rounded-full" />,
    title: <Trans>Vaults</Trans>,
    description: <Trans>Deploy USDS, USDC or USDT across a range of vaults running on Morpho</Trans>,
    cta: <Trans>Launch Vaults</Trans>
  },
  stake: {
    icon: <TokenIcon token={{ symbol: 'SKY' }} width={52} showChainIcon={false} />,
    title: <Trans>Stake SKY</Trans>,
    description: <Trans>Stake SKY to govern, accrue rewards, and borrow USDS</Trans>,
    cta: <Trans>Access SKY</Trans>
  }
};

/**
 * One product-group card of the Portfolio "Earn with Sky" section.
 * Presentational — the caller routes the CTA via `onStart`.
 */
export function EarnWithSkyCard({ product, onStart }: { product: EarnWithSkyProduct; onStart: () => void }) {
  const content = CARD_CONTENT[product.id];
  return (
    <Card
      className="flex h-full flex-col gap-8 p-5"
      data-testid="earn-with-sky-card"
      data-product={product.id}
    >
      {/* DS Iconbox / Status sizes the mark itself — 64px overall around a
          52px mark at `l` (Figma 2376:225234 → I…;5320:41748). */}
      <IconboxStatus size="l">{content.icon}</IconboxStatus>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Text variant="large" tag="span" className="text-text font-circle text-2xl font-medium">
            {content.title}
          </Text>
          {/* DS Badges / Special — the green rate pill (5320:41752). */}
          {product.rate.value !== undefined && (
            <RateBadge data-testid="earn-with-sky-card-rate">
              {product.isBestOf ? <Trans>up to {product.rate.formatted}</Trans> : product.rate.formatted}
            </RateBadge>
          )}
        </div>
        <Text variant="medium" className="text-textSecondary leading-[22px]">
          {content.description}
        </Text>
      </div>

      {/* Supply leads, Risk follows, and Risk is the bare meter — no tier word
          beside it (1036:189284 dark / 1030:58560 light, APP-443 item 20). */}
      <div className="mt-auto grid grid-cols-2 gap-4">
        <Stat label={<Trans>Supply</Trans>}>
          <TokenIconStack symbols={product.supplyTokens} size={20} />
        </Stat>
        <Stat label={<Trans>Risk</Trans>}>
          <RiskTierDetailsTrigger profile={product.riskProfile} />
        </Stat>
      </div>

      <Button
        variant="primary"
        size="l"
        className="w-full"
        onClick={onStart}
        data-testid="earn-with-sky-card-start"
      >
        {content.cta}
      </Button>
    </Card>
  );
}

function Stat({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Text variant="captionSm" className="text-textSecondary leading-[18px]">
        {label}
      </Text>
      {children}
    </div>
  );
}
