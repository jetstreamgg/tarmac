import { mainnet, base, arbitrum, optimism, unichain } from 'wagmi/chains';
import { TENDERLY_CHAIN_ID } from './constants';

type L2ChainId = typeof base.id | typeof arbitrum.id | typeof optimism.id | typeof unichain.id;

export const contracts: {
  name: string;
  address: Record<typeof mainnet.id, `0x${string}`> & Partial<Record<number, `0x${string}`>>;
}[] = [
  // Savings module
  {
    name: 'mcdPot',
    address: {
      [mainnet.id]: '0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7',
      [TENDERLY_CHAIN_ID]: '0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7'
    }
  },

  // Maker protocol tokens
  {
    name: 'mcdDai',
    address: {
      [mainnet.id]: '0x6b175474e89094c44da98b954eedeac495271d0f',
      [TENDERLY_CHAIN_ID]: '0x6b175474e89094c44da98b954eedeac495271d0f',
      [base.id]: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      [arbitrum.id]: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1'
    }
  },
  {
    name: 'mkr',
    address: {
      [mainnet.id]: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
      [TENDERLY_CHAIN_ID]: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'
    }
  },

  // Other tokens
  {
    name: 'weth',
    address: {
      [mainnet.id]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      [TENDERLY_CHAIN_ID]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      [base.id]: '0x4200000000000000000000000000000000000006',
      [arbitrum.id]: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
    }
  },
  {
    name: 'usdc',
    address: {
      [mainnet.id]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      [TENDERLY_CHAIN_ID]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    }
  },
  {
    name: 'usdt',
    address: {
      [mainnet.id]: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      [TENDERLY_CHAIN_ID]: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      [base.id]: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
      [arbitrum.id]: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'
    }
  },

  // Proxy
  {
    name: 'dsProxy',
    address: {
      // Just an example address used to pull the proxy ABI, not to be used for anything else.
      [mainnet.id]: '0x7Ac6E2b9ea61e2E587A06e083E4373918071dCfc',
      [TENDERLY_CHAIN_ID]: '0x7Ac6E2b9ea61e2E587A06e083E4373918071dCfc'
    }
  },
  {
    name: 'proxyActions',
    address: {
      [mainnet.id]: '0x82ecd135dce65fbc6dbdd0e4237e0af93ffd5038',
      [TENDERLY_CHAIN_ID]: '0x82ecd135dce65fbc6dbdd0e4237e0af93ffd5038'
    }
  },
  {
    name: 'proxyRegistry',
    address: {
      [mainnet.id]: '0x4678f0a6958e4D2Bc4F1BAF7Bc52E8F3564f3fE4',
      [TENDERLY_CHAIN_ID]: '0x4678f0a6958e4D2Bc4F1BAF7Bc52E8F3564f3fE4'
    }
  },

  //Maker protocol
  {
    name: 'mcdVat',
    address: {
      [mainnet.id]: '0x35d1b3f3d7966a1dfe207aa4514c12a259a0492b',
      [TENDERLY_CHAIN_ID]: '0x35d1b3f3d7966a1dfe207aa4514c12a259a0492b'
    }
  },
  {
    name: 'mcdSpot',
    address: {
      [mainnet.id]: '0x65c79fcb50ca1594b025960e539ed7a9a6d434a3',
      [TENDERLY_CHAIN_ID]: '0x65c79fcb50ca1594b025960e539ed7a9a6d434a3'
    }
  },
  {
    name: 'mcdJug',
    address: {
      [mainnet.id]: '0x19c0976f590d67707e62397c87829d896dc0f1f1',
      [TENDERLY_CHAIN_ID]: '0x19c0976f590d67707e62397c87829d896dc0f1f1'
    }
  },
  // new Sky contracts
  // Upgrade module
  {
    name: 'daiUsds',
    address: {
      [mainnet.id]: '0x3225737a9Bbb6473CB4a45b7244ACa2BeFdB276A',
      [TENDERLY_CHAIN_ID]: '0x3225737a9Bbb6473CB4a45b7244ACa2BeFdB276A'
    }
  },
  {
    name: 'mkrSky',
    address: {
      [mainnet.id]: '0xA1Ea1bA18E88C381C724a75F23a130420C403f9a',
      [TENDERLY_CHAIN_ID]: '0xA1Ea1bA18E88C381C724a75F23a130420C403f9a'
    }
  },
  // Savings module
  {
    name: 'sUsds',
    address: {
      [mainnet.id]: '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD',
      [TENDERLY_CHAIN_ID]: '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD'
    }
  },
  {
    name: 'sUsdsImplementation',
    address: {
      [mainnet.id]: '0x4e7991e5C547ce825BdEb665EE14a3274f9F61e0',
      [TENDERLY_CHAIN_ID]: '0x4e7991e5C547ce825BdEb665EE14a3274f9F61e0'
    }
  },
  // stUSDS module
  {
    name: 'stUsds',
    address: {
      [mainnet.id]: '0x99CD4Ec3f88A45940936F469E4bB72A2A701EEB9',
      [TENDERLY_CHAIN_ID]: '0x99CD4Ec3f88A45940936F469E4bB72A2A701EEB9'
    }
  },
  {
    name: 'stUsdsImplementation',
    address: {
      [mainnet.id]: '0x7A61B7adCFD493f7CF0F86dFCECB94b72c227F22',
      [TENDERLY_CHAIN_ID]: '0x7A61B7adCFD493f7CF0F86dFCECB94b72c227F22'
    }
  },
  // Rewards module
  {
    name: 'usdsSkyReward',
    address: {
      [mainnet.id]: '0x0650CAF159C5A49f711e8169D4336ECB9b950275',
      [TENDERLY_CHAIN_ID]: '0x0650CAF159C5A49f711e8169D4336ECB9b950275'
    }
  },
  {
    name: 'usdsSpkReward',
    address: {
      [mainnet.id]: '0x173e314C7635B45322cd8Cb14f44b312e079F3af',
      [TENDERLY_CHAIN_ID]: '0x173e314C7635B45322cd8Cb14f44b312e079F3af'
    }
  },
  {
    name: 'cleReward',
    address: {
      [mainnet.id]: '0x10ab606B067C9C461d8893c47C7512472E19e2Ce',
      [TENDERLY_CHAIN_ID]: '0x10ab606B067C9C461d8893c47C7512472E19e2Ce'
    }
  },
  // Maker protocol tokens
  {
    name: 'usds',
    address: {
      [mainnet.id]: '0xdC035D45d973E3EC169d2276DDab16f1e407384F',
      [TENDERLY_CHAIN_ID]: '0xdC035D45d973E3EC169d2276DDab16f1e407384F'
    }
  },
  {
    name: 'sky',
    address: {
      [mainnet.id]: '0x56072C95FAA701256059aa122697B133aDEd9279',
      [TENDERLY_CHAIN_ID]: '0x56072C95FAA701256059aa122697B133aDEd9279'
    }
  },
  {
    name: 'spk',
    address: {
      [mainnet.id]: '0xc20059e0317DE91738d13af027DfC4a50781b066',
      [TENDERLY_CHAIN_ID]: '0xc20059e0317DE91738d13af027DfC4a50781b066'
    }
  },
  // SealModule
  {
    name: 'sealModule',
    address: {
      [mainnet.id]: '0x2b16c07d5fd5cc701a0a871eae2aad6da5fc8f12',
      [TENDERLY_CHAIN_ID]: '0x2b16c07d5fd5cc701a0a871eae2aad6da5fc8f12'
    }
  },
  // LockstakeMkr
  {
    name: 'lsMkr',
    address: {
      [mainnet.id]: '0xb4e0e45e142101dc3ed768bac219fc35edbed295',
      [TENDERLY_CHAIN_ID]: '0xb4e0e45e142101dc3ed768bac219fc35edbed295'
    }
  },
  // Rewards Lockstake MKR
  {
    name: 'lsMkrUsdsReward',
    address: {
      [mainnet.id]: '0x92282235a39be957ff1f37619fd22a9ae5507cb1',
      [TENDERLY_CHAIN_ID]: '0x92282235a39be957ff1f37619fd22a9ae5507cb1'
    }
  },
  // Merkle Distributor
  {
    name: 'merkleDistributor',
    address: {
      [mainnet.id]: '0xca9eF7F3404B23C77A2a0Dee8ab54B3338d35eAe',
      [TENDERLY_CHAIN_ID]: '0xca9eF7F3404B23C77A2a0Dee8ab54B3338d35eAe'
    }
  },
  // StakeModule
  {
    name: 'stakeModule',
    address: {
      [mainnet.id]: '0xCe01C90dE7FD1bcFa39e237FE6D8D9F569e8A6a3',
      [TENDERLY_CHAIN_ID]: '0xCe01C90dE7FD1bcFa39e237FE6D8D9F569e8A6a3'
    }
  },
  // LockstakeSky
  {
    name: 'lsSky',
    address: {
      [mainnet.id]: '0xf9A9cfD3229E985B91F99Bc866d42938044FFa1C',
      [TENDERLY_CHAIN_ID]: '0xf9A9cfD3229E985B91F99Bc866d42938044FFa1C'
    }
  },
  // Lockstake USDS Rewards
  {
    name: 'lsSkyUsdsReward',
    address: {
      [mainnet.id]: '0x38E4254bD82ED5Ee97CD1C4278FAae748d998865',
      [TENDERLY_CHAIN_ID]: '0x38E4254bD82ED5Ee97CD1C4278FAae748d998865'
    }
  },
  // Lockstake SPK Rewards
  {
    name: 'lsSkySpkReward',
    address: {
      [mainnet.id]: '0x99cBC0e4E6427F6939536eD24d1275B95ff77404',
      [TENDERLY_CHAIN_ID]: '0x99cBC0e4E6427F6939536eD24d1275B95ff77404'
    }
  },
  // Lockstake SKY Rewards
  {
    name: 'lsSkySkyReward',
    address: {
      [mainnet.id]: '0xB44C2Fb4181D7Cb06bdFf34A46FdFe4a259B40Fc',
      [TENDERLY_CHAIN_ID]: '0xB44C2Fb4181D7Cb06bdFf34A46FdFe4a259B40Fc'
    }
  },

  // Liquidation
  {
    name: 'clipper',
    address: {
      [mainnet.id]: '0x836F56750517b1528B5078Cba4Ac4B94fBE4A399',
      [TENDERLY_CHAIN_ID]: '0x836F56750517b1528B5078Cba4Ac4B94fBE4A399'
    }
  },

  // Curve USDS/stUSDS Pool
  // Reference: https://docs.curve.finance/cryptoswap-exchange/cryptoswap/pools/crypto-pool/
  {
    name: 'curveStUsdsUsdsPool',
    address: {
      [mainnet.id]: '0x2C7C98A3b1582D83c43987202aEFf638312478aE',
      [TENDERLY_CHAIN_ID]: '0x2C7C98A3b1582D83c43987202aEFf638312478aE'
    }
  },

  // CoW Protocol
  {
    name: 'gPv2Settlement',
    address: {
      [mainnet.id]: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
      [base.id]: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
      [arbitrum.id]: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
      [TENDERLY_CHAIN_ID]: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41'
    }
  },
  {
    name: 'ethFlow',
    address: {
      [mainnet.id]: '0xbA3cB449bD2B4ADddBc894D8697F5170800EAdeC',
      [base.id]: '0xbA3cB449bD2B4ADddBc894D8697F5170800EAdeC',
      [arbitrum.id]: '0xbA3cB449bD2B4ADddBc894D8697F5170800EAdeC',
      [TENDERLY_CHAIN_ID]: '0xbA3cB449bD2B4ADddBc894D8697F5170800EAdeC'
    }
  },
  // Morpho Blue core contract (singleton that stores all market state)
  {
    name: 'morphoBlue',
    address: {
      [mainnet.id]: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
      [TENDERLY_CHAIN_ID]: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb'
    }
  },
  // Morpho vaults
  {
    name: 'usdsRiskCapitalVault',
    address: {
      [mainnet.id]: '0xf42bca228D9bd3e2F8EE65Fec3d21De1063882d4',
      [TENDERLY_CHAIN_ID]: '0xf42bca228D9bd3e2F8EE65Fec3d21De1063882d4'
    }
  },
  {
    name: 'MorphoMerklDistributor',
    address: {
      [mainnet.id]: '0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae',
      [TENDERLY_CHAIN_ID]: '0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae'
    }
  },
  {
    name: 'MorphoMerklDistributorImplementation',
    address: {
      [mainnet.id]: '0x0e6590F64a82CbC838b2a087281689dE1a5bC8E0',
      [TENDERLY_CHAIN_ID]: '0x0e6590F64a82CbC838b2a087281689dE1a5bC8E0'
    }
  }
];

export const tenderlyContracts: { name: string; address: Record<typeof TENDERLY_CHAIN_ID, `0x${string}`> }[] =
  [
    // {
    //   name: 'cle',
    //   address: {
    //     // same token as USDS for now
    //     [TENDERLY_CHAIN_ID]: '0xdC035D45d973E3EC169d2276DDab16f1e407384F'
    //   }
    // }
  ];

export const l2Contracts: { name: string; address: Record<L2ChainId, `0x${string}`> }[] = [
  {
    name: 'usdcL2',
    address: {
      [base.id]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      [arbitrum.id]: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      [optimism.id]: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      [unichain.id]: '0x078D782b760474a361dDA0AF3839290b0EF57AD6'
    }
  },
  {
    name: 'usdsL2',
    address: {
      [base.id]: '0x820C137fa70C8691f0e44Dc420a5e53c168921Dc',
      [arbitrum.id]: '0x6491c05A82219b8D1479057361ff1654749b876b',
      [optimism.id]: '0x4F13a96EC5C4Cf34e442b46Bbd98a0791F20edC3',
      [unichain.id]: '0x7E10036Acc4B56d4dFCa3b77810356CE52313F9C'
    }
  },
  {
    name: 'sUsdsL2',
    address: {
      [base.id]: '0x5875eEE11Cf8398102FdAd704C9E96607675467a',
      [arbitrum.id]: '0xdDb46999F8891663a8F2828d25298f70416d7610',
      [optimism.id]: '0xb5B2dc7fd34C249F4be7fB1fCea07950784229e0',
      [unichain.id]: '0xA06b10Db9F390990364A3984C04FaDf1c13691b5'
    }
  },
  {
    name: 'psm3L2',
    address: {
      [base.id]: '0x1601843c5E9bC251A3272907010AFa41Fa18347E',
      [arbitrum.id]: '0x2B05F8e1cACC6974fD79A673a341Fe1f58d27266',
      [optimism.id]: '0xe0F9978b907853F354d79188A3dEfbD41978af62',
      [unichain.id]: '0x7b42Ed932f26509465F7cE3FAF76FfCe1275312f'
    }
  },
  {
    name: 'ssrAuthOracle',
    address: {
      [base.id]: '0x65d946e533748A998B1f0E430803e39A6388f7a1',
      [arbitrum.id]: '0xEE2816c1E1eed14d444552654Ed3027abC033A36',
      [optimism.id]: '0x6E53585449142A5E6D5fC918AE6BEa341dC81C68',
      [unichain.id]: '0x1566BFA55D95686a823751298533D42651183988'
    }
  }
];
