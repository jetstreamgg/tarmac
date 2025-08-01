import { useAccount } from 'wagmi';

const METAMASK_CONNECTOR_ID = 'io.metamask';

export const useIsMetaMaskWallet = () => {
  const { connector } = useAccount();

  return connector?.id === METAMASK_CONNECTOR_ID;
};
