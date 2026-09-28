import { useEffect } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthWrapper } from './AuthWrapper';

const h = vi.hoisted(() => ({
  connectedContext: { isAuthorized: true } as Record<string, unknown>
}));

vi.mock('@/modules/ui/context/ConnectedContext', () => ({
  useConnectedContext: () => h.connectedContext
}));

vi.mock('@/modules/auth/components/UnauthorizedPage', () => ({
  UnauthorizedPage: () => <div data-testid="unauthorized-page-stub" />
}));

afterEach(() => {
  cleanup();
  h.connectedContext = { isAuthorized: true };
});

describe('AuthWrapper', () => {
  // Screening runs on a transaction's first screen, so a block can land while
  // a flow is open. Remounting the page there dropped the open form and
  // re-opened URL-driven modals on top of the gate.
  it('keeps the page mounted when a block lands', () => {
    const mounts = vi.fn();
    const Page = () => {
      useEffect(mounts, []);
      return <div data-testid="page" />;
    };

    const { rerender } = render(
      <AuthWrapper>
        <Page />
      </AuthWrapper>
    );
    expect(screen.queryByTestId('unauthorized-page-stub')).toBeNull();

    h.connectedContext = { isAuthorized: false };
    rerender(
      <AuthWrapper>
        <Page />
      </AuthWrapper>
    );

    expect(screen.getByTestId('unauthorized-page-stub')).toBeTruthy();
    expect(screen.getByTestId('page')).toBeTruthy();
    expect(mounts).toHaveBeenCalledTimes(1);
  });
});
