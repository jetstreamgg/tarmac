import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Layout } from './Layout';
import { Heading, Text } from './Typography';
import { Button } from '@/components/ui/button';
import { NoResults } from '@/widgets';
import { trackRouteRedirected } from '@/modules/analytics/lib/trackRouteRedirected';
import { trackNotFoundViewed } from '@/modules/analytics/lib/trackAmbientSurfaces';

export function NotFound() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });

  useEffect(() => {
    trackNotFoundViewed({ path: pathname });
  }, [pathname]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      // The auto-redirect otherwise hides 404s as home traffic (APP-444 A7).
      trackRouteRedirected({ fromPath: pathname, toPath: '/', reason: 'not_found' });
      navigate({ to: '/' });
    }, 5000);
    return () => window.clearTimeout(timeoutId);
  }, [navigate, pathname]);

  return (
    <Layout>
      <div className="-mt-16 flex w-full grow flex-col items-center justify-center text-center">
        <div className="bg-container flex max-w-[450px] flex-col items-center gap-3 rounded-3xl border px-12 py-8 bg-blend-overlay backdrop-blur-[50px]">
          <NoResults className="h-24 w-24" />
          <Heading tag="h3" variant="medium" className="tracking-[0.0125em]">
            Page not found
          </Heading>
          <div>
            <Heading tag="h1" variant="large" className="text-[32px] leading-9 tracking-[0.008em]">
              Lost in the Sky?
            </Heading>
            <Text variant="large" className="text-text/65">
              Seems like you&apos;ve ventured into the unknown.
            </Text>
          </div>
          <Text variant="large" className="text-text/65 mt-3">
            Click the button to find your way back (you will be redirected to the homepage in 5 seconds).
          </Text>
          <Button
            variant="primary"
            className="mt-6 self-center px-6 py-4"
            onClick={() => navigate({ to: '/' })}
          >
            Go to Homepage
          </Button>
        </div>
      </div>
    </Layout>
  );
}
