import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CellValue, type ModalGridCell } from './ModalGridCells';
import { splitFigure } from './CellFigure';

vi.mock('wagmi', () => ({ useChainId: () => 1 }));
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));
vi.mock('@/modules/ui/hooks/useChainImage', () => ({ useChainImage: () => undefined }));

const settle = () => screen.queryAllByTestId('rolling-digit-in').forEach(el => fireEvent.animationEnd(el));
const rolling = () => screen.queryAllByTestId('rolling-digit-in').map(el => el.textContent);
// What the cell reads once the outgoing digits have rolled away.
const shown = (node: Element) => {
  const copy = node.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[data-testid="rolling-digit-out"]').forEach(el => el.remove());
  return copy.textContent;
};

describe('splitFigure', () => {
  it('splits at the last digit, keeping any prefix with the figure', () => {
    expect(splitFigure('9,999.99 USDS')).toEqual(['9,999.99', ' USDS']);
    expect(splitFigure('6.50%')).toEqual(['6.50', '%']);
    expect(splitFigure('$1,234')).toEqual(['$1,234', '']);
    expect(splitFigure('<0.01 USDS')).toEqual(['<0.01', ' USDS']);
    expect(splitFigure('–')).toEqual(['', '–']);
    expect(splitFigure('26 Nov 2026')).toEqual(['', '26 Nov 2026']);
    expect(splitFigure('64 days')).toEqual(['64', ' days']);
  });
});

describe('CellValue', () => {
  it('rolls a delta’s right side as it changes and leaves the left side still', () => {
    const cell = (after: string): ModalGridCell => ({
      kind: 'delta',
      label: 'Supply',
      before: '100.00 USDS',
      after,
      token: 'USDS'
    });
    const { rerender, container } = render(<CellValue cell={cell('150.00 USDS')} />);
    expect(rolling()).toEqual([]);
    rerender(<CellValue cell={cell('1,500.00 USDS')} />);
    expect(shown(container)).toBe('100.00 USDS1,500.00 USDS');
    expect(rolling().length).toBeGreaterThan(0);
    // Only the right side's digits move; the unit and the current value don't.
    const moved = screen
      .getAllByTestId('rolling-digit-in')
      .map(el => el.closest('[data-testid="rolling-digits"]'));
    expect(new Set(moved).size).toBe(1);
    expect(moved[0] && shown(moved[0])).toBe('1,500.00');
    expect(screen.queryAllByTestId('rolling-digit-out').map(el => el.textContent)).not.toContain('U');
  });

  it('keeps a trailing unit and the rate’s percent sign still when the figure widens', () => {
    const { rerender } = render(
      <CellValue cell={{ kind: 'single', label: 'Rate', value: '9.50%', rateAccent: 'savings' }} />
    );
    rerender(<CellValue cell={{ kind: 'single', label: 'Rate', value: '10.25%', rateAccent: 'savings' }} />);
    const digits = screen.getByTestId('rolling-digits');
    expect(shown(digits)).toBe('10.25');
    expect(rolling().length).toBeGreaterThan(0);
    settle();
  });

  it('rolls a single value that changes and stays still when it does not', () => {
    const cell = (value: string): ModalGridCell => ({ kind: 'single', label: 'Receive at least', value });
    const { rerender } = render(<CellValue cell={cell('4.95 sUSDS')} />);
    rerender(<CellValue cell={cell('4.95 sUSDS')} />);
    expect(rolling()).toEqual([]);
    rerender(<CellValue cell={cell('9.90 sUSDS')} />);
    // Units 4→9 and hundredths 5→0 turn; the tenths digit is 9 either way.
    expect(rolling()).toEqual(['9', '0']);
  });

  it('rolls the first figure in when a dash gives way to a number', () => {
    const cell = (value: string): ModalGridCell => ({ kind: 'single', label: 'Claim at maturity', value });
    const { container, rerender } = render(<CellValue cell={cell('–')} />);
    expect(shown(container)).toBe('–');
    expect(rolling()).toEqual([]);
    rerender(<CellValue cell={cell('111.95')} />);
    expect(shown(container)).toBe('111.95');
    expect(rolling()).toEqual(['1', '1', '1', '9', '5']);
    settle();
    // …and back: the digits go, the dash shows, nothing rolls.
    rerender(<CellValue cell={cell('–')} />);
    expect(shown(container)).toBe('–');
    expect(rolling()).toEqual([]);
  });

  it('rolls a savings rate in from a dash and keeps the accent on the %', () => {
    const cell = (value: string): ModalGridCell => ({
      kind: 'single',
      label: 'Rate',
      value,
      rateAccent: 'savings'
    });
    const { container, rerender } = render(<CellValue cell={cell('–')} />);
    rerender(<CellValue cell={cell('4.86%')} />);
    expect(shown(container)).toBe('4.86%');
    expect(rolling()).toEqual(['4', '8', '6']);
  });

  it('shows a value without digits as plain text', () => {
    render(<CellValue cell={{ kind: 'single', label: 'Network', value: 'Ethereum' }} />);
    // The odometer waits, empty, so a figure that replaces the text rolls in.
    expect(screen.getByTestId('rolling-digits').textContent).toBe('');
    expect(screen.getByText('Ethereum')).toBeTruthy();
  });
});
