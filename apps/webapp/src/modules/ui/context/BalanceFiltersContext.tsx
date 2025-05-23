import React, { createContext, useContext, useState } from 'react';

type BalanceFiltersContextType = {
  showAllNetworks: boolean;
  setShowAllNetworks: (value: boolean) => void;
  hideZeroBalances: boolean;
  setHideZeroBalances: (value: boolean) => void;
};

const BalanceFiltersContext = createContext<BalanceFiltersContextType>({
  showAllNetworks: false,
  setShowAllNetworks: () => {},
  hideZeroBalances: true,
  setHideZeroBalances: () => {}
});

export const BalanceFiltersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showAllNetworks, setShowAllNetworks] = useState(true);
  const [hideZeroBalances, setHideZeroBalances] = useState(false);

  return (
    <BalanceFiltersContext.Provider
      value={{
        showAllNetworks,
        setShowAllNetworks,
        hideZeroBalances,
        setHideZeroBalances
      }}
    >
      {children}
    </BalanceFiltersContext.Provider>
  );
};

export const useBalanceFilters = () => useContext(BalanceFiltersContext);
