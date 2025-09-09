import { createUseReadContract } from 'wagmi/codegen';
import stUsdsImplementationAbi from '../abis/stUsdsImplementationAbi';
import { stUsdsAddress } from '../generated';
import { Abi } from 'viem';

export { stUsdsAddress, stUsdsImplementationAbi };

// We make all calls to the proxy token address, but use the implementation ABI
export const useReadStUsdsImplementation = /*#__PURE__*/ createUseReadContract({
  abi: stUsdsImplementationAbi as Abi,
  address: stUsdsAddress
});
