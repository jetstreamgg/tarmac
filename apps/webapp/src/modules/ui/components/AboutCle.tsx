import { Trans } from '@lingui/react/macro';
import { AboutCard } from './AboutCard';

export const AboutCle = () => {
  return (
    <AboutCard
      title={<Trans>Chronicle</Trans>}
      tokenSymbol="CLE"
      description={
        <Trans>
          Chronicle Points are not a native feature of the Sky Protocol. Skybase International does not
          control or guarantee the availability, distribution or allocation of Chronicle Points or any other
          Chronicle funds. The Chronicle project operates independently of Sky.money and Skybase
          International. Please be aware that any engagement with Chronicle is at your own risk, and we bear
          no responsibility for any outcomes associated with this third-party system, or any funds associated
          with it.
        </Trans>
      }
      linkHref="https://chroniclelabs.org/"
      linkLabel={<Trans>View Chronicle</Trans>}
      colorMiddle="linear-gradient(43deg, #2FD05B -2.45%, #129837 100%)"
    />
  );
};
