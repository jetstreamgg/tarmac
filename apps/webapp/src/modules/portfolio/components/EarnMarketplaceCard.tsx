import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import type { EarnProductRow, EarnRiskTier } from '@/hooks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIconStack } from '@/modules/ui/components/TokenIconStack';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { IconboxStatus } from '@/components/ui/iconbox';
import { RiskTierDetailsTrigger } from '@/components/product/RiskTierDetails';
import { productIconSymbol, productStatusType } from '@/components/product/productVisuals';
import { ProductGlyph } from './ProductGlyph';

const RISK_LABEL: Record<EarnRiskTier, ReactNode> = {
  low: <Trans>Low</Trans>,
  moderate: <Trans>Moderate</Trans>,
  advanced: <Trans>Advanced</Trans>
};

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
          the detail headers; 48px box holding the 40px token. */}
      <IconboxStatus
        size="l"
        type={productStatusType(row)}
        dot={!!productStatusType(row)}
        className="size-12"
      >
        <TokenIcon
          token={{ symbol: productIconSymbol(row) }}
          width={40}
          showChainIcon={false}
          className="h-10 w-10"
        />
      </IconboxStatus>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Text variant="large" tag="span" className="text-text text-2xl font-medium">
            {row.name}
          </Text>
          <ProductGlyph id={row.id} kind={row.kind} />
          {row.rate.value !== undefined && <Badge>{row.rate.formatted}</Badge>}
        </div>
        {/* TODO(D1): per-product marketing copy has no source yet. */}
        <Text variant="small" className="text-textSecondary">
          TODO
        </Text>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-4">
        <Stat label={<Trans>Risk</Trans>}>
          <div className="flex items-center gap-2">
            <RiskTierDetailsTrigger profile={row.riskProfile} />
            <span className="text-text text-sm font-medium">{RISK_LABEL[row.risk]}</span>
          </div>
        </Stat>
        <Stat label={<Trans>Supply</Trans>}>
          <TokenIconStack symbols={row.supplyTokens} size={20} />
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

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="bg-surface text-text rounded-full px-2 py-0.5 text-xs font-medium">{children}</span>
  );
}
