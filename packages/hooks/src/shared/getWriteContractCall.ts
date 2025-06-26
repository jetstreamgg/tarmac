import { Abi, Call, ContractFunctionArgs, ContractFunctionName } from 'viem';

/**
 * Helper function to get type inference for `functionName` and `args` based on the ABI
 */
export function getWriteContractCall<
  const abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'>,
  args extends ContractFunctionArgs<abi, 'nonpayable' | 'payable', functionName>
>(parameters: { to: `0x${string}`; abi: abi; functionName: functionName; args: args }): Call {
  return parameters as Call;
}
