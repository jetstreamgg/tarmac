import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@lingui/react';
import { i18n } from '@lingui/core';
import { ProductDetailTemplate } from './ProductDetailTemplate';

i18n.activate('en');

// The header's network control by tier and chain count (item 8 of the Sep 7
// QA round): a single-chain product on a phone states its chain as the DS
// title-suffix badge beside the title (1295:20810) instead of an empty
// control-shaped row; several chains keep the dropdown (a full-width labelled
// row on phones, M6.3 486:20732; a pill from md up).
const h = vi.hoisted(() => ({ isMobile: false }));

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useBreakpointIndex: () => ({ bpi: h.isMobile ? actual.BP.sm : actual.BP.desktop })
  };
});
vi.mock('@/lib/navigation', () => ({
  AppLink: ({ children }: { children: React.ReactNode }) => <a>{children}</a>
}));
vi.mock('@/modules/ui/components/NetworkSelect', () => ({
  NetworkSelect: ({ triggerClassName, dataTestId }: { triggerClassName?: string; dataTestId?: string }) => (
    <div data-testid={dataTestId} data-kind="select" data-trigger-class={triggerClassName ?? ''} />
  ),
  // The tier/chain-count rule itself belongs to NetworkSelect and is tested
  // there; this stub only answers "badge or control" so what this file
  // exercises is the template's PLACEMENT of the badge.
  useNetworkTitleBadge: (chainIds: number[] | undefined, dataTestId?: string) =>
    chainIds && h.isMobile && chainIds.length <= 1 ? <div data-testid={dataTestId} data-kind="badge" /> : null
}));

const renderHeader = (chainIds?: number[]) =>
  render(
    <I18nProvider i18n={i18n}>
      <ProductDetailTemplate
        backHref="/earn"
        token={{ icon: <span /> }}
        title="SPK Rewards"
        networkChainIds={chainIds}
        chart={<div />}
        position={<div />}
        details={[]}
        about={{ body: <div /> }}
        transactions={<div />}
      />
    </I18nProvider>
  );

afterEach(() => {
  h.isMobile = false;
  cleanup();
});

describe('ProductDetailTemplate header network control', () => {
  it('shows the title-suffix badge for a single-chain product on a phone', () => {
    h.isMobile = true;
    renderHeader([1]);

    const control = screen.getByTestId('product-detail-network');
    expect(control.getAttribute('data-kind')).toBe('badge');
    // Beside the title, in the same row.
    expect(control.parentElement?.textContent).toContain('SPK Rewards');
  });

  it('places provider badges and the network badge after the title, outside the heading, 12px apart', () => {
    h.isMobile = true;
    render(
      <I18nProvider i18n={i18n}>
        <ProductDetailTemplate
          backHref="/earn"
          token={{ icon: <span /> }}
          title="USDS Flagship"
          titleBadges={<span data-testid="provider-badge">Powered by Morpho</span>}
          titleSubtitle="A vault"
          networkChainIds={[1]}
          chart={<div />}
          position={<div />}
          details={[]}
          about={{ body: <div /> }}
          transactions={<div />}
        />
      </I18nProvider>
    );

    // The heading's accessible name is the plain title: badges are siblings,
    // never children, so a screen reader doesn't hear "USDS Flagship Powered
    // by Morpho Ethereum" as the page heading.
    const heading = screen.getByRole('heading', { level: 1, name: 'USDS Flagship' });
    const provider = screen.getByTestId('provider-badge');
    const network = screen.getByTestId('product-detail-network');
    expect(network.getAttribute('data-kind')).toBe('badge');
    expect(heading.contains(provider)).toBe(false);
    expect(heading.contains(network)).toBe(false);
    // One row: title, provider badge, network badge, on the 12px title-suffix gap (1295:20810).
    const row = heading.parentElement!;
    const kids = Array.from(row.children);
    expect(row.className).toContain('gap-x-3');
    expect(kids.indexOf(heading)).toBeLessThan(kids.indexOf(provider));
    expect(kids.indexOf(provider)).toBeLessThan(kids.indexOf(network));
    expect(screen.getAllByTestId('product-detail-network')).toHaveLength(1);
    // The subtitle sits under the row, outside the heading too.
    expect(heading.textContent).toBe('USDS Flagship');
    expect(heading.contains(screen.getByText('A vault'))).toBe(false);
  });

  it('keeps the dropdown as a full-width row for a multi-chain product on a phone', () => {
    h.isMobile = true;
    renderHeader([1, 8453]);

    const control = screen.getByTestId('product-detail-network');
    expect(control.getAttribute('data-kind')).toBe('select');
    expect(control.getAttribute('data-trigger-class')).toContain('w-full');
  });

  it('keeps the pill from md up regardless of chain count', () => {
    renderHeader([1]);
    const control = screen.getByTestId('product-detail-network');
    expect(control.getAttribute('data-kind')).toBe('select');
    expect(control.getAttribute('data-trigger-class')).toBe('');
  });

  it('renders no network control when no chains are given', () => {
    renderHeader(undefined);
    expect(screen.queryByTestId('product-detail-network')).toBeNull();
  });
});
