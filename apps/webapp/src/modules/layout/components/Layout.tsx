import React, { useContext } from 'react';
import { Header } from './Header';
import { ConfigContext } from '../../config/context/ConfigContext';
import { ErrorBoundary } from './ErrorBoundary';
import { useConnection } from 'wagmi';
import { AuthWrapper } from './AuthWrapper';
import { VStack } from './VStack';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { UnsupportedNetworkPage } from './UnsupportedNetworkPage';
import { Text } from '@/modules/layout/components/Typography';
import { FooterLinks } from './FooterLinks';
import { useBreakpointIndex, BP } from '@/modules/ui/hooks/useBreakpointIndex';
import { IS_DEVELOPMENT_ENV, IS_STAGING_ENV } from '@/lib/constants';
import { Banner } from '@/components/extensible';

export function Layout({
  children,
  metaDescription
}: {
  children: React.ReactNode;
  metaDescription?: string;
}): React.ReactElement {
  const { siteConfig } = useContext(ConfigContext);
  const { chain } = useConnection();
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const { bpi } = useBreakpointIndex();

  const showEnvInfo = (IS_STAGING_ENV || IS_DEVELOPMENT_ENV) && import.meta.env.VITE_CF_PAGES_COMMIT_SHA;

  const titleContent = `${siteConfig.name} | ${metaDescription || siteConfig.description}`;
  const descriptionContent = metaDescription || siteConfig.description;

  return (
    <div>
      <title>{titleContent}</title>
      <meta name="description" content={descriptionContent} />
      <link rel="icon" href={siteConfig.favicon} />

      <VStack
        className={
          'bg-app-background flex max-h-svh min-h-svh max-w-full items-center overflow-auto bg-cover bg-center bg-no-repeat md:max-h-screen md:min-h-screen md:p-4 md:pb-2'
        }
      >
        <ErrorBoundary>
          <Header />
        </ErrorBoundary>

        <ErrorBoundary>
          {isConnectedAndAcceptedTerms && !chain ? (
            <UnsupportedNetworkPage>{children}</UnsupportedNetworkPage>
          ) : (
            <AuthWrapper>{children}</AuthWrapper>
          )}
        </ErrorBoundary>
        {bpi > BP.sm && <FooterLinks />}
      </VStack>
      <Banner />
      {showEnvInfo && (
        <div className="absolute bottom-0 left-2">
          <Text className="text-xs text-white">{import.meta.env.VITE_CF_PAGES_COMMIT_SHA}</Text>
        </div>
      )}
    </div>
  );
}
