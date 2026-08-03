import React, { useContext, useEffect } from 'react';
import { Layout } from '../modules/layout/components/Layout';
import { InsideLayoutContext } from '../modules/layout/components/InsideLayoutContext';
import { AppLink } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { Heading } from '@/modules/layout/components/Typography';
import { reportError } from '@/modules/sentry/reportError';

function ErrorPage({ error }: { error?: unknown }): React.ReactElement {
  // Route-level errors surface inside the shell's Layout (header included);
  // wrapping again there would draw the header twice. Only a boundary above the
  // shell — where no chrome survived the error — supplies its own Layout.
  const insideLayout = useContext(InsideLayoutContext);

  useEffect(() => {
    if (!error) return;

    reportError(error, {
      module: 'ui',
      flow: 'router',
      action: 'load-route',
      type: 'route_error'
    });
  }, [error]);

  const content = (
    <div className="my-6 text-center">
      <Heading variant="large">Something went wrong</Heading>

      <AppLink to="/">
        <Button variant="secondary" className="mt-4 ml-4">
          Back to homepage
        </Button>
      </AppLink>
    </div>
  );

  return insideLayout ? content : <Layout>{content}</Layout>;
}

export default ErrorPage;
