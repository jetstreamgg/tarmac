import { createUseReadContract } from 'wagmi/codegen';
import { stUsdsAddress, stUsdsImplementationAbi } from '../generated';

// We make all calls to the proxy token address, but use the implementation ABI
export const useReadStUsdsImplementation = /*#__PURE__*/ createUseReadContract({
  abi: stUsdsImplementationAbi,
  address: stUsdsAddress
});
