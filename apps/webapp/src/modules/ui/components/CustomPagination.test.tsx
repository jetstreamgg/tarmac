import { ReactElement } from 'react';
import { render as rtlRender, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { CustomPagination } from './CustomPagination';

i18n.load('en', {});
i18n.activate('en');

// The mobile "Page x of y" label is a lingui message, so every render needs
// the provider.
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider i18n={i18n}>{children}</I18nProvider>
);
const render = (ui: ReactElement) => rtlRender(ui, { wrapper });

const pageButtons = () =>
  screen
    .queryAllByRole('button')
    .map(button => button.textContent!.trim())
    .filter(text => /^\d+$/.test(text));

const activePage = () => screen.queryByRole('button', { current: 'page' })?.textContent?.trim();

describe('CustomPagination — derived window over a live dataLength', () => {
  afterEach(cleanup);

  it('keeps the current page visible and active when dataLength grows mid-interaction', () => {
    const onPageChange = vi.fn();
    // 25 rows / 5 per page → 5 pages.
    const { rerender } = render(<CustomPagination dataLength={25} onPageChange={onPageChange} />);
    expect(pageButtons()).toEqual(['1', '2', '3', '4', '5']);

    fireEvent.click(screen.getByRole('button', { name: '5' }));
    expect(onPageChange).toHaveBeenCalledWith(5);

    // A keyset source appends rows: 65 rows → 13 pages. The window must
    // re-derive around the page the user is on (with its neighbors, matching
    // the production run of adjacent pages), not keep a stale layout.
    rerender(<CustomPagination dataLength={65} onPageChange={onPageChange} />);
    expect(activePage()).toBe('5');
    expect(pageButtons()).toEqual(['1', '4', '5', '6', '13']);
  });

  it('never renders page numbers beyond the total', () => {
    const onPageChange = vi.fn();
    const { rerender } = render(<CustomPagination dataLength={25} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    rerender(<CustomPagination dataLength={65} onPageChange={onPageChange} />);

    // Regression: the stateful implementation drifted into showing "12 13 14"
    // (14 pages don't exist) after navigating near the end post-growth. The
    // tail window is the DS comp's three-and-three shape.
    fireEvent.click(screen.getByRole('button', { name: '13' }));
    expect(activePage()).toBe('13');
    expect(pageButtons()).toEqual(['1', '2', '3', '11', '12', '13']);
    expect(screen.getByRole('button', { name: 'Go to next page' })).toHaveProperty('disabled', true);
  });

  it('clamps the current page when dataLength shrinks', () => {
    const onPageChange = vi.fn();
    const { rerender } = render(<CustomPagination dataLength={25} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: '5' }));

    rerender(<CustomPagination dataLength={10} onPageChange={onPageChange} />);
    expect(activePage()).toBe('2');
    expect(pageButtons()).toEqual(['1', '2']);
  });

  it('walks forward across a growth boundary without losing its place', () => {
    const onPageChange = vi.fn();
    const { rerender } = render(<CustomPagination dataLength={25} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    rerender(<CustomPagination dataLength={65} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(6);
    expect(activePage()).toBe('6');
    expect(pageButtons()).toEqual(['1', '5', '6', '7', '13']);
  });

  it('shows the head-and-tail window while the current page sits at either end', () => {
    // 50 rows / 5 per page → 10 pages: the DS comp's "1 2 3 … 8 9 10".
    render(<CustomPagination dataLength={50} onPageChange={vi.fn()} />);
    expect(pageButtons()).toEqual(['1', '2', '3', '8', '9', '10']);
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    expect(pageButtons()).toEqual(['1', '2', '3', '8', '9', '10']);
  });

  it('renders the mobile "Page x of y" label alongside the numbered window', () => {
    render(<CustomPagination dataLength={50} onPageChange={vi.fn()} />);
    expect(screen.getByText('Page 1 of 10')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(screen.getByText('Page 2 of 10')).toBeTruthy();
  });
});
