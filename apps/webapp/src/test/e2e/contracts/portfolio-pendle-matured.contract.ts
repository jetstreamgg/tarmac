import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Portfolio Supplied carousel — matured PT-sUSDS redeem card (QA §2 A-12). */
export const portfolioPendleMaturedContract: TestContract = {
  id: 'portfolio-pendle-matured',
  qaCase: 'A-12',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['2653:80453']
  },
  intent: 'Matured PT-sUSDS position renders in Portfolio Supplied carousel with Claim CTA',
  preconditions: [
    'connected wallet',
    'PT-sUSDS balance staged via on-chain storage-slot mint',
    'UI Date.now frozen past expiry + chain time warped'
  ],
  steps: [
    { action: 'goto /portfolio', locator: { testId: 'portfolio-page' } },
    { action: 'matured card', locator: { testId: 'pendle-matured-position-card' } },
    { action: 'Matured badge', locator: { testId: 'pendle-matured-badge' } },
    { action: 'Claim CTA', locator: { testId: 'pendle-matured-redeem-button' } }
  ],
  oracle: 'pendle-matured-position-card visible in Supplied with Matured badge and Claim CTA (quote-gated enablement out of scope)'
};
