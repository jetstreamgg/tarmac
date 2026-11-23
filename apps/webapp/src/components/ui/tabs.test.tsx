import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tabs, TabsList, TabsTrigger } from './tabs';

function renderTabs() {
  render(
    <Tabs defaultValue="a">
      <TabsList>
        <TabsTrigger value="a">A</TabsTrigger>
        <TabsTrigger value="b">B</TabsTrigger>
      </TabsList>
    </Tabs>
  );
  return screen.getByRole('tab', { name: 'B' });
}

describe('TabsTrigger', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('takes focus on a mouse press without the keyboard ring', () => {
    const trigger = renderTabs();
    const focus = vi.spyOn(trigger, 'focus');

    fireEvent.mouseDown(trigger, { button: 0 });

    expect(focus.mock.calls[0]).toEqual([{ focusVisible: false }]);
    expect(trigger.getAttribute('data-state')).toBe('active');
  });

  it('leaves focus and selection alone on a right click', () => {
    const trigger = renderTabs();
    const focus = vi.spyOn(trigger, 'focus');

    fireEvent.mouseDown(trigger, { button: 2 });

    expect(focus).not.toHaveBeenCalled();
    expect(trigger.getAttribute('data-state')).toBe('inactive');
  });
});
