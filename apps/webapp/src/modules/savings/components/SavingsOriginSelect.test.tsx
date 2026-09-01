import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

// TokenIcon hits network/asset resolution; stub it so the chip renders text-only.
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { SavingsOriginSelect, type OriginSymbol } from './SavingsOriginSelect';

const renderSelect = (options: OriginSymbol[], value: OriginSymbol = 'USDS') =>
  render(
    <I18nProvider i18n={i18n}>
      <SavingsOriginSelect value={value} options={options} onChange={() => {}} />
    </I18nProvider>
  );

describe('SavingsOriginSelect', () => {
  afterEach(() => cleanup());

  it('renders a dropdown trigger showing the selected token when there is a choice', () => {
    renderSelect(['USDS', 'DAI']);
    const trigger = screen.getByTestId('savings-origin-select');
    // Radix renders the trigger as a <button role="combobox">.
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.textContent).toContain('USDS');
  });

  it('collapses to a static chip (no dropdown affordance) when there is only one option', () => {
    renderSelect(['USDS']);
    const chip = screen.getByTestId('savings-origin-select');
    expect(chip.tagName).toBe('DIV');
    expect(chip.textContent).toContain('USDS');
  });

  it('reflects the selected value (DAI) in the trigger', () => {
    renderSelect(['USDS', 'DAI'], 'DAI');
    expect(screen.getByTestId('savings-origin-select').textContent).toContain('DAI');
  });
});
