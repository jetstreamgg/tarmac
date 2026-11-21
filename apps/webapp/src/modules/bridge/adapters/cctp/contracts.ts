import {
  cctpMessageTransmitterV2ImplementationAbi,
  cctpTokenMessengerV2ImplementationAbi,
  cctpTokenMinterV2Abi,
  mcdDaiAddress,
  psm3L2Address,
  usdcAddress,
  usdcL2Address,
  usdsAddress,
  usdsL2Address,
  usdsPsmWrapperAddress
} from '@/hooks/generated';
import { pad, type Address, type Hex } from 'viem';
import { arbitrum, base, mainnet, optimism, unichain } from 'viem/chains';
import type { BridgeNetworkId } from '../../model/networks';
import { isSystemAddress } from '../../model/systemAddresses';
import { NATIVE_DEPOSIT_CONTRACTS } from '../nativeDeposit/contracts';
import { MESSAGE_TRANSMITTER_V2, TOKEN_MESSENGER_V2, TOKEN_MINTER_V2 } from './addresses';

/** The L2s that bridge USDS to Ethereum through CCTP: USDS is swapped to USDC on PSM3, burned, and minted on Ethereum. */
export const CCTP_L2_NETWORKS = [
  'base',
  'optimism',
  'unichain',
  'arbitrum'
] as const satisfies BridgeNetworkId[];
export type CctpL2NetworkId = (typeof CCTP_L2_NETWORKS)[number];

export const isCctpL2Network = (network: BridgeNetworkId): network is CctpL2NetworkId =>
  (CCTP_L2_NETWORKS as readonly BridgeNetworkId[]).includes(network);

/** Circle's domain ids, read from each chain's MessageTransmitterV2 `localDomain()`. */
export const CCTP_DOMAIN = {
  ethereum: 0,
  optimism: 2,
  arbitrum: 3,
  base: 6,
  unichain: 10
} as const satisfies Record<'ethereum' | CctpL2NetworkId, number>;

export { MESSAGE_TRANSMITTER_V2, TOKEN_MESSENGER_V2, TOKEN_MINTER_V2 } from './addresses';

/** Standard transfer: attested once the source block is final, with no fee. Fast transfers (1000) are not offered. */
export const CCTP_FINALITY_STANDARD = 2000;

/** The LitePSM behind the USDS wrapper (its `psm()`), which holds the DAI a claim's USDC is sold for. */
export const LITE_PSM: Address = '0xf6e72Db5454dd049d0788e411b06CfAF16853042';

export const L1_USDC: Address = usdcAddress[mainnet.id];
export const L1_DAI: Address = mcdDaiAddress[mainnet.id];
export const L1_USDS: Address = usdsAddress[mainnet.id];
export const USDS_PSM_WRAPPER: Address = usdsPsmWrapperAddress[mainnet.id];

const CHAIN_ID: Record<CctpL2NetworkId, keyof typeof psm3L2Address> = {
  base: base.id,
  optimism: optimism.id,
  unichain: unichain.id,
  arbitrum: arbitrum.id
};

/** The L2 side of a CCTP bridge: the PSM3 that swaps USDS to USDC, and the tokens. */
export const cctpL2Contracts = (network: CctpL2NetworkId) => {
  const chainId = CHAIN_ID[network];
  return { psm3: psm3L2Address[chainId], usds: usdsL2Address[chainId], usdc: usdcL2Address[chainId] };
};

export {
  cctpTokenMessengerV2ImplementationAbi as tokenMessengerV2Abi,
  cctpMessageTransmitterV2ImplementationAbi as messageTransmitterV2Abi,
  cctpTokenMinterV2Abi as tokenMinterV2Abi
};

/** A 20-byte address as CCTP's bytes32. */
export const addressToBytes32 = (address: Address): Hex => pad(address.toLowerCase() as Hex, { size: 32 });

/** Every contract a CCTP bridge touches on either side; none of them can receive one. */
export const CCTP_CONTRACTS: readonly Address[] = [
  TOKEN_MESSENGER_V2,
  MESSAGE_TRANSMITTER_V2,
  TOKEN_MINTER_V2,
  L1_USDC,
  L1_DAI,
  LITE_PSM,
  USDS_PSM_WRAPPER,
  ...(Object.keys(CHAIN_ID) as CctpL2NetworkId[]).flatMap(network => Object.values(cctpL2Contracts(network)))
];

/** The burn's mint on Ethereum to the zero address, a system address or a bridge contract would lose the funds. */
export function assertCctpRecipient(address: Address) {
  if (isSystemAddress(address, [...CCTP_CONTRACTS, ...NATIVE_DEPOSIT_CONTRACTS]))
    throw new Error('A CCTP bridge needs a recipient that can hold USDC and USDS');
}
