import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Popover, PopoverContent, PopoverTrigger, PopoverWidgetContent } from './popover';

const CLAMP = 'max-w-[min(var(--radix-popover-content-available-width),calc(100vw_-_2rem))]';

afterEach(cleanup);

describe('PopoverContent', () => {
  it('clamps its width to the viewport so it never renders off-screen at 360px', () => {
    render(
      <Popover open>
        <PopoverTrigger>open</PopoverTrigger>
        <PopoverContent data-testid="pc">content</PopoverContent>
      </Popover>
    );
    expect(screen.getByTestId('pc').className).toContain(CLAMP);
  });

  it('keeps the clamp when a consumer overrides the fixed width', () => {
    render(
      <Popover open>
        <PopoverTrigger>open</PopoverTrigger>
        <PopoverContent data-testid="pc" className="w-[330px]">
          content
        </PopoverContent>
      </Popover>
    );
    const cls = screen.getByTestId('pc').className;
    expect(cls).toContain('w-[330px]');
    expect(cls).toContain(CLAMP);
  });
});

describe('PopoverWidgetContent', () => {
  it('clamps its width to the viewport', () => {
    render(
      <Popover open>
        <PopoverTrigger>open</PopoverTrigger>
        <PopoverWidgetContent data-testid="pw">content</PopoverWidgetContent>
      </Popover>
    );
    expect(screen.getByTestId('pw').className).toContain(CLAMP);
  });
});
