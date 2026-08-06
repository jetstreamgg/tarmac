import { Trans } from '@lingui/react/macro';
import { useIsTouchDevice } from '@/hooks';
import { HeaderBadge } from '@/components/ui/page-header';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { IllustrationStaked } from '@/modules/icons';
import { protocolStartYear, yearsOperating } from '../helpers/protocolStats';

/**
 * The lineage the "Operating for N years" claim rests on (APP-432 item 3
 * thread). Copy is the legal-reviewed line: it deliberately avoids counting
 * years a second time, so only the badge label has to move each anniversary.
 * The year interpolates from `PROTOCOL_START` for the same reason the subtitle
 * does — badge, subtitle and tooltip can then never disagree.
 */
const LINEAGE_COPY = (
  <Trans>
    Sky Protocol is MakerDAO&apos;s continuation — running decentralized stablecoin infrastructure since{' '}
    {protocolStartYear}.
  </Trans>
);

/**
 * Hover affordance on a badge the DS draws borderless: a ring in the glass
 * border token rather than a fill change, since the pill's `glassBadge` fill
 * has no hover value in either theme.
 */
const TRIGGER_CLASSES =
  'hover:ring-glassBorder focus-visible:ring-ring inline-flex cursor-default rounded-full transition-shadow hover:ring-1 hover:ring-inset focus-visible:ring-1 focus-visible:outline-hidden';

/**
 * Opens *above* the badge, against the hero's empty top padding — every other
 * app tooltip opens below its trigger, but this one would then sit on the 44px
 * hero heading, and the DS surface is glass: 40% white over blur(20px) in
 * light, 10% lavender in dark. Blurring display type doesn't hide it, it
 * averages it, so the card picked up a grey cast in light and washed out in
 * dark — visibly unlike every other tooltip in the app. Deepening the blur
 * can't fix a luminance difference (100px and 300px were both still grey); a
 * clean backdrop can, and above the badge there is one.
 */
const SIDE = 'top';

/**
 * The Earn hero's years badge (5031:52321), carrying the Maker/DAI lineage on
 * hover. Tooltip from a pointer, tap-open popover on touch (Radix force-closes
 * tooltips there) — the same split `InfoTooltip` makes.
 */
export function ProtocolLineageBadge() {
  const isTouchDevice = useIsTouchDevice();
  // Whole years only tick over on an anniversary, so one read per mount is
  // plenty — and it keeps the label stable across re-renders.
  const years = String(yearsOperating());

  // Accessible name comes from the badge's own text, so the trigger carries no
  // aria-label that would shadow it.
  const trigger = (
    <HeaderBadge icon={<IllustrationStaked boxSize={16} />}>
      <Trans>Operating for {years} years</Trans>
    </HeaderBadge>
  );

  if (isTouchDevice) {
    return (
      <Popover>
        <PopoverTrigger className={TRIGGER_CLASSES}>{trigger}</PopoverTrigger>
        {/* Touch fallback mirrors the DS tooltip chrome (Figma 5043:57748). */}
        <PopoverContent
          align="center"
          side={SIDE}
          className="bg-bgTertiary text-fgPrimary font-graphik w-auto max-w-[260px] rounded-2xl text-[11px] leading-4 font-normal backdrop-blur-[20px]"
        >
          <p>{LINEAGE_COPY}</p>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    // Own provider (same 300ms delay as the app root's, which nests harmlessly
    // under it) so the badge is self-contained on any surface — page, tests —
    // with no host setup. Same precedent as RiskTierDetailsTrigger.
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className={TRIGGER_CLASSES}>
            {trigger}
          </button>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent side={SIDE}>
            <p>{LINEAGE_COPY}</p>
          </TooltipContent>
        </TooltipPortal>
      </Tooltip>
    </TooltipProvider>
  );
}
