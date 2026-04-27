import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { PsmConversionDetails } from './PsmConversionDetails';

i18n.load('en', {});
i18n.activate('en');

vi.mock('@/modules/ui/components/AboutPsmConversion', () => ({
  AboutPsmConversion: () => <div>about-psm-conversion</div>
}));

vi.mock('./PsmConversionFaq', () => ({
  PsmConversionFaq: () => <div>psm-faq</div>
}));

describe('PsmConversionDetails', () => {
  it('renders the about and faq sections', () => {
    render(
      <I18nProvider i18n={i18n}>
        <PsmConversionDetails />
      </I18nProvider>
    );

    expect(screen.getByText('About')).toBeTruthy();
    expect(screen.getByText('FAQs')).toBeTruthy();
    expect(screen.getByText('about-psm-conversion')).toBeTruthy();
    expect(screen.getByText('psm-faq')).toBeTruthy();
  });
});
