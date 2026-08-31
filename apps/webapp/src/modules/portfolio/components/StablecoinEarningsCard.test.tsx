import type { ReactNode } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StablecoinEarningsCard } from './StablecoinEarningsCard';
import type { SuppliedView } from '../helpers/suppliedView';
import type { IdleView } from '../helpers/idleView';
import { combineWalletEarnings } from '../earnings/combineWalletEarnings';
import { notAvailable, ok, type ProtocolEarnings, type WalletEarnings } from '../earnings/types';

// Pin touch detection per test (finding #7: tooltips fall back to popovers on touch).
const touch = vi.hoisted(() => ({ isTouch: false }));
vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return { ...actual, useIsTouchDevice: () => touch.isTouch };
});

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

// APP-450 earnings fixtures: literal per-source figures with the combined
// stats derived by the real fold, so fixtures can't drift from the contract.
const proto = (
  id: ProtocolEarnings['id'],
  rowIds: string[],
  totalEarned: ProtocolEarnings['totalEarned'],
  earnedThisMonth: ProtocolEarnings['earnedThisMonth'],
  extra: Partial<ProtocolEarnings> = {}
): ProtocolEarnings => ({
  id,
  rowIds,
  totalEarned,
  earnedThisMonth,
  isLoading: false,
  error: null,
  ...extra
});

const walletEarnings = (protocols: ProtocolEarnings[], isLoading = false): WalletEarnings => ({
  protocols,
  combined: combineWalletEarnings(protocols),
  isLoading,
  window: { startSec: 0, endSec: 0 }
});

// Steady state: total 20 + 4 + 70 + 46.4 + 30 = 170.4; month 10 + 7 + 5 + 3 = 25;
// announced gap only (Merkl monthly).
const EARNINGS = walletEarnings([
  proto('morpho-vault-0xflagship', ['vault-morpho-0xflagship'], ok({ usd: 20 }), ok({ usd: 10 })),
  proto('merkl', ['vault-morpho-0xflagship'], ok({ usd: 4 }), notAvailable('merkl-monthly-unsupported')),
  proto('pendle', ['fixed-0xmkt'], ok({ usd: 70 }), ok({ usd: 7 })),
  proto('savings', ['savings'], ok({ usd: 46.4 }), ok({ usd: 5 })),
  proto('stusds', ['stusds'], ok({ usd: 30 }), ok({ usd: 3 }))
]);

const renderCard = (over: Partial<Parameters<typeof StablecoinEarningsCard>[0]> = {}) =>
  render(
    <I18nProvider i18n={i18n}>
      <StablecoinEarningsCard
        suppliedView={SUPPLIED}
        suppliedLoading={false}
        idleView={IDLE}
        idleLoading={false}
        savingsRate={0.0375}
        earnings={EARNINGS}
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
  touch.isTouch = false;
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
          earnings={EARNINGS}
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
    expect(screen.getByText('Projected 1Y yield')).toBeTruthy();
    expect(screen.getByText('Idle stablecoins')).toBeTruthy();
  });

  it('drops the savings rate and projection stats when savings is geo-restricted (no rate)', () => {
    renderCard({ tab: 'idle', savingsRate: undefined });
    expect(screen.queryByText('Sky Savings Rate')).toBeNull();
    expect(screen.queryByText('Projected 1Y yield')).toBeNull();
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

describe('StablecoinEarningsCard earnings footer (APP-450)', () => {
  afterEach(() => cleanup());

  const totalText = () => screen.getByTestId('earnings-total-value').textContent;
  const monthText = () => screen.getByTestId('earnings-month-value').textContent;

  it('renders the combined Total earned and Earned this month', () => {
    renderCard();
    expect(totalText()).toBe('+$170.40');
    expect(monthText()).toBe('+$25.00');
  });

  it('shows a skeleton per stat while the earnings hook loads', () => {
    const loading = walletEarnings(
      EARNINGS.protocols.map(p => ({
        ...p,
        totalEarned: notAvailable('loading'),
        earnedThisMonth: notAvailable('loading'),
        isLoading: true
      })),
      true
    );
    renderCard({ earnings: loading });
    expect(screen.getAllByTestId('earnings-stat-skeleton')).toHaveLength(2);
  });

  // The footer stats render the bare figures: the gap glyph beside
  // "Total accrued" / "Accrued this month" was dropped (2026-08-31), even when
  // a source is missing from the sum. The position cards still carry it.
  it('renders announced gaps without the info glyph or the partial-data indicator', () => {
    renderCard();
    // Month misses Merkl (announced): the figure still shows, with no glyph.
    expect(monthText()).toBe('+$25.00');
    expect(screen.queryByTestId('earnings-info')).toBeNull();
    expect(screen.queryByTestId('earnings-partial')).toBeNull();
  });

  it('excludes an errored source from the sum without a partial-data indicator', () => {
    const morphoDown = walletEarnings([
      proto(
        'morpho-vault-0xflagship',
        ['vault-morpho-0xflagship'],
        notAvailable('source-error'),
        notAvailable('source-error')
      ),
      ...EARNINGS.protocols.slice(1)
    ]);
    renderCard({ earnings: morphoDown });
    // 4 + 70 + 46.4 + 30 = 150.4; month 7 + 5 + 3 = 15.
    expect(totalText()).toBe('+$150.40');
    expect(monthText()).toBe('+$15.00');
    expect(screen.queryByTestId('earnings-partial')).toBeNull();
  });

  it('renders dashes, not $0.00, when every source is unavailable', () => {
    const allDown = walletEarnings(
      EARNINGS.protocols.map(p => ({
        ...p,
        totalEarned: notAvailable('source-error'),
        earnedThisMonth: notAvailable('source-error')
      }))
    );
    renderCard({ earnings: allDown });
    expect(totalText()).toBe('—');
    expect(monthText()).toBe('—');
  });

  it('renders a negative combined total signed with a minus', () => {
    const pendleUnderwater = walletEarnings(
      EARNINGS.protocols.map(p => (p.id === 'pendle' ? { ...p, totalEarned: ok({ usd: -130 }) } : p))
    );
    renderCard({ earnings: pendleUnderwater });
    // 20 + 4 - 130 + 46.4 + 30 = -29.6.
    expect(totalText()).toBe('-$29.60');
  });

  it("collapses both stats to the hovered position's figures", () => {
    renderCard();
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Sky Savings Rate/ }));
    expect(totalText()).toBe('+$46.40');
    expect(monthText()).toBe('+$5.00');
  });

  it('shows a dash when the hovered position is outside APP-450 scope', () => {
    const outOfScope = {
      ...SUPPLIED,
      positions: [{ ...SUPPLIED.positions[0], id: 'vault-other-0xdead', name: 'Other Vault' }]
    };
    renderCard({ suppliedView: outOfScope });
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Other Vault/ }));
    expect(totalText()).toBe('—');
    expect(monthText()).toBe('—');
  });

  // Review finding #2 (2026-08-21): untracked positions must not be silent.

  it("explains an untracked hovered position's dash with a tooltip", () => {
    const outOfScope = {
      ...SUPPLIED,
      positions: [{ ...SUPPLIED.positions[0], id: 'vault-other-0xdead', name: 'Other Vault' }]
    };
    renderCard({ suppliedView: outOfScope });
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Other Vault/ }));
    const dash = within(screen.getByTestId('earnings-total-value')).getByText('—');
    // The dash is a tooltip trigger (focusable) rather than inert text.
    expect(dash.getAttribute('tabindex')).toBe('0');
  });

  it('shows no glyph when a supplied position has no earnings source', () => {
    const allOk = walletEarnings([proto('savings', ['savings'], ok({ usd: 46.4 }), ok({ usd: 5 }))]);
    const withUntracked = {
      ...SUPPLIED,
      positions: [
        SUPPLIED.positions[0],
        { ...SUPPLIED.positions[0], id: 'vault-other-0xdead', name: 'Other Vault' }
      ]
    };
    renderCard({ suppliedView: withUntracked, earnings: allOk });
    expect(totalText()).toBe('+$46.40');
    expect(screen.queryByTestId('earnings-info')).toBeNull();
    expect(screen.queryByTestId('earnings-partial')).toBeNull();
  });

  it('shows no glyph when every source is ok and every position is tracked', () => {
    const allOk = walletEarnings([proto('savings', ['savings'], ok({ usd: 46.4 }), ok({ usd: 5 }))]);
    renderCard({ earnings: allOk });
    expect(screen.queryByTestId('earnings-info')).toBeNull();
    expect(screen.queryByTestId('earnings-partial')).toBeNull();
  });

  // Review finding #7: the app Tooltip is forced closed on touch devices, so
  // the dash explanation must open as a tap popover there instead.
  it('opens the dash explanation as a tap popover on touch devices', () => {
    touch.isTouch = true;
    const allDown = walletEarnings(
      EARNINGS.protocols.map(p => ({
        ...p,
        totalEarned: notAvailable('source-error'),
        earnedThisMonth: notAvailable('source-error')
      }))
    );
    renderCard({ earnings: allDown });
    fireEvent.click(within(screen.getByTestId('earnings-total-value')).getByText('—'));
    expect(screen.getByText(/Not included:/)).toBeTruthy();
  });

  // Hover-focused figures render bare too: no glyph for their missing contributors.

  it("shows the hovered position's figure without a glyph for its announced gap", () => {
    const flagship = {
      ...SUPPLIED,
      positions: [{ ...SUPPLIED.positions[0], id: 'vault-morpho-0xflagship', name: 'USDS Flagship' }]
    };
    renderCard({ suppliedView: flagship });
    fireEvent.mouseEnter(screen.getByRole('button', { name: /USDS Flagship/ }));
    expect(within(screen.getByTestId('earnings-total-value')).queryByTestId('earnings-info')).toBeNull();
    // Month: Morpho's figure shows; the Merkl announced gap is not flagged beside it.
    expect(monthText()).toBe('+$10.00');
    const month = screen.getByTestId('earnings-month-value');
    expect(within(month).queryByTestId('earnings-info')).toBeNull();
    expect(within(month).queryByTestId('earnings-partial')).toBeNull();
  });

  it("shows the hovered position's figure without a partial-data indicator for its error gap", () => {
    const flagship = {
      ...SUPPLIED,
      positions: [{ ...SUPPLIED.positions[0], id: 'vault-morpho-0xflagship', name: 'USDS Flagship' }]
    };
    const merklDown = walletEarnings(
      EARNINGS.protocols.map(p =>
        p.id === 'merkl' ? { ...p, totalEarned: notAvailable('source-error') } : p
      )
    );
    renderCard({ suppliedView: flagship, earnings: merklDown });
    fireEvent.mouseEnter(screen.getByRole('button', { name: /USDS Flagship/ }));
    expect(totalText()).toBe('+$20.00');
    expect(within(screen.getByTestId('earnings-total-value')).queryByTestId('earnings-partial')).toBeNull();
  });

  // Review finding #8 companion: sub-cent combined earnings say so, not $0.00.
  it('renders sub-cent combined earnings as <$0.01', () => {
    const tiny = walletEarnings([proto('savings', ['savings'], ok({ usd: 0.0002 }), ok({ usd: 0.0001 }))]);
    renderCard({ earnings: tiny });
    expect(totalText()).toBe('+<$0.01');
    expect(monthText()).toBe('+<$0.01');
  });
});
