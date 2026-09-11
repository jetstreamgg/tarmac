import { SKY_APP_UI_FILE, type TestContract } from './types';

/** First-visit app loader + portfolio decision (QA §2 D-2). */
export const shellAppLoaderContract: TestContract = {
  id: 'shell-app-loader',
  qaCase: 'D-2',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['1875:6834']
  },
  intent: 'First connect on an empty wallet plays the loader once and lands sorted on Earn',
  preconditions: ['fresh browser context', 'throwaway unfunded wallet address'],
  steps: [
    { action: 'goto /portfolio disconnected', locator: { testId: 'app-loader' } },
    { action: 'connect mock wallet', locator: { role: { type: 'button', name: /Connect Mock Wallet/i } } }
  ],
  oracle: 'loader visible then dismissed; URL /earn; localStorage portfolioDecision cached simulate+idle'
};
