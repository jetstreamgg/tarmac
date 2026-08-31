import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { parseBannerContent } from './bannerContentParser';

vi.mock('@/widgets', () => ({
  PopoverRateInfo: ({ type }: { type: string }) => <span data-testid={`tooltip-${type}`} />,
  resolvePopoverTooltipKey: (raw: string) => (raw === 'psm' ? 'psm' : undefined)
}));

i18n.load('en', {});
i18n.activate('en');

const renderContent = (text: string) =>
  render(<I18nProvider i18n={i18n}>{parseBannerContent(text)}</I18nProvider>);

describe('parseBannerContent', () => {
  it('renders markdown links as external anchors', () => {
    renderContent('SPK is the token of [Spark.fi](https://Spark.fi). More text.');
    const link = screen.getByRole('link', { name: 'Spark.fi' });
    expect(link.getAttribute('href')).toBe('https://Spark.fi');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(screen.getByText(/More text\./)).toBeTruthy();
    expect(screen.queryByText(/\]\(/)).toBeNull();
  });

  it('still renders tooltip placeholders alongside links', () => {
    renderContent('Uses the [PSM](#tooltip-psm) and [docs](https://docs.sky.money).');
    expect(screen.getByTestId('tooltip-psm')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'docs' }).getAttribute('href')).toBe('https://docs.sky.money');
  });

  it('returns plain text untouched', () => {
    renderContent('Just text.');
    expect(screen.getByText('Just text.')).toBeTruthy();
  });
});
