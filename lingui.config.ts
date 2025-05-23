import type { LinguiConfig } from '@lingui/conf';
import { formatter } from '@lingui/format-po';
import { locales } from './supportedLocales';

const config: LinguiConfig = {
  locales,
  catalogs: [
    {
      path: '<rootDir>/packages/utils/src/locales/{locale}',
      include: ['apps/webapp/src', 'packages/widgets/src']
    }
  ],
  format: formatter({ lineNumbers: false }),
  compileNamespace: 'ts'
};

export default config;
