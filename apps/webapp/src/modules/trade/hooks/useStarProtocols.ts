import { getProtocolConfig } from '../config/starProtocols';

export const useStarProtocols = () => {
  const protocols = getProtocolConfig();
  const activeProtocols = protocols.filter(p => p.enabled);

  return {
    protocols,
    activeProtocols
  };
};
