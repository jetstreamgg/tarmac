import { useIsSafeWallet } from './useIsSafeWallet';

export const useIsSmartContractWallet = () => {
  const isSafeWallet = useIsSafeWallet();

  // Eventually we can add more checks here for other types of wallets
  return isSafeWallet;
};
