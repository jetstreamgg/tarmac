import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ModalStepBackSlot, ModalStepLabel } from './ModalStepChrome';

afterEach(cleanup);

describe('ModalStepLabel', () => {
  it('renders one copy of the label at rest', () => {
    render(<ModalStepLabel labelKey="entry">Supply to Sky Savings</ModalStepLabel>);
    expect(screen.getAllByText('Supply to Sky Savings')).toHaveLength(1);
  });

  it('rolls: the outgoing copy leaves flow and the accessibility tree, the incoming one sizes the box', () => {
    const { rerender } = render(<ModalStepLabel labelKey="entry">Supply to Sky Savings</ModalStepLabel>);
    rerender(<ModalStepLabel labelKey="review">Review supply</ModalStepLabel>);

    const incoming = screen.getByText('Review supply');
    expect(incoming.getAttribute('aria-hidden')).toBe('false');
    expect(incoming.className).not.toContain('absolute');

    const outgoing = screen.queryByText('Supply to Sky Savings');
    if (outgoing) {
      expect(outgoing.getAttribute('aria-hidden')).toBe('true');
      expect(outgoing.className).toContain('absolute');
      expect(outgoing.className).toContain('pointer-events-none');
    }
  });

  it('does not roll when the label changes but the key does not', () => {
    const { rerender } = render(<ModalStepLabel labelKey="entry">Review</ModalStepLabel>);
    rerender(<ModalStepLabel labelKey="entry">Connect wallet</ModalStepLabel>);

    expect(screen.getAllByText('Connect wallet')).toHaveLength(1);
    expect(screen.queryByText('Review')).toBeNull();
  });

  it('fills its box when centred, so both copies share one centre', () => {
    render(
      <ModalStepLabel labelKey="entry" align="center">
        Review
      </ModalStepLabel>
    );
    expect(screen.getByText('Review').className).toContain('text-center');
  });
});

describe('ModalStepBackSlot', () => {
  it('holds nothing while closed', () => {
    render(
      <ModalStepBackSlot open={false}>
        <button>Back</button>
      </ModalStepBackSlot>
    );
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('mounts the button once open', () => {
    const { rerender } = render(
      <ModalStepBackSlot open={false}>
        <button>Back</button>
      </ModalStepBackSlot>
    );
    rerender(
      <ModalStepBackSlot open>
        <button>Back</button>
      </ModalStepBackSlot>
    );
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
  });
});
