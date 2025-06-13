import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from './Layout';
import { Heading, Text } from './Typography';
import { Button } from '@/components/ui/button';
import { NoResults } from '@jetstreamgg/sky-widgets';

export function NotFound() {
  const navigate = useNavigate();

  useEffect(() => {
    setTimeout(() => {
      navigate('/');
    }, 5000);
  }, [navigate]);

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
          <Button variant="primary" className="mt-6 self-center px-6 py-4" onClick={() => navigate('/')}>
            Go to Homepage
          </Button>
        </div>
      </div>
    </Layout>
  );
}
