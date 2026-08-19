import type { ReactNode } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StablecoinEarningsCard } from './StablecoinEarningsCard';
import type { SuppliedView } from '../helpers/suppliedView';
import type { IdleView } from '../helpers/idleView';

// Pin the JS breakpoint per test (happy-dom's 1024 viewport = desktop).
const breakpoint = vi.hoisted(() => ({ isMobile: false }));
vi.mock('@/hooks/ui/useBreakpoint', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/ui/useBreakpoint')>();
  return {
    ...actual,
    useBreakpointIndex: () => ({ bpi: breakpoint.isMobile ? actual.BP.sm : actual.BP.desktop })
  };
});

// TokenIcon reaches for wagmi's chain config, which would need a provider. This
// suite only exercises the card's responsive wiring, so stub the icons out.
vi.mock('@/modules/ui/components/TokenIcon', () => ({
  TokenIcon: (props: { token: { symbol: string }; width?: number }) => (
    <span data-testid="token-icon" data-symbol={props.token.symbol} data-width={props.width} />
  )
}));
vi.mock('@/modules/ui/components/TokenIconStack', () => ({
  IconStack: (props: { size?: number; children?: ReactNode }) => (
    <span data-testid="icon-stack" data-size={props.size}>
      {props.children}
    </span>
  )
}));

i18n.load('en', {});
i18n.activate('en');

const SUPPLIED: SuppliedView = {
  positions: [
    {
      id: 'savings',
      name: 'Sky Savings Rate',
      tokenSymbol: 'sUSDS',
      kind: 'savings',
      intent: 'SAVINGS_INTENT' as SuppliedView['positions'][number]['intent'],
      amountUsd: 1000,
      rate: 0.0375,
      rateLoading: false,
      color: '#7C5BF5',
      hoverColor: '#7C5BF5',
      share: 1,
      detailPath: '/earn/savings',
      chainIds: [1]
    }
  ],
  totalSupplied: 1000,
  projected1Y: 37.5,
  avgRate: 0.0375,
  ratesLoading: false,
  activePositions: 1,
  suppliedTokens: ['sUSDS'],
  networksWithPositions: [1]
};

const IDLE: IdleView = {
  tokens: [{ symbol: 'USDS', name: 'USDS', amountUsd: 500, color: '#25D5C4' }],
  walletBalance: 500,
  idleCount: 1
} as IdleView;

const renderCard = (over: Partial<Parameters<typeof StablecoinEarningsCard>[0]> = {}) =>
  render(
    <I18nProvider i18n={i18n}>
      <StablecoinEarningsCard
        suppliedView={SUPPLIED}
        suppliedLoading={false}
        idleView={IDLE}
        idleLoading={false}
        savingsRate={0.0375}
        tab="supplied"
        onTabChange={() => {}}
        {...over}
      />
    </I18nProvider>
  );

/** The donut's box is inline-styled from the `size` prop, so read it back. */
const donutBox = () => screen.getByTestId('portfolio-donut').style.width;

afterEach(() => {
  breakpoint.isMobile = false;
  cleanup();
});

describe('StablecoinEarningsCard responsive behavior (M6.1)', () => {
  it("renders the donut at the comp's 160 box below md", () => {
    breakpoint.isMobile = true;
    renderCard();
    expect(donutBox()).toBe('160px');
  });

  it('keeps the desktop 178 donut box from md up (5034:39333)', () => {
    renderCard();
    expect(donutBox()).toBe('178px');
  });

  // jsdom has no layout, so visual order can only be asserted through the
  // classes that drive it: `contents` collapses the column below md and the
  // three blocks order themselves against the parent flex row.
  it('orders the chart block headline -> donut -> legend below md (486:20132)', () => {
    breakpoint.isMobile = true;
    renderCard();
    expect(screen.getByTestId('portfolio-donut').className).toContain('order-2');
    expect(screen.getByRole('list').className).toContain('order-3');
  });

  it('hands ordering back to DOM order from md up', () => {
    renderCard();
    expect(screen.getByTestId('portfolio-donut').className).toContain('md:order-none');
    expect(screen.getByRole('list').className).toContain('md:order-none');
  });

  it('steps the headline down to 32px below md and back to 40 from md up', () => {
    renderCard();
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.className).toContain('text-[32px]');
    expect(heading.className).toContain('md:text-[40px]');
  });

  it('drops the badge cluster to 24 below md and back to 28 from md up (486:20137)', () => {
    breakpoint.isMobile = true;
    const { rerender } = renderCard();
    expect(screen.getByTestId('icon-stack').getAttribute('data-size')).toBe('24');

    breakpoint.isMobile = false;
    rerender(
      <I18nProvider i18n={i18n}>
        <StablecoinEarningsCard
          suppliedView={SUPPLIED}
          suppliedLoading={false}
          idleView={IDLE}
          idleLoading={false}
          savingsRate={0.0375}
          tab="supplied"
          onTabChange={() => {}}
        />
      </I18nProvider>
    );
    expect(screen.getByTestId('icon-stack').getAttribute('data-size')).toBe('28');
  });

  // A bare <p> under <ul> is invalid list markup — screen readers announce
  // "list, 0 items" and can drop the message from the accessibility tree.
  it('wraps the supplied empty state in an li so the ul stays valid', () => {
    renderCard({ suppliedView: { ...SUPPLIED, positions: [], suppliedTokens: [] } });
    const li = screen.getByText('No supplied positions yet.').closest('li');
    expect(li).toBeTruthy();
    expect(li?.parentElement?.tagName).toBe('UL');
  });

  it('wraps the idle empty state in an li so the ul stays valid', () => {
    renderCard({ tab: 'idle', idleView: { ...IDLE, tokens: [] } as IdleView });
    const li = screen.getByText('No idle stablecoins.').closest('li');
    expect(li).toBeTruthy();
    expect(li?.parentElement?.tagName).toBe('UL');
  });

  it('shows the savings rate and projection stats on the idle tab when savings is available', () => {
    renderCard({ tab: 'idle' });
    expect(screen.getByText('Sky Savings Rate')).toBeTruthy();
    expect(screen.getByText('1Y projected earnings')).toBeTruthy();
    expect(screen.getByText('Idle stablecoins')).toBeTruthy();
  });

  it('drops the savings rate and projection stats when savings is geo-restricted (no rate)', () => {
    renderCard({ tab: 'idle', savingsRate: undefined });
    expect(screen.queryByText('Sky Savings Rate')).toBeNull();
    expect(screen.queryByText('1Y projected earnings')).toBeNull();
    expect(screen.getByText('Idle stablecoins')).toBeTruthy();
  });

  it('keeps the skeleton donut and order in step with the loaded card', () => {
    breakpoint.isMobile = true;
    renderCard({ suppliedLoading: true, suppliedView: { ...SUPPLIED, positions: [] } });
    // Skeleton donut is a plain div — 160 below md, 178 from md, matching
    // useDonutSize.
    const donut = screen.getByTestId('earnings-skeleton-donut');
    expect(donut.className).toContain('h-40');
    expect(donut.className).toContain('md:h-[178px]');
    expect(donut.className).toContain('order-2');
  });
});
