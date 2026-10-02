import { createUseReadContract } from 'wagmi/codegen';
import { stUsdsAddress, stUsdsImplementationAbi } from '../generated';

// Reads the implementation ABI at the PROXY address, where the state lives.
// Not interchangeable with the generated `useReadStUsdsImplementation`, which
// targets the bare implementation contract and returns empty storage.
export const useReadStUsdsProxy = /*#__PURE__*/ createUseReadContract({
  abi: stUsdsImplementationAbi,
  address: stUsdsAddress
});
