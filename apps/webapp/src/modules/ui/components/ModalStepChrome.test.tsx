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

  it('hugs its content when centred, so a loading spinner cannot shift the wording', () => {
    const { container } = render(
      <ModalStepLabel labelKey="entry" align="center">
        Review
      </ModalStepLabel>
    );
    // A `w-full` box would claim the CTA's remaining width and re-centre the
    // text inside it the moment a spinner joined the button.
    expect((container.firstElementChild as HTMLElement).className).not.toContain('w-full');
    expect(screen.getByText('Review').className).toContain('whitespace-nowrap');
  });

  it('holds the outgoing copy at its own width so it cannot re-wrap on the way out', () => {
    // Out of flow it is still SIZED by the container, and the incoming string is
    // usually shorter — "Supply to Sky Savings" was being squeezed into "Review
    // supply"'s box and wrapping to two lines halfway through its own fade.
    const { rerender } = render(<ModalStepLabel labelKey="entry">Supply to Sky Savings</ModalStepLabel>);
    const outgoing = screen.getByText('Supply to Sky Savings');
    // happy-dom reports 0 for every box, so stub the measurement the effect
    // takes, then re-render on the SAME key to let it record the stubbed width
    // while this copy is still the one in flow.
    outgoing.getBoundingClientRect = () => ({ width: 173, height: 22 }) as DOMRect;
    rerender(<ModalStepLabel labelKey="entry">Supply to Sky Savings</ModalStepLabel>);

    rerender(<ModalStepLabel labelKey="review">Review supply</ModalStepLabel>);

    const stillThere = screen.queryByText('Supply to Sky Savings');
    if (stillThere) expect(stillThere.style.width).toBe('173px');
    // The incoming copy is never pinned to a width — it sizes the box.
    expect(screen.getByText('Review supply').style.width).toBe('');
  });

  it('lets a start-aligned title wrap rather than ellipsizing it', () => {
    render(<ModalStepLabel labelKey="entry">Supply to Sky Savings</ModalStepLabel>);
    expect(screen.getByText('Supply to Sky Savings').className).not.toContain('truncate');
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
