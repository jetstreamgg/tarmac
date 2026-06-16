import { ReactNode, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { formatDecimalPercentage, formatUsd } from '@/utils';
import { Button } from '@/components/ui/button';
import { GainValue } from '@/components/ui/GainValue';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import type { SuppliedView } from '../helpers/suppliedView';
import { PortfolioDonutChart, type DonutSegment } from './PortfolioDonutChart';

type EarningsTab = 'supplied' | 'idle';

export function StablecoinEarningsCard({ view, isLoading }: { view: SuppliedView; isLoading: boolean }) {
  const [tab, setTab] = useState<EarningsTab>('supplied');
  const [activeId, setActiveId] = useState<string | null>(null);

  const showSkeleton = isLoading && view.positions.length === 0;

  // Hovering a position (legend or chart) focuses the card on it: totals and
  // footer stats collapse to that single position's values.
  const activePosition = activeId ? view.positions.find(p => p.id === activeId) : undefined;
  const activeSymbol = activePosition?.tokenSymbol ?? null;
  const displayTotal = activePosition ? activePosition.amountUsd : view.totalSupplied;
  const displayProjected = activePosition
    ? activePosition.amountUsd * (activePosition.rate ?? 0)
    : view.projected1Y;
  const displayAvgRate = activePosition ? (activePosition.rate ?? 0) : view.avgRate;

  const segments: DonutSegment[] = view.positions.map(p => ({
    id: p.id,
    color: p.color,
    value: p.amountUsd
  }));

  const renderCenter = (id: string): ReactNode => {
    const position = view.positions.find(p => p.id === id);
    if (!position) return null;
    return (
      <div className="flex items-center gap-1.5">
        <TokenIcon
          token={{ symbol: position.tokenSymbol }}
          width={16}
          showChainIcon={false}
          className="h-4 w-4"
        />
        <span className="text-text text-sm font-medium">{position.tokenSymbol}</span>
      </div>
    );
  };

  return (
    <div
      className="bg-container rounded-3xl border p-6 bg-blend-overlay backdrop-blur-[50px] md:p-8"
      data-testid="stablecoin-earnings-card"
    >
      {/* Tabs */}
      <div className="flex items-center gap-2">
        <Button
          variant={tab === 'supplied' ? 'pill' : 'chip'}
          size="xs"
          className="h-8 px-4 text-sm"
          aria-pressed={tab === 'supplied'}
          onClick={() => setTab('supplied')}
        >
          <Trans>Supplied</Trans>
        </Button>
        <Button
          variant={tab === 'idle' ? 'pill' : 'chip'}
          size="xs"
          className="h-8 px-4 text-sm"
          aria-pressed={tab === 'idle'}
          onClick={() => setTab('idle')}
        >
          <Trans>Idle</Trans>
        </Button>
      </div>

      {tab === 'idle' ? (
        // TODO(D1): Idle tab — wire wallet stablecoin balances once requirements land.
        <div className="flex min-h-[280px] items-center justify-center">
          <Text variant="medium" className="text-textSecondary">
            <Trans>Coming soon.</Trans>
          </Text>
        </div>
      ) : showSkeleton ? (
        <EarningsSkeleton />
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            {/* Left: total + legend */}
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-2">
                <Text variant="medium" className="text-textSecondary">
                  <Trans>Total supplied</Trans>
                </Text>
                <div className="flex items-center gap-3">
                  <Heading tag="h2" className="text-text font-circle text-[40px] leading-none">
                    {formatUsd(displayTotal)}
                  </Heading>
                  <span className="flex -space-x-2">
                    {view.suppliedTokens.map(symbol => (
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

              <ul className="flex flex-col gap-3" onMouseLeave={() => setActiveId(null)}>
                {view.positions.map(position => {
                  const pct = position.share * 100;
                  const pctLabel = pct > 0 && pct < 1 ? '<1%' : `${Math.round(pct)}%`;
                  return (
                    <li key={position.id}>
                      <button
                        type="button"
                        className={cn(
                          'flex items-center gap-3 text-left transition-opacity',
                          activeId && activeId !== position.id && 'opacity-50'
                        )}
                        onMouseEnter={() => setActiveId(position.id)}
                        onFocus={() => setActiveId(position.id)}
                        onBlur={() => setActiveId(null)}
                      >
                        <span
                          className="h-1 w-4 shrink-0 rounded-full"
                          style={{ backgroundColor: position.color }}
                        />
                        <Text variant="medium" tag="span" className="text-text font-medium">
                          {position.name}
                        </Text>
                        <Text variant="medium" tag="span" className="text-textSecondary">
                          ({pctLabel})
                        </Text>
                      </button>
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

            {/* Right: donut */}
            <PortfolioDonutChart
              segments={segments}
              activeId={activeId}
              onActiveChange={setActiveId}
              renderCenter={renderCenter}
              className="mx-auto shrink-0 lg:mx-0"
            />
          </div>

          <div className="border-borderPrimary mt-8 mb-6 border-b" />

          <EarningsFooterStats
            projected={displayProjected}
            avgRate={displayAvgRate}
            activePositions={view.activePositions}
            showActivePositions={!activePosition}
          />
        </>
      )}
    </div>
  );
}

function EarningsFooterStats({
  projected,
  avgRate,
  activePositions,
  showActivePositions
}: {
  projected: number;
  avgRate: number;
  activePositions: number;
  showActivePositions: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
      {/* TODO(D1): Total earned / Earned this month need a cost-basis source (no hook yet). */}
      <Stat label={<Trans>Total earned</Trans>} value={<TodoValue />} />
      <Stat label={<Trans>Earned this month</Trans>} value={<TodoValue />} />
      <Stat
        label={<Trans>1Y projected earnings</Trans>}
        value={<GainValue value={projected} className="text-lg font-medium" />}
      />
      <Stat
        label={<Trans>Avg. Rate</Trans>}
        value={<span className="text-text text-lg font-medium">{formatDecimalPercentage(avgRate)}</span>}
      />
      {showActivePositions && (
        <Stat
          label={<Trans>Active positions</Trans>}
          value={<span className="text-text text-lg font-medium">{activePositions}</span>}
        />
      )}
    </div>
  );
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
