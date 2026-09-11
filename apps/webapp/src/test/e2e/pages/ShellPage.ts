import { expect, type Page } from '@playwright/test';
import { ROUTES } from '@/lib/routes';
import { shellMobileNavContract } from '../contracts/shell-mobile-nav.contract';
import { shellWalletDrawerContract } from '../contracts/shell-wallet-drawer.contract';
import { suppressGovernanceMigrationToast } from '../utils/suppressGovernanceMigrationToast.ts';
import { formatContractContext, locate } from './locate';

const MOBILE_VIEWPORT = { width: 393, height: 900 };

/** Semantic page object for V2 app shell chrome (Gate 4). */
export class ShellPage {
  constructor(private readonly page: Page) {}

  topNav = () => this.page.getByTestId('top-nav');
  mobileNavbar = () => locate(this.page, { testId: 'mobile-navbar' }, shellMobileNavContract);

  navLink = (
    path: typeof ROUTES.PORTFOLIO | typeof ROUTES.EARN | typeof ROUTES.STAKE | typeof ROUTES.CONVERT
  ) => this.page.getByTestId(`nav-${path.slice(1)}`);

  mobileNavLink = (
    path: typeof ROUTES.PORTFOLIO | typeof ROUTES.EARN | typeof ROUTES.STAKE | typeof ROUTES.CONVERT
  ) => this.page.getByTestId(`mobile-nav-${path.slice(1)}`);

  walletChip = () => locate(this.page, { testId: 'wallet-chip' }, shellWalletDrawerContract);

  async openWalletDrawer() {
    await this.walletChip().getByRole('button').click();
    await expect(this.page.getByTestId('wallet-drawer')).toBeVisible({ timeout: 15_000 });
  }

  async setMobileViewport() {
    await this.page.setViewportSize(MOBILE_VIEWPORT);
  }

  /** Seed cookie consent so the banner does not intercept bottom-nav taps. */
  async suppressCookieBanner() {
    await this.page.context().addCookies([
      {
        name: 'sky_consent',
        value: encodeURIComponent(JSON.stringify({ posthog: false, google_analytics: false })),
        domain: 'localhost',
        path: '/'
      }
    ]);
  }

  /** MKR→SKY governance toast blocks bottom-nav clicks on funded wallets. Call after `goto` — mock-wallet boot clears localStorage. */
  async suppressGovernanceMigrationToast() {
    await suppressGovernanceMigrationToast(this.page);
  }

  /** Cookie banner only — must run before navigation. */
  async suppressNavBlockers() {
    await this.suppressCookieBanner();
  }

  async expectMobileNavVisible() {
    await expect(this.mobileNavbar()).toBeVisible({ timeout: 15_000 });
    // Desktop destination pills hide below the desktop tier; bottom bar owns nav.
    await expect(this.navLink(ROUTES.STAKE)).toBeHidden();
  }

  contractContext(contractId: 'shell-mobile-nav' | 'shell-wallet-drawer') {
    const contract =
      contractId === 'shell-wallet-drawer' ? shellWalletDrawerContract : shellMobileNavContract;
    return formatContractContext(contract);
  }
}

export { MOBILE_VIEWPORT };
