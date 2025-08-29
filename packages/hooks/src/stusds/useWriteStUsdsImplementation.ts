import { createUseWriteContract } from 'wagmi/codegen';
import stUsdsImplementationAbi from '../abis/stUsdsImplementationAbi';
import { stUsdsAddress } from '../generated';
import { Abi } from 'viem';

// We make all calls to the proxy token address, but use the implementation ABI
export const useWriteStUsdsImplementation = /*#__PURE__*/ createUseWriteContract({
  abi: stUsdsImplementationAbi as Abi,
  address: stUsdsAddress
});
