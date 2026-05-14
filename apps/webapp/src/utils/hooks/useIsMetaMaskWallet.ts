import { useConnection } from 'wagmi';

const METAMASK_CONNECTOR_ID = 'io.metamask';

export const useIsMetaMaskWallet = () => {
  const { connector } = useConnection();

  return connector?.id === METAMASK_CONNECTOR_ID;
};
