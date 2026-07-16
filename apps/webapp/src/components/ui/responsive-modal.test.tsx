import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ isBottomSheet: false }));

// The single Dialog ↔ Sheet switch reads the breakpoint tier; drive it directly
// so a test can pin the modal to either tier without a real matchMedia viewport.
vi.mock('@/hooks/ui/useBreakpoint', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/ui/useBreakpoint')>();
  return {
    ...actual,
    useBreakpointIndex: () => ({ bpi: h.isBottomSheet ? actual.BP.sm : actual.BP.md })
  };
});

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalTrigger
} from './responsive-modal';

const renderModal = (contentProps: { showCloseButton?: boolean } = {}) =>
  render(
    <ResponsiveModal open>
      <ResponsiveModalTrigger>Open</ResponsiveModalTrigger>
      <ResponsiveModalContent {...contentProps}>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Modal title</ResponsiveModalTitle>
          <ResponsiveModalDescription>Modal description</ResponsiveModalDescription>
        </ResponsiveModalHeader>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );

const sheetContent = () => document.querySelector('[data-slot="sheet-content"]');

describe('ResponsiveModal', () => {
  afterEach(() => cleanup());

  it('renders a Dialog (no bottom Sheet) at/above the desktop tier', () => {
    h.isBottomSheet = false;
    renderModal();

    expect(screen.getByText('Modal title')).not.toBeNull();
    expect(sheetContent()).toBeNull();
  });

  it('renders a bottom Sheet below the tier', () => {
    h.isBottomSheet = true;
    renderModal();

    expect(screen.getByText('Modal title')).not.toBeNull();
    expect(sheetContent()).not.toBeNull();
  });

  it('mirrors Dialog by shipping no built-in close button on the Sheet by default', () => {
    h.isBottomSheet = true;
    renderModal();

    expect(screen.queryByText('Close')).toBeNull();
  });

  it('renders the Sheet close button when showCloseButton is set', () => {
    h.isBottomSheet = true;
    renderModal({ showCloseButton: true });

    expect(screen.queryByText('Close')).not.toBeNull();
  });
});
