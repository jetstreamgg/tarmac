import { psm3L2Abi, usdsPsmWrapperAbi } from '@/hooks/generated';
import { getWriteContractCall } from '@/hooks/shared/getWriteContractCall';
import { erc20Abi, isAddressEqual, zeroHash, type Address, type Call, type Hex } from 'viem';
import {
  CCTP_DOMAIN,
  CCTP_FINALITY_STANDARD,
  L1_USDC,
  MESSAGE_TRANSMITTER_V2,
  TOKEN_MESSENGER_V2,
  USDS_PER_USDC_UNIT,
  USDS_PSM_WRAPPER,
  addressToBytes32,
  assertCctpRecipient,
  cctpL2Contracts,
  messageTransmitterV2Abi,
  tokenMessengerV2Abi,
  type CctpL2NetworkId
} from './contracts';
import { decodeCctpMessage } from './message';

/** The USDC a USDS amount burns as; the USDS below one USDC unit stays in the wallet, so the swap takes none of it. */
export const cctpBurnAmount = (amount: bigint): bigint => amount / USDS_PER_USDC_UNIT;

/** The leg that receives a claim's message, which records the claim. */
export const CCTP_CLAIM_FUNCTION = 'receiveMessage';
/** The leg that sells USDC for USDS, which records a convert. */
export const CCTP_CONVERT_FUNCTION = 'sellGem';
/** The leg that swaps USDC for USDS on an L2's PSM3, which records an L2 convert. */
export const CCTP_L2_CONVERT_FUNCTION = 'swapExactIn';

const approve = (token: Address, spender: Address, amount: bigint) =>
  getWriteContractCall({ to: token, abi: erc20Abi, functionName: 'approve', args: [spender, amount] });

/**
 * The L2 calls of a CCTP bridge to Ethereum: the whole amount is swapped 1:1
 * from USDS to USDC on PSM3 (to the sender, with a minimum of the full swap),
 * so USDC the wallet already held is never burned, then burned to
 * `mintRecipient` on Ethereum as a standard transfer with no fee, hook or
 * destination caller. Without `swap` it only burns: a bridge continued after
 * its swap mined. Each approve is of exactly the amount, and only when the
 * allowance is short.
 */
export function cctpBurnCalls({
  network,
  amount,
  account,
  mintRecipient,
  usdsAllowance,
  usdcAllowance,
  swap: swaps = true
}: {
  network: CctpL2NetworkId;
  /** USDS at 18 decimals. */
  amount: bigint;
  account: Address;
  mintRecipient: Address;
  usdsAllowance: bigint;
  usdcAllowance: bigint;
  /** False to burn USDC a mined swap already returned. */
  swap?: boolean;
}): Call[] {
  assertCctpRecipient(mintRecipient);
  const burn = cctpBurnAmount(amount);
  if (burn === 0n) throw new Error('A CCTP bridge needs at least one USDC unit');
  const swapIn = burn * USDS_PER_USDC_UNIT;
  const { psm3, usds, usdc } = cctpL2Contracts(network);
  const swap = getWriteContractCall({
    to: psm3,
    abi: psm3L2Abi,
    functionName: 'swapExactIn',
    args: [usds, usdc, swapIn, burn, account, 0n]
  });
  const depositForBurn = getWriteContractCall({
    to: TOKEN_MESSENGER_V2,
    abi: tokenMessengerV2Abi,
    functionName: 'depositForBurn',
    args: [
      burn,
      CCTP_DOMAIN.ethereum,
      addressToBytes32(mintRecipient),
      usdc,
      zeroHash,
      0n,
      CCTP_FINALITY_STANDARD
    ]
  });
  return [
    ...(swaps && usdsAllowance < swapIn ? [approve(usds, psm3, swapIn)] : []),
    ...(swaps ? [swap] : []),
    ...(usdcAllowance < burn ? [approve(usdc, TOKEN_MESSENGER_V2, burn)] : []),
    depositForBurn
  ];
}

/** Sells `amount` USDC (6 decimals) to the wrapper for USDS to `account`, after an approve when short. */
export function cctpConvertCalls({
  account,
  amount,
  usdcAllowance
}: {
  account: Address;
  amount: bigint;
  usdcAllowance: bigint;
}): Call[] {
  const sell = getWriteContractCall({
    to: USDS_PSM_WRAPPER,
    abi: usdsPsmWrapperAbi,
    functionName: CCTP_CONVERT_FUNCTION,
    args: [account, amount]
  });
  return usdcAllowance < amount ? [approve(L1_USDC, USDS_PSM_WRAPPER, amount), sell] : [sell];
}

/**
 * Swaps `amount` USDC (6 decimals) 1:1 for USDS on the L2's PSM3, to
 * `account` with a minimum of the full amount and no referral, after an
 * approve of exactly the amount when short: the USDC a stopped bridge swapped
 * out, turned back.
 */
export function cctpL2ConvertCalls({
  network,
  account,
  amount,
  usdcAllowance
}: {
  network: CctpL2NetworkId;
  account: Address;
  amount: bigint;
  usdcAllowance: bigint;
}): Call[] {
  if (amount <= 0n) throw new Error('A conversion needs at least one USDC unit');
  const { psm3, usds, usdc } = cctpL2Contracts(network);
  const swap = getWriteContractCall({
    to: psm3,
    abi: psm3L2Abi,
    functionName: CCTP_L2_CONVERT_FUNCTION,
    args: [usdc, usds, amount, amount * USDS_PER_USDC_UNIT, account, 0n]
  });
  return usdcAllowance < amount ? [approve(usdc, psm3, amount), swap] : [swap];
}

/**
 * The Ethereum claim of an attested message minted to `account`: receive it,
 * then sell the minted USDC for USDS to the same account. Anyone else's
 * message is refused: its USDC goes to its own recipient.
 */
export function cctpClaimCalls({
  message,
  attestation,
  account,
  usdcAllowance
}: {
  message: Hex;
  attestation: Hex;
  account: Address;
  usdcAllowance: bigint;
}): Call[] {
  const { body } = decodeCctpMessage(message);
  if (!isAddressEqual(body.mintRecipient, account))
    throw new Error('This CCTP message mints to another account');
  const receive = getWriteContractCall({
    to: MESSAGE_TRANSMITTER_V2,
    abi: messageTransmitterV2Abi,
    functionName: CCTP_CLAIM_FUNCTION,
    args: [message, attestation]
  });
  return [receive, ...cctpConvertCalls({ account, amount: body.amount - body.feeExecuted, usdcAllowance })];
}
