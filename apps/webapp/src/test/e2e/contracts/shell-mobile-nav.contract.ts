import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Mobile bottom navbar (G3 — QA §2 B-1–B-3). */
export const shellMobileNavContract: TestContract = {
  id: 'shell-mobile-nav',
  qaCase: 'B-2',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['536:26374', '5153:25322']
  },
  intent: 'At 393px the bottom MobileNavbar navigates across all four destinations with an active pill',
  preconditions: ['viewport 393px', 'connected wallet', 'cookie banner suppressed'],
  steps: [
    { action: 'assert mobile navbar', locator: { testId: 'mobile-navbar' } },
    { action: 'tap Earn', locator: { testId: 'mobile-nav-earn' } },
    { action: 'assert active pill', locator: { testId: 'mobile-nav-active-pill' } }
  ],
  oracle:
    'mobile-navbar visible; top-nav absent from layout flow; each tap lands correct /portfolio|/earn|/stake|/convert'
};
