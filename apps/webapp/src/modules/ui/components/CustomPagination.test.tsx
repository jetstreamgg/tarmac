import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomPagination } from './CustomPagination';

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
    // (14 pages don't exist) after navigating near the end post-growth.
    fireEvent.click(screen.getByRole('button', { name: '13' }));
    expect(activePage()).toBe('13');
    expect(pageButtons()).toEqual(['1', '11', '12', '13']);
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
});
