import { WidgetsConfig } from './widgets-config';

export type SiteConfig = WidgetsConfig & {
  name: string;
  description: string;
  daiSavingsReferral: number;
  /** Header logo for dark mode (the default theme). */
  logo: string;
  /** Header logo for light mode. */
  logoLight: string;
  favicon: string;
  locale: string | undefined;
};
