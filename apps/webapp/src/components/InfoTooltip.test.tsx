import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TooltipBody } from './InfoTooltip';

afterEach(cleanup);

describe('TooltipBody', () => {
  it('keeps titled copy with an inline link in one block under the title', () => {
    render(
      <TooltipBody title="Delayed Upgrade Penalty">
        <>
          The penalty is described <a href="https://example.com">here</a> and grows over time.
        </>
      </TooltipBody>
    );

    const column = screen.getByText('Delayed Upgrade Penalty').parentElement!;
    // Title + one body block: the text runs and the link are not separate flex items.
    expect(column.children).toHaveLength(2);
    expect(column.children[1].textContent).toBe('The penalty is described here and grows over time.');
  });
});
