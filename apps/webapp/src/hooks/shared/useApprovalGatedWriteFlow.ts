import { Config, ResolvedRegister } from '@wagmi/core';
import type { Abi, ContractFunctionArgs, ContractFunctionName } from 'viem';
import type { UseWriteContractFlowParameters, WriteHook } from '../hooks';
import { useWriteContractFlow } from './useWriteContractFlow';

/**
 * `useWriteContractFlow` for a single write that the caller only enables once
 * an allowance covers it: the allowance read's error surfaces as the prepare
 * error when the simulation itself has none, so a failed read reads as
 * "cannot prepare" rather than silently disabling the flow.
 */
export function useApprovalGatedWriteFlow<
  const abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'>,
  args extends ContractFunctionArgs<abi, 'nonpayable' | 'payable', functionName>,
  config extends Config = ResolvedRegister['config'],
  chainId extends config['chains'][number]['id'] | undefined = undefined
>({
  allowanceError,
  ...parameters
}: UseWriteContractFlowParameters<abi, functionName, args, config, chainId> & {
  /** The allowance read's error, reported when the simulation has none. */
  allowanceError: Error | null;
}): WriteHook {
  // `Omit` on wagmi's parameter union loses the discriminant; the spread only
  // removed `allowanceError`, so the rest IS the flow's parameter type.
  const writeContractFlowResults = useWriteContractFlow(
    parameters as unknown as UseWriteContractFlowParameters<abi, functionName, args, config, chainId>
  );

  return {
    ...writeContractFlowResults,
    prepareError: writeContractFlowResults.prepareError || allowanceError
  };
}
