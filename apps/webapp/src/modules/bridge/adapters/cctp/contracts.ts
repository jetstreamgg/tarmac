import {
  mcdDaiAddress,
  psm3L2Address,
  usdcAddress,
  usdcL2Address,
  usdsAddress,
  usdsL2Address,
  usdsPsmWrapperAddress
} from '@/hooks/generated';
import { USDC_PRECISION, WAD_PRECISION } from '@/utils/math.constants';
import { pad, parseAbi, type Address, type Hex } from 'viem';
import { arbitrum, base, mainnet, optimism, unichain } from 'viem/chains';
import type { BridgeNetworkId } from '../../model/networks';
import { isSystemAddress } from '../../model/systemAddresses';

/** The L2s that bridge USDS to Ethereum through CCTP: USDS is swapped to USDC on PSM3, burned, and minted on Ethereum. */
export type CctpL2NetworkId = 'base' | 'optimism' | 'unichain' | 'arbitrum';

export const isCctpL2Network = (network: BridgeNetworkId): network is CctpL2NetworkId =>
  network === 'base' || network === 'optimism' || network === 'unichain' || network === 'arbitrum';

/** Circle's domain ids, read from each chain's MessageTransmitterV2 `localDomain()`. */
export const CCTP_DOMAIN = {
  ethereum: 0,
  optimism: 2,
  arbitrum: 3,
  base: 6,
  unichain: 10
} as const satisfies Record<'ethereum' | CctpL2NetworkId, number>;

// CCTP V2 is deployed at the same addresses on every chain.
export const TOKEN_MESSENGER_V2: Address = '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d';
export const MESSAGE_TRANSMITTER_V2: Address = '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64';
export const TOKEN_MINTER_V2: Address = '0xfd78EE919681417d192449715b2594ab58f5D002';

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

/** USDS has 18 decimals and USDC 6; PSM3 and the wrapper convert at exactly 1:1. */
export const USDS_PER_USDC_UNIT = 10n ** BigInt(WAD_PRECISION - USDC_PRECISION);

/** A 20-byte address as CCTP's bytes32. */
export const addressToBytes32 = (address: Address): Hex => pad(address.toLowerCase() as Hex, { size: 32 });

export const tokenMessengerV2Abi = parseAbi([
  'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold)',
  'event DepositForBurn(address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller, uint256 maxFee, uint32 indexed minFinalityThreshold, bytes hookData)',
  'event MintAndWithdraw(address indexed mintRecipient, uint256 amount, address indexed mintToken, uint256 feeCollected)'
]);

export const messageTransmitterV2Abi = parseAbi([
  'function receiveMessage(bytes message, bytes attestation) returns (bool)',
  'function usedNonces(bytes32 nonce) view returns (uint256)',
  'function paused() view returns (bool)',
  'event MessageSent(bytes message)',
  'event MessageReceived(address indexed caller, uint32 sourceDomain, bytes32 indexed nonce, bytes32 sender, uint32 indexed finalityThresholdExecuted, bytes messageBody)'
]);

export const tokenMinterV2Abi = parseAbi([
  'function burnLimitsPerMessage(address token) view returns (uint256)',
  'function paused() view returns (bool)'
]);

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

/** The burn's mint on Ethereum to the zero address, a system address or a CCTP contract would lose the funds. */
export function assertCctpRecipient(address: Address) {
  if (isSystemAddress(address, CCTP_CONTRACTS))
    throw new Error('A CCTP bridge needs a recipient that can hold USDC and USDS');
}
