import { Trans } from '@lingui/react/macro';
import { useMorphoVaultMarketApiData, useOverallSkyData } from '@/hooks';
import { Skeleton } from '@/components/ui/skeleton';
import { TokensComposition } from '@/components/product/TokensComposition';
import { Merkl } from '@/modules/icons';
import { formatDecimalPercentage } from '@/utils';
import { buildVaultStrategy, type StrategyCaps } from '../helpers/vaultStrategy';

// DS Charts / Pie Chart geometry, measured off the Figma export (10px box):
// the ring's outer edge sits on the box edge and the stroke is an eighth of the
// box, which puts the stroke's centre line at 0.4375 — a donut, not a filled
// pie. Kept as ratios so the glyph stays proportional at any `size`.
const DONUT_RADIUS_RATIO = 0.4375;
const DONUT_STROKE_RATIO = 0.125;

/**
 * Cap-utilization donut (DS Charts / Pie Chart, 10px): a round-capped sweep in
 * the segment's own color over a chart-track ring. `value` is 0..1.
 */
function CapUtilizationDonut({ value, color, size = 10 }: { value: number; color: string; size?: number }) {
  const radius = size * DONUT_RADIUS_RATIO;
  const strokeWidth = size * DONUT_STROKE_RATIO;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(Math.max(value, 0), 1);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-chartTrack"
      />
      {/* Skipped at zero: a round cap would still paint a dot for "0% filled". */}
      {filled > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={`${circumference * filled} ${circumference}`}
        />
      )}
    </svg>
  );
}

/** One "Absolute Cap" / "Relative Cap" stat — DS Body 7 label over Label 6 value. */
function CapStat({
  label,
  value,
  utilization,
  color
}: {
  label: React.ReactNode;
  value: string;
  /** Omitted for an uncapped market — there is no fill to show. */
  utilization?: number;
  color: string;
}) {
  return (
    <div className="flex flex-col justify-center gap-0.5 px-2.5">
      <span className="text-fgSecondary font-graphik text-[11px] leading-4">{label}</span>
      <span className="text-text font-circle flex items-center gap-1 text-xs leading-[14px] font-medium tracking-[-0.24px]">
        {value}
        {utilization !== undefined && <CapUtilizationDonut value={utilization} color={color} />}
      </span>
    </div>
  );
}

/** The caps block revealed under a hovered market row. */
function MarketCaps({ caps, color }: { caps: StrategyCaps; color: string }) {
  return (
    <div className="flex gap-0.5">
      <CapStat
        label={<Trans>Absolute Cap</Trans>}
        value={caps.formattedAbsoluteCap}
        utilization={caps.isAbsoluteCapUnlimited ? undefined : caps.absoluteCapUtilization}
        color={color}
      />
      <CapStat
        label={<Trans>Relative Cap</Trans>}
        value={caps.formattedRelativeCap}
        utilization={caps.relativeCapUtilization}
        color={color}
      />
    </div>
  );
}

/** DS Badges/secondary chip — the Merkl mark on a light disc plus its wordmark. */
function MerklBadge() {
  return (
    <span className="bg-badgeSecondary flex h-[18px] shrink-0 items-center gap-0.5 rounded-full pr-[5px] pl-[3px]">
      <span className="flex size-3 shrink-0 items-center justify-center rounded-full bg-[#e7e4ff]">
        <Merkl boxSize={8} className="light:fill-[#191f37] fill-[#191f37]" />
      </span>
      <span className="font-circle light:text-text text-[11px] leading-3 font-medium tracking-[-0.22px] text-[#e7e4ff]">
        Merkl
      </span>
    </span>
  );
}

/**
 * The "Strategy" section of the vault product page (ProductDetailTemplate
 * `afterDetails` slot): the total allocated capital, a proportional stacked bar
 * of the vault's market allocations, and a per-market legend. Same
 * `useMorphoVaultMarketApiData` source as the Exposure table it replaced,
 * distilled to total + shares via `buildVaultStrategy`, then handed to the DS
 * Tokens Composition component.
 *
 * Per Figma 2682:68829 / 2682:68931 the unutilized-liquidity row carries the
 * live Sky Savings Rate and a Merkl chip (that yield is distributed via Merkl).
 * Only idle USDS earns that rate — the USDC/USDT vaults' idle balances don't —
 * so the claim is gated on the idle asset, as the Exposure table it replaced
 * did. Hovering a market row reveals its supply caps — caps that don't exist
 * for idle capital, which is why only market segments get a `hoverDetail`.
 */
export function VaultStrategy({ vaultAddress }: { vaultAddress: `0x${string}` }) {
  const { data, isLoading } = useMorphoVaultMarketApiData({ vaultAddress });
  const { data: overallSkyData } = useOverallSkyData();
  const strategy = data?.market
    ? buildVaultStrategy(data.market.markets, data.market.idleLiquidity, data.totalAssetsUsd)
    : undefined;

  const savingsRate = overallSkyData?.skySavingsRatecRate
    ? formatDecimalPercentage(parseFloat(overallSkyData.skySavingsRatecRate))
    : undefined;

  return (
    <div data-testid="vault-strategy">
      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>
      ) : !strategy || strategy.segments.length === 0 ? (
        <span className="text-fgSecondary text-sm">
          <Trans>No allocations found</Trans>
        </span>
      ) : (
        <TokensComposition
          total={strategy.formattedTotal}
          // Shares already sit on a 0..1 scale against the vault total, so the
          // bar must not renormalize them — a vault whose reported total
          // exceeds its allocations keeps its short tail of empty track.
          valueTotal={1}
          segments={strategy.segments.map(segment => {
            const earnsSavingsRate = segment.kind === 'idle' && segment.assetSymbol === 'USDS';
            return {
              id: segment.id,
              label: earnsSavingsRate ? (
                savingsRate ? (
                  <Trans>Unutilized liquidity accrues the Sky Savings Rate ({savingsRate} APY)</Trans>
                ) : (
                  <Trans>Unutilized liquidity accrues the Sky Savings Rate</Trans>
                )
              ) : segment.kind === 'idle' ? (
                <Trans>Unutilized liquidity</Trans>
              ) : (
                segment.label
              ),
              badge: earnsSavingsRate ? <MerklBadge /> : undefined,
              href: segment.marketId
                ? `https://app.morpho.org/ethereum/market/${segment.marketId}`
                : undefined,
              hoverDetail: segment.caps ? (
                <MarketCaps caps={segment.caps} color={segment.hoverColor} />
              ) : undefined,
              color: segment.color,
              hoverColor: segment.hoverColor,
              value: segment.share,
              percent: parseFloat(segment.formattedShare),
              formattedValue: segment.formattedUsd
            };
          })}
        />
      )}
    </div>
  );
}
