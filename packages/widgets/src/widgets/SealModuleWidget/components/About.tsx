import { InfoTooltip } from '@widgets/shared/components/ui/tooltip/InfoTooltip';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { Trans } from '@lingui/react/macro';

export const About = () => {
  return (
    <div className="mb-4">
      <Heading variant="medium">
        <Trans>About the Seal Engine</Trans>
      </Heading>
      <Text className="mt-4">
        <Trans>The MKR and or SKY tokens you supply to the Seal Engine are sealed behind an exit fee</Trans>{' '}
        <InfoTooltip
          content={
            <>
              <Text>
                When you supply MKR or SKY to the Seal Engine, a position is created and those tokens are
                sealed behind an exit fee. You can seal and unseal your tokens anytime.
              </Text>
              <br />
              <Text>
                Unsealing requires the payment of an exit fee, which is a percentage of the total amount of
                tokens that you have sealed in that position. The fee is automatically subtracted from that
                total amount, and then burnt, removing the tokens from circulation. Your accumulated rewards
                are not affected.
              </Text>
              <br />
              <Text>
                The exit fee is a risk parameter managed and determined (regardless of position duration) by
                Sky ecosystem governance. The exit fee applies at unsealing, not at sealing, which means that
                it is determined the moment you unseal your MKR.
              </Text>
              <br />
            </>
          }
          contentClassname="max-w-[400px]"
        />{' '}
        <Trans>
          in order to provide access to Seal Rewards and encourage a deeper commitment to Sky ecosystem
          governance.
        </Trans>
      </Text>
      <Text className="mt-4">
        <Trans>
          Your sealed tokens enable you to create one or more positions through which you access rewards. You
          can:
        </Trans>
      </Text>

      <ol className="mt-4 list-outside list-decimal space-y-2 pl-4">
        <li>
          <Text tag="span">
            <Trans>Borrow USDS against your MKR and SKY</Trans>{' '}
            <InfoTooltip
              contentClassname="max-w-[400px]"
              content="Borrowing against your sealed position carries the risk of automatic liquidation without any possibility of recourse if at any time the value of your sealed collateral drops below the required threshold and your position becomes undercollateralised. Please ensure you fully understand these risks before proceeding."
            />{' '}
          </Text>
        </li>
        <li>
          <Text tag="span">
            <Trans>Transfer the voting power of your MKR and SKY tokens to a recognized delegate</Trans>{' '}
            <InfoTooltip
              content={
                <Text>
                  When you hold MKR or SKY tokens, you maintain the right to participate in the process of Sky
                  ecosystem governance voting. That means that you have the ability to contribute to the
                  community-driven, decentralised ecosystem decision-making process, which occurs through
                  onchain voting.
                  <br />
                  <br />
                  The voting power delegation feature of the Seal Engine of the Sky Protocol enables you to
                  entrust your voting power to a delegate of your choosing, who can then vote in the Sky
                  ecosystem governance process on your behalf. You can choose one delegate per sealed MKR or
                  SKY position. If you want to entrust your MKR or SKY to two delegates using the Seal Engine,
                  you will need to create two separate positions.
                  <br />
                  <br />
                  Delegates in receipt of token voting power can never directly access any tokens delegated to
                  them, including sealed tokens. Throughout the delegation process, you always own and are in
                  control of your sealed tokens, and you can change your delegate at any time.Sealing to
                  delegate your voting power may be a useful option for governance token holders who have
                  limited time to allocate to the process, who want to save on the cost of gas involved in
                  voting on their own, and who also want to earn Seal Rewards.
                </Text>
              }
              contentClassname="max-w-[600px]"
            />{' '}
            <Trans>or a contract that you own</Trans>
          </Text>
        </li>
        <li>
          <Text tag="span">
            <Trans>Seal your tokens and continue to collect rewards</Trans>
          </Text>
        </li>
      </ol>
      <Text className="mt-4">
        <Trans>
          Your MKR and SKY tokens, as well as any rewards that you accumulate, are supplied to a non-custodial
          smart contract, such that no intermediary takes custody of those tokens. With Sky, you always remain
          in control of your assets.
        </Trans>
      </Text>
    </div>
  );
};
