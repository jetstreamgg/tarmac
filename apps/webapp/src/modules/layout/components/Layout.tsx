import React, { useContext } from 'react';
import { Header } from './Header';
import { ConfigContext } from '../../config/context/ConfigContext';
import { ErrorBoundary } from './ErrorBoundary';
import { useAccount } from 'wagmi';
import { AuthWrapper } from './AuthWrapper';
import { VStack } from './VStack';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { UnsupportedNetworkPage } from './UnsupportedNetworkPage';
import { Text } from '@/modules/layout/components/Typography';
import { FooterLinks } from './FooterLinks';
import { useBreakpointIndex, BP } from '@/modules/ui/hooks/useBreakpointIndex';

export function Layout({
  children,
  metaDescription
}: {
  children: React.ReactNode;
  metaDescription?: string;
}): React.ReactElement {
  const { siteConfig } = useContext(ConfigContext);
  const { chain } = useAccount();
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const { bpi } = useBreakpointIndex();

  const showEnvInfo =
    (import.meta.env.VITE_ENV_NAME === 'staging' || import.meta.env.VITE_ENV_NAME === 'development') &&
    import.meta.env.VITE_CF_PAGES_COMMIT_SHA;

  const titleContent = `${siteConfig.name} | ${metaDescription || siteConfig.description}`;
  const descriptionContent = metaDescription || siteConfig.description;

  return (
    <div>
      <title>{titleContent}</title>
      <meta name="description" content={descriptionContent} />
      <link rel="icon" href={siteConfig.favicon} />

      {/* Open Graph Tags */}
      <meta property="og:title" content={titleContent} />
      <meta property="og:description" content={descriptionContent} />
      <meta property="og:image" content={`${window.location.origin}/images/social_media_image.png`} />
      <meta property="og:url" content={window.location.href} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteConfig.name} />

      {/* Twitter Card Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={titleContent} />
      <meta name="twitter:description" content={descriptionContent} />
      <meta name="twitter:image" content={`${window.location.origin}/images/social_media_image.png`} />

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
      {showEnvInfo && (
        <div className="absolute bottom-0 left-2">
          <Text className="text-xs text-white">{import.meta.env.VITE_CF_PAGES_COMMIT_SHA}</Text>
        </div>
      )}
    </div>
  );
}
