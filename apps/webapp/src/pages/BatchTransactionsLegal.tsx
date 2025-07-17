import { Layout } from '@/modules/layout/components/Layout';
import { Text, Heading } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { HStack } from '@/modules/layout/components/HStack';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function BatchTransactionsLegal() {
  return (
    <Layout>
      <main
        className="scrollbar-hidden md:scrollbar-thin bg-container group mx-4 mt-20 flex h-auto min-w-[375px] max-w-[480px] flex-col gap-3 overflow-y-auto overflow-x-hidden rounded-t-3xl border bg-blend-overlay backdrop-blur-[50px] md:flex-row md:overflow-hidden md:rounded-3xl md:p-3 md:pr-0.5"
        style={{ borderRadius: '1.5rem' }}
      >
        <div className="flex flex-col gap-4 p-8">
          <Link to="/" className={'text-textSecondary'}>
            <HStack className="mb-3 space-x-2">
              <ArrowLeft className="self-center" />
              <Heading tag="h3" variant="small" className="text-textSecondary">
                <Trans>Back to Home Page</Trans>
              </Heading>
            </HStack>
          </Link>
          <Heading tag="h2" className="text-text">
            <Trans>Legal Notice</Trans>
          </Heading>
          <Text variant="medium" className="text-text">
            <Trans>
              Please note that all security checks, user confirmations, and error handling are managed by your
              chosen wallet&apos;s delegate contract. As outlined in our{' '}
              <ExternalLink
                showIcon={false}
                href="https://docs.sky.money/legal-terms"
                className="text-textEmphasis"
              >
                Terms of Use
              </ExternalLink>
              , your use of a non-custodial digital wallet—including wallets supporting EIP-7702 and smart
              account functionality—is governed by the terms of service of your third-party wallet provider.
              We do not control or take responsibility for the security, functionality, or behavior of
              third-party wallets, including their handling of bundled transactions or delegate contracts. To
              ensure a secure and transparent experience, please ensure you are using a trusted and up-to-date
              wallet before proceeding.
            </Trans>
          </Text>
        </div>
      </main>
    </Layout>
  );
}
