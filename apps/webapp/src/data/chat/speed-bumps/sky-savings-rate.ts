import { SpeedBumpContent } from './types';

export const skySavingsRateSpeedBump: SpeedBumpContent = {
  title: 'Sky Savings Rate',
  functionality: 'sky-savings-rate',
  slug: 'sky-savings-rate',
  restrictions: ['- Not available in the U.S.'],
  howItWorks: 'The user can supply their USDS and receive savings USDS ("sUSDS").',
  associatedRisks: [
    '- **Variable Rate Risk**: The Sky Savings Rate ("SSR") is variable and determined by Sky Ecosystem governance; accordingly, there is a risk that the rate may change at any time and without notice, based on market conditions. Worst case scenario, the variable rate could drop to 0%.',
    `- **Additional Risks**:
- Issues with peg stability / the de-pegging of USDS
- Regulatory risk with respect to the treatment of stablecoins
- Tax liability depending on the user's jurisdiction and the relevant tax authority's treatment of cryptoassets (i.e., there may be a taxable event when moving from sUSDS to USDS)
- Oracle risk`
  ]
};
