import { cn } from '@/lib/utils';

const logoMetadata = [
  {
    name: 'upgrade',
    src: '/images/upgrade_icon_large.svg',
    alt: 'Upgrade logo',
    position: '-bottom-2 -right-5',
    size: 'w-40 2xl:w-48'
  },
  {
    name: 'trade',
    src: '/images/trade_icon_large.svg',
    alt: 'Trade logo',
    position: '-bottom-12 -right-12',
    size: 'w-56 2xl:w-64'
  },
  {
    name: 'savings',
    src: '/images/savings_icon_large.svg',
    alt: 'Savings logo',
    position: '-bottom-5 -right-8',
    size: 'w-50 2xl:w-52'
  },
  {
    name: 'rewards',
    src: '/images/rewards_icon_large.svg',
    alt: 'Rewards logo',
    position: '-bottom-5 -right-12',
    size: 'w-50 2xl:w-56'
  },
  {
    name: 'staking',
    src: '/images/staking_engine_icon_large.svg',
    alt: 'Staking Engine logo',
    position: '-bottom-8 -right-5',
    size: 'w-50 2xl:w-56'
  },
  {
    name: 'expert',
    src: '/images/expert_icon_large.svg',
    alt: 'Expert logo',
    position: '-bottom-4 -right-2',
    size: 'w-48 2xl:w-56'
  }
] as const;

export type LogoName = (typeof logoMetadata)[number]['name'];

export function Logo({ logoName }: { logoName: LogoName }) {
  const logo = logoMetadata.find(({ name }) => name === logoName);
  return logo ? (
    <div className={cn('absolute z-0 overflow-hidden', logo.position)}>
      <img src={logo.src} alt={`${logoName} logo`} className={cn('logo h-auto', logo.size)} />
    </div>
  ) : null;
}
