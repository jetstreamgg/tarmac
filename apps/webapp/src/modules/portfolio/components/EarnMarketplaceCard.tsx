import { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import type { EarnProductRow, EarnRiskTier } from '@/hooks';
import { Card } from '@/components/ui/card';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIconStack } from '@/modules/ui/components/TokenIconStack';
import { ProductTokenIcon } from '@/modules/ui/components/ProductTokenIcon';
import { RiskTierMeter } from '@/components/product/RiskMeter';
import { productIconSymbol, productRingColor } from '@/components/product/productVisuals';
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
      <ProductTokenIcon
        symbol={productIconSymbol(row)}
        ringColor={productRingColor(row)}
        width={40}
        className="h-10 w-10"
      />

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
            <RiskTierMeter tier={row.risk} />
            <span className="text-text text-sm font-medium">{RISK_LABEL[row.risk]}</span>
          </div>
        </Stat>
        <Stat label={<Trans>Supply</Trans>}>
          <TokenIconStack symbols={row.supplyTokens} size={20} />
        </Stat>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="text-text hover:text-textSecondary flex w-full items-center justify-between border-t pt-4 text-sm font-medium transition-colors"
        data-testid="earn-marketplace-card-start"
      >
        <Trans>Start earning</Trans>
        <ArrowRight className="h-4 w-4" />
      </button>
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
