import React, { useEffect } from 'react';
import { Layout } from '../modules/layout/components/Layout';
import { AppLink } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { Heading } from '@/modules/layout/components/Typography';
import { reportError } from '@/modules/sentry/reportError';

function ErrorPage({ error }: { error?: unknown }): React.ReactElement {
  useEffect(() => {
    if (!error) return;

    reportError(error, {
      module: 'ui',
      flow: 'router',
      action: 'load-route',
      type: 'route_error'
    });
  }, [error]);

  return (
    <Layout>
      <div className="my-6 text-center">
        <Heading variant="large">Something went wrong</Heading>

        <AppLink to="/">
          <Button variant="secondary" className="mt-4 ml-4">
            Back to homepage
          </Button>
        </AppLink>
      </div>
    </Layout>
  );
}

export default ErrorPage;
