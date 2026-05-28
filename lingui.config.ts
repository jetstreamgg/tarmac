import type { LinguiConfig } from '@lingui/conf';
import { formatter } from '@lingui/format-po';
import { locales } from './supportedLocales';

const config: LinguiConfig = {
  locales,
  catalogs: [
    {
      path: '<rootDir>/apps/webapp/src/locales/{locale}',
      include: ['apps/webapp/src']
    }
  ],
  format: formatter({ lineNumbers: false }),
  compileNamespace: 'ts'
};

export default config;
