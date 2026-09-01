import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBannerById } from '@/data/banners/banners';

i18n.load('en', {});
i18n.activate('en');

// The engine card drives live reward/collateral reads; stub it so this test
// stays scoped to the About-tab structure (same pattern the shell test uses).
vi.mock('./StakeEngineCard', () => ({
  StakeEngineCard: () => <div data-testid="stake-engine-card" />
}));

// The contract link is chain-scoped; pin the chain so the Etherscan href is
// deterministic (mainnet). Partial-mock so transitive wagmi consumers keep their
// real exports (createConfig etc.).
vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1
  };
});

import { StakeAboutTab } from './StakeAboutTab';

const renderTab = () =>
  render(
    <I18nProvider i18n={i18n}>
      <StakeAboutTab />
    </I18nProvider>
  );

describe('StakeAboutTab', () => {
  afterEach(cleanup);

  it('renders the About copy from the corpus banner, not an inlined string', () => {
    renderTab();

    const copy = screen.getByTestId('stake-about-copy');
    // Prove the wiring: the rendered body equals the synced banner description.
    const bannerBody = getBannerById('about-the-staking-engine')?.description ?? '';
    expect(bannerBody.length).toBeGreaterThan(0);
    expect(copy.textContent).toContain(bannerBody);
  });

  it('renders the three How-it-works rows', () => {
    renderTab();

    const howItWorks = screen.getByTestId('stake-how-it-works');
    expect(howItWorks.textContent).toContain('Stake SKY & accrue rewards');
    expect(howItWorks.textContent).toContain('Borrow USDS');
    expect(howItWorks.textContent).toContain('Delegate Voting Power');
    // The two optional steps carry a separate right-aligned "(Optional)" tag.
    expect(howItWorks.querySelectorAll('li').length).toBe(3);
    expect(howItWorks.textContent?.match(/\(Optional\)/g)?.length).toBe(2);
  });

  it('renders View contract and Governance links with non-empty hrefs, and no Docs link yet', () => {
    renderTab();

    const links = screen.getByTestId('stake-about-links');
    const anchors = links.querySelectorAll('a');
    expect(anchors.length).toBe(2);
    anchors.forEach(a => {
      expect(a.getAttribute('href')).toBeTruthy();
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
      expect(a.getAttribute('target')).toBe('_blank');
    });

    expect(screen.queryByText('Docs')).toBeNull();
    expect(screen.getByText('Governance').closest('a')?.getAttribute('href')).toBe('https://vote.sky.money/');
    // View contract points at the staking-engine address on Etherscan (mainnet).
    expect(screen.getByText('View contract').closest('a')?.getAttribute('href')).toContain(
      'etherscan.io/address/'
    );
  });

  it('mounts the engine card in the right rail', () => {
    renderTab();
    expect(screen.getByTestId('stake-engine-card')).toBeTruthy();
  });
});
