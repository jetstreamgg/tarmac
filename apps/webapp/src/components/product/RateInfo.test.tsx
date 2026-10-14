import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RateInfo } from './RateInfo';

// happy-dom reports no touch support; flip per test to reach the tap branch.
const device = vi.hoisted(() => ({ isTouch: false }));
vi.mock('@/hooks/ui/useIsTouchDevice', () => ({ useIsTouchDevice: () => device.isTouch }));

describe('RateInfo — the rate explainer on the design-system Tooltip (Design QA 3314:135504)', () => {
  afterEach(() => {
    device.isTouch = false;
    cleanup();
  });

  it('taps open the titled copy on touch, on the tooltip chrome with no close button', () => {
    device.isTouch = true;
    render(<RateInfo type="sbr" />);

    fireEvent.click(screen.getByLabelText('Show additional information'));

    const title = screen.getByText('Borrow Rate');
    expect(title.className).toContain('font-circle');
    const body = screen.getByText(/determined by Sky Governance/);
    expect(body.parentElement?.className).toContain('text-fgSecondary');
    expect(screen.queryByRole('button', { name: /close/i })).toBeNull();
    expect(
      title.closest('[data-radix-popper-content-wrapper]')?.querySelector('.bg-bgTertiary')
    ).not.toBeNull();
  });

  it('keeps the copy out of the resting glyph', () => {
    render(<RateInfo type="ssr" />);

    expect(screen.queryByText('Sky Savings Rate')).toBeNull();
  });

  it('renders nothing for a key with no copy', () => {
    const { container } = render(<RateInfo type={'nope' as never} />);

    expect(container.innerHTML).toBe('');
  });
});
