import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResponsiveTooltip } from './tooltip';

afterEach(cleanup);

const renderInRow = (onRowClick: () => void) =>
  render(
    <div onClick={onRowClick}>
      <ResponsiveTooltip
        trigger={
          <button type="button" data-testid="trigger">
            i
          </button>
        }
      >
        <span data-testid="content">Tooltip copy</span>
      </ResponsiveTooltip>
    </div>
  );

describe('ResponsiveTooltip (pointer device)', () => {
  it('stays open when its trigger is clicked, and the click does not reach the parent row', async () => {
    const onRowClick = vi.fn();
    renderInRow(onRowClick);
    const trigger = screen.getByTestId('trigger');

    fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
    act(() => trigger.focus());
    fireEvent.click(trigger);

    expect(await screen.findAllByText('Tooltip copy')).not.toHaveLength(0);
    expect(trigger.getAttribute('data-state')).not.toBe('closed');
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('gives every trigger the pointer cursor', () => {
    renderInRow(vi.fn());
    expect(screen.getByTestId('trigger').className).toContain('cursor-pointer');
  });

  it('keeps clicks inside the content from reaching the parent row', async () => {
    const onRowClick = vi.fn();
    renderInRow(onRowClick);
    act(() => screen.getByTestId('trigger').focus());

    fireEvent.click(await screen.findByTestId('content'));
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
