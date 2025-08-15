export interface Banner {
  id: string;
  title: string;
  description: string;
  display?: string[];
}

export const banners: Banner[] = [
  {
    id: 'about-balances',
    title: 'About Balances',
    description:
      'Balances displays all of your Sky-related assets. When you connect your crypto wallet to Sky.money to access the decentralized Sky Protocol, only the tokens in the wallet that are relevant to the app are listed. With all of your Sky assets visible in one place, you can better self-manage your assets in line with your goals. Sky.money is non-custodial and permissionless.',
    display: ['disconnected']
  },
  {
    id: 'savings',
    title: 'Savings',
    description:
      'When you supply USDS to the Sky Savings Rate module of the decentralized Sky Protocol, you access the Sky Savings Rate and may accumulate additional USDS over time. No minimum supply amount is required, and you always maintain control of your supplied assets, as this feature is non-custodial.',
    display: ['disconnected']
  },
  {
    id: 'trade-1',
    title: 'Trade',
    description:
      'On Layer 2 (L2) scaling solutions for the Ethereum blockchain via Sky.money, you can convert between USDS, sUSDS and USDC through a Peg Stability Module (PSM) (i) deployed to the L2. The PSM [(PSM)](#tooltip-psm) handles conversions programmatically, driven at your direction, between these pairs directly.',
    display: ['disconnected']
  },
  {
    id: 'trade-2',
    title: 'Trade',
    description:
      'Directly trade eligible tokens for Sky Ecosystem tokens using permissionless and non-custodial rails. With the Sky.money web app, you can access the decentralized Sky Protocol to trade via smart contracts on the blockchain instead of relying on centralized entities.',
    display: ['disconnected']
  },
  {
    id: 'about-the-staking-engine',
    title: 'About the Staking Engine',
    description:
      'The Staking Engine is a module of the Sky Protocol. When you stake SKY tokens to the Staking Engine, you can access Staking Rewards and may also choose to create one or more positions, including positions that enable you to generate and borrow USDS against your supplied SKY and to delegate the voting power the SKY token provides. With Sky, you always remain in control of your assets.',
    display: ['disconnected']
  },
  {
    id: 'about-staking-rewards',
    title: 'About Staking Rewards',
    description:
      'Staking Rewards can be accessed when SKY is supplied to the Staking Engine of the decentralized, non-custodial Sky Protocol. Staking Rewards rates are determined by Sky Ecosystem Governance through the process of decentralized onchain voting.',
    display: ['connected', 'disconnected']
  },
  {
    id: 'about-the-seal-engine',
    title: 'About the Seal Engine',
    description:
      'The Seal Engine is a module of the Sky Protocol. The MKR and or SKY tokens you supply to the Seal Engine are sealed behind an exit fee in order to provide access to Seal Rewards and encourage a deeper commitment to Sky ecosystem governance. With Sky, you always remain in control of your funds.',
    display: ['disconnected']
  },
  {
    id: 'seal-rewards',
    title: 'Seal Rewards',
    description:
      'Seal Rewards can be accessed when you supply MKR or SKY to the Seal Engine of the decentralised, non-custodial Sky Protocol. Currently, all Seal Rewards take the form of USDS. Eventually, subject to Sky ecosystem governance approval, Seal Rewards may also be available in the form of Sky Star tokens.',
    display: ['disconnected']
  }
];

// Helper function to get banner by ID
export function getBannerById(id: string): Banner | undefined {
  return banners.find(b => b.id === id);
}
