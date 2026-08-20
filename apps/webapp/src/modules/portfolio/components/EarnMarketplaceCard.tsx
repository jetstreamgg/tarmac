import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import type { EarnProductRow } from '@/hooks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIconStack } from '@/modules/ui/components/TokenIconStack';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { IconboxStatus } from '@/components/ui/iconbox';
import { RateBadge } from '@/components/ui/RateBadge';
import { RiskTierDetailsTrigger } from '@/components/product/RiskTierDetails';
import { productIconSymbol, productStatusType } from '@/components/product/productVisuals';
import { ProductGlyph } from './ProductGlyph';

/**
 * Card version of an Earn marketplace row, shown in the Portfolio "Earn with
 * Sky" carousel. Consumes the same EarnProductRow the Earn table renders, so the
 * two stay in agreement. Presentational — the caller routes the CTA to the
 * product page via `onStart`.
 */
export function EarnMarketplaceCard({ row, onStart }: { row: EarnProductRow; onStart: () => void }) {
  return (
    <Card className="flex h-full flex-col gap-8 p-5" data-testid="earn-marketplace-card">
      {/* DS Iconbox / Status keeps the family tint (ring + dot) in sync with
          the detail headers. The comp measures 64px overall including the ring
          with a 52px token inside it — not the DS `l` default of 48, and not
          the 48/40 this had been shrunk to (Figma 2376:225234 →
          I…;5320:41748, "update icon size"). */}
      <IconboxStatus size="l" type={productStatusType(row)} dot={!!productStatusType(row)}>
        <TokenIcon
          token={{ symbol: productIconSymbol(row) }}
          width={52}
          showChainIcon={false}
          className="size-[52px]"
        />
      </IconboxStatus>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Text variant="large" tag="span" className="text-text font-circle text-2xl font-medium">
            {row.name}
          </Text>
          <ProductGlyph id={row.id} kind={row.kind} />
          {/* DS Badges / Special — the green rate pill the comps draw here
              (1036:189284 dark / 1030:58560 light, APP-443 item 1); it was a
              neutral surface chip. */}
          {row.rate.value !== undefined && <RateBadge>{row.rate.formatted}</RateBadge>}
        </div>
        {/* TODO(D1): per-product marketing copy has no source yet. */}
        <Text variant="small" className="text-textSecondary">
          TODO
        </Text>
      </div>

      {/* Supply leads, Risk follows, and Risk is the bare meter — no tier word
          beside it (1036:189284 dark / 1030:58560 light, APP-443 item 20). */}
      <div className="mt-auto grid grid-cols-2 gap-4">
        <Stat label={<Trans>Supply</Trans>}>
          <TokenIconStack symbols={row.supplyTokens} size={20} />
        </Stat>
        <Stat label={<Trans>Risk</Trans>}>
          <RiskTierDetailsTrigger profile={row.riskProfile} />
        </Stat>
      </div>

      <Button
        variant="primary"
        size="l"
        className="w-full"
        onClick={onStart}
        data-testid="earn-marketplace-card-start"
      >
        <Trans>Start earning</Trans>
      </Button>
    </Card>
  );
}

function Stat({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Text variant="medium" className="text-textSecondary">
        {label}
      </Text>
      {children}
    </div>
  );
}
