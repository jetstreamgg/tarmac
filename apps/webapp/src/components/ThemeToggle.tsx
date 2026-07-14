import { Moon, Sun } from 'lucide-react';
import { Toggle } from './ui/toggle';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from './ui/tooltip';
import { Text } from '@/modules/layout/components/Typography';
import { t } from '@lingui/core/macro';
import { useThemeToggle } from '@/modules/ui/hooks/useThemeToggle';

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeToggle();
  const isLight = theme === 'light';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <Toggle
            variant="singleSwitcherBright"
            className="hidden h-10 w-10 rounded-xl p-0 md:flex"
            pressed={isLight}
            onPressedChange={toggleTheme}
            aria-label={t`Toggle light and dark theme`}
          >
            {isLight ? <Sun width={20} height={20} /> : <Moon width={20} height={20} />}
          </Toggle>
        </div>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent className="max-w-[220px]">
          <Text variant="small">{isLight ? t`Switch to dark mode` : t`Switch to light mode`}</Text>
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
