import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The real Layout drags in the whole shell (wagmi, config, nav); the test only
// asserts whether ErrorPage adds a Layout of its own or renders bare.
vi.mock('../modules/layout/components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div data-testid="own-layout">{children}</div>
}));

vi.mock('@/lib/navigation', () => ({
  AppLink: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>
}));

vi.mock('@/modules/sentry/reportError', () => ({
  reportError: vi.fn()
}));

import { InsideLayoutContext } from '../modules/layout/components/InsideLayoutContext';
import ErrorPage from './ErrorPage';

afterEach(cleanup);

describe('ErrorPage', () => {
  it('renders bare under an already-rendered Layout (no second header — APP-443 item 4)', () => {
    render(
      <InsideLayoutContext.Provider value={true}>
        <ErrorPage />
      </InsideLayoutContext.Provider>
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.queryByTestId('own-layout')).toBeNull();
  });

  it('supplies its own Layout when no shell chrome survived the error', () => {
    render(<ErrorPage />);

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByTestId('own-layout')).toBeTruthy();
  });
});
