import { WidgetsConfig } from '@/widgets';

export type ThemeColor = {
  default: string;
  _dark?: string;
};

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
