// Default configuration used site-wide

import { defaultConfig as widgetsConfig } from '@jetstreamgg/sky-widgets';
import { SiteConfig } from './types/site-config';
import {
  restrictedTokenList,
  restrictedTokenListMiCa,
  restrictedTokenListTrade
} from './restrictedTokenList';

const restrictedBuild = import.meta.env.VITE_RESTRICTED_BUILD === 'true';
const restrictedMiCa = import.meta.env.VITE_RESTRICTED_BUILD_MICA === 'true';

// stores all the RPCs the application will use, and also the user configured-ones
export const defaultConfig: SiteConfig = {
  ...widgetsConfig,
  name: 'Sky',
  description: 'Get rewarded for saving, without giving up control',
  daiSavingsReferral: 0,
  logo: '/images/header-lg.png',
  favicon: '/images/sky.svg',
  ...(restrictedBuild
    ? {
        tradeTokenList: restrictedTokenListTrade,
        balancesTokenList: restrictedTokenList
      }
    : {}),
  ...(restrictedMiCa ? { balancesTokenList: restrictedTokenListMiCa } : {}),
  locale: 'en'
};
