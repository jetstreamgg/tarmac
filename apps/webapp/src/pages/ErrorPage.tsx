import React, { useEffect } from 'react';
import { Layout } from '../modules/layout/components/Layout';
import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Heading } from '@/modules/layout/components/Typography';
import { reportError } from '@/modules/sentry/reportError';

function ErrorPage(): React.ReactElement {
  const error = useRouteError();

  useEffect(() => {
    if (!error) return;

    if (isRouteErrorResponse(error)) {
      reportError(new Error(`${error.status} ${error.statusText}`), {
        module: 'ui',
        flow: 'router',
        action: 'load-route',
        type: 'route_error',
        statusCode: error.status,
        extra: {
          routeErrorStatusText: error.statusText
        }
      });
      return;
    }

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

        <Link to="/">
          <Button variant="secondary" className="ml-4 mt-4">
            Back to homepage
          </Button>
        </Link>
      </div>
    </Layout>
  );
}

export default ErrorPage;
