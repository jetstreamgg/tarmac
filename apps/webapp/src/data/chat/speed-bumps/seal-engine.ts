import { SpeedBumpContent } from './types';

export const sealEngineSpeedBump: SpeedBumpContent = {
  title: 'Seal Engine',
  functionality: 'seal-engine',
  slug: 'seal-engine',
  restrictions: ['- None.'],
  howItWorks: `- Users can supply and seal their MKR or SKY tokens to access Seal Rewards (a/k/a SKY Token Rewards), the accumulation of which can be viewed via the Sky Token Rewards tab.
- A user can delegate their sealed MKR or SKY Sky Governance voting rights.
- Sealed MKR or SKY tokens can be used as collateral to borrow USDS.
- Sealed MKR or SKY can be unsealed at any time (and you can claim your rewards at any time). Note that users can withdraw their accumulated rewards before unsealing their sealed assets. The reward system and sealing mechanism (i.e., exit fee) operate independently. The exit fee applies to the sealed assets (i.e., the principal) only. The rewards distribution system allows users to claim their rewards at any time through the get reward function.`,
  associatedRisks: [
    "- **Exit Fee**: Although a user can unseal their supplied tokens at any time, unsealing requires the payment of an exit fee. The exit fee is a percentage of the total amount of tokens in the user's sealed position. The fee is automatically deducted from user's sealed position amount and then burnt, which removes the tokens from circulation.",
    "- **Variable Fee**: The exit fee is variable (i.e., determined by Sky Ecosystem governance), meaning that it could be changed by governance at any time and will increase by 1% every six months until it reaches its long term fee rate of 15%. The exit fee does not effect the user's accumulated rewards."
  ]
};
