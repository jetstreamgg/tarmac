import { psm3L2Abi, psm3L2Address, usdsPsmWrapperAbi, usdsPsmWrapperAddress } from '../generated';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import type { ApproveThenActLeg } from '../shared/useApproveThenAct';

type Allowance = { allowance: bigint | undefined; allowanceError?: Error | null };

/** L2 PSM3: approve(assetIn → psm) → `swapExactIn`. */
export function psm3SwapExactInLeg({
  chainId,
  address,
  assetIn,
  assetOut,
  amountIn,
  minAmountOut,
  referralCode = 0n,
  ...allowance
}: Allowance & {
  chainId: number;
  address: `0x${string}` | undefined;
  assetIn: `0x${string}`;
  assetOut: `0x${string}`;
  amountIn: bigint;
  minAmountOut: bigint;
  referralCode?: bigint;
}): ApproveThenActLeg {
  const psm = psm3L2Address[chainId as keyof typeof psm3L2Address];
  return {
    approve: { token: assetIn, spender: psm, amount: amountIn, ...allowance },
    calls: [
      getWriteContractCall({
        to: psm,
        abi: psm3L2Abi,
        functionName: 'swapExactIn',
        args: [assetIn, assetOut, amountIn, minAmountOut, address!, referralCode]
      })
    ]
  };
}

/** L2 PSM3: approve(assetIn → psm, up to `maxAmountIn`) → `swapExactOut`. */
export function psm3SwapExactOutLeg({
  chainId,
  address,
  assetIn,
  assetOut,
  amountOut,
  maxAmountIn,
  referralCode = 0n,
  ...allowance
}: Allowance & {
  chainId: number;
  address: `0x${string}` | undefined;
  assetIn: `0x${string}`;
  assetOut: `0x${string}`;
  amountOut: bigint;
  maxAmountIn: bigint;
  referralCode?: bigint;
}): ApproveThenActLeg {
  const psm = psm3L2Address[chainId as keyof typeof psm3L2Address];
  return {
    approve: { token: assetIn, spender: psm, amount: maxAmountIn, ...allowance },
    calls: [
      getWriteContractCall({
        to: psm,
        abi: psm3L2Abi,
        functionName: 'swapExactOut',
        args: [assetIn, assetOut, amountOut, maxAmountIn, address!, referralCode]
      })
    ]
  };
}

/** Mainnet PSM wrapper: approve(gem → wrapper) → `sellGem(usr, gemAmt)` (USDC → USDS). */
export function psmWrapperSellGemLeg({
  chainId,
  gem,
  recipient,
  gemAmt,
  ...allowance
}: Allowance & {
  chainId: number;
  gem: `0x${string}` | undefined;
  recipient: `0x${string}` | undefined;
  gemAmt: bigint;
}): ApproveThenActLeg {
  const wrapper = usdsPsmWrapperAddress[chainId as keyof typeof usdsPsmWrapperAddress];
  return {
    approve: { token: gem, spender: wrapper, amount: gemAmt, ...allowance },
    calls: [
      getWriteContractCall({
        to: wrapper,
        abi: usdsPsmWrapperAbi,
        functionName: 'sellGem',
        args: [recipient!, gemAmt]
      })
    ]
  };
}

/** Mainnet PSM wrapper: approve(USDS → wrapper, the wad) → `buyGem(usr, gemAmt)` (USDS → USDC). */
export function psmWrapperBuyGemLeg({
  chainId,
  usds,
  recipient,
  gemAmt,
  usdsAmountInWad,
  ...allowance
}: Allowance & {
  chainId: number;
  usds: `0x${string}` | undefined;
  recipient: `0x${string}` | undefined;
  gemAmt: bigint;
  usdsAmountInWad: bigint;
}): ApproveThenActLeg {
  const wrapper = usdsPsmWrapperAddress[chainId as keyof typeof usdsPsmWrapperAddress];
  return {
    approve: { token: usds, spender: wrapper, amount: usdsAmountInWad, ...allowance },
    calls: [
      getWriteContractCall({
        to: wrapper,
        abi: usdsPsmWrapperAbi,
        functionName: 'buyGem',
        args: [recipient!, gemAmt]
      })
    ]
  };
}
