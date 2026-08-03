import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider
} from '@tanstack/react-router';
import { I18nWidgetProvider } from '@/widgets/context/I18nWidgetProvider';
import { Text } from '@/widgets/shared/components/ui/Typography';
import { InteractiveStatsCardAlt } from './InteractiveStatsCardAlt';

function renderCard(props: Partial<React.ComponentProps<typeof InteractiveStatsCardAlt>> = {}) {
  const rootRoute = createRootRoute({
    component: () => (
      <InteractiveStatsCardAlt
        title="Supplied to Savings"
        logoName="savings"
        icon={<span />}
        content={<Text>100 USDS</Text>}
        {...props}
      />
    )
  });
  const stubRoute = (path: string) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null });
  const router = createRouter({
    routeTree: rootRoute.addChildren([stubRoute('/'), stubRoute('/savings')]),
    history: createMemoryHistory({ initialEntries: ['/'] })
  });

  render(
    <I18nWidgetProvider locale="en">
      <RouterProvider router={router as never} />
    </I18nWidgetProvider>
  );
}

describe('InteractiveStatsCardAlt', () => {
  it('renders the APY badge when a rate is provided', async () => {
    renderCard({ apyBadge: 'Rate: 4.5%' });

    const badge = await screen.findByTestId('asset-apy-badge');
    expect(badge.textContent).toContain('Rate: 4.5%');
  });

  it('omits the APY badge without a rate', async () => {
    renderCard();
    await screen.findByText('100 USDS');
    expect(screen.queryByTestId('asset-apy-badge')).toBeNull();
  });

  it('reveals a Start earning link into the module when a url is provided', async () => {
    renderCard({ url: '/savings' });

    const cta = await screen.findByTestId('start-earning-cta');
    expect(cta.getAttribute('href')).toBe('/savings');
  });

  it('omits the Start earning link without a url', async () => {
    renderCard();
    await screen.findByText('100 USDS');
    expect(screen.queryByTestId('start-earning-cta')).toBeNull();
  });
});
