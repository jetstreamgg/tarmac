import { mainnet } from 'wagmi/chains';
import { TENDERLY_CHAIN_ID } from '../constants';

export const usdsPsmWrapperAddress = {
  [mainnet.id]: '0xA188EEC8F81263234dA3622A406892F3D630f98c',
  [TENDERLY_CHAIN_ID]: '0xA188EEC8F81263234dA3622A406892F3D630f98c'
} as const;

export const psmPocketAddress = {
  [mainnet.id]: '0x37305B1cD40574E4C5Ce33f8e8306Be057fD7341',
  [TENDERLY_CHAIN_ID]: '0x37305B1cD40574E4C5Ce33f8e8306Be057fD7341'
} as const;

export const usdsPsmWrapperAbi = [
  {
    type: 'function',
    name: 'sellGem',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'usr', type: 'address', internalType: 'address' },
      { name: 'gemAmt', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [{ name: 'usdsOutWad', type: 'uint256', internalType: 'uint256' }]
  },
  {
    type: 'function',
    name: 'buyGem',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'usr', type: 'address', internalType: 'address' },
      { name: 'gemAmt', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [{ name: 'usdsInWad', type: 'uint256', internalType: 'uint256' }]
  },
  {
    type: 'function',
    name: 'tin',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
  },
  {
    type: 'function',
    name: 'tout',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
  },
  {
    type: 'function',
    name: 'live',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
  },
  {
    type: 'function',
    name: 'HALTED',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
  }
] as const;
