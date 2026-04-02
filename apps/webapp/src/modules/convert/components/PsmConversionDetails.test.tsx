import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PsmConversionDetails } from './PsmConversionDetails';

vi.mock('@/modules/ui/components/AboutUsds', () => ({
  AboutUsds: () => <div>about-usds</div>
}));

vi.mock('./PsmConversionFaq', () => ({
  PsmConversionFaq: () => <div>psm-faq</div>
}));

describe('PsmConversionDetails', () => {
  it('renders the about and faq sections', () => {
    render(<PsmConversionDetails />);

    expect(screen.getByText('About USDS')).toBeTruthy();
    expect(screen.getByText('FAQs')).toBeTruthy();
    expect(screen.getByText('about-usds')).toBeTruthy();
    expect(screen.getByText('psm-faq')).toBeTruthy();
  });
});
