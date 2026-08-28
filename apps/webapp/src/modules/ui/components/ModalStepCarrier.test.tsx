import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ModalStepCarrier, type ModalStepCarrierLayer } from './ModalStepCarrier';

afterEach(cleanup);

const layers = (): ModalStepCarrierLayer[] => [
  { key: 'entry', persistent: true, content: <div data-testid="entry-body">entry</div> },
  { key: 'review', content: <div data-testid="review-body">review</div> },
  { key: 'transaction', content: <div data-testid="tx-body">transaction</div> }
];

const layerFor = (testId: string) => screen.getByTestId(testId).closest('[data-step]') as HTMLElement;

describe('ModalStepCarrier', () => {
  it('draws only the active screen, with the others absent', () => {
    render(<ModalStepCarrier activeKey="entry" layers={layers()} />);

    expect(screen.getByTestId('entry-body')).toBeTruthy();
    expect(screen.queryByTestId('review-body')).toBeNull();
    expect(screen.queryByTestId('tx-body')).toBeNull();
    expect(layerFor('entry-body').dataset.step).toBe('active');
  });

  it('parks a persistent layer out of flow, inert and hidden from assistive tech', () => {
    const { rerender } = render(<ModalStepCarrier activeKey="entry" layers={layers()} />);
    rerender(<ModalStepCarrier activeKey="review" layers={layers()} />);

    const entry = layerFor('entry-body');
    expect(entry.dataset.step).toBe('exiting');
    expect(entry.className).toContain('absolute');
    expect(entry.className).toContain('invisible');
    expect(entry.className).toContain('pointer-events-none');
    expect(entry.getAttribute('aria-hidden')).toBe('true');
    expect(entry.hasAttribute('inert')).toBe(true);

    // ...and the incoming screen is the one that sizes the box.
    const review = layerFor('review-body');
    expect(review.dataset.step).toBe('active');
    expect(review.className).not.toContain('absolute');
  });

  it('keeps a persistent layer MOUNTED — the same DOM node — across every step', () => {
    // The entry body can own the in-flight engine hook and registers the modal's
    // portal slot by ref; remounting it strands the transaction and re-registers
    // the slot on every render.
    const { rerender } = render(<ModalStepCarrier activeKey="entry" layers={layers()} />);
    const node = screen.getByTestId('entry-body');

    rerender(<ModalStepCarrier activeKey="review" layers={layers()} />);
    rerender(<ModalStepCarrier activeKey="transaction" layers={layers()} />);
    rerender(<ModalStepCarrier activeKey="entry" layers={layers()} />);

    expect(screen.getByTestId('entry-body')).toBe(node);
  });

  it('never detaches a ref inside a persistent layer on re-render', () => {
    const ref = vi.fn();
    const withRef = (): ModalStepCarrierLayer[] => [
      { key: 'entry', persistent: true, content: <div ref={ref} data-testid="entry-body" /> },
      { key: 'review', content: <div data-testid="review-body">review</div> }
    ];
    const { rerender } = render(<ModalStepCarrier activeKey="entry" layers={withRef()} />);
    ref.mockClear();

    rerender(<ModalStepCarrier activeKey="review" layers={withRef()} />);
    rerender(<ModalStepCarrier activeKey="entry" layers={withRef()} />);

    expect(ref).not.toHaveBeenCalled();
  });

  it('swaps one transient screen for another', () => {
    const { rerender } = render(<ModalStepCarrier activeKey="review" layers={layers()} />);
    expect(screen.getByTestId('review-body')).toBeTruthy();

    rerender(<ModalStepCarrier activeKey="transaction" layers={layers()} />);
    expect(screen.getByTestId('tx-body')).toBeTruthy();
    expect(layerFor('tx-body').dataset.step).toBe('active');
  });

  it('tags every layer as a `step` group so its contents can choreograph their own exit', () => {
    render(<ModalStepCarrier activeKey="review" layers={layers()} />);
    expect(layerFor('review-body').className).toContain('group/step');
  });
});
