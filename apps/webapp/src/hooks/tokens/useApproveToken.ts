import { useChainId } from 'wagmi';
import { erc20Abi } from 'viem';
import { WriteHook, WriteHookParams } from '../hooks';
import { useConnection } from 'wagmi';
import { usdtAbi, usdtAddress } from '../generated';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';

// Returns the tx hash
type ApproveHookParams = WriteHookParams & {
  contractAddress?: `0x${string}`;
  spender?: `0x${string}`;
  amount?: bigint;
};
export function useApproveToken({
  contractAddress,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  spender,
  amount,
  gas,
  enabled: paramEnabled = true
}: ApproveHookParams): WriteHook {
  const chainId = useChainId();
  const { isConnected } = useConnection();
  const isUsdt = contractAddress === usdtAddress[chainId as keyof typeof usdtAddress];

  const enabled = isConnected && !!spender && !!amount && paramEnabled;

  return useWriteContractFlow({
    // Token contract address
    address: contractAddress,
    // USDT's ABI slightly differs from the standard ERC20 ABI, using the ERC20 one causes the simulation to fail
    abi: isUsdt ? usdtAbi : erc20Abi,
    functionName: 'approve',
    // spender is the contract address of the contract that will spend the tokens
    args: [spender!, amount!],
    gas,
    enabled,
    scopeKey: `${contractAddress}-approve-${spender}-${amount}-${chainId}`,
    chainId,
    onMutate,
    onSuccess,
    onError,
    onStart
  });
}
