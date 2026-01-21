export interface Banner {
  id: string;
  title: string;
  description: string;
  module: string;
  display?: string[];
}

export const banners: Banner[] = [
  {
    id: 'about-expert-modules',
    title: 'About Expert modules',
    module: 'expert-modules-banners',
    description: 'Expert modules unlock high-level functionality tailored to experienced users.',
    display: ['disconnected']
  },
  {
    id: 'stusds',
    title: 'stUSDS',
    module: 'expert-modules-banners',
    description:
      'stUSDS is a token designed for eligible Sky Protocol expert users. When you supply USDS to the stUSDS module of the Protocol, you fund SKY-backed borrowing to access the [stUSDS Rate](#tooltip-stusds-rate) and receive stUSDS tokens. The stUSDS tokens serve as a digital record of your USDS interaction with the stUSDS module and any change to the value of your position.',
    display: ['connected', 'disconnected']
  },
  {
    id: 'usds',
    title: 'USDS',
    module: 'expert-modules-banners',
    description:
      'USDS is the stablecoin of the decentralized Sky Protocol. It can be used in several ways, including to participate in the [stUSDS Rate](#tooltip-stusds-rate), Sky Savings Rate and access Sky Token Rewards without giving up control. It is the upgraded version of DAI, backed by a surplus of collateral and soft-pegged to the value of the U.S. dollar, meaning it is designed to maintain a value equal to or close to a dollar. USDS powers the permissionless, non-custodial Sky Protocol.',
    display: ['connected', 'disconnected']
  },
  {
    id: 'about-stusds',
    title: 'About stUSDS',
    module: 'stusds-module-banners',
    description:
      'stUSDS is a token designed for eligible Sky Protocol expert users. When you supply USDS to the stUSDS module of the Protocol, you fund SKY-backed borrowing to access the [stUSDS Rate](#tooltip-stusds-rate) and receive stUSDS tokens. The stUSDS tokens serve as a digital record of your USDS interaction with the stUSDS module and any change to the value of your position.',
    display: ['disconnected']
  },
  {
    id: 'stusds',
    title: 'stUSDS',
    module: 'stusds-module-banners',
    description:
      'stUSDS is a risk token that offers higher risk/higher reward to fund and support liquidity for SKY stakers. Offering additional reward options for SKY stakers encourages more people to participate in governance of Sky Ecosystem, which increases the stability and security of the protocol and ecosystem.',
    display: ['connected', 'disconnected']
  },
  {
    id: 'usds',
    title: 'USDS',
    module: 'stusds-module-banners',
    description:
      'USDS is the stablecoin of the decentralized Sky Protocol. It can be used in several ways, including to participate in the stUSDS Rate, Sky Savings Rate and access Sky Token Rewards without giving up control. It is the upgraded version of DAI, backed by a surplus of collateral and soft-pegged to the value of the U.S. dollar, meaning it is designed to maintain a value equal to or close to a dollar. USDS powers the permissionless, non-custodial Sky Protocol.',
    display: ['disconnected']
  },
  {
    id: 'usds-2',
    title: 'USDS',
    module: 'stusds-module-banners',
    description:
      'USDS is the stablecoin of the decentralized Sky Protocol. It can be used in several ways, including to participate in the [stUSDS Rate](#tooltip-stusds-rate), Sky Savings Rate and access Sky Token Rewards without giving up control. It is the upgraded version of DAI, backed by a surplus of collateral and soft-pegged to the value of the U.S. dollar, meaning it is designed to maintain a value equal to or close to a dollar. USDS powers the permissionless, non-custodial Sky Protocol.',
    display: ['connected']
  },
  {
    id: 'about-balances',
    title: 'About Balances',
    module: 'integrated-networks-banner-copy',
    description:
      'Balances displays all of your Sky-related assets available on the selected network for the Ethereum blockchain. When you connect your crypto wallet to Sky.money, you can view your tokens across supported networks on the decentralized Sky Protocol. This visibility is built in for ease of use. Sky.money is non-custodial and permissionless.',
    display: ['connected', 'disconnected']
  },
  {
    id: 'savings',
    title: 'Savings',
    module: 'integrated-networks-banner-copy',
    description:
      'When you supply USDS to the Sky Savings Rate module of the decentralized Sky Protocol, you access the [Sky Savings Rate](#tooltip-sky-savings-rate) and may accumulate additional USDS over time. No minimum supply amount is required, and you always maintain control of your supplied assets, as this feature is non-custodial.',
    display: ['disconnected']
  },
  {
    id: 'trade',
    title: 'Trade',
    module: 'integrated-networks-banner-copy',
    description:
      'On Layer 2 (L2) scaling solutions for the Ethereum blockchain via Sky.money, you can convert between USDS, sUSDS and USDC through a Peg Stability Module [(PSM)](#tooltip-psm) deployed to the L2. The PSM handles conversions programmatically, executed at your direction, between these pairs directly.',
    display: ['disconnected']
  },
  {
    id: 'about-the-staking-engine',
    title: 'About the Staking Engine',
    module: 'staking-engine-banners',
    description:
      'The Staking Engine is a module of the Sky Protocol. When you stake SKY tokens to the Staking Engine, you can access Staking Rewards in various token forms. You may also choose to create one or more positions, including positions that enable you to generate and borrow USDS against your supplied SKY and to delegate the voting power the SKY token provides. With Sky, you always remain in control of your assets.',
    display: ['disconnected']
  },
  {
    id: 'about-staking-rewards',
    title: 'About Staking Rewards',
    module: 'staking-engine-banners',
    description:
      'Staking Rewards, available in various token forms, can be accessed when SKY is supplied to the Staking Engine of the decentralized, non-custodial Sky Protocol. [Staking Rewards Rates (SRRs)](#tooltip-staking-rewards-rates-srrs) are determined by Sky Ecosystem Governance through the process of decentralized onchain voting.',
    display: ['connected', 'disconnected']
  },
  {
    id: 'usds',
    title: 'USDS',
    module: 'staking-engine-banners',
    description:
      'USDS is the stablecoin of the decentralized Sky Protocol. It is the upgraded version of DAI, backed by a surplus of collateral and soft-pegged to the value of the U.S. dollar, meaning it is designed to maintain a value equal to or close to a dollar. When you supply SKY to the Staking Engine of the Sky Protocol, you can opt to receive USDS as rewards over time.',
    display: ['connected', 'disconnected']
  },
  {
    id: 'sky-star-tokens',
    title: 'Sky Star Tokens',
    module: 'staking-engine-banners',
    description:
      'Sky Stars are autonomous and independent decentralized projects within Sky Ecosystem. A Star might opt to have its own governance token, as defined by the rules enforced by the Sky Atlas. When you supply SKY to the Staking Engine of the Sky Protocol, you can opt to receive Sky Star tokens as rewards over time.',
    display: ['connected', 'disconnected']
  },
  {
    id: 'about-the-seal-engine',
    title: 'About the Seal Engine',
    module: 'seal-engine-banners',
    description:
      'The Seal Engine is a module of the Sky Protocol. The MKR and or SKY tokens you supply to the Seal Engine are sealed behind an exit fee in order to provide access to Seal Rewards and encourage a deeper commitment to Sky Ecosystem Governance. With Sky, you always remain in control of your funds.',
    display: ['disconnected']
  },
  {
    id: 'seal-rewards',
    title: 'Seal Rewards',
    module: 'seal-engine-banners',
    description:
      'Seal Rewards can be accessed when you supply MKR or SKY to the Seal Engine of the decentralised, non-custodial Sky Protocol. Currently, all Seal Rewards take the form of USDS. Eventually, subject to Sky Ecosystem Governance approval, Seal Rewards may also be available in the form of Sky Star tokens.',
    display: ['disconnected']
  },
  {
    id: 'about-balances',
    title: 'About Balances',
    module: 'balances-banners',
    description:
      'Balances displays all of your Sky-related assets. When you connect your crypto wallet to Sky.money to access the decentralized Sky Protocol, only the tokens in the wallet that are relevant to the app are listed. With all of your Sky assets visible in one place, you can better self-manage your assets in line with your goals. Sky.money is non-custodial and permissionless.',
    display: ['disconnected']
  },
  {
    id: 'ready-to-upgrade-and-explore',
    title: 'Ready to upgrade and explore?',
    module: 'upgrade-banners',
    description:
      'Your DeFi journey with Sky is just beginning. Connect your wallet to access the decentralized Sky Protocol and upgrade your DAI to USDS, and your MKR to SKY. Unlock all the Sky Protocol has to offer, without giving up control.',
    display: ['disconnected']
  },
  {
    id: 'usds',
    title: 'USDS',
    module: 'upgrade-banners',
    description:
      'USDS is the stablecoin of the decentralized Sky Protocol. It can be used in several ways, including to participate in the [Sky Savings Rate](#tooltip-sky-savings-rate) and get Sky Token Rewards without giving up control. It is the upgraded version of DAI.',
    display: ['connected', 'disconnected']
  },
  {
    id: 'sky',
    title: 'SKY',
    module: 'upgrade-banners',
    description:
      'SKY is a native governance token of the decentralised Sky ecosystem and the upgraded version of MKR. You can trade SKY for USDS, depending on your location and other criteria, and use SKY to access Staking Rewards and participate in Sky Ecosystem Governance.',
    display: ['connected', 'disconnected']
  },
  {
    id: 'about-trade',
    title: 'About Trade',
    module: 'trade-banners',
    description:
      'Directly trade eligible tokens for Sky Ecosystem tokens using permissionless and non-custodial rails. With the Sky.money web app, you can access the decentralized Sky Protocol to trade via smart contracts on the blockchain instead of relying on centralized entities.',
    display: ['disconnected']
  },
  {
    id: 'usds',
    title: 'USDS',
    module: 'trade-banners',
    description:
      'USDS is the stablecoin of the decentralised Sky Protocol. It can be used in several ways, including to participate in the [Sky Savings Rate](#tooltip-sky-savings-rate) and get Sky Token Rewards without giving up control. It is the upgraded version of DAI.',
    display: ['connected', 'disconnected']
  },
  {
    id: 'about-the-sky-savings-rate',
    title: 'About the Sky Savings Rate',
    module: 'savings-banners',
    description:
      'When you supply USDS to the Sky Savings Rate module of the decentralized Sky Protocol, you access the [Sky Savings Rate](#tooltip-sky-savings-rate) and may accumulate additional USDS over time. No minimum supply amount is required, and you always maintain control of your supplied assets, as this feature is non-custodial.',
    display: ['disconnected']
  },
  {
    id: 'susds',
    title: 'sUSDS',
    module: 'savings-banners',
    description:
      'sUSDS is a savings token for eligible Sky Protocol users. When you supply USDS to the Sky Savings Rate module of the Protocol, you access the [Sky Savings Rate](#tooltip-sky-savings-rate) and receive sUSDS tokens. These sUSDS tokens serve as a digital record of your USDS interaction with the Sky Savings Rate module and any value accrued to your position.',
    display: ['connected', 'disconnected']
  },
  {
    id: 'usds',
    title: 'USDS',
    module: 'savings-banners',
    description:
      'USDS is the stablecoin of the decentralized Sky Protocol. It can be used in several ways, including to participate in the [Sky Savings Rate](#tooltip-sky-savings-rate) and access Sky Token Rewards without giving up control. It is the upgraded version of DAI, backed by a surplus of collateral and soft-pegged to the value of the U.S. dollar, meaning it is designed to maintain a value equal to or close to a dollar. USDS powers the permissionless, non-custodial Sky Protocol.',
    display: ['connected', 'disconnected']
  },
  {
    id: 'about-sky-token-rewards',
    title: 'About Sky Token Rewards',
    module: 'rewards-banners',
    description:
      'When you supply USDS to the Sky Token Rewards module of the Sky Protocol, you receive Sky Token Rewards over time. The USDS tokens, as well as the rewards received, are supplied to a non-custodial smart contract that represents the USDS pool of assets. That means no intermediary has custody of your supplied assets.',
    display: ['disconnected']
  },
  {
    id: 'usds',
    title: 'USDS',
    module: 'rewards-banners',
    description:
      'USDS is the stablecoin of the decentralized Sky Protocol. It can be used in several ways, including to participate in the [Sky Savings Rate](#tooltip-sky-savings-rate) and get Sky Token Rewards without giving up control. It is the upgraded version of DAI.',
    display: ['connected', 'disconnected']
  },
  {
    id: 'sky',
    title: 'SKY',
    module: 'rewards-banners',
    description:
      'Sky is a native governance token of the decentralized Sky Ecosystem and the upgraded version of MKR. Depending also on your location and other criteria, you can trade USDS for SKY using the Sky.money app, and then use your SKY to access Staking Rewards and participate in Sky Ecosystem Governance.',
    display: ['connected', 'disconnected']
  },
  {
    id: 'about-the-spk-token',
    title: 'About the SPK Token',
    module: 'rewards-banners',
    description:
      'SPK is the native governance and staking token of [Spark.fi](https://Spark.fi). Designed with a long-term vision for sustainability, decentralization and ecosystem alignment, SPK enables protocol governance, protocol security via staking, and reward distribution to participants.',
    display: ['connected', 'disconnected']
  }
];

export function getBannerById(id: string): Banner | undefined {
  return banners.find(banner => banner.id === id);
}
