import { Moon } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Switch } from './ui/switch';
import { useThemeToggle } from '@/modules/ui/hooks/useThemeToggle';

/**
 * "Dark mode" row of the nav Menu dropdown (Figma 5233:10233): 16px moon
 * glyph + Label 5 text left, S-size switch right — on while dark mode is.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeToggle();

  return (
    <div className="flex w-full items-center justify-between">
      <span className="text-fgPrimary font-circle flex items-center gap-2 text-sm leading-4 font-medium tracking-[-0.28px]">
        <Moon size={16} className="text-fgBrand shrink-0" />
        <Trans>Dark mode</Trans>
      </span>
      <Switch
        size="sm"
        checked={theme === 'dark'}
        onCheckedChange={toggleTheme}
        aria-label={t`Toggle light and dark theme`}
        data-testid="dark-mode-switch"
      />
    </div>
  );
}
