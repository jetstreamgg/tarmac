import { ReactNode, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { formatDecimalPercentage, formatUsd, projectAnnualEarnings } from '@/utils';
import { GainValue } from '@/components/ui/GainValue';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import type { SuppliedView } from '../helpers/suppliedView';
import type { IdleView } from '../helpers/idleView';
import { PortfolioDonutChart, type DonutSegment } from './PortfolioDonutChart';
import { PortfolioTabs, type PortfolioTab } from './PortfolioTabs';

export function StablecoinEarningsCard({
  suppliedView,
  suppliedLoading,
  idleView,
  idleLoading,
  savingsRate,
  tab,
  onTabChange
}: {
  suppliedView: SuppliedView;
  suppliedLoading: boolean;
  idleView: IdleView;
  idleLoading: boolean;
  /** Current Sky Savings Rate as a decimal fraction (0.0375 = 3.75%). */
  savingsRate: number;
  tab: PortfolioTab;
  onTabChange: (tab: PortfolioTab) => void;
}) {
  return (
    <div
      className="bg-container rounded-3xl border p-6 bg-blend-overlay backdrop-blur-[50px] md:p-8"
      data-testid="stablecoin-earnings-card"
    >
      <PortfolioTabs tab={tab} onTabChange={onTabChange} />

      {tab === 'idle' ? (
        <IdleContent view={idleView} savingsRate={savingsRate} isLoading={idleLoading} />
      ) : (
        <SuppliedContent view={suppliedView} isLoading={suppliedLoading} />
      )}
    </div>
  );
}

function SuppliedContent({ view, isLoading }: { view: SuppliedView; isLoading: boolean }) {
  // Hovering a position (legend or chart) focuses the card on it: totals and
  // footer stats collapse to that single position's values.
  const [activeId, setActiveId] = useState<string | null>(null);

  if (isLoading && view.positions.length === 0) return <EarningsSkeleton />;

  const activePosition = activeId ? view.positions.find(p => p.id === activeId) : undefined;
  const activeSymbol = activePosition?.tokenSymbol ?? null;
  const displayTotal = activePosition ? activePosition.amountUsd : view.totalSupplied;
  const displayProjected = activePosition
    ? projectAnnualEarnings(activePosition.amountUsd, activePosition.rate)
    : view.projected1Y;
  const displayAvgRate = activePosition ? (activePosition.rate ?? 0) : view.avgRate;

  const segments: DonutSegment[] = view.positions.map(p => ({
    id: p.id,
    color: p.color,
    value: p.amountUsd
  }));

  return (
    <>
      <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-8">
          <EarningsHeadline
            label={<Trans>Total supplied</Trans>}
            value={displayTotal}
            tokenSymbols={view.suppliedTokens}
            activeSymbol={activeSymbol}
          />

          <ul className="flex flex-col gap-3" onMouseLeave={() => setActiveId(null)}>
            {view.positions.map(position => {
              const pct = position.share * 100;
              const pctLabel = pct > 0 && pct < 1 ? '<1%' : `${Math.round(pct)}%`;
              return (
                <li key={position.id}>
                  <LegendRow
                    color={position.color}
                    dimmed={!!activeId && activeId !== position.id}
                    onActivate={() => setActiveId(position.id)}
                    onDeactivate={() => setActiveId(null)}
                  >
                    <Text variant="medium" tag="span" className="text-text font-medium">
                      {position.name}
                    </Text>
                    <Text variant="medium" tag="span" className="text-textSecondary">
                      ({pctLabel})
                    </Text>
                  </LegendRow>
                </li>
              );
            })}
            {view.positions.length === 0 && (
              <Text variant="medium" className="text-textSecondary">
                <Trans>No supplied positions yet.</Trans>
              </Text>
            )}
          </ul>
        </div>

        <PortfolioDonutChart
          segments={segments}
          activeId={activeId}
          onActiveChange={setActiveId}
          renderCenter={id => {
            const position = view.positions.find(p => p.id === id);
            return position ? <DonutCenter symbol={position.tokenSymbol} /> : null;
          }}
          className="mx-auto shrink-0 lg:mx-0"
        />
      </div>

      <Divider />

      <FooterStats>
        {/* TODO(D1): Total earned / Earned this month need a cost-basis source (no hook yet). */}
        <Stat label={<Trans>Total earned</Trans>} value={<TodoValue />} />
        <Stat label={<Trans>Earned this month</Trans>} value={<TodoValue />} />
        <Stat
          label={<Trans>1Y projected earnings</Trans>}
          value={<GainValue value={displayProjected} className="text-lg font-medium" />}
        />
        <Stat
          label={<Trans>Avg. Rate</Trans>}
          value={<StatValue>{formatDecimalPercentage(displayAvgRate)}</StatValue>}
        />
        {!activePosition && (
          <Stat
            label={<Trans>Active positions</Trans>}
            value={<StatValue>{view.activePositions}</StatValue>}
          />
        )}
      </FooterStats>
    </>
  );
}

function IdleContent({
  view,
  savingsRate,
  isLoading
}: {
  view: IdleView;
  savingsRate: number;
  isLoading: boolean;
}) {
  // Hovering a token focuses the card on it (mirrors the Supplied tab).
  const [activeId, setActiveId] = useState<string | null>(null);

  if (isLoading && view.tokens.length === 0) return <EarningsSkeleton />;

  const activeToken = activeId ? view.tokens.find(t => t.symbol === activeId) : undefined;
  const activeSymbol = activeToken?.symbol ?? null;
  const displayTotal = activeToken ? activeToken.amountUsd : view.walletBalance;
  const displayProjected = projectAnnualEarnings(displayTotal, savingsRate);

  const segments: DonutSegment[] = view.tokens.map(t => ({
    id: t.symbol,
    color: t.color,
    value: t.amountUsd
  }));

  return (
    <>
      <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-8">
          <EarningsHeadline
            label={<Trans>Wallet balance</Trans>}
            value={displayTotal}
            tokenSymbols={view.tokens.map(t => t.symbol)}
            activeSymbol={activeSymbol}
          />

          <ul className="flex flex-col gap-3" onMouseLeave={() => setActiveId(null)}>
            {view.tokens.map(token => (
              <li key={token.symbol}>
                <LegendRow
                  color={token.color}
                  dimmed={!!activeId && activeId !== token.symbol}
                  onActivate={() => setActiveId(token.symbol)}
                  onDeactivate={() => setActiveId(null)}
                >
                  <Text variant="medium" tag="span" className="text-text font-medium">
                    {token.symbol}
                  </Text>
                  <Text variant="medium" tag="span" className="text-textSecondary">
                    ({token.name})
                  </Text>
                </LegendRow>
              </li>
            ))}
            {view.tokens.length === 0 && (
              <Text variant="medium" className="text-textSecondary">
                <Trans>No idle stablecoins.</Trans>
              </Text>
            )}
          </ul>
        </div>

        <PortfolioDonutChart
          segments={segments}
          activeId={activeId}
          onActiveChange={setActiveId}
          renderCenter={id => <DonutCenter symbol={id} />}
          className="mx-auto shrink-0 lg:mx-0"
        />
      </div>

      <Divider />

      <FooterStats>
        <Stat
          label={<Trans>Sky Savings Rate</Trans>}
          value={<StatValue>{formatDecimalPercentage(savingsRate)}</StatValue>}
        />
        <Stat
          label={<Trans>1Y projected earnings</Trans>}
          value={<GainValue value={displayProjected} className="text-lg font-medium" />}
        />
        {/* Always the total — unlike Supplied's "Active positions", this stat
            stays fixed when focusing a single token. */}
        <Stat label={<Trans>Idle stablecoins</Trans>} value={<StatValue>{view.idleCount}</StatValue>} />
      </FooterStats>
    </>
  );
}

/** Total label + value with the overlapping token-icon cluster (dims on hover). */
function EarningsHeadline({
  label,
  value,
  tokenSymbols,
  activeSymbol
}: {
  label: ReactNode;
  value: number;
  tokenSymbols: string[];
  activeSymbol: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Text variant="medium" className="text-textSecondary">
        {label}
      </Text>
      <div className="flex items-center gap-3">
        <Heading tag="h2" className="text-text font-circle text-[40px] leading-none">
          {formatUsd(value)}
        </Heading>
        <span className="flex -space-x-2">
          {tokenSymbols.map(symbol => (
            <TokenIcon
              key={symbol}
              token={{ symbol }}
              width={28}
              showChainIcon={false}
              className={cn(
                'h-7 w-7 transition-opacity',
                activeSymbol && activeSymbol !== symbol && 'opacity-50'
              )}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

/** A hoverable legend entry: colored swatch + caller-provided label content. */
function LegendRow({
  color,
  dimmed,
  onActivate,
  onDeactivate,
  children
}: {
  color: string;
  dimmed: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn('flex items-center gap-3 text-left transition-opacity', dimmed && 'opacity-50')}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onBlur={onDeactivate}
    >
      <span className="h-1 w-4 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {children}
    </button>
  );
}

/** The active segment's token, shown centered in the donut hole. */
function DonutCenter({ symbol }: { symbol: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <TokenIcon token={{ symbol }} width={16} showChainIcon={false} className="h-4 w-4" />
      <span className="text-text text-sm font-medium">{symbol}</span>
    </div>
  );
}

function Divider() {
  return <div className="border-borderPrimary mt-8 mb-6 border-b" />;
}

function FooterStats({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">{children}</div>;
}

function Stat({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Text variant="medium" className="text-textSecondary">
        {label}
      </Text>
      {value}
    </div>
  );
}

function StatValue({ children }: { children: ReactNode }) {
  return <span className="text-text text-lg font-medium">{children}</span>;
}

function TodoValue() {
  return <span className="text-textSecondary text-lg font-medium">TODO</span>;
}

function EarningsSkeleton() {
  return (
    <div className="mt-6 flex animate-pulse flex-col gap-8 lg:flex-row lg:justify-between">
      <div className="flex flex-col gap-6">
        <div className="bg-surface h-4 w-28 rounded" />
        <div className="bg-surface h-10 w-72 rounded" />
        <div className="flex flex-col gap-3">
          <div className="bg-surface h-4 w-40 rounded" />
          <div className="bg-surface h-4 w-36 rounded" />
          <div className="bg-surface h-4 w-32 rounded" />
        </div>
      </div>
      <div className="bg-surface mx-auto h-[320px] w-[320px] shrink-0 rounded-full lg:mx-0" />
    </div>
  );
}
