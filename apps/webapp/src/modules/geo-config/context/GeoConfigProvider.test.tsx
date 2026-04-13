import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGeoConfig } from '../hooks/useGeoConfig';
import { GeoConfig } from '../types';

const mockConfig: GeoConfig = {
  version: '1.0.0',
  countryCode: 'US',
  generatedAt: '2024-01-01T00:00:00Z',
  cacheTtl: 300,
  isRegionRestricted: false,
  modules: {
    savings: { enabled: true },
    rewards: { enabled: true },
    expert: { enabled: true },
    trade: { enabled: true },
    upgrade: { enabled: true },
    seal: { enabled: true }
  },
  chatbot: { enabled: true },
  isCookiesBannerRequired: false
};

const routerListeners = new Set<() => void>();
const mockRouter = {
  state: {
    location: {
      search: ''
    }
  },
  subscribe: (listener: () => void) => {
    routerListeners.add(listener);
    return () => routerListeners.delete(listener);
  }
};

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: mockConfig,
    isLoading: false,
    error: null
  })
}));

vi.mock('@/lib/constants', () => ({
  IS_PRODUCTION_ENV: false
}));

vi.mock('@/pages/router', () => ({
  router: mockRouter
}));

const { GeoConfigProvider } = await import('./GeoConfigProvider');

const GeoConfigProbe = () => {
  const { isRegionRestricted, isModuleEnabled } = useGeoConfig();

  return (
    <>
      <div data-testid="restricted">{String(isRegionRestricted)}</div>
      <div data-testid="savings">{String(isModuleEnabled('savings'))}</div>
    </>
  );
};

describe('GeoConfigProvider', () => {
  beforeEach(() => {
    mockRouter.state.location.search = '';
    routerListeners.clear();
  });

  it('recomputes geo overrides when the router search changes', () => {
    render(
      <GeoConfigProvider>
        <GeoConfigProbe />
      </GeoConfigProvider>
    );

    expect(screen.getByTestId('restricted').textContent).toBe('false');
    expect(screen.getByTestId('savings').textContent).toBe('true');

    act(() => {
      mockRouter.state.location.search = '?geo_mode=restricted&geo_module_savings=true';
      routerListeners.forEach(listener => listener());
    });

    expect(screen.getByTestId('restricted').textContent).toBe('true');
    expect(screen.getByTestId('savings').textContent).toBe('true');

    act(() => {
      mockRouter.state.location.search = '';
      routerListeners.forEach(listener => listener());
    });

    expect(screen.getByTestId('restricted').textContent).toBe('false');
    expect(screen.getByTestId('savings').textContent).toBe('true');
  });
});
