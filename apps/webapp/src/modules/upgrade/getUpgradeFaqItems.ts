export const getUpgradeFaqItems = () => [...mkrToSkyFaqItems, ...usdsFaqItems];

const mkrToSkyFaqItems = [
  {
    question: 'How do I upgrade my MKR to SKY?',
    answer: `Eligible users of the Sky.money web app can upgrade their MKR to SKY using the Upgrade feature of the app, or they may choose to upgrade their MKR using [one of the frontends that support the upgrade](https://upgrademkrtosky.sky.money). Please see the [Terms of Use](https://docs.sky.money/legal-terms) for more information on third-party services.

For upgrade details and step-by-step upgrade instructions, visit the [MKR to SKY Upgrade Hub](https://upgrademkrtosky.sky.money).
`
  },
  {
    question: 'Where can I find the MKR to SKY Upgrade Guide and Upgrade FAQs?',
    answer:
      'For upgrade FAQs and step-by-step upgrade instructions, please visit the [MKR to SKY Upgrade Hub](https://upgrademkrtosky.sky.money). For a more technical overview, see the [Upgrade Guide](https://developers.sky.money/guides/sky/token-governance-upgrade/overview/) in the [Developer Documentation](https://developers.sky.money/). '
  },
  {
    question: 'Why should I upgrade my MKR to SKY?',
    answer: `The governance-aligned vote to upgrade MKR to SKY, establishing SKY as the sole governance token of the Sky Protocol, reflects the community’s desire to streamline governance, increase voter participation, and support the ecosystem’s long-term growth and scalability. Simply put, SKY is the technical and functional evolution of MKR, inheriting the governance functionalities previously held by MKR. 

SKY holders can use the token to vote directly on Sky Ecosystem Governance proposals and/or to transfer the voting power of their SKY tokens to a recognized delegate or a contract that they own, just as they once could with MKR. SKY also enables users to access Staking Rewards via the Sky.money web app. When users supply SKY to the Staking Engine of the Sky Protocol, they can access those rewards and may also choose to create one or more positions, including positions that enable them to generate and borrow USDS against their supplied SKY, and to delegate the voting power their supplied SKY tokens provide.

For upgrade details and step-by-step upgrade instructions, please visit the [MKR to SKY Upgrade Hub](https://upgrademkrtosky.sky.money).
`
  },
  {
    question: 'Is there a deadline to upgrade MKR to SKY?',
    answer: `No, but all MKR holders are encouraged to upgrade to SKY promptly to maintain the ability to participate in key decisions shaping the Sky Protocol. Upgrading in a timely fashion ensures reduced governance complexity and a more effective, efficient and resilient ecosystem for all. Please note that while MKR will continue to exist, users will not be able to revert back to MKR from SKY via the Sky Protocol.

To facilitate a smooth and prompt transition, Sky Ecosystem Governance [voted to introduce a Delayed Upgrade Penalty](https://vote.makerdao.com/polling/QmTVd4iq). The penalty, which will [begin sometime in September 2025](https://upgrademkrtosky.sky.money) reduces the amount of SKY received per MKR upgraded at a rate of 1%, and increases by 1% every three months thereafter until it reaches 100% in 25 years. The penalty will not apply to anyone upgrading their MKR to SKY before it kicks in.

For upgrade details and step-by-step upgrade instructions, please visit the [MKR to SKY Upgrade Hub](https://upgrademkrtosky.sky.money).`
  },
  {
    question: 'What is the Delayed Upgrade Penalty?',
    answer: `The Delayed Upgrade Penalty is a time-based upgrade mechanism, approved by Sky Ecosystem Governance, which is designed to facilitate a smooth and prompt upgrade of MKR to SKY.

The penalty, which will [begin sometime in September 2025](https://upgrademkrtosky.sky.money), reduces the amount of SKY received per MKR upgraded at a rate of 1%, and increases by 1% every three months thereafter until it reaches 100% in 25 years. The penalty will not apply to anyone upgrading their MKR to SKY before it kicks in.

# How the Delayed Upgrade Penalty works
Here are some examples:


• If a user upgrades 1 MKR before the Delayed Upgrade Penalty takes effect, the user will not pay a penalty and will receive 24,000 SKY.

• If a user upgrades 1 MKR three months after the Delayed Upgrade Penalty takes effect, the penalty applies at 1%. So, the amount the user will receive as a result of the upgrade will be 23,760 SKY (24,000 minus 1%).  

• If a user upgrades 1 MKR six months after the Delayed Upgrade Penalty takes effect, the penalty applies at 2%, meaning the user will receive 23,520 SKY (24,000 minus 2%).


Please note that blockchain, or gas, fees for using the Ethereum network apply when upgrading. Blockchain transaction fees are neither controlled, imposed nor received by Sky.money or the Sky Protocol. 

For upgrade details and step-by-step upgrade instructions, please visit the [MKR to SKY Upgrade Hub](https://upgrademkrtosky.sky.money).`
  },
  {
    question: 'Why did Sky Ecosystem Governance vote to upgrade MKR to SKY?',
    answer: `The governance-aligned vote to upgrade MKR to SKY, establishing SKY as the sole governance token of the Sky Protocol, reflects the community’s desire to streamline governance, increase voter participation, and support the ecosystem’s long-term growth and scalability. 
 
The upgrade of MKR to SKY establishes SKY as the technical and functional evolution of MKR, with SKY inheriting the governance functionalities previously held by MKR. The upgrade is at the rate of 1:24,000 (1 MKR = 24,000 SKY). 
SKY holders can use the token to vote directly on Sky Ecosystem Governance proposals and/or to transfer their voting power to a recognized delegate or a contract that they own, just as they once could with MKR. 
SKY also enables users to access Staking Rewards via the Sky.money web app. When users supply SKY to the Staking Engine of the Sky Protocol, they can access those rewards and may also choose to create one or more positions, including positions that enable them to generate and borrow USDS against their supplied SKY, and to delegate the voting power their supplied SKY tokens provide.

For upgrade details and step-by-step upgrade instructions, please visit the [MKR to SKY Upgrade Hub](https://upgrademkrtosky.sky.money).`
  },
  {
    question: 'Will my MKR automatically upgrade to SKY, or do I need to manually convert?',
    answer: `MKR will not automatically upgrade to SKY.

Eligible users of the Sky.money web app can upgrade their MKR to SKY using the Upgrade feature of the app. Some users may also choose to upgrade their MKR using [one of the frontends that support the upgrade](https://upgrademkrtosky.sky.money/). Please see the [Terms of Use](https://docs.sky.money/legal-terms) for more information on third-party services.
 
For upgrade details and step-by-step upgrade instructions, please visit the [MKR to SKY Upgrade Hub](https://upgrademkrtosky.sky.money).`
  },
  {
    question: 'Do I have to upgrade my MKR to SKY?',
    answer: `All MKR holders are encouraged to upgrade to SKY promptly to maintain the ability to participate in key decisions shaping the Sky Protocol. Upgrading in a timely fashion ensures reduced governance complexity and a more effective, efficient and resilient ecosystem for all. Please note that while MKR will continue to exist, users will not be able to revert back to MKR from SKY via the Sky Protocol.

For upgrade details and step-by-step upgrade instructions, please visit the [MKR to SKY Upgrade Hub](https://upgrademkrtosky.sky.money).`
  },
  {
    question: 'Are SKY and MKR the same?',
    answer: `Think of SKY not as different from MKR, but as the technical and functional evolution of MKR, with SKY inheriting the governance functionalities previously held by MKR. The upgrade is at the rate of 1:24,000 (1 MKR = 24,000 SKY). 

SKY is the sole governance token of the Sky Ecosystem and the upgrade of MKR. SKY token holders can use their SKY to participate directly in Sky Ecosystem Governance through a system of decentralized onchain voting, and/or to entrust their voting power to one or more governance delegates or a contract that they own. Voting with MKR is no longer possible.
`
  },
  {
    question: 'Are Sky and Maker the same?',
    answer:
      'The Sky Ecosystem is the rebrand of Maker. Maker became Sky in 2024, taking the Maker Protocol to the next level with new technology that focuses on resilience and simplicity while remaining decentralized and non-custodial. The Sky Protocol is maintained by Sky Ecosystem Governance and is easy to access and explore via the Sky.money web app, a gateway to the Protocol.'
  },
  {
    question: 'What happens if I never upgrade my MKR?',
    answer: `All MKR holders are encouraged to upgrade to SKY promptly to maintain the ability to participate in key decisions shaping the Sky Protocol. Upgrading in a timely fashion ensures reduced governance complexity and a more effective, efficient and resilient ecosystem for all. Please note that while MKR will continue to exist, users will not be able to revert back to MKR from SKY via the Sky Protocol.

To facilitate a smooth and prompt transition, Sky Ecosystem Governance [voted to introduce a Delayed Upgrade Penalty](https://vote.makerdao.com/polling/QmTVd4iq). The penalty, which will [begin sometime in September 2025](https://upgrademkrtosky.sky.money) reduces the amount of SKY received per MKR upgraded at a rate of 1%, and increases by 1% every three months thereafter until it reaches 100% in 25 years. The penalty will not apply to anyone upgrading their MKR to SKY before it kicks in.

For upgrade details and step-by-step upgrade instructions, please visit the [MKR to SKY Upgrade Hub](https://upgrademkrtosky.sky.money).`
  },
  {
    question: 'Will the MKR I hold lose its value if I never upgrade to SKY?',
    answer: `All MKR holders are encouraged to upgrade to SKY promptly to maintain the ability to participate in key decisions shaping the Sky Protocol. Upgrading in a timely fashion ensures reduced governance complexity and a more effective, efficient and resilient ecosystem for all. Please note that while MKR will continue to exist, users will not be able to revert back to MKR from SKY via the Sky Protocol.

To facilitate a smooth and prompt transition, Sky Ecosystem Governance [voted to introduce a Delayed Upgrade Penalty](https://vote.makerdao.com/polling/QmTVd4iq). The penalty, which will [begin sometime in September 2025](https://upgrademkrtosky.sky.money) reduces the amount of SKY received per MKR upgraded at a rate of 1%, and increases by 1% every three months thereafter until it reaches 100% in 25 years. The penalty will not apply to anyone upgrading their MKR to SKY before it kicks in.

For upgrade details and step-by-step upgrade instructions, please visit the [MKR to SKY Upgrade Hub](https://upgrademkrtosky.sky.money). `
  },
  {
    question: 'Can I convert my SKY back to MKR?',
    answer:
      'While MKR will continue to exist, it is not possible to revert back to MKR from SKY via the Sky Protocol.'
  },
  {
    question: 'How do I vote with SKY?',
    answer: `SKY token holders can use their SKY to participate directly in Sky Ecosystem Governance through a system of decentralized onchain voting, and/or to transfer the voting power of their SKY tokens to a recognized delegate or a contract that they own. Voting with MKR is no longer possible.
 
SKY holders participate directly in Sky Ecosystem Governance by supplying SKY to the Governance Contract of the Sky Protocol via the [Sky Governance Voting Portal](https://vote.sky.money/). Direct voting is weighted, meaning that voting power is proportional to the number of SKY tokens voters supply to that contract. 

SKY holders can use their tokens to entrust their voting power to one or more delegates via the Sky Governance Voting portal or the Staking Engine of the Sky Protocol. Sky Ecosystem Governance delegates are chosen and approved by governance vote. Creating a new delegate account can only be done via the Sky Governance Voting Portal.

Delegates in receipt of token voting power can never directly access any SKY tokens delegated to them. Throughout the delegation process, users always own and are in control of their SKY tokens, and can change their delegate(s) at any time (subject to the Sky Protocol’s rules that prevent double voting or misuse of delegated voting power).
`
  },
  {
    question: 'Does the MKR to SKY upgrade affect DAI and USDS?',
    answer:
      'No. DAI and USDS are not affected by the MKR to SKY upgrade. Eligible users of the Sky.money web app can continue to upgrade any amount of DAI to USDS (and revert USDS to DAI) at any time without a fee. Please note, however, that blockchain fees for using the Ethereum network apply when upgrading. Blockchain transaction fees are neither controlled, imposed nor received by Sky.money or the Sky Protocol.'
  },
  {
    question: 'Are DAI and MKR going away?',
    answer: `No. Sky Ecosystem Governance has not indicated that the DAI and MKR will go away. You can continue to hold DAI exactly as you have in the past, or you can upgrade it to USDS, which may enable more uses than DAI. 

SKY is the technical and functional evolution of MKR, inheriting and extending the governance functionalities previously held by MKR. It reflects the community’s desire to streamline governance, increase voter participation, and support the ecosystem’s long-term growth and scalability. 

MKR holders can upgrade their tokens to SKY at the rate of 1:24,000 (1 MKR = 24,000 SKY). For upgrade details, see the [MKR to SKY Upgrade Hub](https://upgrademkrtosky.sky.money). For the most current information on all things Sky, join the community conversations in the [Sky Forum](https://forum.sky.money/), [Sky Discord](https://discord.com/invite/skyecosystem), and [Sky Builder Discord](https://discord.gg/skybuilder), where the Sky community dives deep into Sky Stars, the Star Agent Framework and Sky Ecosystem Governance.`
  },
  {
    question: 'Will the exchange I use automatically upgrade all of my MKR to SKY?',
    answer: `MKR will not automatically upgrade to SKY. Eligible users of the Sky.money web app can upgrade their MKR to SKY using the Upgrade feature of the app. Some users may also choose to upgrade their MKR using [one of the frontends that support the upgrade](https://upgrademkrtosky.sky.money), Please see the [Terms of Use](https://docs.sky.money/legal-terms) for more information on third-party services.

For upgrade details and step-by-step upgrade instructions, please visit the [MKR to SKY Upgrade Hub](https://upgrademkrtosky.sky.money).`
  },
  {
    question: 'Can I still vote and delegate with MKR?',
    answer:
      'No, MKR is no longer used for Sky Ecosystem Governance. Only SKY, the upgrade of MKR, can be used to participate in Sky Ecosystem Governance voting at the new [Sky Governance Voting Portal](https://vote.sky.money/).'
  }
];

const usdsFaqItems = [
  {
    question: 'What is USDS?',
    answer: `USDS is a stablecoin of the decentralized Sky Protocol and the upgrade of DAI. It is backed by a surplus of collateral and soft-pegged to the value of the U.S. dollar, meaning it is designed to maintain a value equal to or close to a dollar. I

USDS is freely transferable and can be used in connection with any software protocol or platform that supports it. For example, you can use USDS to participate in the Sky Savings Rate to accumulate additional USDS, and to access Sky Token Rewards in the form of SKY tokens via the Sky.money web app.  

The Sky Protocol is governed by a community of broad and diversified individuals and entities from around the world, who hold Sky governance tokens and support the Sky Ecosystem by participating in a system of decentralized onchain voting. USDS powers the open Sky Ecosystem.

USDS is also currently available on networks other than Ethereum Mainnet, including Solana, Base and Arbitrum. You can follow the growth of USDS and all Sky Protocol tokens using the [Sky Ecosystem Dashboard](https://info.sky.money/).`
  },
  {
    question: 'How does USDS maintain stability and benefit the ecosystem?',
    answer: `Overcollateralization and other mechanisms helps USDS maintain stability while also helping to manage risk. 

Overcollateralization means that the total value of the collateral that backs a specific stablecoin must always be higher than the aggregate value of all of those stablecoins in circulation. For example, if a governance community decides that its stablecoin must be overcollateralized by 20%, and the value of all its stablecoins in circulation is $1M, the collateral held in reserve must be worth at least $1.2M.

Other mechanisms of the decentralized Sky Protocol that are used to keep USDS stable are Peg Stability Modules (PSMs) and the Smart Burn Engine (SBE):

• Peg Stability Modules (PSMs). Peg Stability Modules (PSMs) are smart contracts that allow users to convert certain stablecoins directly with the Sky Protocol for USDS or DAI at a fixed rate and with relatively low fees. They are designed to maintain the stability of USDS and DAI. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol. 
Through PSMs, USDS or DAI is obtained via predictable-rate conversion (typically a 1:1 ratio with certain stablecoins, or, in the case of sUSDS, for an amount reflecting its current price) rather than through borrowing. For example, given the existence of a USDC-backed PSM, a user could supply 100 USDC stablecoins to generate100 USDS or 100 DAI (minus fees), without taking on any debt. Given that PSM operations are facilitated on the Sky Protocol directly and not on a DEX, price slippage (i.e., the difference between the expected price of a token and the actual price when traded) is not a concern. Zero) Sky Protocol fees and no slippage are some of the benefits of using PSM, which adds liquidity to the assets backing the PSM. That liquidity helps to keep the value of USDS and DAI stable. 

• The Smart Burn Engine (SBE). The Smart Burn Engine is a smart contract that programmatically acquires SKY on the DeFi markets and deposits it into Sky Protocol-owned USDS/SKY liquidity pools using Sky Protocol surplus once the Surplus Buffer has hit a certain threshold set by Sky Ecosystem governance. Depositing SKY into these pools improves token liquidity and also increases the capital buffers of the Sky Protocol. Note that the SBE no longer holds DAI and MKR. and it no longer buys MKR.
The Surplus Buffer is where all the USDS revenue earned by the Sky Protocol from fees collected by users are accrued. Using the excess USDS in this way balances its supply with its demand, which stabilizes its price.

Importantly, the [Sky Ecosystem Dashboard](https://info.sky.money/), designed by [Block Analitica](https://blockanalitica.com/), allows anyone to examine the health of the decentralized Sky Protocol in real time. Users can view the total value locked (TVL) in the Protocol, TVL in the Sky Savings Rate module, TVL in the Sky Token Rewards module, the total collateral backing the system, an estimation of annual profits, and much more. For more on the Dashboard, see this [Substack post](https://blockanalitica.substack.com/p/the-sky-risk-and-analytics-dashboard) by Block Analitica. 

For details on the risks associated with soft-pegged stablecoins, review the [User Risk Documentation](https://docs.sky.money/user-risks).`
  },
  {
    question: 'Can I trade USDS on the open market?',
    answer:
      'Yes, eligible sUSDS holders can access the Sky.money web app to trade the tokens via an API integration with the third-party decentralized exchange [CoW Swap](https://swap.cow.fi/#/1/swap/WETH). sUSDS holders are also free to access any other protocol or exchange that supports sUSDS trading; however, users do so at their own risk. Sky.money is not responsible for any loss or damages incurred while using such third-party platforms.'
  },
  {
    question: 'Do I have to upgrade my DAI to USDS?',
    answer: 'No, upgrading your DAI is optional. You can continue to hold DAI tokens as you have in the past.'
  },
  {
    question: 'How much does it cost to upgrade DAI to USDS?',
    answer:
      'Upgrading DAI to USDS is free and instant using the Sky.money web app; however, you will likely pay a transaction—or gas—fee for using the Ethereum blockchain network. That fee is neither controlled, imposed nor received by Sky.money or the Sky Protocol. It is calculated based on current Ethereum network demand and the amount of gas required to process the upgrade transaction. Be sure to have ETH in your wallet anytime you transact using the Sky Protocol.'
  },
  {
    question: 'What happens to the DAI I’ve supplied to the DAI Savings Rate contract?',
    answer: `The DAI Savings Rate (DSR) contract remains unchanged, so you don’t need to immediately do anything to your DAI in the DSR module. You can, however, withdraw your DSR position, and, if you’re an eligible user of the Sky.money web app, upgrade your DAI to USDS, and then use the USDS to access the Sky Savings Rate.  

When you supply USDS to the Sky Savings Rate module of the decentralized, non-custodial Sky Protocol, you receive sUSDS savings tokens in return. When you choose to redeem your sUSDS for USDS—which you can do at any time—the total USDS you will receive will equal the amount you originally supplied, plus any rewards accumulated. No minimum supply amount is required to access the Sky Savings Rate, and you always maintain full control of your supplied assets.
`
  }
];
