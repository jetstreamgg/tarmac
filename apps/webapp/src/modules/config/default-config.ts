// Default configuration used site-wide

import { defaultConfig as widgetsConfig } from '@jetstreamgg/sky-widgets';
import { SiteConfig } from './types/site-config';
import {
  restrictedBalancesTokenList,
  restrictedBalancesTokenListMiCa,
  restrictedTradeTokenList
} from './tokenListConfig';
import { isExpertModulesEnabled } from '@/lib/feature-flags';
import { TOKENS } from '@jetstreamgg/sky-hooks';

const restrictedBuild = import.meta.env.VITE_RESTRICTED_BUILD === 'true';
const restrictedMiCa = import.meta.env.VITE_RESTRICTED_BUILD_MICA === 'true';

// stores all the RPCs the application will use, and also the user configured-ones
export const defaultConfig: SiteConfig = {
  ...widgetsConfig,
  balancesTokenList: isExpertModulesEnabled()
    ? widgetsConfig.balancesTokenList
    : // Filter out stUSDS if expert modules are disabled
      Object.entries(widgetsConfig.balancesTokenList).reduce(
        (acc, [chainId, tokens]) => {
          acc[Number(chainId)] = tokens.filter(token => token.symbol !== TOKENS.stusds.symbol);
          return acc;
        },
        {} as typeof widgetsConfig.balancesTokenList
      ),
  name: 'Sky',
  description: 'Get rewarded for saving, without giving up control',
  daiSavingsReferral: 0,
  logo: '/images/header-lg.png',
  favicon: '/images/sky.svg',
  ...(restrictedBuild
    ? {
        tradeTokenList: restrictedTradeTokenList,
        balancesTokenList: restrictedBalancesTokenList
      }
    : {}),
  ...(restrictedMiCa ? { balancesTokenList: restrictedBalancesTokenListMiCa } : {}),
  locale: 'en'
};
