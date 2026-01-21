import { cn } from '@widgets/lib/utils';

const logoMetadata = [
  {
    name: 'upgrade',
    src: '/images/upgrade_icon_large.svg',
    alt: 'Upgrade logo'
  },
  {
    name: 'trade',
    src: '/images/trade_icon_large.svg',
    alt: 'Trade logo'
  },
  {
    name: 'savings',
    src: '/images/savings_icon_large.svg',
    alt: 'Savings logo'
  },
  {
    name: 'rewards',
    src: '/images/rewards_icon.svg',
    alt: 'Rewards logo'
  },
  {
    name: 'staking',
    src: '/images/staking_engine_icon_large.svg',
    alt: 'Staking Engine logo'
  },
  {
    name: 'expert',
    src: '/images/expert_icon_large.svg',
    alt: 'Expert logo'
  }
] as const;

export type LogoName = (typeof logoMetadata)[number]['name'];

export function Logo({ logoName }: { logoName: LogoName }) {
  const logo = logoMetadata.find(({ name }) => name === logoName);
  return logo ? (
    <div>
      <img src={logo.src} alt={`${logoName} logo`} className={cn('logo h-11')} />
    </div>
  ) : null;
}
