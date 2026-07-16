import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nWidgetProvider } from '@/widgets/context/I18nWidgetProvider';
import { ThemeToggle } from './ThemeToggle';

const mocks = vi.hoisted(() => ({
  theme: 'dark' as 'dark' | 'light',
  toggleTheme: vi.fn()
}));

vi.mock('@/modules/ui/hooks/useThemeToggle', () => ({
  useThemeToggle: () => ({ theme: mocks.theme, toggleTheme: mocks.toggleTheme })
}));

function renderToggle() {
  render(
    <I18nWidgetProvider locale="en">
      <ThemeToggle />
    </I18nWidgetProvider>
  );
}

beforeEach(() => {
  mocks.theme = 'dark';
  mocks.toggleTheme.mockClear();
});

describe('ThemeToggle', () => {
  it('renders the Dark mode row with the switch on while the theme is dark', async () => {
    renderToggle();
    expect(await screen.findByText('Dark mode')).toBeTruthy();
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('shows the switch off in light mode', async () => {
    mocks.theme = 'light';
    renderToggle();
    expect((await screen.findByRole('switch')).getAttribute('aria-checked')).toBe('false');
  });

  it('toggles the theme when the switch is clicked', async () => {
    renderToggle();
    fireEvent.click(await screen.findByRole('switch'));
    expect(mocks.toggleTheme).toHaveBeenCalledTimes(1);
  });
});
