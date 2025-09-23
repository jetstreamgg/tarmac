import { SpeedBumpContent } from './types';

export const skyTokenRewardsSpeedBump: SpeedBumpContent = {
  title: 'Sky Token Rewards',
  functionality: 'sky-token-rewards',
  slug: 'sky-token-rewards',
  restrictions: ['- Not available in the U.S.'],
  howItWorks:
    'Users can supply their USDS and receive Sky Token Rewards ("STRs"). The amount of STRs you receive is calculated based on your share of the entire pool of $USDS tokens supplied to the Sky Token Rewards module by all participants, not on the amount of tokens you supply. This share, and consequently the rate of Sky Token Reward, can fluctuate as the total pool size changes over time. Sky.money does not control the issuance, determination, or distribution of these rewards.',
  associatedRisks: [
    '- **Regulatory Risk**: There is a regulatory risk that a token received by the user as a STR could be deemed a security by financial markets regulators, which could potentially lead to delisting from exchanges (if listed) and other regulatory restrictions.',
    "- **Tax Liability**: Additional risk includes tax liability depending on the user's jurisdiction and the treatment of cryptoassets."
  ]
};
