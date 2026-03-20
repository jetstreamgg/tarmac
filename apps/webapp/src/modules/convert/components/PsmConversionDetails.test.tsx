import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PsmConversionDetails } from './PsmConversionDetails';

vi.mock('@/data/banners/banners', () => ({
  getBannerById: () => ({
    id: 'about-11-conversions',
    title: 'About 1:1 Conversions',
    description: 'Test banner description'
  })
}));

vi.mock('@/utils/bannerContentParser', () => ({
  parseBannerContent: (text: string) => text
}));

vi.mock('@/modules/ui/components/AboutCard', () => ({
  AboutCard: ({ description }: { description: string }) => <div>{description}</div>
}));

vi.mock('./PsmConversionFaq', () => ({
  PsmConversionFaq: () => <div>psm-faq</div>
}));

describe('PsmConversionDetails', () => {
  it('renders the about and faq sections', () => {
    render(<PsmConversionDetails />);

    expect(screen.getByText('About 1:1 Conversions')).toBeTruthy();
    expect(screen.getByText('FAQs')).toBeTruthy();
    expect(screen.getByText('Test banner description')).toBeTruthy();
    expect(screen.getByText('psm-faq')).toBeTruthy();
  });
});
