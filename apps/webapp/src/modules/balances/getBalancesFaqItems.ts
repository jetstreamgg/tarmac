import {
  isBaseChainId,
  isArbitrumChainId,
  isOptimismChainId,
  isUnichainChainId
} from '@jetstreamgg/sky-utils';

import {
  L2GeneralFaqItems,
  baseFaqItems,
  arbitrumFaqItems,
  optimismFaqItems,
  unichainFaqItems
} from '../ui/constants/sharedFaqItems';
import { BATCH_TX_ENABLED } from '@/lib/constants';

export const getBalancesFaqItems = (chainId: number) => [
  ...[...mainnetFaqItems, ...batchTxFaqItems, ...L2GeneralFaqItems],
  ...(isBaseChainId(chainId) ? baseFaqItems : []),
  ...(isArbitrumChainId(chainId) ? arbitrumFaqItems : []),
  ...(isOptimismChainId(chainId) ? optimismFaqItems : []),
  ...(isUnichainChainId(chainId) ? unichainFaqItems : [])
];

const mainnetFaqItems = [
  {
    question: 'What is a crypto wallet, and how do I get one?',
    answer: `A crypto wallet is a tool, typically in the form of software, that enables you to easily view a list of your digital assets, manage them, and help safeguard them. Note that with crypto wallets, your assets are recorded on a blockchain and only visible in the wallet—not stored there. 

Your non-custodial wallet holds the private keys needed to sign crypto transactions, and gives you full control over those private keys, which are essential for accessing and managing your crypto. Unlike custodial wallets, where a third party holds the private keys, non-custodial wallets allow users to be the sole custodian of their keys. This means that only the user has the ability to sign transactions, making it more secure and private; however, it also means that if a user loses their private key or recovery phrase, they may permanently lose access to their assets. Because all crypto assets exist on a public or private blockchain, access to them depends on control of the corresponding private keys.

Non-custodial wallets can be software-based, like mobile apps, or hardware devices designed for enhanced security. There are several types of crypto wallets and no limit to the number of wallets you can own. Two popular software-based wallets are Metamask and Rainbow.

Sky Balances is not a crypto wallet, but rather a non-custodial tool that displays your Sky-related asset balances by receiving information from the non-custodial crypto wallet that you connect to Sky.money to access the Sky Protocol.
`
  },
  {
    question: 'How do crypto wallets work?',
    answer: `Typical crypto wallets operate using a pair of cryptographic keys—one public, the other private. These keys are essential components of what is known as “public key cryptography,” the core concept underlying wallet security and actions. 

Typically, when setting up a new non-custodial digital wallet, the wallet software generates a “seed phrase,” which is a sequence of 12, 18, or 24 seemingly random words used as a mnemonic device to access the underlying private key(s) related to that wallet. The seed phrase can be used to recover the public and private keys, and should therefore be stored somewhere safe and never shared with anyone. 

A private key is a randomly generated string of letters and numbers which acts as a sort of password that gives anyone that knows it the capability to control the wallet assets. It is known only to the user and should be kept secure and confidential to ensure that only the user has access to and can control any associated assets. The private key is used to sign transactions. For example, when a user wants to send crypto or access their assets on the blockchain, they would use the private key to authorize the transaction. 

A public key is usually derived from the private key using a mathematical algorithm. It is a string of characters that can be shared openly without compromising a wallet’s inherent security. The public key is used to generate wallet addresses and to encrypt data. For example, when someone wants to send digital assets to a user, they would use the user’s public key or the associated wallet address. 
`
  },
  {
    question: 'How do I use a non-custodial digital wallet to make a transaction?',
    answer: `Once you’ve set up your non-custodial digital wallet, and have your public and private keys, you can use it to manage (send and receive) your digital assets on the blockchain. Every time you transact, your wallet requires you to digitally sign the transaction with your private key. Signing when prompted is a simple but critical part of the process, demonstrating that you acknowledge your action, and ensuring that only you have control of your crypto.

Some onchain actions might require multiple wallet signatures to authorize them. For example, to complete a trade on the decentralized, non-custodial Sky Protocol using the Sky.money web app, you would first need to confirm that you allow the app to access the token you want to trade in your wallet (one signature), and then authorize the actual trade (another signature).
`
  },
  {
    question: 'What is a blockchain transaction fee?',
    answer:
      'Every time you engage in transactions with your digital assets (e.g., buy, sell, trade or transfer them) you will likely pay a transaction fee—called a gas fee—for using the blockchain network. That fee is neither controlled, imposed nor received by the Sky.money web app or the Sky Protocol; it is calculated based on current network demand and the amount of gas (i.e., units of compute resources) required to process your transaction. On the Ethereum blockchain, gas fees are paid in ETH, the native currency of the blockchain. So, be sure to have ETH in your wallet anytime you transact using the Sky Protocol.'
  },
  {
    question: 'What is USDS?',
    answer: `USDS is a stablecoin of the decentralized Sky Protocol and the upgrade of DAI. It is backed by a surplus of collateral and soft-pegged to the value of the U.S. dollar, meaning it is designed to maintain a value equal to or close to a dollar.

USDS is freely transferable and can be used in connection with any software protocol or platform that supports it. For example, you can use USDS to participate in the Sky Savings Rate to accumulate additional USDS, and to access Sky Token Rewards via the Sky.money web app.  

The Sky Protocol is governed by a community of broad and diversified individuals and entities from around the world, who hold Sky governance tokens and support the Sky Ecosystem by participating in a system of decentralized onchain voting. USDS powers the open Sky Ecosystem.

USDS is also currently available on networks other than Ethereum Mainnet, including Solana, Base and Arbitrum. You can follow the health of USDS and all Sky Protocol tokens using the [Sky Ecosystem Dashboard](https://info.sky.money/).`
  },
  {
    question: 'How do I get USDS?',
    answer:
      'You can use the Sky.money web app, a non-custodial gateway to the decentralized Sky Protocol, to trade USDC, USDT, ETH or SKY for USDS (or vice versa). You can also upgrade your DAI to USDS, subject to any applicable blockchain transaction, or gas, fees. Gas fees are neither controlled, imposed nor received by Sky.money or the Sky Protocol. You can also obtain USDS on various crypto exchanges that decide to make it available on their platforms.'
  },
  {
    question: 'How can I use USDS?',
    answer:
      'Like other decentralized stablecoins, USDS is freely transferable and can be used in connection with any software protocol or platform that supports it. Unlike other stablecoins, you can use USDS to participate in the Sky Savings Rate to accumulate additional USDS over time, and to access Sky Token Rewards, without giving up control of your digital assets. When you select SKY as your Sky Token Reward, you can participate—if you choose to do so—in the governance of the Sky Ecosystem.'
  },
  {
    question: 'What is SKY, and how can I get it and use it?',
    answer: `SKY is the native governance token of the decentralized Sky Protocol and Ecosystem, and the upgrade of MKR.

You can access SKY in several ways:

• By upgrading your MKR tokens to SKY at a rate of 1:24,000 (1 MKR = 24,000 SKY) via the  Sky.money web app.

• By directly trading  USDC, USDT, ETH and USDS for it via the Sky.money web app.

• By supplying USDS to the Sky Token Rewards module of the Sky Protocol and selecting SKY as a reward.

• On cryptocurrency exchanges that support the SKY token. 


SKY holders can use the token to:

• Participate directly in Sky Ecosystem Governance through a system of onchain voting, and/or to entrust their voting power to one or more governance delegates. 

• Access Staking Rewards by supplying SKY to the Staking Engine of the Protocol. 
`
  },
  {
    question: 'Are there risks involved with using the Sky.money web app?',
    answer:
      'For details regarding potential risks using Sky.money web app, please see the [User Risk Documentation](https://docs.sky.money/user-risks).'
  }
];

const batchTxFaqItems = BATCH_TX_ENABLED
  ? [
      {
        question: 'What are EIP-7702 bundled transactions, and how do they work?',
        answer: `EIP-7702 is a formal Ethereum Improvement Proposal that introduces native bundled transactions. Bundled transactions enable users to bundle multiple on-chain calls (e.g., token approval and upgrade, token approval and savings supply, etc.) into one atomic operation. 

Wallets implement EIP-7702 via delegate contracts that handle bundling, validation, gas estimation, and signature flow on behalf of dApps. Please note, however, that all security checks, user confirmations, and error handling are managed by your chosen wallet’s delegate contract. As outlined in our [Terms of Use](https://docs.sky.money/legal-terms), your use of a non-custodial digital wallet—including wallets supporting EIP-7702 and smart account functionality—is governed by the terms of service of your third-party wallet provider. We do not control or take responsibility for the security, functionality, or behavior of third-party wallets, including their handling of bundled transactions or delegate contracts. To ensure a secure and transparent experience, please ensure you are using a trusted and up-to-date wallet before proceeding.

By adopting EIP-7702, Sky.money delivers a one-click, gas-optimized experience that aligns with the best practices of the broader Ethereum ecosystem, while avoiding any additional risks associated with low-level transaction assembly or bundler contract implementation.`
      },
      {
        question: 'How do I opt in or out of bundled transactions?',
        answer: `EIP-7702 bundled transactions are enabled by default, as they simplify the user experience and reduce gas costs. You can opt out of bundled transactions manually by toggling off where indicated in the feature widget flow or in the main navigation bar in the top right corner of the app.

When bundled transactions are toggled off, you will need to confirm two separate transactions, as you did prior to implementation of the bundled transaction option, instead of only one.`
      },
      {
        question: 'How do I know if my wallet is compatible with EIP-7702 bundled transactions?',
        answer: `On first use, if your connected wallet supports EIP-7702 functionality, it will ask if you would like to use a Smart Account, which accommodates features such as bundled transactions. You will also be shown some of the benefits of opting for a Smart Account. On Metamask, for example, those benefits include:

• Faster transactions and lower gas fees.  
• The ability to pay network fees with any token in your wallet.  
• The ability to keep the same wallet address and turn the functionality on or off any time.

If your connected wallet doesn’t support EIP-7702, you will not be able to use the bundled transactions option with that wallet.`
      }
    ]
  : [];
