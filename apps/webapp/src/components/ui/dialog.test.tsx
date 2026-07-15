import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Dialog, DialogContent, DialogTitle } from './dialog';

afterEach(cleanup);

describe('DialogContent', () => {
  it('caps its height and scrolls internally so tall modals fit the viewport', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    const content = screen.getByRole('dialog');
    expect(content.className).toContain('max-h-[calc(100dvh-2rem)]');
    expect(content.className).toContain('overflow-y-auto');
  });
});
