import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { Theme } from '@/modules/config/types/user-config';
import { DEFAULT_THEME } from '@/lib/theme';

export function useThemeToggle() {
  const { userConfig, updateUserConfig } = useConfigContext();
  const theme = userConfig.theme ?? DEFAULT_THEME;

  const setTheme = (next: Theme) => {
    updateUserConfig({ ...userConfig, theme: next });
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return { theme, setTheme, toggleTheme } as const;
}
