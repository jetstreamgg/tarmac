import { SKY_APP_UI_FILE, type TestContract } from './types';

/** Stake deep-link param contract (QA §2 E-1, E-4). */
export const stakeDeepLinkContract: TestContract = {
  id: 'stake-deep-link',
  qaCase: 'E-1',
  figma: {
    fileKey: SKY_APP_UI_FILE,
    frames: ['1036:209505', '1036:212842']
  },
  intent: 'Public stake deep links mount the correct flow surfaces',
  preconditions: ['connected wallet on /stake'],
  steps: [
    { action: 'flow=open', locator: { testId: 'stake-takeover' } },
    { action: 'flow=manage&stake_tab=free', locator: { testId: 'stake-manage-takeover' } }
  ],
  oracle: 'flow=open mounts takeover; stake_tab=free pre-toggles withdraw+repay modes; retired params ignored'
};
