import { useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { useMorphoVaultMarketApiData } from '@/hooks';
import { Skeleton } from '@/components/ui/skeleton';
import { buildVaultStrategy } from '../helpers/vaultStrategy';

// Each pill tucks this far under its predecessor so only the predecessor's
// rounded cap + pageBackground ring shows over it — the DS "circular gap"
// joint (Figma tokens composition 5270:15661, APP-416).
const CAP_OVERLAP_PX = 6;

/**
 * The "Strategy" section of the vault product page (ProductDetailTemplate
 * `afterDetails` slot): the total allocated capital, a proportional stacked bar
 * of the vault's market allocations, and a per-market legend. Re-skin of the
 * existing Exposure table — same `useMorphoVaultMarketApiData` source, distilled
 * to total + shares via `buildVaultStrategy`. Hover (bar or legend) recolors the
 * segment with its DS Charts-Hover value and dims the rest to 50%, mirroring
 * the portfolio pie behavior.
 */
export function VaultStrategy({ vaultAddress }: { vaultAddress: `0x${string}` }) {
  const { data, isLoading } = useMorphoVaultMarketApiData({ vaultAddress });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const strategy = data?.market
    ? buildVaultStrategy(data.market.markets, data.market.idleLiquidity, data.totalAssetsUsd)
    : undefined;

  // Cumulative spans: pill i runs from its segment's start to its end, plus a
  // small tuck under pill i-1; earlier pills stack on top so their caps (with
  // the pageBackground ring) draw the joint gaps.
  let cursor = 0;
  const layers = (strategy?.segments ?? []).map(segment => {
    const start = cursor;
    cursor += segment.share;
    return { segment, start, end: cursor };
  });

  return (
    <div data-testid="vault-strategy">
      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>
      ) : !strategy || strategy.segments.length === 0 ? (
        <span className="text-textSecondary text-sm">
          <Trans>No allocations found</Trans>
        </span>
      ) : (
        <div className="flex flex-col gap-5">
          <span className="text-text text-3xl font-semibold">{strategy.formattedTotal}</span>

          {/* Proportional bar: absolutely stacked pills, earlier segments on
              top; the tall wrapper leaves room for the joint rings. */}
          <div className="relative flex h-3.5 w-full items-center" onMouseLeave={() => setHoveredId(null)}>
            <div className="bg-surface absolute top-1/2 right-0 left-0 h-1.5 -translate-y-1/2 rounded-full" />
            {layers.map(({ segment, start, end }, index) => (
              <div
                key={segment.id}
                onMouseEnter={() => setHoveredId(segment.id)}
                className="ring-pageBackground absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full ring-4 transition-[background-color,opacity] duration-150"
                style={{
                  left: index === 0 ? 0 : `calc(${start * 100}% - ${CAP_OVERLAP_PX}px)`,
                  width:
                    index === 0 ? `${end * 100}%` : `calc(${(end - start) * 100}% + ${CAP_OVERLAP_PX}px)`,
                  zIndex: layers.length - index,
                  backgroundColor: hoveredId === segment.id ? segment.hoverColor : segment.color,
                  opacity: hoveredId !== null && hoveredId !== segment.id ? 0.5 : 1
                }}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
            {strategy.segments.map(segment => (
              <div
                key={segment.id}
                className="flex flex-col gap-1 transition-opacity duration-150"
                style={{ opacity: hoveredId !== null && hoveredId !== segment.id ? 0.5 : 1 }}
                onMouseEnter={() => setHoveredId(segment.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <span className="text-textSecondary flex items-center gap-1.5 text-sm">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full transition-colors duration-150"
                    style={{
                      backgroundColor: hoveredId === segment.id ? segment.hoverColor : segment.color
                    }}
                  />
                  {segment.label}
                </span>
                <span className="text-text text-sm font-medium">
                  {segment.formattedUsd}{' '}
                  <span className="text-textSecondary">({segment.formattedShare})</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
