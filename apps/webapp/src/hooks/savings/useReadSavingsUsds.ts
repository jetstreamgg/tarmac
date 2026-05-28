import { createUseReadContract } from 'wagmi/codegen';
import { sUsdsImplementationAbi, sUsdsAddress } from '../generated';

export { sUsdsAddress, sUsdsImplementationAbi } from '../generated';

// We make all calls to the proxy token address, but use the implementation ABI
export const useReadSavingsUsds = /*#__PURE__*/ createUseReadContract({
  abi: sUsdsImplementationAbi,
  address: sUsdsAddress
});

export const useReadSavingsUsdsMaxWithdraw = /*#__PURE__*/ createUseReadContract({
  abi: sUsdsImplementationAbi,
  address: sUsdsAddress,
  functionName: 'maxWithdraw'
});
