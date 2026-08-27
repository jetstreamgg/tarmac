import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Deep-link and direction contracts (QA §2 A-4, A-5). */
export const convertDeepLinkContract: TestContract = {
  id: 'convert-deep-link',
  qaCase: 'A-4',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['1036:205437']
  },
  intent: 'Public convert deep links resolve correctly',
  preconditions: ['connected wallet (mainnet for URL tests)'],
  steps: [
    { action: '/convert/psm redirects to /convert', locator: { testId: 'convert-page' } },
    { action: '?source_token=USDC sets USDC→USDS', locator: { testId: 'convert-from-token' } },
    { action: 'convert-flip toggles direction', locator: { testId: 'convert-flip' } }
  ],
  oracle: 'Legacy paths redirect; search params and flip control from/to tokens'
};
