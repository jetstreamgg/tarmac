import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TransactionCard } from './TransactionCard';

describe('TransactionCard', () => {
  afterEach(cleanup);

  it('renders the header, badge, all fields and their labels', () => {
    render(
      <TransactionCard
        header={<span>Supply</span>}
        badge={<span>Completed</span>}
        fields={[
          { label: 'From', value: '1,000.00' },
          { label: 'To', value: '999.00' },
          { label: 'Time', value: '35 min ago' }
        ]}
      />
    );

    expect(screen.getByText('Supply')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    for (const text of ['From', '1,000.00', 'To', '999.00', 'Time', '35 min ago']) {
      expect(screen.getByText(text)).toBeTruthy();
    }
  });

  it('renders the footer link as a new-tab anchor that does not bubble clicks', () => {
    const onCardClick = vi.fn();
    render(
      <div onClick={onCardClick}>
        <TransactionCard
          header={<span>Supply</span>}
          link={{ label: 'View transaction', href: 'https://example.com/tx' }}
        />
      </div>
    );

    const anchor = screen.getByRole('link', { name: /View transaction/ });
    expect(anchor.getAttribute('href')).toBe('https://example.com/tx');
    expect(anchor.getAttribute('target')).toBe('_blank');
    fireEvent.click(anchor);
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('renders no footer button when no link is given', () => {
    render(<TransactionCard header={<span>Supply</span>} fields={[{ label: 'Amount', value: '1.00' }]} />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
