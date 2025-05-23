import React from 'react';

export interface MakerHooksContextProps {
  delegates: {
    ens: string;
  };
  ipfs: {
    gateway: string;
  };
}

const MakerHooksContext = React.createContext<MakerHooksContextProps>({
  delegates: {
    ens: ''
  },
  ipfs: {
    gateway: 'dweb.link' //nftstorage.link is an alternative
  }
});

export const MakerHooksProvider = ({
  children,
  config
}: {
  children: React.ReactNode;
  config?: MakerHooksContextProps;
}): React.ReactElement => {
  return (
    <MakerHooksContext.Provider
      value={{
        delegates: {
          ens: config?.delegates.ens || ''
        },
        ipfs: {
          gateway: config?.ipfs.gateway || 'dweb.link'
        }
      }}
    >
      {children}
    </MakerHooksContext.Provider>
  );
};

export function useMakerHooks() {
  const { delegates, ipfs } = React.useContext(MakerHooksContext);
  if (!delegates.ens || !ipfs.gateway) {
    throw new Error(['`useMakerHooks` must be used within `MakerHooksProvider`.\n'].join('\n'));
  }
  return {
    delegates,
    ipfs
  };
}
