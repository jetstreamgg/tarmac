import { SpeedBumpContent } from './types';

export const upgradeSpeedBump: SpeedBumpContent = {
  title: 'Upgrade',
  functionality: 'upgrade',
  slug: 'upgrade',
  restrictions: ['- None.'],
  howItWorks: `#### MKR ↔ SKY

- A user can upgrade their MKR to SKY at a rate of 1:24,000
- This will not always be bi-directional

#### DAI ↔ USDS

- A user can upgrade their DAI to USDS at a rate of 1:1
- This will always be bi-directional

#### sUSDS ↔ USDS

- A user can upgrade their savings USDS to USDS
- This will always be bi-directional`,
  associatedRisks: [
    `#### MKR ↔ SKY
- **Directionality**: This will not always be bi-directional. From March '25, it is anticipated that one-directionality may be implemented (it will be completed by June at the latest).
- **Token Conversion**: Once one-directionality has been implemented, a user can convert their MKR to SKY and then Seal the SKY. When the user unseals their SKY, they will receive a new token – 24KSKY – in return (not MKR, unlike when the upgrade contract was bi-directional).
- **Peg Risk**: The peg between MKR and SKY (i.e., 1:24,000) is a soft peg; the value of MKR to SKY can vary based on the market, and although unlikely, there is a risk that the dollar value of the tokens could unpeg. That being said, due to the PSM, 1 MKR must always be worth 24,000 SKY. Sky Ecosystem governance can enforce this.`,
    `#### DAI ↔ USDS
- Although unlikely, there is a risk that either asset could de-peg from the U.S. dollar.`,
    `#### sUSDS ↔ USDS
- Given that the yield of the SSR is paid in USDS, if USDS were to de-peg from the U.S. dollar, this will affect the amount of yield that the user would receive (e.g., if the user supplies USDS at an APY of 10%, but then USDS de-pegs by 10%, the user will not earn any yield on their supplied USDS; note that in this example, the user's supplied principal will not be affected by the de-pegging, only the interest that they would have received).`
  ]
};
