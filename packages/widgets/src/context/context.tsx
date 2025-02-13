import React from 'react';

// TODO move this file (along with its counterpart in hooks) into a tests helper package or something

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
          gateway: config?.ipfs.gateway || 'dweb.link' //nftstorage.link is an alternative
        }
      }}
    >
      {children}
    </MakerHooksContext.Provider>
  );
};
