import { createUseWriteContract } from 'wagmi/codegen';
import { stUsdsAddress, stUsdsImplementationAbi } from '../generated';

// We make all calls to the proxy token address, but use the implementation ABI
export const useWriteStUsdsImplementation = /*#__PURE__*/ createUseWriteContract({
  abi: stUsdsImplementationAbi,
  address: stUsdsAddress
});
