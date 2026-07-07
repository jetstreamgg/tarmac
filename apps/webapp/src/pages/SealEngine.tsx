import { Layout } from '@/modules/layout/components/Layout';
import { Text, Heading, List } from '@/modules/layout/components/Typography';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { HStack } from '@/modules/layout/components/HStack';
import { AppLink } from '@/lib/navigation';
import { ArrowLeft } from 'lucide-react';
import { SEAL_ENGINE_V1_ADDRESS } from '@/lib/constants';

// Inline monospace token for contract addresses and function names.
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-surface text-textEmphasis rounded px-1 py-0.5 font-mono text-[13px]">{children}</code>
  );
}

const ENGINES = [
  {
    contract: 'LockstakeEngine (v1)',
    address: SEAL_ENGINE_V1_ADDRESS,
    denomination: 'MKR'
  }
];

export function SealEngine() {
  return (
    <Layout>
      <main
        className="scrollbar-hidden bg-container group mx-4 mt-20 mb-10 flex h-auto max-w-[680px] min-w-[375px] flex-col gap-3 overflow-x-hidden overflow-y-auto rounded-t-3xl border bg-blend-overlay backdrop-blur-[50px] md:scrollbar-thin md:rounded-3xl"
        style={{ borderRadius: '1.5rem' }}
      >
        <div className="flex flex-col gap-4 p-8">
          <AppLink to="/" className={'text-textSecondary'}>
            <HStack className="mb-3 space-x-2">
              <ArrowLeft className="self-center" />
              <Heading tag="h3" variant="small" className="text-textSecondary">
                Back to Home Page
              </Heading>
            </HStack>
          </AppLink>

          <Heading tag="h2" className="text-text">
            Withdrawing from the Seal Engine via Etherscan
          </Heading>

          <Text variant="large" className="text-text">
            The Seal Engine UI has been removed from the app. The Seal Engine was deprecated by Sky governance
            on <span className="font-semibold">April 22, 2025</span> (MakerDAO Poll <Code>Qmctp1eN</Code>) and
            replaced by the SKY Staking Engine. Any remaining positions can be withdrawn directly on-chain via
            Etherscan.
          </Text>
          <Text variant="large" className="text-text">
            The on-chain exit fee is <span className="font-semibold">0</span> — users withdraw 100% of their
            position.
          </Text>

          <Heading tag="h3" variant="small" className="text-text mt-2">
            The Seal Engine contract
          </Heading>
          <Text variant="large" className="text-text">
            Positions are held in the LockstakeEngine (v1), denominated in MKR:
          </Text>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-textSecondary/20 border-b">
                <th className="text-textSecondary py-2 pr-4 text-sm font-normal">Contract</th>
                <th className="text-textSecondary py-2 pr-4 text-sm font-normal">Address</th>
                <th className="text-textSecondary py-2 text-sm font-normal">Denomination</th>
              </tr>
            </thead>
            <tbody>
              {ENGINES.map(engine => (
                <tr key={engine.address} className="border-textSecondary/10 border-b align-top">
                  <td className="text-text py-2 pr-4 text-sm">{engine.contract}</td>
                  <td className="py-2 pr-4 text-sm">
                    <ExternalLink
                      href={`https://etherscan.io/address/${engine.address}`}
                      className="text-textEmphasis font-mono text-[13px] break-all"
                    >
                      {engine.address}
                    </ExternalLink>
                  </td>
                  <td className="text-text py-2 text-sm">{engine.denomination}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Heading tag="h3" variant="small" className="text-text mt-2">
            Step 1 — Find your urn and read your position
          </Heading>
          <Text variant="large" className="text-text">
            Each position is held in a per-user &quot;urn&quot; contract. To find yours and check what&apos;s
            locked, you&apos;ll read from both the engine and the underlying Vat contract.
          </Text>
          <Text variant="large" className="text-text">
            On the appropriate engine&apos;s Etherscan page, open{' '}
            <span className="font-semibold">Contract → Read Contract</span>:
          </Text>
          <List variant="ordered" className="text-text">
            <li>
              <Text tag="span" variant="large" className="text-text">
                Call <Code>ownerUrnsCount(&lt;yourAddress&gt;)</Code>. Most users have exactly one urn at
                index <Code>0</Code>. If you have multiple, repeat the withdrawal steps below for each index.
              </Text>
            </li>
            <li>
              <Text tag="span" variant="large" className="text-text">
                Call <Code>ownerUrns(&lt;yourAddress&gt;, &lt;index&gt;)</Code> → returns your{' '}
                <span className="font-semibold">urn address</span>. Save this value.
              </Text>
            </li>
            <li>
              <Text tag="span" variant="large" className="text-text">
                Call <Code>vat()</Code> → returns the <span className="font-semibold">Vat address</span>. Save
                this value.
              </Text>
            </li>
            <li>
              <Text tag="span" variant="large" className="text-text">
                Call <Code>ilk()</Code> → returns the <span className="font-semibold">ilk</span> (bytes32
                identifier). Save this value.
              </Text>
            </li>
            <li>
              <Text tag="span" variant="large" className="text-text">
                Open the <span className="font-semibold">Vat contract</span> on Etherscan at the address from
                step 3, go to <span className="font-semibold">Read Contract</span>, and call{' '}
                <Code>urns(&lt;ilk&gt;, &lt;urnAddress&gt;)</Code> using the values from steps 4 and 2. This
                returns <Code>(ink, art)</Code>:
                <List variant="unordered" className="text-text">
                  <li>
                    <Code>ink</Code> = your locked MKR collateral (18-decimal units)
                  </li>
                  <li>
                    <Code>art</Code> = your outstanding USDS debt (18-decimal units)
                  </li>
                </List>
              </Text>
            </li>
          </List>

          <Heading tag="h3" variant="small" className="text-text mt-2">
            Step 2 — Repay USDS debt (skip if you have no debt)
          </Heading>
          <Text variant="large" className="text-text">
            If <Code>art</Code> from Step 1.5 is non-zero, repay it before withdrawing collateral.{' '}
            <Code>free</Code> will revert otherwise.
          </Text>
          <List variant="ordered" className="text-text">
            <li>
              <Text tag="span" variant="large" className="text-text">
                On the <span className="font-semibold">USDS token contract</span>, call{' '}
                <Code>approve(&lt;engineAddress&gt;, &lt;amount&gt;)</Code> with an amount ≥ your debt. A safe
                choice is <Code>2^256 - 1</Code> (max uint256).
              </Text>
            </li>
            <li>
              <Text tag="span" variant="large" className="text-text">
                On the engine&apos;s <span className="font-semibold">Write Contract</span> tab, call{' '}
                <Code>wipeAll(&lt;yourAddress&gt;, &lt;index&gt;)</Code> to repay the full debt.
              </Text>
            </li>
          </List>

          <Heading tag="h3" variant="small" className="text-text mt-2">
            Step 3 — Withdraw your collateral
          </Heading>
          <Text variant="large" className="text-text">
            On the engine&apos;s <span className="font-semibold">Write Contract</span> tab:
          </Text>
          <pre className="bg-surface text-text overflow-x-auto rounded-lg p-4 font-mono text-[13px]">
            {`free(
  owner: <yourAddress>,
  index: <urnIndex>,
  to:    <yourAddress>,
  wad:   <amountIn18Decimals>
)`}
          </pre>
          <Text variant="large" className="text-text">
            Use the <Code>ink</Code> value from Step 1.5 as <Code>wad</Code> to withdraw everything. Tokens
            are sent directly to the <Code>to</Code> address.
          </Text>

          <Heading tag="h3" variant="small" className="text-text mt-2">
            Notes &amp; gotchas
          </Heading>
          <List variant="unordered" className="text-text">
            <li>
              <Text tag="span" variant="large" className="text-text">
                <Code>wad</Code> values are 18-decimal MKR.
              </Text>
            </li>
            <li>
              <Text tag="span" variant="large" className="text-text">
                <Code>free</Code> reverts if any USDS debt remains — always <Code>wipeAll</Code> first.
              </Text>
            </li>
            <li>
              <Text tag="span" variant="large" className="text-text">
                If <Code>urnFarms(&lt;urnAddress&gt;)</Code> is non-zero, <Code>free</Code> auto-withdraws
                from the farm; no explicit <Code>selectFarm(0x0)</Code> is required.
              </Text>
            </li>
            <li>
              <Text tag="span" variant="large" className="text-text">
                To claim pending rewards before withdrawing, call{' '}
                <Code>getReward(&lt;owner&gt;, &lt;index&gt;, &lt;farm&gt;, &lt;to&gt;)</Code>.
              </Text>
            </li>
            <li>
              <Text tag="span" variant="large" className="text-text">
                Only the position owner can call these functions, unless{' '}
                <Code>hope(&lt;owner&gt;, &lt;index&gt;, &lt;delegate&gt;)</Code> has been set.
              </Text>
            </li>
          </List>

          <Heading tag="h3" variant="small" className="text-text mt-2">
            Support
          </Heading>
          <Text variant="large" className="text-text">
            If you can&apos;t complete the withdrawal, contact support with your wallet address so we can help
            diagnose.
          </Text>
        </div>
      </main>
    </Layout>
  );
}
